"""Space Derelict — Full graphical game using pygame + pygame_gui.

State machine drives screens: MainMenu → SectorMap → Combat → PostCombat → Hub → (loop).
All game logic comes from space_derelict.model (zero duplication).
"""

import pygame
import pygame_gui
from enum import Enum, auto
from typing import Optional, Tuple, List, Dict
import os
import sys
import random
import json
from pathlib import Path
import math  # for ship travel angle and trail calculations
from collections import deque, defaultdict  # for map layout depth calculation

from space_derelict.model import (
    Ship, Cell, CellType, CellState, DamageType, Resources, Chunk, SectorNode,
    make_starter_player_ship, generate_sector, generate_branching_sector, get_node_enemy, get_random_dev_ship,
    resolve_combat_turn, get_active_threats, apply_player_graft_bonuses, execute_player_attack,
    get_player_weapons, WEAPON_DAMAGE_MAP, WEAPON_PROFILES,
    COMPONENT_KINDS, ARTIFACT_KINDS,
    load_meta, save_meta,
    get_available_contracts, evaluate_contracts,
    STARTING_FRAMES,
    roll_random_event,
    Cell, CellType, CellState, STARTING_FRAMES,
    FACTIONS, AGGRESSION_MAX, get_faction_aggression, gain_faction_aggression, get_maxed_factions, is_max_aggression,
    META_PATH,
    get_tube_reveal_text,
    save_ship_to_json, load_ship_from_json,
    extract_brutal_moments,
)
from space_derelict.graphics import TILE_SIZE
from space_derelict.tiles import ShipTileRenderer, FACTION_TILESET
from space_derelict.hub_progression import (
    FEAST_TREE, FEAST_TREE_BY_ID, get_feast_tree_status,
    RATINGS_UPGRADES, RATINGS_UPGRADES_BY_ID, get_available_ratings_upgrades,
    DISTRICT_GATES, can_enter_district,
    HubCooldowns, calculate_launch_bonuses,
    RUN_MORALE_UPGRADES, RUN_MORALE_UPGRADES_BY_KEY, get_available_run_morale_upgrades, get_run_upgrade_prereq_str,
)

# Logging is normally set up by the launcher (run_graphical.py), but be defensive.
try:
    from space_derelict.logging_setup import get_logger, shutdown_logging
except Exception:
    import logging as _logging
    def get_logger(name="space_derelict"):
        return _logging.getLogger(name)
    def shutdown_logging():
        pass


# ─── Constants ───────────────────────────────────────────────────────────────

WINDOW_W, WINDOW_H = 1280, 800
FPS = 60

# Colors (dark sci-fi palette)
COL_BG = (12, 12, 20)
COL_PANEL = (20, 22, 35)
COL_PANEL_BORDER = (50, 55, 80)
COL_TEXT = (200, 210, 230)
COL_TEXT_DIM = (120, 130, 150)
COL_ACCENT = (80, 200, 255)
COL_DANGER = (255, 80, 80)
COL_SUCCESS = (80, 255, 120)
COL_GOLD = (255, 200, 60)
COL_HIGHLIGHT = (255, 255, 100, 120)

# ─── Planets asset pack for sector map / flight path visuals ─────────────────
# Wired for the branching sector map (SectorMapScreen) so each destination node
# has a thematic planet/moon/phenomenon icon based on faction + node index.
# The pack provides 48x48 / 64x64 icons across many categories.
PLANETS_DIR = Path("asset packs") / "PlanetsFull"

FACTION_PLANET_CATS: dict[str, list[str]] = {
    "raider": ["Rocky", "Barren_or_Moon", "Asteroids", "Desert_or_Martian", "Lava", "Asteroid_belts"],
    "techopuritan": ["Tech", "Dyson_sphere(overlay_over_a_sun!)", "Suns", "Black_holes", "Quasars"],
    "felonia": ["Terran_or_Earth-like", "Forest_or_Jungle_or_Swamp", "Ocean", "Tundra"],
    "confederacy": ["Terran_or_Earth-like", "Ice_or_Snow", "Rocky", "Barren_or_Moon"],
    "pop_fiz": ["Gas_Giant_or_Toxic", "Lava", "Comets", "Nebulae", "Asteroid_belts", "Supernova"],
}

_bg_cache: Dict[str, pygame.Surface] = {}

def _draw_screen_bg(surface: pygame.Surface, image_name: str, overlay_alpha: int = 120):
    """Load, cache and blit a background image with a dark overlay for UI readability."""
    global _bg_cache
    if image_name not in _bg_cache:
        path = os.path.join("assets", "ui", image_name)
        if not os.path.exists(path):
            return False
        try:
            img = pygame.image.load(path).convert()
            _bg_cache[image_name] = pygame.transform.smoothscale(img, (WINDOW_W, WINDOW_H))
        except Exception:
            return False
    surface.blit(_bg_cache[image_name], (0, 0))
    if overlay_alpha > 0:
        ov = pygame.Surface((WINDOW_W, WINDOW_H), pygame.SRCALPHA)
        ov.fill((10, 10, 20, overlay_alpha))
        surface.blit(ov, (0, 0))
    return True


def get_planet_icon(node, node_idx: int, size: int = 44) -> pygame.Surface:
    """Return a consistently chosen, scaled planet icon for a sector node.
    Deterministic so the same node always looks the same during a run.
    Uses faction + node name/risk/diff for thematic matching (black holes for risky tech, etc).
    """
    faction = getattr(node, 'enemy_faction', 'raider')
    cats = list(FACTION_PLANET_CATS.get(faction, FACTION_PLANET_CATS["raider"]))
    name = (getattr(node, 'name', '') + ' ' + getattr(node, 'risk_notes', '')).lower()
    diff = getattr(node, 'difficulty', 1)

    # Bias toward dramatic / fitting visuals
    if 'black' in name or 'crusade' in name or (faction == 'techopuritan' and diff >= 3):
        if 'Black_holes' in cats:
            cats = ['Black_holes'] + cats
    if 'sun' in name or 'star' in name or 'quasar' in name:
        if 'Suns' in [c for c in cats if 'Sun' in c or 'Quasar' in c]:  # loose
            pass
    if 'nebula' in name or 'gas' in name:
        if 'Nebulae' in cats or 'Gas_Giant_or_Toxic' in cats:
            cats = ['Nebulae', 'Gas_Giant_or_Toxic'] + cats

    cat = cats[node_idx % len(cats)]
    folder = PLANETS_DIR / cat
    if not folder.exists():
        folder = PLANETS_DIR / "Rocky"
    try:
        pngs = sorted([p for p in folder.iterdir() if p.suffix.lower() == ".png"])
        if not pngs:
            raise FileNotFoundError
        # deterministic pick within category
        pick = (node_idx * 13 + hash(faction) % 17 + hash(cat) % 5) % len(pngs)
        path = pngs[pick]
        surf = pygame.image.load(str(path)).convert_alpha()
        surf = pygame.transform.smoothscale(surf, (size, size))
        return surf
    except Exception:
        # fallback colored rect
        surf = pygame.Surface((size, size), pygame.SRCALPHA)
        surf.fill((90, 90, 110))
        return surf

# Home Base "Graftyard City" map - distinct locations for the stage between runs.
# Each location has flavor, interactions, and a conceptual background image slot.
# Images will be generated later; for now we use themed solid colors + text overlays
# and render as if the image exists. Player "moves" between locations for different
# meta/story interactions. This makes the city feel like a real town/stage set.
GRAFTYARD_LOCATIONS = {
    "plaza": {
        "name": "Central Plaza",
        "short": "The heart of the show",
        "desc": "Giant holo-screens replay the best carnage from across the rim. A massive statue of a legendary predator looms over the square. Crowds of thrill-seekers, sponsors, and other monsters mill about. This is where you decide your next season's body and contracts, then launch into the void.",
        "bg_color": (15, 18, 30),  # dark plaza with neon glow
        "image_hint": "Wide establishing shot of a neon-drenched city square at night. Massive curved screens showing blurry ship combat footage and replays, grotesque alien crowd cheering on balcony, central heroic statue of a frankenstein ship with claws and recent 'offerings' at base, rain-slick streets, producers in suits networking, distant vats glowing, audience holding signs with predator names."
    },
    "vats": {
        "name": "The Clone Vats",
        "short": "Choose your body",
        "desc": "Rows of glowing tanks where new 'you's are grown. Different templates float in nutrient fluid — some sleek and predatory, others bulky or weirdly organic. Producers and vat-techs watch from catwalks. This is the core meta choice: pick your starting frame for the season.",
        "bg_color": (25, 30, 40),
        "image_hint": "Interior of a high-tech vat lab at night. Multiple large cylindrical tanks with silhouetted different monster bodies (sleek predator, bulky siege, chaotic reef Pop Fiz, glowing volatile) in green-blue fluid. Catwalks full of grotesque producers and sponsors watching the choice. Pipes, monitoring screens with 'birth' telemetry, dim dramatic lighting mixed with spotlights on the 'selected' tank. Alien vat-techs, a small audience area, one tank bubbling with 'test sim' activity, horror flavor from empty/cracked tanks."
    },
    "contracts": {
        "name": "Contract Office",
        "short": "Televised demands",
        "desc": "The Producers' Board. Holo-contracts scroll with the audience's current bloodthirsty requests. Completing these during your run earns bonus Ratings and gets your highlights aired on prime-time back home. The contracts change based on what the crowd wants to see.",
        "bg_color": (20, 15, 25),
        "image_hint": "Corporate boardroom crossed with a TV studio. Large wall of floating holo-screens showing brutal contract briefs (e.g. 'Purge Felonia Pride', 'Shatter Quota'), executive producers in suits with alien features watching a predator, betting terminals with live odds, a big 'LIVE AUDIENCE DEMAND' ticker scrolling, a small stage area for pitching ideas, security drones, dark red accent lighting, the sense that every word is being broadcast to the Graftyard."
    },
    "entertainment": {
        "name": "Entertainment Pits",
        "short": "Watch the show",
        "desc": "The rowdy heart of the audience experience. Replays of famous (and infamous) runs play on loop. You can relive your own highlights for a morale boost or small ratings insight. This is where the story of your infamy is celebrated — or mocked.",
        "bg_color": (30, 20, 15),
        "image_hint": "Underground arena/pit with tiered seating full of cheering grotesque spectators. Central holo-stage replaying ship combat footage with dramatic slow-mo explosions. Betting kiosks, spilled drinks, a big 'HALL OF INFAMY' wall of past predators."
    },
    "feast": {
        "name": "Feast Hall",
        "short": "Process the catch",
        "desc": "Where the real feasting happens. Long tables, processing vats, the smell of biomass. Spending Feast here improves your clone line for future seasons. It's equal parts celebration and grim necessity — the captured become the next generation of entertainment.",
        "bg_color": (25, 22, 18),
        "image_hint": "Grimy but opulent banquet hall. Long metal tables, vats bubbling with green slurry, chains and hooks on the walls, a mix of elegant alien elites and rough predators eating. Warm orange lighting, steam, some 'guests' still in cages in the background for tone."
    },
    "market": {
        "name": "Graft Market",
        "short": "Practical business",
        "desc": "The working part of the city. Scrap dealers, armorers, vat-techs. The market stocks specific components and artifacts (from the full diversity pool) that you can buy with scrap from destroyed ships. Purchases carry to your next launched run.",
        "bg_color": (18, 22, 28),
        "image_hint": "Bustling open-air market under a dome. Stalls selling scrap, spare parts, glowing artifacts in crates, repair rigs, rough-looking traders. Dim industrial lighting mixed with colorful vendor signs. Your ship might be visible in the background being worked on."
    },
    "lounge": {
        "name": "Producers' Lounge",
        "short": "High-infamy deals",
        "desc": "Exclusive lounge for predators with real Ratings clout. Here the big permanent upgrades, district unlocks, and special hype contracts are offered directly by the executives. The tone is slick, corporate, and slightly menacing. This is where the real power in the show lives.",
        "bg_color": (12, 15, 22),
        "image_hint": "Luxurious but sinister VIP lounge. Dark wood and chrome, floor-to-ceiling windows overlooking the city and vats, well-dressed alien producers with drinks, private screens showing classified run data, a sense of wealth and control. Subtle security drones."
    }
}


class GameState(Enum):
    MAIN_MENU = auto()
    SECTOR_MAP = auto()
    COMBAT = auto()
    POST_COMBAT = auto()
    HUB = auto()
    GAME_OVER = auto()


class Game:
    """Main game controller with state machine."""

    def __init__(self):
        pygame.init()
        try:
            pygame.mixer.init()  # audio hooks ready for future sfx (no current assets)
        except Exception:
            get_logger().warning("pygame.mixer.init failed (no audio)")
        self.screen = pygame.display.set_mode((WINDOW_W, WINDOW_H))
        pygame.display.set_caption("Space Derelict")
        self.clock = pygame.time.Clock()

        # pygame_gui manager
        self.ui_manager = pygame_gui.UIManager((WINDOW_W, WINDOW_H), 
                                               os.path.join(os.path.dirname(__file__), "theme.json")
                                               if os.path.exists(os.path.join(os.path.dirname(__file__), "theme.json"))
                                               else None)

        # Tile renderer (loads all tileset spritesheets)
        self.tile_renderer = ShipTileRenderer()
        self.tile_renderer.load_all()

        # Fonts (shared)
        self.font_sm = pygame.font.SysFont("consolas", 13)
        self.font = pygame.font.SysFont("consolas", 16)
        self.font_bold = pygame.font.SysFont("consolas", 16, bold=True)

        # Game state
        self.state = GameState.MAIN_MENU
        self.running = True

        # Session data
        self.player_ship: Optional[Ship] = None
        self.enemy_ship: Optional[Ship] = None
        self.resources = Resources()
        self.run_morale: int = 65  # run-only moral points (from live captures/disable; lose on back; spend on temp tree)
        # Run-only morale upgrade tree (temp this run only; ported from terminal for parity)
        self.run_upgrades: set[str] = set()
        self.run_backtrack_cost: int = 25
        self.run_morale_gain_mult: float = 1.0
        self.run_ratings_mult: float = 0.0
        self.run_visited: set[int] = set()
        self.sector: List[SectorNode] = []
        self.sector_connections: Dict[int, List[int]] = {}
        self.current_node_idx: int = 0
        self.fight_num: int = 0
        self.combat_log: List[str] = []
        self.unlocks: set = set()
        self.season: int = 1
        self.career: dict = {"total_ratings_earned": 0, "seasons_completed": 0, "high_score": 0}

        # Hub progression: per-visit cooldowns (reset each time you enter the hub)
        self.hub_cooldowns = HubCooldowns()

        # Contracts system: picked at the home base "stage" before a season. "Horrific acts" demanded by the televised audience.
        self.active_contracts: List[dict] = []   # e.g. [{"id": "felonia_purge"}]
        # Market / shop: stock of specific components and artifacts for scrap trade. Generated when visiting market.
        self.market_stock: list[dict] = []
        # Purchased addons from market that will be applied to the ship on next launch (so buys actually give you the parts for the run).
        self.market_purchases: list[dict] = []  # e.g. [{"type": "component", "kind": "laser"}, {"type": "artifact", "kind": "scatter"}]
        # Stats accumulated during a season for contract evaluation + story drip on return to city.
        self.season_stats: dict = {
            "factions_defeated": {},
            "shattered_count": 0,
            "techopuritan_cleared": 0,
            "total_destroyed": 0,
            "spectacle_count": 0,
            "fights": 0,
            "avg_destroyed_ratio": 0.0,
            "clean_sweeps": 0,
            "genocide_progress": 0,
        }
        self.just_returned_from_combat: bool = False

        # Random faction stop events (en route to nodes)
        self.current_random_event: dict | None = None
        self.pending_event_node: SectorNode | None = None

        # Load persistent meta (ratings, unlocks, career) so graphical continues from terminal or prior graphical runs
        try:
            meta_res, meta_unlocks, meta_career = load_meta()
            self.resources = meta_res
            self.unlocks = meta_unlocks
            self.career = meta_career
            self.career.setdefault("deaths", 0)
            self.season = max(1, meta_career.get("seasons_completed", 0) + 1)

            # Core meta: unlocked starting ship frames (Vat Templates). Only basic at true launch.
            loaded_frames = meta_career.get("unlocked_frames", ["basic"]) if isinstance(meta_career, dict) else ["basic"]
            self.unlocked_frames: set = set(loaded_frames) if loaded_frames else {"basic"}
            if "basic" not in self.unlocked_frames:
                self.unlocked_frames.add("basic")
            self.chosen_frame: str = meta_career.get("chosen_frame", "basic") if isinstance(meta_career, dict) else "basic"
            if self.chosen_frame not in self.unlocked_frames:
                self.chosen_frame = "basic"
            # Also check top level from json for frames (saved in extra)
            try:
                if META_PATH.exists():
                    import json as _json
                    _d = _json.loads(META_PATH.read_text())
                    if "unlocked_frames" in _d:
                        self.unlocked_frames = set(_d["unlocked_frames"])
                    if "chosen_frame" in _d:
                        cf = _d["chosen_frame"]
                    if "market_purchases" in _d:
                        self.market_purchases = _d.get("market_purchases", []) or []
                        if cf in self.unlocked_frames:
                            self.chosen_frame = cf
            except:
                pass
            if "basic" not in self.unlocked_frames:
                self.unlocked_frames.add("basic")
            if self.chosen_frame not in self.unlocked_frames:
                self.chosen_frame = "basic"

            # Faction aggression / betrayal rep (home audience "rep" from cruel acts against specific races)
            # Higher = more fear from that race (less on-sight attacks), more ratings from betrayals, and at MAX unlocks genocide declaration.
            self.faction_aggression: dict = {}
            if isinstance(meta_career, dict):
                self.faction_aggression = meta_career.get("faction_aggression", {f: 0 for f in FACTIONS})
            for f in FACTIONS:
                self.faction_aggression.setdefault(f, 0)
            self.genocide_target: Optional[str] = None  # Set in city (Contracts/Plaza) when eligible; affects the run's sector + special victory
        except Exception:
            get_logger().exception("Failed to load meta/career on startup; using defaults")
            self.unlocked_frames: set = {"basic"}
            self.chosen_frame: str = "basic"
            self.faction_aggression: dict = {f: 0 for f in FACTIONS}
            self.genocide_target: Optional[str] = None
            self.last_genocide_victory: Optional[str] = None
            self.career = {"total_ratings_earned": 0, "seasons_completed": 0, "high_score": 0, "deaths": 0}

        # Screen instances
        self.screens: Dict[GameState, "BaseScreen"] = {}
        self._init_screens()
        get_logger().info("Game initialized successfully (season=%s, ratings=%s)", self.season, getattr(self.resources, 'ratings', 0))

    def _init_screens(self):
        self.screens[GameState.MAIN_MENU] = MainMenuScreen(self)
        self.screens[GameState.SECTOR_MAP] = SectorMapScreen(self)
        self.screens[GameState.COMBAT] = CombatScreen(self)
        self.screens[GameState.POST_COMBAT] = PostCombatScreen(self)
        self.screens[GameState.HUB] = HubScreen(self)
        self.screens[GameState.GAME_OVER] = GameOverScreen(self)

    def change_state(self, new_state: GameState):
        """Transition to a new screen."""
        old_screen = self.screens.get(self.state)
        if old_screen:
            old_screen.on_exit()
        self.state = new_state
        new_screen = self.screens.get(new_state)
        if new_screen:
            new_screen.on_enter()

    def persist_meta(self):
        """Save current resources + unlocks + update career stats to disk (shared with terminal)."""
        try:
            self.career["seasons_completed"] = max(self.career.get("seasons_completed", 0), self.season - 1)
            self.career["total_ratings_earned"] = max(self.career.get("total_ratings_earned", 0), self.resources.ratings)
            # Core meta progression: unlocked frames and current choice
            extra = {
                "unlocked_frames": list(self.unlocked_frames),
                "chosen_frame": self.chosen_frame,
                "market_purchases": list(self.market_purchases),  # so scrap-bought stock carries across sessions if needed
            }
            self.career["faction_aggression"] = self.faction_aggression
            save_meta(self.resources, self.unlocks, self.career, extra=extra)
        except Exception:
            get_logger().exception("persist_meta: failed to save main meta")

        # Also save basic mid-run progress (sector position, morale, visited) so quit mid-sector isn't total loss
        # And full player ship (and enemy if mid-combat) using existing dev ship json format
        try:
            if self.sector and self.state in (GameState.SECTOR_MAP, GameState.COMBAT, GameState.POST_COMBAT):
                run_data = {
                    "current_node_idx": self.current_node_idx,
                    "fight_num": self.fight_num,
                    "run_morale": self.run_morale,
                    "run_visited": list(getattr(self, "run_visited", set())),
                    "run_upgrades": list(getattr(self, "run_upgrades", set())),
                    "run_backtrack_cost": getattr(self, "run_backtrack_cost", 25),
                }
                # Persist the actual sector nodes and connections so resume can reconstruct the exact map (names, risks, branches)
                try:
                    sector_data = [
                        {
                            "name": getattr(n, "name", ""),
                            "description": getattr(n, "description", ""),
                            "difficulty": getattr(n, "difficulty", 1),
                            "enemy_faction": getattr(n, "enemy_faction", "raider"),
                            "ratings_mult": getattr(n, "ratings_mult", 1.0),
                            "risk_notes": getattr(n, "risk_notes", ""),
                            "layer": getattr(n, "layer", 0),
                            "row": getattr(n, "row", 0),
                        }
                        for n in self.sector
                    ]
                    run_data["sector"] = sector_data
                    run_data["sector_connections"] = {str(k): v for k, v in (getattr(self, "sector_connections", {}) or {}).items()}
                except Exception:
                    pass
                Path("space_derelict_current_run.json").write_text(json.dumps(run_data, indent=2))
                if self.player_ship:
                    save_ship_to_json(self.player_ship, "current_run_player")
                if self.enemy_ship and self.state == GameState.COMBAT:
                    save_ship_to_json(self.enemy_ship, "current_run_enemy")
        except Exception:
            get_logger().warning("persist_meta: mid-run snapshot save failed (non-fatal)")


    def record_fight_result(self, node: SectorNode, enemy: Ship, quality: str, combat_log: List[str]):
        """Update season stats from a completed fight. Used for contract evaluation and televised story drip at the home base."""
        if not node or not enemy:
            return
        fac = getattr(node, "enemy_faction", "unknown")
        self.season_stats["fights"] = self.season_stats.get("fights", 0) + 1

        # Faction defeats
        fd = self.season_stats.setdefault("factions_defeated", {})
        fd[fac] = fd.get(fac, 0) + 1

        if fac in FACTIONS:
            # Shattering/betraying a race's ships builds home aggression/rep (the more you betray them, the more the home loves it and they fear you)
            gain = 1 if quality == "shattered" else 0
            if gain > 0:
                new_lvl = gain_faction_aggression(self.career, fac, gain)
                if new_lvl > 0 and new_lvl % 2 == 0:
                    combat_log.append(f"[HOME REP] Aggression vs {fac} now {new_lvl}/{AGGRESSION_MAX}.")
            if getattr(self, "genocide_target", None) == fac:
                self.season_stats["genocide_progress"] = self.season_stats.get("genocide_progress", 0) + (2 if quality == "shattered" else 1)

        # Shatter tracking
        if quality == "shattered":
            self.season_stats["shattered_count"] = self.season_stats.get("shattered_count", 0) + 1
            if fac == "techopuritan":
                self.season_stats["techopuritan_cleared"] = self.season_stats.get("techopuritan_cleared", 0) + 1

        # Destroyed / spectacle from states + log
        states = enemy.count_states()
        destroyed = states.get("destroyed", 0)
        self.season_stats["total_destroyed"] = self.season_stats.get("total_destroyed", 0) + destroyed

        total_cells = sum(states.values()) or 1
        ratio = destroyed / total_cells
        fights = self.season_stats["fights"]
        prev_avg = self.season_stats.get("avg_destroyed_ratio", 0.0)
        self.season_stats["avg_destroyed_ratio"] = ((prev_avg * (fights - 1)) + ratio) / fights if fights > 0 else ratio

        if ratio >= 0.85:
            self.season_stats["clean_sweeps"] = self.season_stats.get("clean_sweeps", 0) + 1

        # Capture quality tracking (for "live feed" style contracts)
        if quality in ("clean_capture", "decent"):
            self.season_stats["clean_captures"] = self.season_stats.get("clean_captures", 0) + 1

        # Spectacle events (keywords the audience loves)
        if combat_log:
            for entry in combat_log:
                u = entry.upper()
                if any(kw in u for kw in ("FIRE", "BREACH", "VOLATILE", "EXPLOSION", "OVERLOAD", "REACTOR")):
                    self.season_stats["spectacle_count"] = self.season_stats.get("spectacle_count", 0) + 1

    def new_game(self):
        """Start fresh run, but keep loaded meta resources/unlocks/ratings as starting point (vat etc apply on launch)."""
        # Core meta: choose frame at front of run (in city)
        frame = self.chosen_frame if self.chosen_frame in self.unlocked_frames else "basic"
        self.player_ship = make_starter_player_ship(frame)
        # Do not fully reset resources; the loaded meta from __init__ carries the city progress.
        if self.resources.ratings < 5 and self.resources.scrap < 5:
            self.resources.scrap = max(self.resources.scrap, 10)
            self.resources.feast = max(self.resources.feast, 5)
        self.sector, self.sector_connections = generate_branching_sector(4, unlocks=self.unlocks)
        self.current_node_idx = 0
        self.fight_num = 1
        self.combat_log = []
        self.active_contracts = []
        self._reset_run_only_vars()
        self.season_stats = {
            "factions_defeated": {},
            "shattered_count": 0,
            "techopuritan_cleared": 0,
            "total_destroyed": 0,
            "spectacle_count": 0,
            "fights": 0,
            "avg_destroyed_ratio": 0.0,
            "clean_sweeps": 0,
            "clean_captures": 0,
            "backtracks": 0,
            "total_feast": 0,
        }
        # keep self.unlocks and season from loaded meta
        # Clean stale run resume on new run start
        try:
            for fname in ["current_run_player.json", "current_run_enemy.json"]:
                p = Path("dev_ships") / fname
                if p.exists():
                    p.unlink()
            if Path("space_derelict_current_run.json").exists():
                Path("space_derelict_current_run.json").unlink()
        except Exception:
            get_logger().debug("new_game: failed to clean stale run resume files (ok)")
        self.change_state(GameState.SECTOR_MAP)

    def continue_career(self):
        """Continue from saved meta: go straight to Graftyard City (hub) with persisted resources/unlocks."""
        frame = self.chosen_frame if self.chosen_frame in self.unlocked_frames else "basic"
        self.player_ship = make_starter_player_ship(frame)
        # resources/unlocks/season/career already loaded in __init__
        self.sector, self.sector_connections = generate_branching_sector(4, unlocks=self.unlocks)
        self.current_node_idx = 0
        self.fight_num = 1
        self.combat_log = []
        self.run_morale = 65
        self.market_stock = []  # will refresh when visiting market
        self.market_purchases = []
        self.change_state(GameState.HUB)

    def _reset_run_only_vars(self):
        """Reset per-run only state (morale tree upgrades, backtrack cost, multipliers).
        Called at start of a new run/season (like terminal play_one_full_run init).
        """
        self.run_morale = 65
        self.run_upgrades = set()
        self.run_backtrack_cost = 25
        self.run_morale_gain_mult = 1.0
        self.run_ratings_mult = 0.0
        self.run_visited = set()

    def _add_run_upgrade(self, comp_kind: Optional[str] = None, art_kind: Optional[str] = None) -> bool:
        """Graphical equivalent of terminal _add_run_upgrade: attach temp cell adj to active corridor.
        Used by morale tree. Returns success.
        """
        player = self.player_ship
        if not player or not player.cells:
            return False
        active = player.get_active_corridors()
        if not active:
            active = {p for p, c in player.cells.items() if c.type == CellType.CORRIDOR and c.state == CellState.INTACT}
        if not active:
            return False
        for base in sorted(active):
            for dx, dy in [(1, 0), (-1, 0), (0, 1), (0, -1)]:
                pos = (base[0] + dx, base[1] + dy)
                if pos not in player.cells:
                    if comp_kind:
                        player.add_cell(pos, Cell(CellType.COMPONENT, component_kind=comp_kind))
                    elif art_kind:
                        player.add_cell(pos, Cell(CellType.ARTIFACT, artifact_kind=art_kind))
                    return True
        # fallback any free spot
        xs = [p[0] for p in player.cells]
        ys = [p[1] for p in player.cells]
        for xx in range(min(xs) - 1, max(xs) + 2):
            for yy in range(min(ys) - 1, max(ys) + 2):
                pos = (xx, yy)
                if pos not in player.cells:
                    if comp_kind:
                        player.add_cell(pos, Cell(CellType.COMPONENT, component_kind=comp_kind))
                    elif art_kind:
                        player.add_cell(pos, Cell(CellType.ARTIFACT, artifact_kind=art_kind))
                    return True
        return False

    def refresh_market_stock(self):
        """Generate a small rotating stock of specific components and artifacts for the Graft Market.
        This lets the store actually 'stock' the diverse parts/artifacts we have, for scrap trade.
        Called when entering the market location."""
        if self.market_stock:
            return  # keep current stock until player leaves or new season
        rng = random.Random()
        # Pick some interesting components (skip core structural ones for "buyable modules")
        comp_pool = [k for k in COMPONENT_KINDS if k not in ("power", "engine", "corridor")]
        art_pool = list(ARTIFACT_KINDS)
        rng.shuffle(comp_pool)
        rng.shuffle(art_pool)
        stock = []
        for k in comp_pool[:4]:
            cost = 18 + rng.randint(5, 15)  # tuned higher for better pacing vs shatter income
            stock.append({
                "name": f"{k.replace('_', ' ').title()} Module",
                "cost": cost,
                "type": "component",
                "kind": k,
                "desc": f"Add a {k} component to your ship for this run."
            })
        for k in art_pool[:3]:
            cost = 25 + rng.randint(5, 18)
            stock.append({
                "name": f"{k.replace('_', ' ').title()} Artifact",
                "cost": cost,
                "type": "artifact",
                "kind": k,
                "desc": f"Install a {k} artifact (powerful modifier)."
            })
        # Add some reliable basics
        stock.append({"name": "Medical Support Kit", "cost": 10, "type": "component", "kind": "medical", "desc": "Basic medical component."})
        stock.append({"name": "Scatter Lens", "cost": 22, "type": "artifact", "kind": "scatter", "desc": "Weapon multiplier - great with guns."})
        self.market_stock = stock

    def start_combat(self, node: SectorNode):
        """Begin a fight at the given node (called after any random stop event is resolved)."""
        self.combat_log = []
        self.current_random_event = None
        self.pending_event_node = None
        self.enemy_ship = get_node_enemy(node, self.fight_num, self.unlocks)
        self.change_state(GameState.COMBAT)

    def run(self):
        """Main loop."""
        logger = get_logger()
        logger.info("Game main loop starting (state=%s)", self.state)
        self.change_state(GameState.MAIN_MENU)

        try:
            while self.running:
                time_delta = self.clock.tick(FPS) / 1000.0

                # Events
                for event in pygame.event.get():
                    if event.type == pygame.QUIT:
                        self.running = False
                        break
                    if event.type == pygame.KEYDOWN and event.key == pygame.K_ESCAPE:
                        if self.state == GameState.MAIN_MENU:
                            self.running = False
                        else:
                            self.change_state(GameState.MAIN_MENU)
                        break

                    self.ui_manager.process_events(event)
                    screen = self.screens.get(self.state)
                    if screen:
                        screen.handle_event(event)

                if not self.running:
                    break

                self.ui_manager.update(time_delta)

                # Draw
                self.screen.fill(COL_BG)
                screen = self.screens.get(self.state)
                if screen:
                    screen.update(time_delta)
                    screen.draw(self.screen)
                self.ui_manager.draw_ui(self.screen)
                pygame.display.flip()
        except Exception:
            logger.exception("Fatal error in main game loop")
            # Re-raise so the excepthook (and launcher finally) still run and write crash report
            raise
        finally:
            logger.info("Game main loop exiting (final state=%s)", self.state)
            try:
                self.persist_meta()
            except Exception:
                logger.exception("Failed to persist meta on exit")
            pygame.quit()
            try:
                shutdown_logging()
            except Exception:
                pass


# ─── Base Screen ─────────────────────────────────────────────────────────────

class BaseScreen:
    def __init__(self, game: Game):
        self.game = game
        self.ui_elements: List[pygame_gui.core.UIElement] = []

    def on_enter(self):
        """Called when transitioning to this screen."""
        pass

    def on_exit(self):
        """Called when leaving this screen. Clean up UI elements."""
        for el in self.ui_elements:
            el.kill()
        self.ui_elements.clear()

    def handle_event(self, event: pygame.event.Event):
        pass

    def update(self, dt: float):
        pass

    def draw(self, surface: pygame.Surface):
        pass


# ─── Main Menu ───────────────────────────────────────────────────────────────

class MainMenuScreen(BaseScreen):
    def on_enter(self):
        for el in self.ui_elements:
            el.kill()
        self.ui_elements.clear()
        self.btn_continue = None

        cx = WINDOW_W // 2
        btn_w, btn_h = 280, 55

        has_meta = False
        try:
            has_meta = Path('space_derelict_meta.json').exists()
        except Exception:
            pass

        has_run = False
        try:
            has_run = Path('space_derelict_current_run.json').exists()
        except Exception:
            pass

        y = 320
        if has_run:
            self.btn_resume_run = pygame_gui.elements.UIButton(
                relative_rect=pygame.Rect(cx - btn_w // 2, y, btn_w, btn_h),
                text="RESUME LAST RUN (sector progress)",
                manager=self.game.ui_manager,
            )
            self.ui_elements.append(self.btn_resume_run)
            y += 70

        if has_meta:
            self.btn_continue = pygame_gui.elements.UIButton(
                relative_rect=pygame.Rect(cx - btn_w // 2, y, btn_w, btn_h),
                text="CONTINUE CAREER",
                manager=self.game.ui_manager,
            )
            self.ui_elements.append(self.btn_continue)
            y += 70

        self.btn_new = pygame_gui.elements.UIButton(
            relative_rect=pygame.Rect(cx - btn_w // 2, y, btn_w, btn_h),
            text="NEW RUN (keep meta)",
            manager=self.game.ui_manager,
        )
        self.ui_elements.append(self.btn_new)
        y += 70
        self.btn_quit = pygame_gui.elements.UIButton(
            relative_rect=pygame.Rect(cx - btn_w // 2, y, btn_w, btn_h),
            text="QUIT",
            manager=self.game.ui_manager,
        )
        self.ui_elements.append(self.btn_quit)

    def handle_event(self, event: pygame.event.Event):
        if event.type == pygame_gui.UI_BUTTON_PRESSED:
            if hasattr(self, 'btn_resume_run') and event.ui_element == self.btn_resume_run:
                self._resume_run()
            elif event.ui_element == self.btn_continue:
                self.game.continue_career()
            elif event.ui_element == self.btn_new:
                self.game.new_game()
            elif event.ui_element == self.btn_quit:
                self.game.running = False

    def _resume_run(self):
        """Load basic mid-run progress (map position etc) and go to sector map.
        Now also restores full player_ship (and enemy if was in combat) from saved json for complete progress resume.
        """
        try:
            data = json.loads(Path('space_derelict_current_run.json').read_text())
            self.game.current_node_idx = data.get("current_node_idx", 0)
            self.game.fight_num = data.get("fight_num", 1)
            self.game.run_morale = data.get("run_morale", 65)
            self.game.run_visited = set(data.get("run_visited", []))
            self.game.run_upgrades = set(data.get("run_upgrades", []))
            self.game.run_backtrack_cost = data.get("run_backtrack_cost", 25)
            # Restore full player ship for real progress (grafts etc from mid-run)
            player_path = Path("dev_ships/current_run_player.json")
            if player_path.exists():
                self.game.player_ship = load_ship_from_json(player_path)
            else:
                frame = self.game.chosen_frame if self.game.chosen_frame in self.game.unlocked_frames else "basic"
                self.game.player_ship = make_starter_player_ship(frame)
            # Optional enemy restore (if mid combat)
            enemy_path = Path("dev_ships/current_run_enemy.json")
            if enemy_path.exists() and self.game.state == GameState.COMBAT:  # but we force to map
                self.game.enemy_ship = load_ship_from_json(enemy_path)

            # Restore the sector map data if saved (critical for graphical resume to show planets/connections)
            sector_data = data.get("sector", [])
            stale_sector = False
            if sector_data:
                try:
                    restored_sector = []
                    for d in sector_data:
                        node = SectorNode(
                            name=d.get("name", ""),
                            description=d.get("description", ""),
                            difficulty=d.get("difficulty", 1),
                            enemy_faction=d.get("enemy_faction", "raider"),
                            ratings_mult=d.get("ratings_mult", 1.0),
                            risk_notes=d.get("risk_notes", ""),
                            layer=d.get("layer", 0),
                            row=d.get("row", 0),
                        )
                        restored_sector.append(node)
                    # Detect stale pre-branching saves: if max layer < 7 or too few nodes, regenerate
                    max_lyr = max(getattr(n, 'layer', 0) for n in restored_sector) if restored_sector else 0
                    if max_lyr < 7 or len(restored_sector) < 8:
                        stale_sector = True
                    else:
                        self.game.sector = restored_sector
                except Exception as e:
                    print("Could not restore sector nodes:", e)
                    stale_sector = True
            else:
                stale_sector = True
            if stale_sector:
                # Old/stale save or no sector data: generate a fresh 8-layer branching map
                try:
                    self.game.sector, self.game.sector_connections = generate_branching_sector(
                        4, unlocks=getattr(self.game, "unlocks", set())
                    )
                except Exception:
                    self.game.sector = []
                    self.game.sector_connections = {}

            if not stale_sector:
                # Only restore saved connections if we kept the saved sector (not regenerated)
                conn_data = data.get("sector_connections", {})
                if conn_data:
                    try:
                        self.game.sector_connections = {}
                        for k, v in conn_data.items():
                            self.game.sector_connections[int(k)] = list(v)
                    except Exception:
                        pass
                # If we restored sector but no connections, at least make a linear fallback
                if self.game.sector and not getattr(self.game, "sector_connections", None):
                    self.game.sector_connections = {i: [i+1] for i in range(len(self.game.sector)-1)}

            self.game.change_state(GameState.SECTOR_MAP)
            # Clean temp run files? Keep for now, or clean on full launch/complete
        except Exception as e:
            print("Could not resume run:", e)
            self.game.new_game()

    def draw(self, surface: pygame.Surface):
        # Background
        _draw_screen_bg(surface, "main_menu_bg.png", overlay_alpha=140)

        # Title
        font_big = pygame.font.SysFont("consolas", 52, bold=True)
        font_sub = pygame.font.SysFont("consolas", 18)

        title = font_big.render("SPACE DERELICT", True, COL_ACCENT)
        sub = font_sub.render("Rim predator. Frankenstein ship. Game show carnage.", True, COL_TEXT_DIM)

        surface.blit(title, (WINDOW_W // 2 - title.get_width() // 2, 180))
        surface.blit(sub, (WINDOW_W // 2 - sub.get_width() // 2, 260))

        # Version
        ver = font_sub.render("Graphical Prototype v0.1", True, COL_TEXT_DIM)
        surface.blit(ver, (WINDOW_W // 2 - ver.get_width() // 2, WINDOW_H - 40))


# ─── Sector Map ──────────────────────────────────────────────────────────────

class SectorMapScreen(BaseScreen):
    def __init__(self, game: Game):
        super().__init__(game)
        self.node_buttons: List[pygame_gui.elements.UIButton] = []
        self.event_buttons: List[pygame_gui.elements.UIButton] = []
        self._event_art: pygame.Surface | None = None
        self.styled_buttons: list = []  # custom-drawn upgrade/repair/feast buttons
        self.node_planet_surfs: List[pygame.Surface] = []
        self.planet_rects: List[pygame.Rect] = []
        self.travel_button: Optional[pygame_gui.elements.UIButton] = None  # big "depart" button for highlighted destination
        self.highlighted_node_idx: int = 0  # the one the player is previewing/choosing next
        self.is_traveling: bool = False
        self.travel_from: int = 0
        self.travel_to: int = 0
        self.travel_progress: float = 0.0
        self.planet_positions: List[tuple] = []  # (cx, cy) for each node, computed in draw
        self.engaging: bool = False
        self.engaging_progress: float = 0.0
        self.engaging_target: int = 0
        self.settle_anim: bool = False
        self.settle_progress: float = 0.0
        # Load generated nebula background (from RFAB API)
        self._nebula_bg = None
        try:
            neb_path = os.path.join(os.path.dirname(__file__), "..", "assets", "ui", "nebula_dark.png")
            if os.path.exists(neb_path):
                raw = pygame.image.load(neb_path).convert()
                self._nebula_bg = pygame.transform.smoothscale(raw, (WINDOW_W, WINDOW_H))
                # Darken it so planets and UI pop over it
                dark = pygame.Surface((WINDOW_W, WINDOW_H), pygame.SRCALPHA)
                dark.fill((0, 0, 0, 140))
                self._nebula_bg.blit(dark, (0, 0))
        except Exception:
            self._nebula_bg = None

        # === CRT terminal frame overlay (80s retro spaceship console aesthetic) ===
        self._crt_overlay = None     # programmatic CRT bezel + scan lines + phosphor glow
        self._crt_scanlines = None   # separate scanline surface (very subtle, full-screen)
        self._build_crt_frame()

    def _build_crt_frame(self):
        """Build an 80s retro CRT terminal frame overlay.
        Simulates looking at an old ship's navigation console — thick dark bezel,
        rounded CRT screen corners, amber phosphor glow on inner edges, subtle
        scan lines, and small indicator details. Think Alien (1979) / WarGames.
        """
        # CRT bezel dimensions — thick enough to feel like a monitor housing,
        # thin enough to not cover any game content
        BZ_LEFT = 14
        BZ_TOP = 10
        BZ_RIGHT = 8
        BZ_BOTTOM = 28       # wider bottom for "console status bar"
        CORNER_R = 18        # CRT rounded corner radius

        # Colors
        bezel_dark = (8, 8, 14, 255)         # dark plastic/metal housing
        bezel_mid = (22, 24, 32, 255)        # slight highlight on bezel face
        bezel_edge = (35, 38, 50, 220)       # inner bevel edge
        phosphor = (60, 180, 90, 50)         # green phosphor glow (subtle)
        phosphor_amber = (180, 140, 40, 35)  # amber accent glow
        screen_border = (45, 55, 70, 200)    # thin bright line at screen edge

        # Screen area (inside the bezel)
        sx, sy = BZ_LEFT, BZ_TOP
        sw, sh = WINDOW_W - BZ_LEFT - BZ_RIGHT, WINDOW_H - BZ_TOP - BZ_BOTTOM

        overlay = pygame.Surface((WINDOW_W, WINDOW_H), pygame.SRCALPHA)

        # --- Bezel border (opaque dark frame around entire window) ---
        # Top bezel
        pygame.draw.rect(overlay, bezel_dark, (0, 0, WINDOW_W, BZ_TOP))
        # Bottom bezel
        pygame.draw.rect(overlay, bezel_dark, (0, WINDOW_H - BZ_BOTTOM, WINDOW_W, BZ_BOTTOM))
        # Left bezel
        pygame.draw.rect(overlay, bezel_dark, (0, BZ_TOP, BZ_LEFT, sh))
        # Right bezel
        pygame.draw.rect(overlay, bezel_dark, (WINDOW_W - BZ_RIGHT, BZ_TOP, BZ_RIGHT, sh))

        # Bezel face highlight (subtle gradient stripe on top and left edges)
        for i in range(min(BZ_TOP, 6)):
            a = 30 - i * 5
            pygame.draw.line(overlay, (40, 42, 55, max(0, a)),
                           (0, i), (WINDOW_W, i))
        for i in range(min(BZ_LEFT, 8)):
            a = 25 - i * 3
            pygame.draw.line(overlay, (35, 38, 50, max(0, a)),
                           (i, BZ_TOP), (i, WINDOW_H - BZ_BOTTOM))

        # --- CRT rounded corners (dark triangular fills to simulate rounded screen) ---
        # Each corner gets a filled quarter-circle in bezel color
        corner_surf = pygame.Surface((CORNER_R, CORNER_R), pygame.SRCALPHA)
        for cy in range(CORNER_R):
            for cx in range(CORNER_R):
                # Distance from the inner corner point
                dx = CORNER_R - cx
                dy = CORNER_R - cy
                dist = (dx * dx + dy * dy) ** 0.5
                if dist > CORNER_R:
                    corner_surf.set_at((cx, cy), bezel_dark)
                elif dist > CORNER_R - 2:
                    corner_surf.set_at((cx, cy), (30, 35, 50, 180))

        # Top-left corner
        overlay.blit(corner_surf, (sx, sy))
        # Top-right corner (flip horizontal)
        overlay.blit(pygame.transform.flip(corner_surf, True, False), (sx + sw - CORNER_R, sy))
        # Bottom-left corner (flip vertical)
        overlay.blit(pygame.transform.flip(corner_surf, False, True), (sx, sy + sh - CORNER_R))
        # Bottom-right corner (flip both)
        overlay.blit(pygame.transform.flip(corner_surf, True, True), (sx + sw - CORNER_R, sy + sh - CORNER_R))

        # --- Screen border line (thin bright edge where CRT glass meets bezel) ---
        # Top
        pygame.draw.line(overlay, screen_border, (sx + CORNER_R, sy), (sx + sw - CORNER_R, sy), 1)
        # Bottom
        pygame.draw.line(overlay, screen_border, (sx + CORNER_R, sy + sh), (sx + sw - CORNER_R, sy + sh), 1)
        # Left
        pygame.draw.line(overlay, screen_border, (sx, sy + CORNER_R), (sx, sy + sh - CORNER_R), 1)
        # Right
        pygame.draw.line(overlay, screen_border, (sx + sw, sy + CORNER_R), (sx + sw, sy + sh - CORNER_R), 1)

        # --- Phosphor glow (inner edge glow — green tint fading inward) ---
        glow_depth = 12
        for i in range(glow_depth):
            a = int(phosphor[3] * (1.0 - i / glow_depth))
            gc = (phosphor[0], phosphor[1], phosphor[2], a)
            # Top glow
            pygame.draw.line(overlay, gc, (sx + CORNER_R, sy + i), (sx + sw - CORNER_R, sy + i))
            # Bottom glow
            pygame.draw.line(overlay, gc, (sx + CORNER_R, sy + sh - i), (sx + sw - CORNER_R, sy + sh - i))
            # Left glow
            pygame.draw.line(overlay, gc, (sx + i, sy + CORNER_R), (sx + i, sy + sh - CORNER_R))
        # Right edge — amber glow (different color for visual interest)
        for i in range(glow_depth // 2):
            a = int(phosphor_amber[3] * (1.0 - i / (glow_depth // 2)))
            gc = (phosphor_amber[0], phosphor_amber[1], phosphor_amber[2], a)
            pygame.draw.line(overlay, gc, (sx + sw - i, sy + CORNER_R), (sx + sw - i, sy + sh - CORNER_R))

        # --- CRT curvature vignette (darken corners of screen slightly) ---
        # Use a pre-rendered corner gradient surface for performance (instead of per-pixel set_at)
        curve_r = 100
        corner_grad = pygame.Surface((curve_r, curve_r), pygame.SRCALPHA)
        for r in range(curve_r, 0, -1):
            darkness = int(30 * (1.0 - r / curve_r) ** 2)
            if darkness > 1:
                pygame.draw.circle(corner_grad, (0, 0, 0, darkness), (curve_r, curve_r), r)
        # Blit into each corner (clipping naturally handles the quarter-circle effect)
        overlay.blit(corner_grad, (sx - curve_r, sy - curve_r))                          # top-left (only bottom-right quarter visible)
        overlay.blit(pygame.transform.flip(corner_grad, True, False),
                    (sx + sw, sy - curve_r))                                               # top-right
        overlay.blit(pygame.transform.flip(corner_grad, False, True),
                    (sx - curve_r, sy + sh))                                               # bottom-left
        overlay.blit(pygame.transform.flip(corner_grad, True, True),
                    (sx + sw, sy + sh))                                                    # bottom-right

        # --- Status bar on bottom bezel (old-school system info) ---
        try:
            status_font = pygame.font.SysFont("consolas", 10)
            status_texts = [
                ("■ ONLINE", (60, 200, 80, 200)),
                ("NAV DISPLAY MK-IV", (100, 110, 130, 180)),
                ("SER#4721-D", (80, 85, 100, 150)),
            ]
            stx = 20
            for txt, col in status_texts:
                ts = status_font.render(txt, True, col[:3])
                ts.set_alpha(col[3])
                overlay.blit(ts, (stx, WINDOW_H - BZ_BOTTOM + 8))
                stx += ts.get_width() + 25

            # Right side of status bar
            right_texts = [
                ("HELM LOCK", (80, 90, 110, 150)),
                ("◆", (60, 180, 90, 180)),
            ]
            rtx = WINDOW_W - 20
            for txt, col in reversed(right_texts):
                ts = status_font.render(txt, True, col[:3])
                ts.set_alpha(col[3])
                rtx -= ts.get_width()
                overlay.blit(ts, (rtx, WINDOW_H - BZ_BOTTOM + 8))
                rtx -= 12
        except Exception:
            pass

        # --- Indicator LEDs on bezel ---
        led_colors = [(60, 200, 80, 200), (200, 160, 40, 160), (60, 160, 220, 180)]
        for idx, lc in enumerate(led_colors):
            lx = BZ_LEFT + 8 + idx * 14
            ly = BZ_TOP // 2
            pygame.draw.circle(overlay, lc, (lx, ly), 2)
            # Tiny glow
            gsurf = pygame.Surface((8, 8), pygame.SRCALPHA)
            gsurf.fill((lc[0], lc[1], lc[2], 20))
            overlay.blit(gsurf, (lx - 4, ly - 4))
        # Right side LED
        pygame.draw.circle(overlay, (200, 60, 60, 140), (WINDOW_W - BZ_RIGHT - 6, BZ_TOP // 2), 2)

        self._crt_overlay = overlay

        # --- Separate full-screen scanline surface (very subtle) ---
        scanlines = pygame.Surface((WINDOW_W, WINDOW_H), pygame.SRCALPHA)
        for y in range(0, WINDOW_H, 2):
            pygame.draw.line(scanlines, (0, 0, 0, 12), (0, y), (WINDOW_W, y))
        self._crt_scanlines = scanlines

    def on_enter(self):
        self.node_buttons = []
        self.event_buttons = []
        self.styled_buttons = []
        self.travel_button = None
        self.node_planet_surfs = []
        self.planet_rects = []
        self.planet_positions = []
        self.is_traveling = False
        self.travel_from = 0
        self.travel_to = 0
        self.travel_progress = 0.0
        self.engaging = False
        self.engaging_progress = 0.0
        self.engaging_target = 0
        self.settle_anim = False
        self.settle_progress = 0.0
        self.highlighted_node_idx = getattr(self.game, 'current_node_idx', 0)
        if getattr(self.game, 'just_returned_from_combat', False):
            self.settle_anim = True
            self.settle_progress = 0.0
            self.game.just_returned_from_combat = False

        # Safety: if we arrived at the map without a sector, or with stale pre-branching data
        # (e.g. old mid-run save with <8 layers), regenerate a proper 8-layer branched map.
        sector = getattr(self.game, 'sector', None)
        needs_regen = not sector
        if sector and not needs_regen:
            max_lyr = max(getattr(n, 'layer', 0) for n in sector) if sector else 0
            if max_lyr < 7 or len(sector) < 8:
                needs_regen = True
        if needs_regen:
            try:
                self.game.sector, self.game.sector_connections = generate_branching_sector(
                    4, unlocks=getattr(self.game, 'unlocks', set())
                )
                if getattr(self.game, 'current_node_idx', 0) >= len(self.game.sector):
                    self.game.current_node_idx = 0
                self.highlighted_node_idx = self.game.current_node_idx
            except Exception:
                self.game.sector = []
                self.game.sector_connections = {}

        self._compute_layout()
        self._build_ui()

    def update(self, dt: float):
        """Animate ship travel along the flight path when departing to a new planet,
        plus short engaging phase before combat (into combat bridge) and settle on return (out of combat)."""
        if self.is_traveling:
            self.travel_progress += dt / 1.3  # ~1.3 seconds to travel between nodes
            if self.travel_progress >= 1.0:
                self.travel_progress = 1.0
                self.is_traveling = False
                # Ship has arrived at the planet via travel effect.
                # Set position, start short "engaging" visual on map before entering combat.
                target = self.travel_to
                self.game.current_node_idx = target
                self.highlighted_node_idx = target
                self.engaging = True
                self.engaging_progress = 0.0
                self.engaging_target = target
                self._build_ui()
        elif self.engaging:
            self.engaging_progress += dt / 0.6  # short 0.6s engaging/arming phase
            if self.engaging_progress >= 1.0:
                self.engaging = False
                self.engaging_progress = 0.0
                self._complete_travel()  # now proceed to event roll or combat
        elif self.settle_anim:
            self.settle_progress += dt / 0.5
            if self.settle_progress >= 1.0:
                self.settle_anim = False
                self.settle_progress = 0.0

    def _complete_travel(self):
        """Called after travel + engaging. Performs event roll or combat start.
        (Current position already updated by travel completion.)"""
        target = getattr(self, 'engaging_target', self.game.current_node_idx)
        node = self.game.sector[target]
        visited = getattr(self.game, 'run_visited', set())
        is_new = target not in visited

        if not is_new:
            self.game.combat_log.append(f"[MAP] Repositioned to already cleared {node.name} (no new fight).")
            self._build_ui()
            return

        # Roll for random stop event before combat (flavorful choice moment)
        if random.random() < 0.28 or getattr(node, 'difficulty', 1) >= 2:
            ctx = {
                "faction": node.enemy_faction,
                "difficulty": getattr(node, 'difficulty', 1),
                "location": "run",
                "aggression_level": get_faction_aggression(self.game.career, node.enemy_faction),
                "genocide_target": getattr(self.game, 'genocide_target', None),
            }
            ev = roll_random_event(ctx)
            self.game.current_random_event = ev
            self.game.pending_event_node = node
            self._build_ui()
        else:
            self.game.start_combat(node)

    def _draw_small_ship(self, surface, x, y, angle, scale=1.0):
        """Draw a tiny asymmetric 'frankenstein' player ship for the map travel effect."""
        cos_a = math.cos(angle)
        sin_a = math.sin(angle)

        def rotate(pts):
            res = []
            for px, py in pts:
                rx = x + (px * cos_a - py * sin_a) * scale
                ry = y + (px * sin_a + py * cos_a) * scale
                res.append((rx, ry))
            return res

        # Main irregular hull (frankenstein / patched look)
        hull = [(-5, -3), (4, -4), (7, -1), (7, 2), (3, 4), (-6, 3), (-7, 0)]
        # Gun pod on top (asymmetric)
        gun = [(0, -4), (0, -8), (5, -7), (5, -4)]
        # Harvester claw / grabber on bottom (thematic)
        claw = [(2, 3), (8, 6), (3, 7)]

        # Draw
        pygame.draw.polygon(surface, (130, 195, 230), rotate(hull))
        pygame.draw.polygon(surface, (90, 150, 190), rotate(gun))
        pygame.draw.polygon(surface, (200, 90, 90), rotate(claw))  # reddish claw for monster ship
        # Core / cockpit glow
        core = rotate([(0.5, 0)])[0]
        pygame.draw.circle(surface, (255, 255, 220), (int(core[0]), int(core[1])), max(1, int(2 * scale)))
        # Outline
        pygame.draw.polygon(surface, (40, 70, 90), rotate(hull), 1)

    def _compute_layout(self):
        """Compute left-to-right column layout using the generator's construction 'layer' (set on each SectorNode during generate_branching_sector).
        8 columns (horizontal stages) are guaranteed (real .layer when available, otherwise index bin for legacy saves).
        4 fixed rows/lanes (straight horizontal tracks) using the .row assigned at generation time (0-3).
        In any column only a subset of the 4 rows may be occupied (1-4 planets per column, with gaps in unoccupied rows/lanes).
        This produces the exact requested structure: 8 columns long, 4 rows deep, each row having 1-4 planets across the map (not all positions full).
        Same-row planets share y coordinate => clean horizontal lanes. Connections may stay in lane or cross to adjacent.
        Legacy/old saves (no .row/.layer or flat) still get spread to 8 columns + 4 rows via binning + %4 fallback.
        Connections/lines use the real DAG etc. Unique per seed.
        """
        sector = getattr(self.game, 'sector', [])
        n = len(sector)
        if n == 0:
            self.planet_positions = []
            return

        # Always bin to exactly 8 visual columns by node creation order (progression order from generator).
        # This strictly guarantees "8 columns long" for the map, regardless of saved layer data or generator version.
        # The .layer and .row are still used for connections (free vs backtrack) and preferred for row y when valid.
        num_visual = 8
        cols = [[] for _ in range(num_visual)]
        for i in range(n):
            d = min(num_visual-1, (i * num_visual) // max(1, n))
            cols[d].append(i)

        # Budget horizontal space for the map so 8-9 columns fit without clipping the right-side DESTINATION inspector
        # or the run-upgrades/repair buttons column. Shallower maps get more breathing room per column.
        map_left = 40
        num_cols = len(cols)
        if num_cols <= 5:
            target_map_width = 920
        elif num_cols <= 7:
            target_map_width = 860
        else:
            target_map_width = 800  # 8-9 layers: tighter cols but still usable; planets + labels remain distinct
        col_width = target_map_width / max(1, num_cols - 1) if num_cols > 1 else 150

        # 4 fixed rows/lanes (straight horizontal tracks) + gaps for the exact model requested.
        # Larger v_spacing to make the 4 rows visibly "deep" (more vertical separation between lanes).
        v_spacing = 130
        center_y = 380
        row_ys = [
            center_y - 1.5 * v_spacing,
            center_y - 0.5 * v_spacing,
            center_y + 0.5 * v_spacing,
            center_y + 1.5 * v_spacing,
        ]

        # Icon/label sizes computed from actual col spacing for this deep map (horizontal constraint dominates for 8-9 cols).
        # 8-9 layers get narrower columns (~100px) so we must use smaller icons (~48-56) + tighter labels or everything overlaps.
        # Shallow maps keep the big epic 80px icons + readable labels.
        avail = max(40, col_width - 28)
        icon_from_col = min(80, max(48, int(avail * 0.62)))
        self.map_icon_size = max(48, min(80, icon_from_col))
        self.map_label_w = max(100, min(150, self.map_icon_size + 55))

        positions: list[tuple[int, int]] = [(0, 0)] * n

        # Detect if we have real varied row data (new saves after row was added to persist).
        # If all nodes have the same row (e.g. 0 from d.get("row",0) on old json), fall back to local assignment
        # within each column so we still get vertical separation ("4 deep") instead of everything on one y.
        used_rows = {getattr(node, 'row', -1) for node in sector}
        has_real_rows = len(used_rows) > 1 and all(0 <= r < 4 for r in used_rows)

        for d, col_nodes in enumerate(cols):
            x = map_left + d * col_width
            col_list = sorted(col_nodes)
            for local_j, nid in enumerate(col_list):
                if has_real_rows:
                    r = getattr(sector[nid], 'row', local_j % 4)
                else:
                    # for legacy/flat row data, use (column + local) %4 to spread singles across lanes
                    # so the "main path" uses different rows in different columns, giving visible 4-row structure
                    r = (d + local_j) % 4
                r = max(0, min(3, r))
                y = row_ys[r]
                positions[nid] = (x, y)

        self.planet_positions = positions

    def _build_ui(self):
        for el in self.ui_elements:
            el.kill()
        self.ui_elements.clear()
        self.node_buttons.clear()
        self.styled_buttons = []

        if self.game.current_random_event:
            # Show random faction stop event instead of nodes
            self._build_event_ui()
            return

        # Title label
        font = pygame.font.SysFont("consolas", 14)

        # Pre-load planet icons sized to the layout we just computed (so 8-layer maps get appropriately scaled icons, not always 56).
        cx = WINDOW_W // 2
        icon_sz = getattr(self, 'map_icon_size', 56)
        for i, node in enumerate(self.game.sector):
            surf = get_planet_icon(node, i, size=icon_sz)
            self.node_planet_surfs.append(surf)

        # DEPART button — centered, prominent, sits at bottom of screen
        travel_y = WINDOW_H - 65
        depart_w = 440
        depart_h = 44
        if self.is_traveling:
            self.travel_button = pygame_gui.elements.UIButton(
                relative_rect=pygame.Rect(cx - depart_w // 2, travel_y, depart_w, depart_h),
                text="IN TRANSIT — TRAVELING TO DESTINATION",
                manager=self.game.ui_manager,
            )
            self.travel_button.disable()
        elif self.engaging:
            self.travel_button = pygame_gui.elements.UIButton(
                relative_rect=pygame.Rect(cx - depart_w // 2, travel_y, depart_w, depart_h),
                text="ENGAGING — PREPARING FOR COMBAT",
                manager=self.game.ui_manager,
            )
            self.travel_button.disable()
        else:
            hl_node = self.game.sector[self.highlighted_node_idx] if self.game.sector else None
            hl_name = hl_node.name if hl_node else "DESTINATION"
            self.travel_button = pygame_gui.elements.UIButton(
                relative_rect=pygame.Rect(cx - depart_w // 2, travel_y, depart_w, depart_h),
                text=f">>> DEPART TO {hl_name.upper()} <<<",
                manager=self.game.ui_manager,
            )
        self.ui_elements.append(self.travel_button)

        # Build styled right-column button data (drawn manually in draw() for full visual control)
        right_w = 258
        right_x = WINDOW_W - right_w - 14
        right_y = 430
        self.styled_buttons = []  # list of dicts: {rect, label, sub, icon_col, enabled, action, hover}
        self._build_styled_upgrades(right_x, right_y, right_w)

        # Quick in-run repair using scrap
        dstate = self.game.player_ship.count_states().get("disabled", 0) if self.game.player_ship else 0
        rcost = dstate * 2
        rcan = dstate > 0 and self.game.resources.scrap >= rcost
        rlabel = f"Repair {dstate} cells" if dstate > 0 else "No damage"
        rsub = f"{rcost} scrap" if dstate > 0 else ""
        repair_y = right_y + len(self.styled_buttons) * 34
        self.styled_buttons.append({
            "rect": pygame.Rect(right_x, repair_y, right_w, 30),
            "label": rlabel, "sub": rsub,
            "icon_col": (100, 200, 255) if rcan else (60, 65, 80),
            "enabled": rcan, "action": "repair", "hover": False,
        })

        # Quick in-run feast processing
        fcan = self.game.resources.feast >= 8
        flabel = "Process feast"
        fsub = f"+6 scrap ({self.game.resources.feast}/8)"
        feast_y = repair_y + 34
        self.styled_buttons.append({
            "rect": pygame.Rect(right_x, feast_y, right_w, 30),
            "label": flabel, "sub": fsub,
            "icon_col": (200, 160, 80) if fcan else (60, 65, 80),
            "enabled": fcan, "action": "feast", "hover": False,
        })

    def _build_styled_upgrades(self, x: int, y: int, w: int):
        """Build styled button data for run morale upgrades."""
        current_m = getattr(self.game, 'run_morale', 65)
        avail = get_available_run_morale_upgrades(getattr(self.game, 'run_upgrades', set()), current_m)
        # Color coding by upgrade type
        code_colors = {
            "M": (100, 200, 140),  # medical = green
            "N": (140, 100, 200),  # nanite = purple
            "S": (100, 160, 255),  # shield = blue
            "B": (200, 180, 80),   # booster = gold
            "D": (180, 140, 220),  # distributor = lilac
            "C": (200, 100, 100),  # capture = red
            "G": (255, 180, 100),  # guru = orange
            "P": (100, 220, 200),  # pathfinder = teal
            "R": (255, 200, 60),   # crowd = yellow
            "V": (200, 80, 180),   # volatile = pink
        }
        for u in avail[:5]:
            # Short readable label: code + short name
            short_name = u.desc.split('(')[0].split('-')[0].strip()[:20]
            ic = code_colors.get(u.code[0], COL_ACCENT)
            can_afford = current_m >= u.cost
            self.styled_buttons.append({
                "rect": pygame.Rect(x, y, w, 30),
                "label": f"{u.code}: {short_name}",
                "sub": f"{u.cost} morale",
                "icon_col": ic if can_afford else (60, 65, 80),
                "enabled": can_afford,
                "action": f"upgrade:{u.key}",
                "hover": False,
            })
            y += 34

    def _build_event_ui(self):
        """Build UI for a random faction stop event — styled panel with illustration."""
        event = self.game.current_random_event
        btn_w = 520
        btn_h = 44

        # Buttons start below the art + text panel area
        btn_start_y = WINDOW_H - 50 - len(event.get("options", [])) * (btn_h + 12)
        cx = WINDOW_W // 2

        self.event_buttons = []
        for i, opt in enumerate(event.get("options", [])):
            eff = opt.get("effect", {})
            etype = eff.get("type", "")
            # Color-code button text hints
            prefix = ""
            if etype == "betray" or etype == "genocide":
                prefix = "[BETRAY] "
            elif etype == "risky":
                prefix = "[RISKY] "
            elif etype == "positive":
                prefix = ""
            elif etype == "neutral":
                prefix = ""
            text = f"{prefix}{opt['text']}"[:70]

            btn = pygame_gui.elements.UIButton(
                relative_rect=pygame.Rect(cx - btn_w // 2, btn_start_y + i * (btn_h + 12), btn_w, btn_h),
                text=text,
                manager=self.game.ui_manager,
            )
            btn.event_option = opt
            self.event_buttons.append(btn)
            self.ui_elements.append(btn)

        # Load event illustration
        self._event_art = self._load_event_art(event)

    def _load_event_art(self, event: dict) -> pygame.Surface | None:
        """Load the illustration image for an event based on its category/faction."""
        events_dir = Path("assets/events")
        # Map event to image file
        faction = event.get("faction", "")
        category = event.get("category", "")
        special = event.get("special", "")

        # Priority: specific faction → category → generic
        candidates = []
        if special == "genocide":
            candidates.append("event_genocide")
        if faction:
            candidates.append(f"event_{faction}")
        if category in ("distress", "artifact", "rival", "crew", "genetic", "trust"):
            candidates.append(f"event_{category}")
        if category == "trust":
            candidates.append("event_merchant")
        if category and category.startswith("base"):
            candidates.append("event_base")
        candidates.append("event_distress")  # fallback

        for name in candidates:
            path = events_dir / f"{name}.png"
            if path.exists():
                try:
                    img = pygame.image.load(str(path)).convert_alpha()
                    # Scale to fit the art area (wide banner)
                    art_w = 680
                    art_h = int(img.get_height() * (art_w / img.get_width()))
                    if art_h > 320:
                        art_h = 320
                        art_w = int(img.get_width() * (320 / img.get_height()))
                    return pygame.transform.smoothscale(img, (art_w, art_h))
                except Exception:
                    continue
        return None

    def handle_event(self, event: pygame.event.Event):
        if event.type == pygame_gui.UI_BUTTON_PRESSED:
            if self.game.current_random_event:
                for btn in getattr(self, 'event_buttons', []):
                    if event.ui_element == btn:
                        self._resolve_random_event(btn.event_option)
                        return
                return

            # Prominent "Travel" button for the highlighted planet/destination (the nice new map UI)
            if event.ui_element == getattr(self, 'travel_button', None):
                target = getattr(self, 'highlighted_node_idx', self.game.current_node_idx)
                if target == self.game.current_node_idx or self.is_traveling:
                    if target == self.game.current_node_idx:
                        self.game.combat_log.append("[MAP] You are already here.")
                    self._build_ui()
                    return

                conns = getattr(self.game, 'sector_connections', {})
                curr = self.game.current_node_idx
                visited = getattr(self.game, 'run_visited', set())

                is_forward = target in conns.get(curr, [])
                is_back = (target in visited and target != curr) or (not is_forward)
                cost = 0
                if not is_forward:
                    cost = getattr(self.game, 'run_backtrack_cost', 25)

                if cost > 0:
                    if self.game.run_morale >= cost:
                        self.game.run_morale -= cost
                        self.game.season_stats["backtracks"] = self.game.season_stats.get("backtracks", 0) + 1
                        print(f"[yellow]Backtrack/reposition cost {cost} run morale (lame to clones).[/yellow]")
                    else:
                        print("[red]Not enough morale for backtrack.[/red]")
                        self._build_ui()
                        return

                # Initiate the travel effect: small ship flies from current planet to the chosen one
                self.is_traveling = True
                self.travel_from = curr
                self.travel_to = target
                self.travel_progress = 0.0
                self.highlighted_node_idx = target
                self._build_ui()  # updates travel button to traveling state
                return

        # NOTE: This mouse handling must be *outside* the UI_BUTTON_PRESSED if.
        # Raw MOUSEBUTTONDOWN on planet rects (which are not pygame_gui elements) never trigger
        # a UI_BUTTON_PRESSED, so the highlight logic was unreachable. Clicking planets now works
        # to preview (update details + DEPART text); actual travel still via the big DEPART button
        # (to show cost, allow cancel etc).
        if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            if self.is_traveling or self.engaging:
                return  # can't change during travel or engaging phase
            pos = getattr(event, 'pos', None)
            if pos:
                # Check styled buttons (upgrades, repair, feast)
                for btn in getattr(self, 'styled_buttons', []):
                    if btn["rect"].collidepoint(pos) and btn["enabled"]:
                        self._handle_styled_button(btn["action"])
                        return
                # Check planet rects for highlight
                for ii, r in enumerate(getattr(self, 'planet_rects', [])):
                    if r.collidepoint(pos):
                        self.highlighted_node_idx = ii
                        self._build_ui()
                        break

    def _handle_styled_button(self, action: str):
        """Handle click on a styled (custom-drawn) button."""
        if action.startswith("upgrade:"):
            key = action.split(":", 1)[1]
            if key in getattr(self.game, 'run_upgrades', set()):
                self.game.combat_log.append("Already have that run upgrade.")
                self._build_ui()
                return
            u = RUN_MORALE_UPGRADES_BY_KEY.get(key)
            if u and self.game.run_morale >= u.cost:
                self.game.run_morale -= u.cost
                self.game.run_upgrades.add(key)
                if key == "pathfinder":
                    self.game.run_backtrack_cost = max(5, self.game.run_backtrack_cost - 5)
                    self.game.combat_log.append(f"Pathfinder: backtrack cost now {self.game.run_backtrack_cost}")
                elif key == "crowd":
                    self.game.run_ratings_mult += 0.2
                    self.game.combat_log.append("+0.2 run ratings_mult (crowd pleaser)")
                elif key == "guru":
                    self.game.run_morale_gain_mult += 0.2
                    self.game.combat_log.append("+0.2x future morale gains (guru)")
                if u.comp_kind or u.art_kind:
                    if self.game._add_run_upgrade(u.comp_kind, u.art_kind):
                        self.game.combat_log.append(f"Installed run upgrade: {u.desc[:30]}")
                    else:
                        self.game.combat_log.append(f"Upgrade trained: {u.desc[:30]} (no spot for cell)")
                else:
                    self.game.combat_log.append(f"Run upgrade: {u.desc[:30]}")
            else:
                self.game.combat_log.append("Not enough run morale or already owned.")
            self._build_ui()

        elif action == "repair":
            player = self.game.player_ship
            if player:
                d = player.count_states().get("disabled", 0)
                cost = d * 2
                if d > 0 and self.game.resources.scrap >= cost:
                    rep, c = player.repair_all_disabled(cost_per=2)
                    self.game.resources.scrap -= c
                    self.game.combat_log.append(f"Repaired {rep} cells for {c} scrap (in-run).")
                else:
                    self.game.combat_log.append("Nothing to repair or not enough scrap.")
            self._build_ui()

        elif action == "feast":
            if self.game.resources.feast >= 8:
                self.game.resources.feast -= 8
                self.game.resources.scrap += 6
                self.game.combat_log.append("Processed captives in vats. +6 scrap (in-run).")
            else:
                self.game.combat_log.append("Need 8 feast to process.")
            self._build_ui()

    def _resolve_random_event(self, option: dict):
        """Apply the player's choice in a general random event."""
        effect = option.get("effect", {})
        event = self.game.current_random_event
        node = self.game.pending_event_node
        log = self.game.combat_log

        etype = effect.get("type")
        special = event.get("special")

        if special == "tech_bait":
            log.append("[TECHOPURITAN] 'We do not negotiate with monsters.'")
            log.append("They open fire immediately. The transmission cuts to static.")
            if self.game.player_ship:
                poss = list(self.game.player_ship.cells.keys())
                for _ in range(2):
                    if poss:
                        p = random.choice(poss)
                        self.game.player_ship.apply_damage(DamageType.KINETIC, p)
                log.append("Your ship takes heavy fire. The node is lost for now.")
            self.game.current_random_event = None
            self.game.pending_event_node = None
            self._build_ui()
            return

        if etype == "positive":
            if "scrap" in effect:
                self.game.resources.scrap += effect["scrap"]
                log.append(f"+{effect['scrap']} scrap from the deal.")
            if "feast" in effect:
                self.game.resources.feast += effect["feast"]
                log.append(f"+{effect['feast']} feast.")
            if "morale" in effect:
                self.game.run_morale = min(200, self.game.run_morale + effect["morale"])
                log.append(f"+{effect['morale']} run morale.")
            if "temp_component" in effect:
                player = self.game.player_ship
                if player:
                    xs = [p[0] for p in player.cells]
                    new_x = max(xs) + 1
                    player.add_cell((new_x, 0), Cell(CellType.CORRIDOR))
                    player.add_cell((new_x + 1, 0), Cell(CellType.COMPONENT, component_kind=effect["temp_component"]))
                    log.append(f"Added temporary {effect['temp_component']} component for this run.")
            if "artifact" in effect:
                player = self.game.player_ship
                if player:
                    xs = [p[0] for p in player.cells]
                    new_x = max(xs) + 1
                    player.add_cell((new_x, 0), Cell(CellType.CORRIDOR))
                    player.add_cell((new_x + 1, 0), Cell(CellType.ARTIFACT, artifact_kind=effect["artifact"]))
                    log.append(f"Added temporary {effect['artifact']} artifact.")

        elif etype == "betray":
            if special == "pop_fiz_backfire":
                penalty = effect.get("morale_penalty", -15)
                self.game.run_morale = max(0, self.game.run_morale + penalty)
                log.append(effect.get("dark_fact", "They turned the tables."))
                log.append(f"Crew morale crashes. {penalty} morale.")
                if "ratings" in effect:
                    self.game.resources.ratings += effect["ratings"] // 2
            else:
                if "ratings" in effect:
                    self.game.resources.ratings += effect["ratings"]
                    log.append(f"Home base loved the cruelty. +{effect['ratings']} RATINGS.")
                if "morale_penalty" in effect:
                    self.game.run_morale = max(0, self.game.run_morale + effect["morale_penalty"])
                    log.append(f"Clones disturbed. {effect['morale_penalty']} morale.")
                if "cruel_note" in effect:
                    log.append(effect["cruel_note"])

            # Gain home aggression/rep for the betrayed faction (core to the new betrayal rep system)
            fac = event.get("faction")
            if fac and fac in FACTIONS:
                lvl = gain_faction_aggression(self.game.career, fac, 1)
                log.append(f"+1 aggression with {fac} (home rep from betrayal). Level: {lvl}/{AGGRESSION_MAX}")
                if lvl >= AGGRESSION_MAX:
                    log.append(f"[HOME] MAX AGGRESSION with the {fac}! The community is baying for their complete extermination.")

        elif etype == "risky":
            if effect.get("damage_self") and self.game.player_ship:
                poss = list(self.game.player_ship.cells.keys())
                if poss:
                    self.game.player_ship.apply_damage(DamageType.KINETIC, random.choice(poss))
                log.append("The risk backfired — your ship took damage.")
                # Check for instant death from event
                p = self.game.player_ship
                if p and (p.get_network_integrity() < 0.15 or (0, 0) not in p.get_active_corridors()):
                    tube = get_tube_reveal_text(season=self.game.season, run_ratings=self.game.resources.ratings, fights_completed=self.game.fight_num, deaths_this_career=self.game.career.get("deaths", 0))
                    log.append(tube)
                    self.game.career["deaths"] = self.game.career.get("deaths", 0) + 1
                    self.game.change_state(GameState.HUB)
                    return

            if "feast" in effect:
                self.game.resources.feast += effect["feast"]
            if "morale" in effect:
                self.game.run_morale = min(200, self.game.run_morale + effect["morale"])
            if "ratings" in effect:
                self.game.resources.ratings += effect["ratings"]
            log.append("You took the risky path.")

        elif etype == "neutral":
            log.append("You chose to stay focused and move on.")

        elif etype == "genocide":
            if "ratings" in effect:
                self.game.resources.ratings += effect["ratings"]
                log.append(f"GENOCIDE PAYOUT: +{effect['ratings']} RATINGS. The home base is losing its mind over this.")
            if "cruel_note" in effect:
                log.append(effect["cruel_note"])
            # Mark huge progress for the run-end victory check
            fac = event.get("faction")
            if fac:
                self.game.season_stats["genocide_progress"] = self.game.season_stats.get("genocide_progress", 0) + 10
                if self.game.genocide_target == fac:
                    log.append(f"The {fac} are being finished off. This will be remembered as the season's climax.")
            # Still proceed to a (perhaps final) combat for the last ship, or auto clear if no node

        # Clear event and proceed
        self.game.current_random_event = None
        self.game.pending_event_node = None
        if node:
            self.game.enemy_ship = get_node_enemy(node, self.game.fight_num, self.game.unlocks)
            self.game.change_state(GameState.COMBAT)
        else:
            self._build_ui()

    def draw(self, surface: pygame.Surface):
        font_big = pygame.font.SysFont("consolas", 36, bold=True)
        font_sm = pygame.font.SysFont("consolas", 14)

        if self.game.current_random_event:
            event = self.game.current_random_event
            cx = WINDOW_W // 2

            # --- Event illustration (top area) ---
            art = getattr(self, '_event_art', None)
            art_bottom = 40
            if art:
                ax = cx - art.get_width() // 2
                ay = 20
                # Dark vignette behind art
                vignette = pygame.Surface((art.get_width() + 20, art.get_height() + 20), pygame.SRCALPHA)
                vignette.fill((0, 0, 0, 160))
                surface.blit(vignette, (ax - 10, ay - 10))
                surface.blit(art, (ax, ay))
                # Gradient fade at bottom of art
                fade_h = 40
                for row in range(fade_h):
                    alpha = int(255 * (row / fade_h))
                    fade_line = pygame.Surface((art.get_width(), 1), pygame.SRCALPHA)
                    fade_line.fill((COL_BG[0], COL_BG[1], COL_BG[2], alpha))
                    surface.blit(fade_line, (ax, ay + art.get_height() - fade_h + row))
                art_bottom = ay + art.get_height() - 10
            else:
                art_bottom = 40

            # --- Title panel ---
            title_font = pygame.font.SysFont("consolas", 26, bold=True)
            # Color by event type
            special = event.get("special", "")
            category = event.get("category", "")
            if special == "genocide":
                title_col = (255, 50, 50)
            elif category and category.startswith("base"):
                title_col = COL_GOLD
            elif event.get("faction") == "techopuritan":
                title_col = (180, 220, 255)
            elif event.get("faction") == "pop_fiz":
                title_col = (100, 255, 200)
            elif event.get("faction") == "felonia":
                title_col = (200, 130, 255)
            else:
                title_col = COL_ACCENT

            title_surf = title_font.render(event["title"], True, title_col)
            title_y = art_bottom + 8
            surface.blit(title_surf, (cx - title_surf.get_width() // 2, title_y))

            # --- Category badge ---
            badge_font = pygame.font.SysFont("consolas", 11)
            badge_text = (event.get("faction") or category or "event").upper()
            badge_surf = badge_font.render(badge_text, True, (180, 180, 200))
            badge_x = cx - title_surf.get_width() // 2
            surface.blit(badge_surf, (badge_x, title_y - 14))

            # --- Description (word-wrapped) ---
            desc_font = pygame.font.SysFont("consolas", 15)
            desc_y = title_y + 38
            max_desc_w = 620
            words = event["desc"].split()
            desc_lines = []
            current_line = ""
            for word in words:
                test = current_line + (" " if current_line else "") + word
                if desc_font.size(test)[0] > max_desc_w:
                    if current_line:
                        desc_lines.append(current_line)
                    current_line = word
                else:
                    current_line = test
            if current_line:
                desc_lines.append(current_line)

            # Draw description with slight panel background
            desc_panel_h = len(desc_lines[:5]) * 20 + 16
            desc_panel = pygame.Surface((max_desc_w + 40, desc_panel_h), pygame.SRCALPHA)
            desc_panel.fill((15, 18, 30, 180))
            pygame.draw.rect(desc_panel, COL_PANEL_BORDER, desc_panel.get_rect(), 1, border_radius=4)
            surface.blit(desc_panel, (cx - (max_desc_w + 40) // 2, desc_y - 8))

            for i, line in enumerate(desc_lines[:5]):
                d = desc_font.render(line, True, COL_TEXT)
                surface.blit(d, (cx - max_desc_w // 2, desc_y + i * 20))

            # --- Special warnings ---
            warn_y = desc_y + desc_panel_h + 4
            warn_font = pygame.font.SysFont("consolas", 13, bold=True)
            if special == "tech_bait":
                warning = warn_font.render("!! WARNING: This is a trap. They will not honor any deal. !!", True, COL_DANGER)
                surface.blit(warning, (cx - warning.get_width() // 2, warn_y))
            elif special == "pop_fiz_backfire":
                hint = warn_font.render("~ They seem friendly... but they are exactly like you. Betray at your peril. ~", True, COL_GOLD)
                surface.blit(hint, (cx - hint.get_width() // 2, warn_y))
            elif special == "genocide":
                geno = warn_font.render("<<< THE HOME BASE IS WATCHING LIVE — FINISH THEM >>>", True, (255, 50, 50))
                surface.blit(geno, (cx - geno.get_width() // 2, warn_y))

            return

        title = font_big.render("SECTOR MAP", True, COL_ACCENT)
        surface.blit(title, (WINDOW_W // 2 - title.get_width() // 2, 18))

        sub = font_sm.render("Select a destination and DEPART  |  Connected jumps are free — others cost morale", True, COL_TEXT_DIM)
        surface.blit(sub, (WINDOW_W // 2 - sub.get_width() // 2, 58))

        # Styled resource badges — individual color-coded items with subtle background pills
        font_res = pygame.font.SysFont("consolas", 13, bold=True)
        res_items = [
            (f"SCRAP {self.game.resources.scrap}", (180, 200, 80), (40, 45, 25)),
            (f"FEAST {self.game.resources.feast}", (200, 120, 80), (45, 30, 20)),
            (f"RATINGS {self.game.resources.ratings}", COL_GOLD, (50, 42, 15)),
            (f"MORALE {self.game.run_morale}", COL_ACCENT, (20, 40, 55)),
            (f"SEASON {self.game.season}", COL_TEXT_DIM, (30, 32, 40)),
        ]
        rx = 40
        for label, fg, bg in res_items:
            tw = font_res.size(label)[0]
            pill = pygame.Rect(rx - 6, 76, tw + 12, 20)
            pygame.draw.rect(surface, bg, pill, border_radius=4)
            border_col = tuple(max(0, c // 2) for c in fg[:3])
            pygame.draw.rect(surface, border_col, pill, 1, border_radius=4)
            surface.blit(font_res.render(label, True, fg), (rx, 78))
            rx += tw + 22

        active = ", ".join(sorted(getattr(self.game, 'run_upgrades', set()))) or "none"
        bt = getattr(self.game, 'run_backtrack_cost', 25)
        upg = font_sm.render(f"Upgrades: {active}  |  Backtrack: {bt}m", True, (100, 115, 140))
        surface.blit(upg, (40, 102))

        # Faction legend — compact, right-aligned
        faction_legend = "☠ Raider  🐱 Felonia  ✝ Tech  ⚖ Confed  🐬 PopFiz"
        fl = font_sm.render(faction_legend, True, (80, 85, 105))
        surface.blit(fl, (WINDOW_W - fl.get_width() - 20, 102))

        cx = WINDOW_W // 2  # for positioning planet icons relative to the node list
        # planet_positions (centers) are computed once in _compute_layout / on_enter for stable animation + layout
        # planet_rects are (re)built in the planet drawing loop below (used for click-to-highlight)

        # === Branching left-to-right FTL-style map ===
        # Planets positioned by depth (columns) from the connections DAG so forks are visible.
        conns = getattr(self.game, 'sector_connections', {}) or {}
        visited = getattr(self.game, 'run_visited', set())
        curr = self.game.current_node_idx
        hl = getattr(self, 'highlighted_node_idx', curr)

        # Map area background — generated nebula image + sparse overlay stars
        if self.planet_positions:
            xs = [p[0] for p in self.planet_positions]
            ys = [p[1] for p in self.planet_positions]
            minx = max(20, min(xs) - 60)
            maxx = min(WINDOW_W - 290, max(xs) + 90)
            miny = max(120, min(ys) - 50)
            maxy = min(WINDOW_H - 50, max(ys) + 70)
            map_bg = pygame.Rect(minx - 12, miny - 12, maxx - minx + 24, maxy - miny + 24)

            # Blit nebula background (cropped to map area) or fallback to solid dark
            if self._nebula_bg:
                clip = pygame.Rect(minx - 12, miny - 12, maxx - minx + 24, maxy - miny + 24)
                clip.clamp_ip(self._nebula_bg.get_rect())
                bg_crop = self._nebula_bg.subsurface(clip)
                surface.blit(bg_crop, (minx - 12, miny - 12))
                # Subtle rounded border on top
                pygame.draw.rect(surface, (40, 50, 80), map_bg, 1, border_radius=8)
            else:
                pygame.draw.rect(surface, (6, 8, 16), map_bg, border_radius=8)
                pygame.draw.rect(surface, (25, 30, 45), map_bg, 1, border_radius=8)

            # Sparse bright overlay stars for extra depth (seeded)
            star_rng = random.Random(54321)
            for _ in range(90):
                sx = star_rng.randint(int(minx), int(maxx))
                sy = star_rng.randint(int(miny), int(maxy))
                brightness = star_rng.randint(80, 200)
                sz = 1 if star_rng.random() < 0.8 else 2
                c = (brightness, brightness, min(255, brightness + 30))
                pygame.draw.circle(surface, c, (sx, sy), sz)

        faction_colors = {
            "raider": (200, 80, 80),
            "techopuritan": (120, 160, 220),
            "felonia": (80, 200, 140),
            "confederacy": (220, 200, 100),
            "pop_fiz": (180, 100, 200),
        }

        # Use sizes computed in _compute_layout (reflects actual .layer count for this run's 8+ deep map with up to 4-wide columns for four vertical choice layers).
        icon_size = getattr(self, 'map_icon_size', 56)
        label_w = getattr(self, 'map_label_w', 160)

        # Draw connections in 3 passes: future grey → visited dim → active glow
        reachable = set(conns.get(curr, []))

        # Pass 1: future paths (from nodes you haven't reached yet) — solid grey
        for from_i, tos in conns.items():
            if from_i >= len(self.planet_positions): continue
            if from_i == curr: continue  # active connections drawn in pass 3
            if from_i in visited: continue  # visited connections drawn in pass 2
            fx, fy = self.planet_positions[from_i]
            for to_i in tos:
                if to_i >= len(self.planet_positions): continue
                tx, ty = self.planet_positions[to_i]
                pygame.draw.line(surface, (55, 60, 75), (fx, fy), (tx, ty), 1)

        # Pass 2: visited/backward connections — dim dotted
        for from_i, tos in conns.items():
            if from_i >= len(self.planet_positions): continue
            if from_i == curr: continue
            if from_i not in visited: continue
            fx, fy = self.planet_positions[from_i]
            for to_i in tos:
                if to_i in reachable: continue
                if to_i >= len(self.planet_positions): continue
                tx, ty = self.planet_positions[to_i]
                # Dotted line
                ddx, ddy = tx - fx, ty - fy
                length = max(1, (ddx * ddx + ddy * ddy) ** 0.5)
                nx, ny = ddx / length, ddy / length
                step = 8
                for s in range(0, int(length), step):
                    if (s // step) % 2 == 0:
                        x1, y1 = int(fx + nx * s), int(fy + ny * s)
                        x2, y2 = int(fx + nx * min(s + step // 2, length)), int(fy + ny * min(s + step // 2, length))
                        pygame.draw.line(surface, (40, 45, 58), (x1, y1), (x2, y2), 1)

        # Pass 3: active/reachable from current — bright glow + direction chevrons
        if curr < len(self.planet_positions):
            fx, fy = self.planet_positions[curr]
            for to_i in reachable:
                if to_i >= len(self.planet_positions): continue
                tx, ty = self.planet_positions[to_i]
                is_target = (to_i == hl)
                glow_col = (25, 120, 55) if is_target else (25, 80, 40)
                core_col = (100, 255, 140) if is_target else COL_SUCCESS
                pygame.draw.line(surface, glow_col, (fx, fy), (tx, ty), 6 if is_target else 4)
                pygame.draw.line(surface, core_col, (fx, fy), (tx, ty), 2)
                # Direction chevrons along the path
                ddx, ddy = tx - fx, ty - fy
                length = max(1, (ddx * ddx + ddy * ddy) ** 0.5)
                for frac in [0.35, 0.55, 0.75]:
                    ax = int(fx + ddx * frac)
                    ay = int(fy + ddy * frac)
                    chev_sz = 3 if is_target else 2
                    pygame.draw.circle(surface, (140, 255, 170), (ax, ay), chev_sz)

        # Draw planet icons + proper beacon-style labels (this is the "map" the player looks at)
        self.planet_rects = []
        for i, (cx, cy) in enumerate(self.planet_positions):
            px = cx - icon_size // 2
            py = cy - icon_size // 2

            node = self.game.sector[i]

            # Planet icon (from the nice PlanetsFull set)
            if i < len(self.node_planet_surfs):
                surf = self.node_planet_surfs[i]
                surface.blit(surf, (px, py))

            pr = pygame.Rect(px, py, icon_size, icon_size)
            self.planet_rects.append(pr)

            is_curr = (i == curr)
            is_hl = (i == hl)
            col = faction_colors.get(node.enemy_faction, COL_ACCENT)

            # Dim overlay on visited/cleared planets
            if i in visited and not is_curr:
                dim = pygame.Surface((icon_size, icon_size), pygame.SRCALPHA)
                dim.fill((10, 10, 20, 100))
                surface.blit(dim, (px, py))

            # Subtle faction-colored halo ring (always visible, helps identify at a glance)
            if not is_curr and not is_hl:
                halo_col = tuple(min(255, c // 3 + 15) for c in col)
                pygame.draw.circle(surface, halo_col, (cx, cy), icon_size // 2 + 3, 1)

            # Strong selection / current rings (FTL beacon feel)
            if is_curr:
                pygame.draw.circle(surface, COL_GOLD, (cx, cy), icon_size // 2 + 11, 4)
                pygame.draw.circle(surface, (255, 220, 100), (cx, cy), icon_size // 2 + 5, 2)
            if is_hl and not is_curr:
                pygame.draw.circle(surface, COL_ACCENT, (cx, cy), icon_size // 2 + 8, 3)

            # Labels — full card for highlighted/current, compact for others
            sym = {"raider": "☠", "techopuritan": "✝", "felonia": "🐱", "confederacy": "⚖", "pop_fiz": "🐬"}.get(node.enemy_faction, "?")
            label_y = py + icon_size + 3

            if is_hl or is_curr:
                # Compact beacon label — centered under planet, narrow to avoid overlap
                font_lbl = pygame.font.SysFont("consolas", 11)
                short = f"{sym} {node.name[:11]}"
                dcol = COL_DANGER if node.difficulty >= 3 else (COL_GOLD if node.difficulty >= 2 else COL_SUCCESS)
                stat_str = f"D{node.difficulty} x{node.ratings_mult:.1f}"
                nm_surf = font_lbl.render(short, True, COL_TEXT)
                st_surf = font_lbl.render(stat_str, True, dcol)
                card_w = max(nm_surf.get_width(), st_surf.get_width()) + 16
                label_h = 30
                label_bg = pygame.Rect(cx - card_w // 2, label_y - 1, card_w, label_h)
                bg_col = (30, 34, 55) if is_hl else (25, 28, 45)
                pygame.draw.rect(surface, bg_col, label_bg, border_radius=4)
                pygame.draw.rect(surface, col, label_bg, 1, border_radius=4)
                surface.blit(nm_surf, (cx - nm_surf.get_width() // 2, label_y + 1))
                surface.blit(st_surf, (cx - st_surf.get_width() // 2, label_y + 15))
            else:
                # Compact single-line label — boosted contrast for readability
                font_xs = pygame.font.SysFont("consolas", 12)
                short = f"{sym} {node.name[:12]}"
                lbl_col = (140, 145, 165) if i not in visited else (100, 110, 125)
                nm = font_xs.render(short, True, lbl_col)
                surface.blit(nm, (cx - nm.get_width() // 2, label_y + 1))

            # Current / cleared badges
            if is_curr:
                font_here = pygame.font.SysFont("consolas", 10, bold=True)
                hb = font_here.render("YOU", True, COL_GOLD)
                # Small badge centered above the planet
                badge_w = hb.get_width() + 8
                badge_r = pygame.Rect(cx - badge_w // 2, py - 16, badge_w, 14)
                pygame.draw.rect(surface, (50, 42, 15), badge_r, border_radius=3)
                pygame.draw.rect(surface, COL_GOLD, badge_r, 1, border_radius=3)
                surface.blit(hb, (cx - hb.get_width() // 2, py - 15))
            elif i in visited:
                # Small checkmark centered above
                font_chk = pygame.font.SysFont("consolas", 11)
                cb = font_chk.render("✓", True, COL_SUCCESS)
                surface.blit(cb, (cx - cb.get_width() // 2, py - 14))

        # Right side details panel — fixed position matching the button column
        panel_w = 260
        details_x = WINDOW_W - panel_w - 14
        details_y = 120
        panel_h = 295
        if self.game.sector:
            hnode = self.game.sector[hl]
            # Panel background — nebula-tinted or solid dark, with glowing border
            panel_rect = pygame.Rect(details_x, details_y, panel_w, panel_h)
            if self._nebula_bg:
                # Crop nebula from top-right corner for a different look than the map area
                neb_clip = pygame.Rect(WINDOW_W - panel_w - 20, 0, panel_w, panel_h)
                neb_clip.clamp_ip(self._nebula_bg.get_rect())
                panel_bg = self._nebula_bg.subsurface(neb_clip).copy()
                # Extra darken for readability
                dk = pygame.Surface((panel_w, panel_h), pygame.SRCALPHA)
                dk.fill((0, 0, 8, 180))
                panel_bg.blit(dk, (0, 0))
                surface.blit(panel_bg, (details_x, details_y))
            else:
                pygame.draw.rect(surface, (14, 16, 28), panel_rect, border_radius=10)
            # Title bar highlight
            pygame.draw.rect(surface, (18, 22, 38), (details_x + 2, details_y + 2, panel_w - 4, 36), border_radius=8)
            # Glowing border
            pygame.draw.rect(surface, COL_ACCENT, panel_rect, 2, border_radius=10)

            df = pygame.font.SysFont("consolas", 14, bold=True)
            dest_name = hnode.name[:18] if len(hnode.name) > 18 else hnode.name
            dest_title = f"DESTINATION: {dest_name}"
            surface.blit(df.render(dest_title, True, COL_GOLD), (details_x + 10, details_y + 10))

            sf = pygame.font.SysFont("consolas", 12)
            # Faction + stats line with colored difficulty
            dcol = COL_DANGER if hnode.difficulty >= 3 else (COL_GOLD if hnode.difficulty >= 2 else COL_SUCCESS)
            faction_txt = sf.render(f"{hnode.enemy_faction.upper()}", True, COL_TEXT)
            diff_txt = sf.render(f"DIFF {hnode.difficulty}", True, dcol)
            rat_txt = sf.render(f"x{hnode.ratings_mult} RATINGS", True, COL_TEXT_DIM)
            sx = details_x + 10
            surface.blit(faction_txt, (sx, details_y + 34))
            sx += faction_txt.get_width() + 8
            surface.blit(sf.render("•", True, (60, 65, 80)), (sx, details_y + 34))
            sx += 14
            surface.blit(diff_txt, (sx, details_y + 34))
            sx += diff_txt.get_width() + 8
            surface.blit(sf.render("•", True, (60, 65, 80)), (sx, details_y + 34))
            sx += 14
            surface.blit(rat_txt, (sx, details_y + 34))

            # Description — word-wrapped
            desc = hnode.description
            desc_lines = []
            words = desc.split()
            cur = ""
            max_text_w = panel_w - 24
            for w in words:
                test = cur + " " + w if cur else w
                if sf.size(test)[0] < max_text_w:
                    cur = test
                else:
                    desc_lines.append(cur)
                    cur = w
            if cur: desc_lines.append(cur)
            for li, line in enumerate(desc_lines[:5]):
                surface.blit(sf.render(line, True, COL_TEXT_DIM), (details_x + 10, details_y + 56 + li * 15))

            # Divider line before RISK
            div_y = details_y + 56 + min(5, len(desc_lines)) * 15 + 6
            pygame.draw.line(surface, (40, 45, 65), (details_x + 10, div_y), (details_x + panel_w - 10, div_y), 1)

            # Risk section
            risk_y = div_y + 10
            surface.blit(sf.render("RISK:", True, COL_DANGER), (details_x + 10, risk_y))
            risk_words = hnode.risk_notes.split()
            risk_lines = []
            cur = ""
            for w in risk_words:
                test = cur + " " + w if cur else w
                if sf.size(test)[0] < max_text_w:
                    cur = test
                else:
                    risk_lines.append(cur)
                    cur = w
            if cur: risk_lines.append(cur)
            for li, line in enumerate(risk_lines[:4]):
                surface.blit(sf.render(line, True, COL_TEXT), (details_x + 10, risk_y + 18 + li * 14))

            tip = "Click planet to preview"
            surface.blit(sf.render(tip, True, COL_SUCCESS), (details_x + 10, details_y + panel_h - 18))

        # === Styled right-column buttons (upgrades, repair, feast) ===
        # Draw a subtle container background behind all buttons
        sbtns = getattr(self, 'styled_buttons', [])
        if sbtns:
            btn_area_x = sbtns[0]["rect"].x - 4
            btn_area_y = sbtns[0]["rect"].y - 6
            btn_area_w = sbtns[0]["rect"].width + 8
            btn_area_h = sbtns[-1]["rect"].bottom - sbtns[0]["rect"].y + 10
            btn_bg = pygame.Surface((btn_area_w, btn_area_h), pygame.SRCALPHA)
            btn_bg.fill((8, 10, 20, 160))
            surface.blit(btn_bg, (btn_area_x, btn_area_y))
            pygame.draw.rect(surface, (35, 40, 60), (btn_area_x, btn_area_y, btn_area_w, btn_area_h), 1, border_radius=6)
            # Section label
            lbl_font = pygame.font.SysFont("consolas", 9, bold=True)
            lbl = lbl_font.render("UPGRADES & ACTIONS", True, (80, 90, 110))
            surface.blit(lbl, (btn_area_x + btn_area_w // 2 - lbl.get_width() // 2, btn_area_y - 12))

        mouse_pos = pygame.mouse.get_pos()
        btn_font = pygame.font.SysFont("consolas", 12, bold=True)
        btn_font_sub = pygame.font.SysFont("consolas", 10)
        for btn in sbtns:
            r = btn["rect"]
            hovering = r.collidepoint(mouse_pos) and btn["enabled"]
            btn["hover"] = hovering
            ic = btn["icon_col"]

            # Background
            if hovering:
                bg = (35, 40, 60)
            elif btn["enabled"]:
                bg = (22, 25, 40)
            else:
                bg = (18, 20, 30)
            pygame.draw.rect(surface, bg, r, border_radius=6)

            # Left accent bar (colored stripe)
            accent_r = pygame.Rect(r.x, r.y + 3, 4, r.height - 6)
            pygame.draw.rect(surface, ic, accent_r, border_radius=2)

            # Hover glow outline
            if hovering:
                pygame.draw.rect(surface, ic, r, 1, border_radius=6)
            else:
                border = tuple(min(255, c // 3 + 20) for c in ic) if btn["enabled"] else (35, 38, 50)
                pygame.draw.rect(surface, border, r, 1, border_radius=6)

            # Label text
            lbl_col = COL_TEXT if btn["enabled"] else (70, 75, 90)
            lbl = btn_font.render(btn["label"], True, lbl_col)
            surface.blit(lbl, (r.x + 14, r.y + 4))

            # Sub text (cost/info) right-aligned
            if btn["sub"]:
                sub_col = ic if btn["enabled"] else (55, 58, 70)
                sub = btn_font_sub.render(btn["sub"], True, sub_col)
                surface.blit(sub, (r.x + r.width - sub.get_width() - 10, r.y + 8))

            # Small diamond icon for upgrade buttons
            if btn["action"].startswith("upgrade:") and btn["enabled"]:
                dx = r.x + r.width - 8
                dy = r.y + 4
                pts = [(dx, dy - 3), (dx + 3, dy), (dx, dy + 3), (dx - 3, dy)]
                pygame.draw.polygon(surface, ic, pts)

        # === Player ship travel effect ===
        # Small frankenstein ship "docked" outside the current planet, or animating along the path when traveling
        if self.planet_positions:
            curr = getattr(self.game, 'current_node_idx', 0)
            if self.is_traveling and len(self.planet_positions) > self.travel_to:
                from_p = self.planet_positions[self.travel_from]
                to_p = self.planet_positions[self.travel_to]
                prog = min(1.0, max(0.0, self.travel_progress))
                sx = from_p[0] + (to_p[0] - from_p[0]) * prog
                sy = from_p[1] + (to_p[1] - from_p[1]) * prog
                dx = to_p[0] - from_p[0]
                dy = to_p[1] - from_p[1]
                angle = math.atan2(dy, dx) if (dx or dy) else 0
                self._draw_small_ship(surface, sx, sy, angle, scale=0.95)

                # Simple exhaust trail
                for k in range(4):
                    t = max(0.0, prog - k * 0.12)
                    tx = from_p[0] + (to_p[0] - from_p[0]) * t
                    ty = from_p[1] + (to_p[1] - from_p[1]) * t
                    trail_x = tx - math.cos(angle) * (7 + k * 3)
                    trail_y = ty - math.sin(angle) * (7 + k * 3)
                    size = max(1, 3 - k)
                    pygame.draw.circle(surface, (255, 200, 80), (int(trail_x), int(trail_y)), size)
            else:
                # Docked "outside" the current planet (to the right)
                if curr < len(self.planet_positions):
                    cpos = self.planet_positions[curr]
                    ship_x = cpos[0] + 40  # to the right of the (larger) planet icon, ready to depart rightward
                    ship_y = cpos[1] - 2
                    self._draw_small_ship(surface, ship_x, ship_y, 0.0, scale=0.9)

        # Engaging phase (bridge into combat): ship close to planet, alert effects, after travel arrival
        if getattr(self, 'engaging', False) and self.planet_positions and self.engaging_target < len(self.planet_positions):
            pos = self.planet_positions[self.engaging_target]
            prog = min(1.0, max(0.0, self.engaging_progress))
            # Ship "docking/arming" very close to the target planet
            dock_x = pos[0] + 18 * (1 - prog * 0.7)
            dock_y = pos[1]
            self._draw_small_ship(surface, dock_x, dock_y, 0.0, scale=0.9 + prog * 0.1)
            # Pulsing alert ring on the planet
            ring_r = icon_size // 2 + 4 + int(6 * (1 - prog) * abs(math.sin(prog * 8)))
            pygame.draw.circle(surface, COL_DANGER, (pos[0], pos[1] + icon_size // 2), ring_r, 2)
            # Engaging text
            ef = pygame.font.SysFont("consolas", 13, bold=True)
            et = ef.render("ENGAGING HOSTILES", True, COL_DANGER)
            surface.blit(et, (pos[0] - et.get_width() // 2, pos[1] + icon_size + 8))
            if self.engaging_target < len(self.game.sector):
                n = self.game.sector[self.engaging_target]
                nt = ef.render(n.name, True, COL_TEXT)
                surface.blit(nt, (pos[0] - nt.get_width() // 2, pos[1] - icon_size - 18))

        # Settle animation on return from combat (out of combat bridge): ship settles into dock position at current planet
        if self.settle_anim and self.planet_positions and curr < len(self.planet_positions):
            cpos = self.planet_positions[curr]
            sp = min(1.0, self.settle_progress)
            # Ship starts slightly off and moves into final docked spot
            start_off = 45
            final_x = cpos[0] + 30
            sx = cpos[0] + start_off * (1 - sp) + (final_x - cpos[0]) * sp
            sy = cpos[1] - 2
            self._draw_small_ship(surface, sx, sy, 0.0, scale=0.85)
            # Nice settle glow on the planet
            glow_r = icon_size // 2 + 5 * (1 - sp)
            pygame.draw.circle(surface, COL_SUCCESS, (cpos[0], cpos[1] + icon_size // 2), int(glow_r), 2)

        # === CRT terminal frame overlay (on top of all content) ===
        if self._crt_scanlines:
            surface.blit(self._crt_scanlines, (0, 0))
        if self._crt_overlay:
            surface.blit(self._crt_overlay, (0, 0))


# ─── Combat Screen ───────────────────────────────────────────────────────────

# Panel layout constants for combat UI
_PANEL_BOTTOM_H = 180       # height of the bottom HUD panel
_PANEL_PAD = 12             # inner padding
_LOG_LINES = 5              # visible combat log lines
_WEAPON_BTN_W = 160
_WEAPON_BTN_H = 36


class CombatScreen(BaseScreen):
    def __init__(self, game: Game):
        super().__init__(game)
        self.selected_target: Optional[Tuple[int, int]] = None
        self.selected_weapon: Optional[dict] = None  # from get_player_weapons()
        self.selected_dmg: Optional[DamageType] = None
        self.turn: int = 0
        self.orders: List = []  # (dmg, pos) or (dmg, p1, p2, "beam") for FTL line weapons
        self.weapon_buttons: List[Tuple[dict, pygame_gui.elements.UIButton]] = []  # (weapon_info, btn)
        self.enemy_cell_rects: Dict[Tuple[int, int], pygame.Rect] = {}
        self.beam_mode: bool = False
        self.beam_start: Optional[Tuple[int, int]] = None
        # Cached weapon list (refreshed on enter and after resolve)
        self._weapons: List[dict] = []
        # Per-turn tracking: each weapon position fires at most once per turn
        self._used_weapons: set = set()  # set of weapon (pos) tuples already queued this turn
        # Turn resolution animation phase
        self._anim_phase: bool = False  # True while playing resolve animation
        self._anim_events: List[dict] = []  # queued visual events [{type, pos, text, color, ...}]
        self._anim_timer: float = 0.0  # seconds into current anim phase
        self._anim_duration: float = 0.0  # total anim duration
        # Combat-over flag (win or loss detected; blocks further input until transition)
        self._combat_over: bool = False
        self._combat_over_reason: str = ""
        self._combat_over_timer: float = 0.0

    def on_enter(self):
        self.selected_target = None
        self.selected_weapon = None
        self.selected_dmg = None
        self.turn = 0
        self.orders = []
        self.enemy_cell_rects = {}
        self.beam_mode = False
        self.beam_start = None
        self._used_weapons = set()
        self._anim_phase = False
        self._anim_events = []
        self._anim_timer = 0.0
        self._anim_duration = 0.0
        self._combat_over = False
        self._combat_over_reason = ""
        self._combat_over_timer = 0.0
        self._refresh_weapons()
        self._build_ui()
        # Flesh transition "into combat": reference the planet we traveled to / are fighting at
        if self.game.sector and self.game.current_node_idx < len(self.game.sector):
            node = self.game.sector[self.game.current_node_idx]
            self.game.combat_log.append(f"--- HOSTILE CONTACT AT {node.name} ({node.enemy_faction}) ---")

    def _refresh_weapons(self):
        """Refresh the available weapons list from the player ship."""
        self._weapons = get_player_weapons(self.game.player_ship) if self.game.player_ship else []

    def _build_ui(self):
        for el in self.ui_elements:
            el.kill()
        self.ui_elements.clear()
        self.weapon_buttons.clear()

        # --- Weapon buttons (bottom-left, based on actual equipped weapons) ---
        btn_x = _PANEL_PAD + 10
        btn_y = WINDOW_H - _PANEL_BOTTOM_H + _PANEL_PAD + 30  # leave room for section header

        for i, wep in enumerate(self._weapons):
            primary = wep["damage_type"]
            secondary = wep["secondary"]
            tags_str = f" +{wep['tags']}" if wep["tags"] else ""
            # Label: WEAPON_LABEL (DAMAGE) or WEAPON_LABEL (DMG+SEC)
            dmg_str = primary.name
            if secondary:
                dmg_str += f"+{secondary.name}"
            used = tuple(wep["pos"]) in self._used_weapons
            prefix = "✗ " if used else ""
            label = f"{prefix}{wep['label']} ({dmg_str}){tags_str}"

            btn = pygame_gui.elements.UIButton(
                relative_rect=pygame.Rect(btn_x + (i % 4) * (_WEAPON_BTN_W + 8),
                                          btn_y + (i // 4) * (_WEAPON_BTN_H + 6),
                                          _WEAPON_BTN_W, _WEAPON_BTN_H),
                text=label,
                manager=self.game.ui_manager,
            )
            if used:
                btn.disable()
            self.weapon_buttons.append((wep, btn))
            self.ui_elements.append(btn)

        # If player has NO weapons, show a disabled hint
        if not self._weapons:
            no_wep = pygame_gui.elements.UIButton(
                relative_rect=pygame.Rect(btn_x, btn_y, 300, _WEAPON_BTN_H),
                text="NO ACTIVE WEAPONS — graft weapons to fight!",
                manager=self.game.ui_manager,
            )
            no_wep.disable()
            self.ui_elements.append(no_wep)

        # --- Action buttons (bottom-right) ---
        action_x = WINDOW_W - 180
        action_y = WINDOW_H - _PANEL_BOTTOM_H + _PANEL_PAD + 10

        self.btn_resolve = pygame_gui.elements.UIButton(
            relative_rect=pygame.Rect(action_x, action_y, 160, 40),
            text="NEXT TURN",
            manager=self.game.ui_manager,
        )
        self.ui_elements.append(self.btn_resolve)

        self.btn_auto = pygame_gui.elements.UIButton(
            relative_rect=pygame.Rect(action_x, action_y + 48, 160, 32),
            text="AUTO-RESOLVE",
            manager=self.game.ui_manager,
        )
        self.ui_elements.append(self.btn_auto)

        # Gate END COMBAT: only available after some damage has been dealt or combat is over
        can_end = self._combat_over
        if not can_end and self.game.enemy_ship:
            states = self.game.enemy_ship.count_states()
            total = sum(states.values())
            if total > 0 and (states["destroyed"] + states["disabled"]) / total > 0.3:
                can_end = True
        if not can_end and self.turn >= 1:
            can_end = True  # allow exit after at least 1 turn

        self.btn_end_combat = pygame_gui.elements.UIButton(
            relative_rect=pygame.Rect(action_x, action_y + 88, 160, 40),
            text="END COMBAT",
            manager=self.game.ui_manager,
        )
        if not can_end:
            self.btn_end_combat.disable()
        self.ui_elements.append(self.btn_end_combat)

    def handle_event(self, event: pygame.event.Event):
        # Block all input during animation phase or combat-over delay
        if self._anim_phase or self._combat_over:
            return

        if event.type == pygame_gui.UI_BUTTON_PRESSED:
            # Weapon selection
            for wep, btn in self.weapon_buttons:
                if event.ui_element == btn:
                    self.selected_weapon = wep
                    self.selected_dmg = wep["damage_type"]
                    if wep["is_beam"]:
                        self.beam_mode = True
                        self.beam_start = None
                        self.game.combat_log.append(f"BEAM selected: click two points on the enemy to sweep.")
                    else:
                        self.beam_mode = False
                        self.beam_start = None
                        if wep["is_scatter"]:
                            self.game.combat_log.append(f"SCATTER selected: click target — fragments spray nearby cells.")
                        elif wep["mode"] == "area":
                            self.game.combat_log.append(f"AREA selected: click target — damage spreads to adjacent cells.")
                    return

            if event.ui_element == self.btn_resolve:
                self._resolve_turn()
                return

            if event.ui_element == self.btn_auto:
                # Auto: use each unused weapon on random targets
                enemy = self.game.enemy_ship
                if enemy and self._weapons:
                    for wep in self._weapons:
                        wpos = tuple(wep["pos"])
                        if wpos in self._used_weapons:
                            continue
                        dt = wep["damage_type"]
                        poss = list(enemy.cells.keys())
                        if poss:
                            tgt = random.choice(poss)
                            if wep["is_beam"] and len(poss) >= 2:
                                p1, p2 = random.sample(poss, 2)
                                self.orders.append({"dmg": dt, "p1": p1, "p2": p2, "beam": True, "weapon": wep})
                            else:
                                self.orders.append({"dmg": dt, "target": tgt, "beam": False, "weapon": wep})
                            self._used_weapons.add(wpos)
                            self.game.combat_log.append(f"[AUTO] {wep['label']} ({dt.name}) queued")
                self._resolve_turn()
                return

            if event.ui_element == self.btn_end_combat:
                self.game.change_state(GameState.POST_COMBAT)
                return

        # Click on enemy ship cells to target (single cell or beam two-click for line weapons)
        if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            mx, my = event.pos
            for pos, rect in self.enemy_cell_rects.items():
                if rect.collidepoint(mx, my):
                    self.selected_target = pos
                    if self.beam_mode:
                        if self.beam_start is None:
                            self.beam_start = pos
                            self.game.combat_log.append(f"Beam origin: {pos} — click endpoint to fire")
                        else:
                            b_dmg = self.selected_dmg or DamageType.KINETIC
                            self.orders.append({"dmg": b_dmg, "p1": self.beam_start, "p2": pos, "beam": True, "weapon": self.selected_weapon})
                            self.game.combat_log.append(
                                f"Queued BEAM {b_dmg.name} {self.beam_start} → {pos}"
                            )
                            # Mark beam weapon as used
                            if self.selected_weapon:
                                self._used_weapons.add(tuple(self.selected_weapon["pos"]))
                            self.beam_mode = False
                            self.beam_start = None
                            self.selected_weapon = None
                            self.selected_dmg = None
                            self._build_ui()
                    elif self.selected_dmg and self.selected_weapon:
                        self.orders.append({"dmg": self.selected_dmg, "target": pos, "beam": False, "weapon": self.selected_weapon})
                        wep_label = self.selected_weapon["label"]
                        self.game.combat_log.append(
                            f"Queued {wep_label} → {pos}"
                        )
                        # Mark this weapon as used for the turn
                        self._used_weapons.add(tuple(self.selected_weapon["pos"]))
                        self.selected_weapon = None
                        self.selected_dmg = None
                        self._build_ui()
                    break

    def _resolve_turn(self):
        """Execute all queued orders, then full shared combat resolution."""
        if not self.orders and not self.selected_target:
            return

        self.turn += 1
        enemy = self.game.enemy_ship
        player = self.game.player_ship

        # Build animation events from player orders
        self._anim_events = []
        for order in self.orders:
            if order.get("beam"):
                self._anim_events.append({"type": "beam", "p1": order["p1"], "p2": order["p2"],
                                          "dmg": order["dmg"], "weapon": order.get("weapon"), "side": "player"})
            else:
                self._anim_events.append({"type": "shot", "target": order["target"],
                                          "dmg": order["dmg"], "weapon": order.get("weapon"), "side": "player"})

        # Execute player attacks
        for order in self.orders:
            if not enemy:
                break
            wep = order.get("weapon")
            if order.get("beam"):
                logs = execute_player_attack(player, enemy, order["dmg"], beam=(order["p1"], order["p2"]), weapon=wep)
                self.game.combat_log.extend(logs)
            else:
                logs = execute_player_attack(player, enemy, order["dmg"], target=order["target"], weapon=wep)
                self.game.combat_log.extend(logs)

        self.orders.clear()

        # Enemy retaliation + environmental
        if enemy and player:
            res_logs = resolve_combat_turn(enemy, player)
            for l in res_logs:
                if l.startswith("ENEMY") or "REPAIRED" in l or "Fire" in l or "NANITE" in l or "MEDICAL" in l:
                    self.game.combat_log.append(l if l.startswith("[") else f"[RESOLVE] {l}")
                else:
                    self.game.combat_log.append(l)

            if self.game.run_morale < 30 and random.random() < 0.4:
                self.game.combat_log.append("[LOW MORALE] Crew panic: extra fire spread risk this turn.")
                if player:
                    poss = [p for p, c in player.cells.items() if c.state == CellState.INTACT and not player.is_component_active(p)]
                    if poss:
                        player.apply_damage(DamageType.FIRE, random.choice(poss))

        # ─── Win/Loss condition checks ─────────────────────────────────────
        self._check_combat_end_conditions()

        # Start animation phase
        self._anim_phase = True
        self._anim_timer = 0.0
        self._anim_duration = max(0.8, len(self._anim_events) * 0.3)

        # Reset per-turn weapon usage for next turn
        self._used_weapons = set()

        # Refresh weapons (some may have been destroyed by retaliation)
        self._refresh_weapons()
        self._build_ui()

    def _check_combat_end_conditions(self):
        """Check win/loss conditions and set _combat_over if met."""
        enemy = self.game.enemy_ship
        player = self.game.player_ship

        # --- Enemy destroyed (WIN) ---
        if enemy:
            states = enemy.count_states()
            total = sum(states.values())
            if total > 0:
                # All cells destroyed or disabled — total neutralization
                if states["intact"] == 0:
                    self._combat_over = True
                    self._combat_over_reason = "ENEMY NEUTRALIZED — all systems offline!"
                    self.game.combat_log.append("── " + self._combat_over_reason + " ──")
                    return
                # Over 90% wrecked — auto-end (shattered)
                damage_ratio = (states["destroyed"] + states["disabled"]) / total
                if damage_ratio >= 0.9:
                    self._combat_over = True
                    self._combat_over_reason = "ENEMY SHATTERED — hull integrity critical!"
                    self.game.combat_log.append("── " + self._combat_over_reason + " ──")
                    return
                # No active weapons AND no active engines — helpless
                enemy_threats = get_active_threats(enemy)
                enemy_engines = any(
                    c.type == CellType.COMPONENT and (c.component_kind or "").lower() == "engine"
                    and c.state == CellState.INTACT and enemy.is_component_active(p)
                    for p, c in enemy.cells.items()
                )
                if not enemy_threats and not enemy_engines:
                    self._combat_over = True
                    self._combat_over_reason = "ENEMY HELPLESS — no weapons or engines remain!"
                    self.game.combat_log.append("── " + self._combat_over_reason + " ──")
                    return
                # Critically damaged hint (not auto-end, just message + enable END COMBAT)
                if damage_ratio > 0.6:
                    self.game.combat_log.append("── Enemy critically damaged! End combat to salvage. ──")

        # --- Player destroyed (LOSS) ---
        if player:
            p_states = player.count_states()
            p_total = sum(p_states.values())
            if p_total > 0 and p_states["intact"] == 0:
                self._combat_over = True
                self._combat_over_reason = "YOUR DERELICT IS GONE — the tube awaits..."
                self.game.combat_log.append("── " + self._combat_over_reason + " ──")
                return
            try:
                if player.get_network_integrity() < 0.10:
                    self._combat_over = True
                    self._combat_over_reason = "CORE FAILING — your ship is breaking apart!"
                    self.game.combat_log.append("── " + self._combat_over_reason + " ──")
                    return
                elif player.get_network_integrity() < 0.25:
                    self.game.combat_log.append("Your core is failing... Finish this fight, then the tube awaits.")
            except Exception:
                pass

    def update(self, dt: float):
        """Handle animation phase and combat-over auto-transition."""
        # Animation phase: let visual events play out before allowing input
        if self._anim_phase:
            self._anim_timer += dt
            if self._anim_timer >= self._anim_duration:
                self._anim_phase = False
                self._anim_events = []

        # Combat-over: show message briefly then auto-transition
        if self._combat_over:
            self._combat_over_timer += dt
            if self._combat_over_timer >= 2.0:
                # Determine if player lost or won
                player = self.game.player_ship
                if player:
                    p_states = player.count_states()
                    p_total = sum(p_states.values())
                    player_dead = (p_total > 0 and p_states["intact"] == 0)
                    try:
                        player_dead = player_dead or player.get_network_integrity() < 0.10
                    except Exception:
                        pass
                else:
                    player_dead = True
                if player_dead:
                    self.game.change_state(GameState.GAME_OVER)
                else:
                    self.game.change_state(GameState.POST_COMBAT)

    def _get_enemy_faction(self) -> str:
        """Determine faction for enemy tileset based on sector node."""
        if self.game.sector and self.game.current_node_idx < len(self.game.sector):
            node = self.game.sector[self.game.current_node_idx]
            return node.enemy_faction
        return "raider"

    def _render_ship_interactive(self, surface: pygame.Surface, ship: Ship, x_offset: int, y_offset: int,
                                  title: str, is_enemy: bool = False) -> Dict[Tuple[int, int], pygame.Rect]:
        """Render a ship using tileset sprites and return clickable cell rects."""
        cell_rects: Dict[Tuple[int, int], pygame.Rect] = {}
        if not ship or not ship.cells:
            return cell_rects

        faction = self._get_enemy_faction() if is_enemy else "player"

        # Title
        font = pygame.font.SysFont("consolas", 16, bold=True)
        txt = font.render(title, True, COL_ACCENT if not is_enemy else COL_DANGER)
        surface.blit(txt, (x_offset, y_offset - 25))

        highlight = self.selected_target if is_enemy else None
        cell_rects = self.game.tile_renderer.render_ship(
            surface, ship, x_offset, y_offset,
            faction=faction, scale=2,
            highlight_cell=highlight
        )

        return cell_rects

    def _draw_panel_bg(self, surface: pygame.Surface, rect: pygame.Rect, alpha: int = 200):
        """Draw a semi-transparent dark panel background with border."""
        panel = pygame.Surface((rect.w, rect.h), pygame.SRCALPHA)
        panel.fill((15, 18, 30, alpha))
        surface.blit(panel, rect.topleft)
        pygame.draw.rect(surface, COL_PANEL_BORDER, rect, 1)

    def draw(self, surface: pygame.Surface):
        # Faction-specific combat background
        faction = self._get_enemy_faction()
        bg_name = f"combat_bg_{faction}.png"
        if not _draw_screen_bg(surface, bg_name, overlay_alpha=160):
            _draw_screen_bg(surface, "combat_bg.png", overlay_alpha=160)

        font = pygame.font.SysFont("consolas", 13)
        font_bold = pygame.font.SysFont("consolas", 13, bold=True)
        font_title = pygame.font.SysFont("consolas", 15, bold=True)

        # ─── Top instruction bar ─────────────────────────────────────────
        top_bar = pygame.Rect(0, 0, WINDOW_W, 32)
        self._draw_panel_bg(surface, top_bar, 220)
        instr_text = "Select weapon → Click enemy cell to target"
        if self._combat_over:
            instr_text = f"█ {self._combat_over_reason} █"
        elif self._anim_phase:
            instr_text = "► RESOLVING TURN... ◄"
        elif self.beam_mode:
            instr_text = "BEAM MODE: Click origin cell, then endpoint to sweep"
        elif self.selected_weapon and self.selected_weapon.get("is_scatter"):
            instr_text = "SCATTER MODE: Click target — fragments spray nearby cells"
        elif self.selected_weapon and self.selected_weapon.get("mode") == "area":
            instr_text = "AREA MODE: Click target — damage spreads to adjacent cells"
        elif not self.selected_dmg:
            instr_text = "Select a weapon below to begin targeting"
        instr = font.render(instr_text, True, COL_TEXT_DIM)
        surface.blit(instr, (12, 8))

        # Turn counter (top-right)
        turn_txt = font_bold.render(f"Turn {self.turn}", True, COL_ACCENT)
        surface.blit(turn_txt, (WINDOW_W - 80, 8))

        # ─── Ship viewport area (middle) ─────────────────────────────────
        viewport_top = 36
        viewport_bottom = WINDOW_H - _PANEL_BOTTOM_H - 4

        # Player ship (left side)
        if self.game.player_ship:
            self._render_ship_interactive(
                surface, self.game.player_ship, 30, viewport_top + 30, "YOUR DERELICT", is_enemy=False
            )

        # Enemy ship (right side) — clickable
        if self.game.enemy_ship:
            self.enemy_cell_rects = self._render_ship_interactive(
                surface, self.game.enemy_ship, WINDOW_W // 2 + 30, viewport_top + 30,
                self.game.enemy_ship.name or "ENEMY", is_enemy=True
            )

        # ─── Queued target highlights (persistent red on committed targets) ──
        if self.orders and self.enemy_cell_rects:
            for order in self.orders:
                targets = []
                if order.get("beam"):
                    if order["p1"] in self.enemy_cell_rects:
                        targets.append(order["p1"])
                    if order["p2"] in self.enemy_cell_rects:
                        targets.append(order["p2"])
                else:
                    tgt = order.get("target")
                    if tgt and tgt in self.enemy_cell_rects:
                        targets.append(tgt)
                for tpos in targets:
                    tr = self.enemy_cell_rects[tpos]
                    hl_surf = pygame.Surface((tr.w, tr.h), pygame.SRCALPHA)
                    hl_surf.fill((220, 40, 40, 70))
                    surface.blit(hl_surf, tr.topleft)
                    pygame.draw.rect(surface, (255, 60, 60), tr, 2)

        # Visual effects overlay
        try:
            recent = " ".join(self.game.combat_log[-6:]).upper()
            effects = self.game.tile_renderer.effects
            if effects and ("FIRE" in recent or "BREACH" in recent or "EXPLOSION" in recent or "VOLATILE" in recent):
                if effects.smoke_frames:
                    ex = WINDOW_W // 2 + 80 + random.randint(-40, 80)
                    ey = 150 + random.randint(-20, 40)
                    frame = effects.smoke_frames[len(recent) % len(effects.smoke_frames)]
                    surface.blit(pygame.transform.scale(frame, (24, 24)), (ex, ey))
                if ("EXPLOSION" in recent or "VOLATILE" in recent) and effects.explosion_frames:
                    ex = WINDOW_W // 2 + 120 + random.randint(-30, 30)
                    ey = 180 + random.randint(-10, 20)
                    frame = effects.explosion_frames[0]
                    surface.blit(pygame.transform.scale(frame, (32, 32)), (ex, ey))
        except Exception:
            pass

        # Beam preview line
        if self.beam_mode and self.beam_start and self.beam_start in self.enemy_cell_rects:
            start_rect = self.enemy_cell_rects[self.beam_start]
            start_center = start_rect.center
            mx, my = pygame.mouse.get_pos()
            end_center = (mx, my)
            for pos, rect in list(self.enemy_cell_rects.items()):
                if rect.collidepoint(mx, my):
                    end_center = rect.center
                    break
            pygame.draw.line(surface, (255, 80, 80), start_center, end_center, 3)
            pygame.draw.circle(surface, (255, 220, 80), start_center, 5)

        # Spray / Area targeting preview on mouse hover
        if self.selected_weapon and not self.beam_mode and self.enemy_cell_rects:
            mx, my = pygame.mouse.get_pos()
            hovered_pos = None
            for pos, rect in self.enemy_cell_rects.items():
                if rect.collidepoint(mx, my):
                    hovered_pos = pos
                    break
            if hovered_pos is not None:
                wep_mode = self.selected_weapon.get("mode", "single")
                if wep_mode == "spray":
                    # Draw a scatter circle around the hovered cell
                    hr = self.enemy_cell_rects[hovered_pos]
                    cx_s, cy_s = hr.center
                    radius = int(hr.w * 2.2)
                    scatter_surf = pygame.Surface((radius * 2, radius * 2), pygame.SRCALPHA)
                    pygame.draw.circle(scatter_surf, (255, 140, 40, 50), (radius, radius), radius)
                    pygame.draw.circle(scatter_surf, (255, 140, 40, 140), (radius, radius), radius, 2)
                    surface.blit(scatter_surf, (cx_s - radius, cy_s - radius))
                    # Highlight cells within spray radius
                    x0, y0 = hovered_pos
                    for (ax, ay), arect in self.enemy_cell_rects.items():
                        if abs(ax - x0) <= 1 and abs(ay - y0) <= 1 and (ax, ay) != hovered_pos:
                            spray_hl = pygame.Surface((arect.w, arect.h), pygame.SRCALPHA)
                            spray_hl.fill((255, 140, 40, 60))
                            surface.blit(spray_hl, arect.topleft)
                elif wep_mode == "area":
                    # Highlight adjacent cells that could be hit
                    x0, y0 = hovered_pos
                    for dx, dy in [(1, 0), (-1, 0), (0, 1), (0, -1)]:
                        adj = (x0 + dx, y0 + dy)
                        if adj in self.enemy_cell_rects:
                            arect = self.enemy_cell_rects[adj]
                            area_hl = pygame.Surface((arect.w, arect.h), pygame.SRCALPHA)
                            area_hl.fill((255, 60, 20, 70))
                            surface.blit(area_hl, arect.topleft)
                            pygame.draw.rect(surface, (255, 100, 40, 180), arect, 1)
                elif wep_mode == "single":
                    # Simple crosshair on hovered cell
                    hr = self.enemy_cell_rects[hovered_pos]
                    pygame.draw.rect(surface, (255, 255, 100, 200), hr, 2)

        # ─── Animation phase overlay ──────────────────────────────────────
        if self._anim_phase and self._anim_events:
            progress = min(1.0, self._anim_timer / max(0.01, self._anim_duration))
            event_idx = min(int(progress * len(self._anim_events)), len(self._anim_events) - 1)
            for i, ae in enumerate(self._anim_events[:event_idx + 1]):
                fade = max(0.3, 1.0 - (event_idx - i) * 0.25)
                alpha = int(200 * fade)
                if ae["type"] == "shot" and ae["side"] == "player":
                    tgt = ae["target"]
                    if tgt in self.enemy_cell_rects:
                        tr = self.enemy_cell_rects[tgt]
                        flash = pygame.Surface((tr.w + 8, tr.h + 8), pygame.SRCALPHA)
                        flash.fill((255, 200, 60, alpha))
                        surface.blit(flash, (tr.x - 4, tr.y - 4))
                        # Impact text
                        wep = ae.get("weapon")
                        lbl = wep["label"] if wep else ae["dmg"].name
                        ft = font_bold.render(lbl, True, (255, 255, 200))
                        surface.blit(ft, (tr.centerx - ft.get_width() // 2, tr.y - 18))
                elif ae["type"] == "beam" and ae["side"] == "player":
                    p1, p2 = ae["p1"], ae["p2"]
                    if p1 in self.enemy_cell_rects and p2 in self.enemy_cell_rects:
                        r1 = self.enemy_cell_rects[p1]
                        r2 = self.enemy_cell_rects[p2]
                        beam_col = (100, 200, 255, alpha)
                        pygame.draw.line(surface, beam_col[:3], r1.center, r2.center, 4)
                        pygame.draw.circle(surface, (255, 255, 200), r1.center, 5)
                        pygame.draw.circle(surface, (255, 255, 200), r2.center, 5)

        # ─── Combat-over banner overlay ───────────────────────────────────
        if self._combat_over:
            banner = pygame.Surface((WINDOW_W, 60), pygame.SRCALPHA)
            banner.fill((0, 0, 0, 200))
            surface.blit(banner, (0, WINDOW_H // 2 - 30))
            reason_font = pygame.font.SysFont("consolas", 22, bold=True)
            reason_txt = reason_font.render(self._combat_over_reason, True, COL_GOLD)
            surface.blit(reason_txt, (WINDOW_W // 2 - reason_txt.get_width() // 2, WINDOW_H // 2 - 11))

        # ─── Custom cursor rendering ──────────────────────────────────────
        if self.selected_weapon and not self._anim_phase and not self._combat_over:
            mx, my = pygame.mouse.get_pos()
            wep_mode = self.selected_weapon.get("mode", "single")
            # Only draw custom cursor when over the enemy ship area
            in_enemy_area = any(r.collidepoint(mx, my) for r in self.enemy_cell_rects.values())
            if in_enemy_area:
                if wep_mode == "line":
                    # Beam: draw line cursor
                    pygame.draw.line(surface, (100, 200, 255), (mx - 10, my), (mx + 10, my), 2)
                    pygame.draw.line(surface, (100, 200, 255), (mx, my - 10), (mx, my + 10), 2)
                    pygame.draw.circle(surface, (100, 200, 255), (mx, my), 8, 1)
                elif wep_mode == "spray":
                    # Scatter: draw spread cursor
                    pygame.draw.circle(surface, (255, 140, 40), (mx, my), 12, 2)
                    pygame.draw.circle(surface, (255, 140, 40), (mx, my), 4)
                elif wep_mode == "area":
                    # Area: draw splash cursor
                    pygame.draw.circle(surface, (255, 60, 20), (mx, my), 10, 2)
                    for dx, dy in [(-6, 0), (6, 0), (0, -6), (0, 6)]:
                        pygame.draw.circle(surface, (255, 100, 40), (mx + dx, my + dy), 3)
                else:
                    # Single: crosshair
                    pygame.draw.line(surface, (255, 255, 100), (mx - 8, my), (mx + 8, my), 2)
                    pygame.draw.line(surface, (255, 255, 100), (mx, my - 8), (mx, my + 8), 2)

        # ─── Combat log (mid-bottom, between ships and HUD) ──────────────
        log_panel_y = viewport_bottom - _LOG_LINES * 16 - 8
        log_rect = pygame.Rect(10, log_panel_y, WINDOW_W - 20, _LOG_LINES * 16 + 12)
        self._draw_panel_bg(surface, log_rect, 180)

        log_entries = self.game.combat_log[-_LOG_LINES:]
        for i, entry in enumerate(log_entries):
            col = COL_DANGER if "[ENEMY]" in entry or "[RESOLVE]" in entry else COL_TEXT_DIM
            if "EXPLOSION" in entry or "VOLATILE" in entry:
                col = COL_GOLD
            elif "Queued" in entry:
                col = COL_SUCCESS
            elif "critically" in entry.lower():
                col = COL_DANGER
            txt = font.render(entry[:120], True, col)
            surface.blit(txt, (18, log_panel_y + 6 + i * 16))

        # ─── Bottom HUD panel ────────────────────────────────────────────
        hud_rect = pygame.Rect(0, WINDOW_H - _PANEL_BOTTOM_H, WINDOW_W, _PANEL_BOTTOM_H)
        self._draw_panel_bg(surface, hud_rect, 230)
        pygame.draw.line(surface, COL_PANEL_BORDER, (0, WINDOW_H - _PANEL_BOTTOM_H), (WINDOW_W, WINDOW_H - _PANEL_BOTTOM_H), 2)

        # Section title: WEAPONS
        wep_header = font_title.render("WEAPONS", True, COL_ACCENT)
        surface.blit(wep_header, (_PANEL_PAD + 10, WINDOW_H - _PANEL_BOTTOM_H + _PANEL_PAD + 8))

        # Selected weapon indicator + description
        sel_y = WINDOW_H - _PANEL_BOTTOM_H + _PANEL_PAD + 8
        if self.selected_weapon:
            kind = self.selected_weapon["kind"].upper()
            dmg_name = self.selected_dmg.name if self.selected_dmg else "?"
            mode = self.selected_weapon.get("mode", "single").upper()
            sel_txt = font_bold.render(f"Active: {kind} ({dmg_name} / {mode})", True, COL_SUCCESS)
            surface.blit(sel_txt, (220, sel_y))
            # Weapon description from profile
            desc = self.selected_weapon.get("desc") or WEAPON_PROFILES.get(self.selected_weapon["kind"], {}).get("desc", "")
            if desc:
                desc_txt = font.render(desc, True, COL_TEXT_DIM)
                surface.blit(desc_txt, (220, sel_y + 16))
        elif not self._weapons:
            sel_txt = font_bold.render("No weapons online!", True, COL_DANGER)
            surface.blit(sel_txt, (220, sel_y))

        # Orders queue count
        if self.orders:
            oq_txt = font_bold.render(f"Orders: {len(self.orders)}", True, COL_GOLD)
            surface.blit(oq_txt, (450, sel_y))

        # Hovered enemy cell tooltip (show component/artifact info)
        if self.enemy_cell_rects and self.game.enemy_ship:
            mx, my = pygame.mouse.get_pos()
            for pos, rect in self.enemy_cell_rects.items():
                if rect.collidepoint(mx, my):
                    cell = self.game.enemy_ship.cells.get(pos)
                    if cell:
                        tip_parts = []
                        if cell.type == CellType.COMPONENT and cell.component_kind:
                            active_str = "ACTIVE" if self.game.enemy_ship.is_component_active(pos) else "OFFLINE"
                            tip_parts.append(f"{cell.component_kind.upper()} ({cell.state.name}) [{active_str}]")
                        elif cell.type == CellType.ARTIFACT and cell.artifact_kind:
                            tip_parts.append(f"ART: {cell.artifact_kind.upper()} ({cell.state.name})")
                        elif cell.type == CellType.CORRIDOR:
                            active_corr = self.game.enemy_ship.get_active_corridors()
                            conn_str = "CONNECTED" if pos in active_corr else "DISCONNECTED"
                            core_str = " [CORE - Life Support]" if pos == self.game.enemy_ship.core else ""
                            if pos == self.game.enemy_ship.core:
                                tip_parts.append(f"Corridor ({cell.state.name}) [{conn_str}]{core_str} — REINFORCED")
                            elif cell.state == CellState.INTACT and pos in active_corr:
                                hp = self.game.enemy_ship.get_corridor_strength(pos)
                                hits = cell.hits_taken
                                tip_parts.append(f"Corridor [{conn_str}] HP:{hp - hits}/{hp}{core_str}")
                            else:
                                tip_parts.append(f"Corridor ({cell.state.name}) [{conn_str}]{core_str}")
                        if tip_parts:
                            tip_str = " | ".join(tip_parts)
                            tip_surf = font.render(tip_str, True, COL_TEXT)
                            tip_bg = pygame.Surface((tip_surf.get_width() + 8, 18), pygame.SRCALPHA)
                            tip_bg.fill((10, 10, 30, 220))
                            surface.blit(tip_bg, (mx + 12, my - 20))
                            surface.blit(tip_surf, (mx + 16, my - 19))
                    break

        # ─── Status info (right side of bottom panel) ────────────────────
        info_x = WINDOW_W - 420
        info_y = WINDOW_H - _PANEL_BOTTOM_H + _PANEL_PAD + 8

        if self.game.enemy_ship:
            states = self.game.enemy_ship.count_states()
            quality = self.game.enemy_ship.get_capture_quality()

            # Enemy status line
            status_txt = font.render(
                f"Enemy: {states['intact']}ok / {states['disabled']}dis / {states['destroyed']}wrk  |  {quality}",
                True, COL_TEXT
            )
            surface.blit(status_txt, (info_x, info_y))

            # Shield info
            try:
                esh = self.game.enemy_ship.get_active_shield_count()
                psh = self.game.player_ship.get_active_shield_count() if self.game.player_ship else 0
                sh_txt = font.render(f"Shields: You {psh} | Enemy {esh}", True, COL_ACCENT)
                surface.blit(sh_txt, (info_x, info_y + 18))
            except Exception:
                pass

            # Enemy threats
            try:
                threats = get_active_threats(self.game.enemy_ship)
                fac = getattr(self.game.enemy_ship, 'faction', 'raider')
                ai_hint = {'techopuritan': 'methodical', 'pop_fiz': 'chaotic', 'felonia': 'precise', 'confederacy': 'defensive'}.get(fac, 'aggressive')
                ttxt = font.render(f"Threats: {len(threats)} weapons ({ai_hint})", True, COL_DANGER if threats else COL_TEXT_DIM)
                surface.blit(ttxt, (info_x, info_y + 36))
            except Exception:
                pass

            # Morale
            morale_col = COL_SUCCESS if self.game.run_morale >= 60 else COL_GOLD if self.game.run_morale >= 30 else COL_DANGER
            m_txt = font.render(f"Morale: {self.game.run_morale}", True, morale_col)
            surface.blit(m_txt, (info_x, info_y + 54))


# ─── Post-Combat / Salvage Screen ────────────────────────────────────────────

class PostCombatScreen(BaseScreen):
    def __init__(self, game: Game):
        super().__init__(game)
        self.salvage_options: List[Chunk] = []
        self.selected_chunk_idx: int = -1
        self.chunk_buttons: List[pygame_gui.elements.UIButton] = []
        self.loot: Resources = Resources()
        self.ratings_earned: int = 0
        # Manual graft placement state (fleshed post-combat editor, limited to the chosen chunk only)
        self.placement_mode: bool = False
        self.placement_chunk: Optional[Chunk] = None
        self.placement_variants: List[Chunk] = []
        self.placement_variant_idx: int = 0
        self.placement_candidates: List[Tuple[Tuple[int,int], Tuple[int,int]]] = []  # (ship_pos, chunk_port)
        self.selected_attach_idx: int = -1
        self.placement_buttons: List[pygame_gui.elements.UIButton] = []
        self.anim_graft: Optional[dict] = None  # for satisfying attachment animation

    def _reset_placement(self):
        self.placement_mode = False
        self.placement_chunk = None
        self.placement_variants = []
        self.placement_variant_idx = 0
        self.placement_candidates = []
        self.selected_attach_idx = -1
        for b in self.placement_buttons:
            b.kill()
        self.placement_buttons = []
        self.anim_graft = None

    def on_enter(self):
        self.selected_chunk_idx = -1
        self.chunk_buttons = []
        self._reset_placement()

        # Compute loot + salvage from enemy
        enemy = self.game.enemy_ship
        if enemy:
            quality = enemy.get_capture_quality()
            self.loot = enemy.compute_loot()
            node = self.game.sector[self.game.current_node_idx] if self.game.sector else None
            self.ratings_earned = enemy.calculate_ratings(quality, self.game.combat_log)
            if node:
                self.ratings_earned = int(self.ratings_earned * node.ratings_mult)
            # Apply run-only ratings mult (from crowd pleaser etc) + contract
            run_rm = getattr(self.game, 'run_ratings_mult', 0.0)
            self.ratings_earned = int(self.ratings_earned * (1.0 + run_rm))
            cmult = getattr(self.game, 'contract_ratings_mult', 1.0)
            self.ratings_earned = int(self.ratings_earned * cmult)
            # Morale factor (low morale from backtracks = lame to clones = less ratings, like terminal)
            morale = getattr(self.game, 'run_morale', 65)
            morale_factor = 1.0
            if morale < 30:
                morale_factor = 0.55
            elif morale < 55:
                morale_factor = 0.8
            elif morale < 75:
                morale_factor = 0.92
            self.ratings_earned = int(self.ratings_earned * morale_factor)
            self.loot.ratings = self.ratings_earned

            # Confederacy "good guys" penalty: brutal attacks on them reduce ratings (fleshed from design)
            node = self.game.sector[self.game.current_node_idx] if self.game.sector else None
            if node and getattr(node, 'enemy_faction', None) == "confederacy" and self.ratings_earned > 5:
                penalty = max(5, int(self.ratings_earned * 0.25))
                self.ratings_earned -= penalty
                self.loot.ratings = self.ratings_earned
                self.game.combat_log.append(f"[CONFEDERACY] Brutality against 'the good guys' costs ratings: -{penalty}")

            # Apply graft diversity bonuses from the pieces you *flew with* into this fight (broadcast claws etc)
            bonus_res, g_logs = apply_player_graft_bonuses(self.game.player_ship, self.loot, self.game.combat_log)
            for gl in g_logs:
                self.game.combat_log.append(gl)
            self.loot = bonus_res
            self.ratings_earned = bonus_res.ratings
            self.salvage_options = enemy.generate_salvage_options(max_options=5)
            # gain run_morale from live captures (disable for crew alive) -- apply run mult + cap_kit like terminal
            st = enemy.count_states()
            base_cap = st["disabled"] * 2 + (8 if quality == "clean_capture" else 4 if quality == "decent" else 0)
            mult = getattr(self.game, 'run_morale_gain_mult', 1.0)
            cg = int(base_cap * mult)
            if "cap_kit" in getattr(self.game, 'run_upgrades', set()):
                cg += 5
                self.game.combat_log.append("(+5 from cap kit upgrade)")
            self.game.run_morale = min(200, self.game.run_morale + cg)
            if cg > 0:
                self.game.combat_log.append(f"+{cg} run morale from live crew captures")

            # Record for contracts / televised meta drip at home base
            if node:
                self.game.record_fight_result(node, enemy, quality, self.game.combat_log or [])
            # Accumulate feast for "feast haul" contracts (from this fight's loot)
            try:
                self.game.season_stats["total_feast"] = self.game.season_stats.get("total_feast", 0) + int(getattr(self.loot, "feast", 0))
            except Exception:
                pass

            # Mark as visited for richer map viz and logic
            try:
                self.game.run_visited.add(self.game.current_node_idx)
            except Exception:
                pass

            # More random events: post-fight reflection / complication (small chance)
            if random.random() < 0.15:
                ctx = {"location": "run", "difficulty": getattr(node, 'difficulty', 1) if node else 1}
                if node:
                    ctx["faction"] = getattr(node, "enemy_faction", "raider")
                    ctx["aggression_level"] = get_faction_aggression(self.game.career, ctx["faction"])
                    ctx["genocide_target"] = getattr(self.game, "genocide_target", None)
                ev = roll_random_event(ctx)
                self.game.combat_log.append(f"[POST-FIGHT EVENT] {ev['title']}")
                self.game.combat_log.append(ev['desc'][:100] + "...")
                # Auto take "safe" option for prototype (player sees result in log)
                if ev.get("options"):
                    safe = ev["options"][0]
                    eff = safe.get("effect", {})
                    if eff.get("type") == "positive":
                        if "scrap" in eff: self.game.resources.scrap += eff["scrap"]
                        if "ratings" in eff: self.game.resources.ratings += eff["ratings"]
                    self.game.combat_log.append(f"  You handled it. ({safe['text'][:40]})")
                elif ev.get("category") == "base_rival":
                    self.game.combat_log.append("  Audience reaction noted.")

        else:
            self.loot = Resources()
            self.salvage_options = []
            self.ratings_earned = 0

        self._build_ui()

    def _build_ui(self):
        for el in self.ui_elements:
            el.kill()
        self.ui_elements.clear()
        self.chunk_buttons.clear()
        for b in self.placement_buttons:
            b.kill()
        self.placement_buttons.clear()

        cx = WINDOW_W // 2
        btn_w, btn_h = 350, 55
        start_y = 260

        if self.placement_mode and self.placement_chunk:
            # Placement editor UI (fleshed manual attachment phase, limited to chosen chunk only - no free draw like dev builder)
            title = pygame_gui.elements.UILabel(
                relative_rect=pygame.Rect(cx - 200, 80, 400, 30),
                text=f"ATTACH: {self.placement_chunk.name} (rotate & choose dock)",
                manager=self.game.ui_manager,
            )
            self.ui_elements.append(title)

            # Rotate button
            rot_btn = pygame_gui.elements.UIButton(
                relative_rect=pygame.Rect(cx - 120, 120, 240, 40),
                text=f"Cycle Rotation ({self.placement_variant_idx+1}/4)",
                manager=self.game.ui_manager,
            )
            self.placement_buttons.append(rot_btn)
            self.ui_elements.append(rot_btn)

            # List candidate attach points (from model get_valid... )
            y = 180
            for i, (ship_pos, ch_port) in enumerate(self.placement_candidates[:5]):
                v = self.placement_variants[self.placement_variant_idx]
                label = f"Attach at ship {ship_pos} (chunk port {ch_port})"
                b = pygame_gui.elements.UIButton(
                    relative_rect=pygame.Rect(cx - btn_w//2, y, btn_w, 38),
                    text=label[:45],
                    manager=self.game.ui_manager,
                )
                b.attach_idx = i
                self.placement_buttons.append(b)
                self.ui_elements.append(b)
                y += 42

            # Confirm and other actions
            conf = pygame_gui.elements.UIButton(
                relative_rect=pygame.Rect(cx - 150, y + 10, 300, 45),
                text="CONFIRM ATTACHMENT (snap in!)",
                manager=self.game.ui_manager,
            )
            self.placement_buttons.append(conf)
            self.ui_elements.append(conf)

            auto_b = pygame_gui.elements.UIButton(
                relative_rect=pygame.Rect(cx - 150, y + 60, 140, 38),
                text="Auto instead",
                manager=self.game.ui_manager,
            )
            self.placement_buttons.append(auto_b)
            self.ui_elements.append(auto_b)

            back_b = pygame_gui.elements.UIButton(
                relative_rect=pygame.Rect(cx + 10, y + 60, 140, 38),
                text="Back to choices",
                manager=self.game.ui_manager,
            )
            self.placement_buttons.append(back_b)
            self.ui_elements.append(back_b)

            # Hint
            hint = pygame_gui.elements.UILabel(
                relative_rect=pygame.Rect(40, WINDOW_H - 80, 500, 30),
                text="Port match required. Prefers corridor connections for active network. Click a dock position.",
                manager=self.game.ui_manager,
            )
            self.ui_elements.append(hint)
            return

        # Normal chunk choice UI
        for i, chunk in enumerate(self.salvage_options):
            intact = sum(1 for c in chunk.cells.values() if c.state == CellState.INTACT)
            disabled = sum(1 for c in chunk.cells.values() if c.state == CellState.DISABLED)
            comps = [c.component_kind for c in chunk.cells.values() if c.type == CellType.COMPONENT and c.component_kind]
            arts = [c.artifact_kind for c in chunk.cells.values() if c.type == CellType.ARTIFACT and c.artifact_kind]
            desc = f"{chunk.name} ({len(chunk.cells)} cells: {intact}ok {disabled}dmg)"
            if comps:
                desc += f" [{','.join(comps[:3])}]"
            if arts:
                desc += f" +{','.join(arts[:2])}"

            btn = pygame_gui.elements.UIButton(
                relative_rect=pygame.Rect(cx - btn_w // 2, start_y + i * 70, btn_w, btn_h),
                text=desc[:55],
                manager=self.game.ui_manager,
            )
            self.chunk_buttons.append(btn)
            self.ui_elements.append(btn)

        # Skip button
        self.btn_skip = pygame_gui.elements.UIButton(
            relative_rect=pygame.Rect(cx - btn_w // 2, start_y + len(self.salvage_options) * 70 + 10, btn_w, 45),
            text="SKIP GRAFT (claim extra scrap)",
            manager=self.game.ui_manager,
        )
        self.ui_elements.append(self.btn_skip)

    def handle_event(self, event: pygame.event.Event):
        if event.type == pygame_gui.UI_BUTTON_PRESSED:
            # Placement mode handlers first
            if self.placement_mode:
                if event.ui_element in self.placement_buttons:
                    if hasattr(event.ui_element, 'attach_idx'):
                        self.selected_attach_idx = event.ui_element.attach_idx
                        self._build_ui()
                        return
                    txt = event.ui_element.text
                    if "Cycle" in txt or "Rotate" in txt:
                        self.placement_variant_idx = (self.placement_variant_idx + 1) % 4
                        self._prepare_placement_candidates()
                        self._build_ui()
                        return
                    if "CONFIRM" in txt:
                        self._confirm_placement_graft()
                        return
                    if "Auto" in txt:
                        self._reset_placement()
                        if self.selected_chunk_idx >= 0:
                            self._graft_chunk(self.selected_chunk_idx)  # falls to auto
                        return
                    if "Back" in txt:
                        self._reset_placement()
                        self._build_ui()
                        return
                return  # ignore other buttons in placement

            for i, btn in enumerate(self.chunk_buttons):
                if event.ui_element == btn:
                    self._enter_placement(i)  # new: manual placement instead of immediate auto
                    return
            if event.ui_element == self.btn_skip:
                self._skip_graft()
                return

    def _graft_chunk(self, idx: int):
        """Attempt to graft selected chunk onto player ship."""
        chunk = self.salvage_options[idx]
        player = self.game.player_ship
        if not player:
            return

        # Use the robust auto-graft from model (tries rotations/ports, prefers corridor-connected seams, undoes bad ones)
        success, glogs = player.try_auto_graft(chunk)
        if success:
            self.game.combat_log.append(f"Grafted {chunk.name} onto your ship!")
            self.game.combat_log.append("Claw pull engaged... the hulk chunk is torn free amid screams and sparks.")  # design hook fleshed
            for lg in glogs[-2:]:  # show last relevant notes
                if lg.strip():
                    self.game.combat_log.append(lg)
        else:
            self.game.combat_log.append(f"Could not attach {chunk.name} — took as scrap instead.")
            self.loot.scrap += 5
            for lg in glogs:
                if lg.strip():
                    self.game.combat_log.append(lg)

        # Award loot
        self.game.resources += self.loot
        self._advance()

    def _skip_graft(self):
        """Skip grafting, extra scrap."""
        self.loot.scrap += 8
        self.game.resources += self.loot
        self._advance()

    def _enter_placement(self, chunk_idx: int):
        """Enter manual attachment editor for the chosen chunk (fleshed 'graft editor' phase).
        Limited: only the selected chunk's cells; no free drawing new tiles (unlike dev builder).
        Player chooses rotation + which dock position on their ship.
        """
        if chunk_idx < 0 or chunk_idx >= len(self.salvage_options):
            return
        chunk = self.salvage_options[chunk_idx]
        player = self.game.player_ship
        if not player:
            self._graft_chunk(chunk_idx)  # fallback
            return

        self.selected_chunk_idx = chunk_idx
        self.placement_chunk = chunk
        self.placement_variants = [chunk] + [chunk.rotated(t) for t in range(1, 4)]
        self.placement_variant_idx = 0
        self._prepare_placement_candidates()
        self.placement_mode = True
        self.selected_attach_idx = 0 if self.placement_candidates else -1
        self._build_ui()

    def _prepare_placement_candidates(self):
        if not self.placement_chunk or not self.game.player_ship:
            self.placement_candidates = []
            return
        v = self.placement_variants[self.placement_variant_idx]
        cands = self.game.player_ship.get_valid_attach_positions(v)
        # store (ship_attach, chunk_port)
        self.placement_candidates = [(att, prt) for att, prt, _ in cands[:5]]

    def _confirm_placement_graft(self):
        if self.selected_attach_idx < 0 or not self.placement_candidates or not self.placement_chunk:
            self._graft_chunk(self.selected_chunk_idx)
            return
        ship_pos, ch_port = self.placement_candidates[self.selected_attach_idx]
        v = self.placement_variants[self.placement_variant_idx]
        player = self.game.player_ship
        if not player:
            return

        # Start satisfying animation (ghost chunk flies in)
        self.anim_graft = {
            "variant": v,
            "attach": ship_pos,
            "port": ch_port,
            "start_ms": pygame.time.get_ticks(),
            "duration_ms": 650,
        }
        # Do the actual graft immediately for state, animation is visual only
        ok, glogs = player.graft_chunk(v, attach_at=ship_pos, chunk_port=ch_port)
        if ok:
            self.game.combat_log.append(f"Manual graft: {v.name} attached at {ship_pos} (port {ch_port})")
            self.game.combat_log.append("Claw pull engaged... the hulk chunk is torn free amid screams and sparks.")  # design hook fleshed
            for lg in glogs[-1:]:
                if lg: self.game.combat_log.append(lg)
        else:
            self.game.combat_log.append("Attachment failed despite preview.")

        # award loot etc
        self.game.resources += self.loot
        # clear placement but keep anim running until draw finishes it
        self._reset_placement()
        # after anim, advance (we'll check anim in draw or use a timer callback; for simplicity use a delayed advance via flag)
        # For prototype, advance after short delay in draw or immediately
        self._advance()  # state advance; anim is cosmetic in draw

    def _advance(self):
        """Move to next encounter or hub. Auto-advance the 'frontier' on the map so it feels like progressing the route.
        Now also handles player death after salvage from this fight (retaliation / accumulated damage).
        Death ends the run early but still awards the current fight's loot/graft and triggers end-of-run meta (contracts, genocide).
        """
        player = self.game.player_ship
        if player and (player.get_network_integrity() < 0.15 or (0, 0) not in player.get_active_corridors()):
            # Player died (core lost) after completing post-combat for this fight.
            # Still get the salvage, but run ends with the tube reveal.
            tube_text = get_tube_reveal_text(
                season=self.game.season,
                run_ratings=self.game.resources.ratings,
                fights_completed=self.game.fight_num,
                total_career_ratings=self.game.career.get("total_ratings_earned", 0),
                brutality=self.game.season_stats.get("shattered_count", 0) + self.game.season_stats.get("spectacle_count", 0),
                deaths_this_career=self.game.career.get("deaths", 0),
            )
            self.game.combat_log.append(tube_text)
            self.game.career["deaths"] = self.game.career.get("deaths", 0) + 1

            self._perform_run_completion(is_death=True)
            self.game.persist_meta()
            self.game.change_state(GameState.HUB)
            return

        self.game.fight_num += 1
        if self.game.fight_num > len(self.game.sector):
            self._perform_run_completion(is_death=False)
        else:
            # For branching: suggest a forward child from connections if any, else stay (player chooses on map using forks)
            conns = getattr(self.game, 'sector_connections', {})
            curr = self.game.current_node_idx
            children = conns.get(curr, [])
            if children:
                # pick first un-visited-ish (simple: first child)
                self.game.current_node_idx = children[0]
            # else leave current; map will offer choices based on connections + back cost
            # Back to sector map for next choice (richer with branching now)
            self.game.just_returned_from_combat = True
            self.game.change_state(GameState.SECTOR_MAP)

    def _perform_run_completion(self, is_death: bool = False):
        """Shared end-of-run processing for contracts, genocide victories, stats, and going to city hub.
        Called on normal run complete or on death (early end).
        """
        # Run complete — evaluate contracts (televised horrific acts), award bonus ratings, drip story at the city stage.
        bonus, stories = evaluate_contracts(
            self.game.active_contracts,
            self.game.season_stats,
            self.game.combat_log or [],
            career=self.game.career,
        )
        if bonus > 0:
            self.game.resources.ratings += bonus
            for s in stories:
                self.game.combat_log.append(f"[LIVE FEED / GRAFTYARD] {s}")
            self.game.combat_log.append(f"+{bonus} BONUS RATINGS from completed contracts. The audience at home is pleased.")
        # Clear for next season (player picks fresh at the city stage)
        self.game.active_contracts = []
        gt = getattr(self.game, 'genocide_target', None)
        if gt:
            gprog = self.game.season_stats.get("genocide_progress", 0) or self.game.season_stats.get("factions_defeated", {}).get(gt, 0)
            if gprog >= 2:
                gbonus = 70 + gprog * 8
                self.game.resources.ratings += gbonus
                self.game.combat_log.append(f"[GENOCIDE VICTORY] The last of the {gt} have been purged! The Graftyard community sees this as the ultimate victory of the season. +{gbonus} RATINGS. Your reputation soars.")
                if "genocides_completed" not in self.game.career or not isinstance(self.game.career.get("genocides_completed"), dict):
                    self.game.career["genocides_completed"] = {}
                self.game.career["genocides_completed"][gt] = self.game.career["genocides_completed"].get(gt, 0) + 1
                if not isinstance(self.game.unlocks, dict):
                    self.game.unlocks = {}
                self.game.unlocks["genocide_veteran"] = self.game.unlocks.get("genocide_veteran", 0) + 1
                self.game.combat_log.append("[END GAME] Permanent 'Genocide Veteran' status earned. Future runs carry the infamy of your extinctions.")
                self.game.last_genocide_victory = gt
            self.game.genocide_target = None
        self.game.season_stats = {
            "factions_defeated": {},
            "shattered_count": 0,
            "techopuritan_cleared": 0,
            "total_destroyed": 0,
            "spectacle_count": 0,
            "clean_captures": 0,
            "backtracks": 0,
            "total_feast": 0,
            "fights": 0,
            "avg_destroyed_ratio": 0.0,
            "clean_sweeps": 0,
            "genocide_progress": 0,
            "clean_captures": 0,
            "backtracks": 0,
            "total_feast": 0,
        }

        # Always go to hub (city) on run end (normal or death)
        self.game.persist_meta()
        # Clean temp mid-run files now that run is over
        try:
            for fname in ["current_run_player.json", "current_run_enemy.json"]:
                p = Path("dev_ships") / fname
                if p.exists():
                    p.unlink()
            if Path("space_derelict_current_run.json").exists():
                Path("space_derelict_current_run.json").unlink()
        except Exception:
            pass
        self.game.change_state(GameState.HUB)

    def _get_component_desc(self, kind: str) -> str:
        """Get a human-readable description of what a component does."""
        descs = {
            "gun": "Fires kinetic shots at single targets",
            "laser": "Ion beam strips shields",
            "engine": "Provides propulsion + evasion",
            "power": "Powers adjacent systems",
            "armor": "Absorbs damage, protects hull",
            "shield": "Blocks first hits (layer system)",
            "medical": "Auto-repairs disabled cells each turn",
            "cargo": "Extra salvage capacity",
            "missile": "Kinetic + fire on impact",
            "flamer": "Area fire damage, spreads",
            "drone_bay": "EMP drones + free strikes",
            "broadcast_array": "Boosts ratings earned",
            "harvester_claw": "Siphons feast from enemy",
            "stealth_plate": "Reduces enemy targeting accuracy",
            "scattergun": "Spray kinetic fragments at multiple cells",
            "beam": "Ion line sweep across multiple cells",
        }
        return descs.get(kind, kind.replace("_", " ").title())

    def _get_artifact_desc(self, kind: str) -> str:
        """Get a human-readable description of what an artifact does."""
        descs = {
            "volatile": "Explodes when destroyed (risky but powerful)",
            "booster": "Increases adjacent weapon damage",
            "dampener": "Reduces incoming damage to adjacent cells",
            "reactor": "Powers components without corridor",
            "feast_chamber": "Bonus feast from captures",
            "scanner": "Reveals enemy weaknesses",
            "jammer": "Blocks enemy targeting of adjacent",
            "nanite": "Self-repairs one cell per turn",
            "overdrive": "Double-fires adjacent weapons (risky)",
            "scatter": "Makes adjacent gun hit multiple targets",
            "widebeam": "Adjacent beam hits extra cell",
            "multishot": "Adjacent weapon fires twice",
            "doubler": "Doubles damage of adjacent weapon",
            "neurotoxin": "Kinetic hits also apply nerve gas",
            "beam_focus": "Extends beam range",
            "prism": "Splits beam into two paths",
            "distributor": "Shares artifact effects to all connected",
            "decoy": "Draws enemy fire (bait)",
        }
        return descs.get(kind, kind.replace("_", " ").title())

    def draw(self, surface: pygame.Surface):
        # Background
        _draw_screen_bg(surface, "post_combat_bg.png", overlay_alpha=150)

        font_big = pygame.font.SysFont("consolas", 28, bold=True)
        font = pygame.font.SysFont("consolas", 14)
        font_sm = pygame.font.SysFont("consolas", 11)
        font_title = pygame.font.SysFont("consolas", 13, bold=True)

        # Title
        quality = "???"
        if self.game.enemy_ship:
            quality = self.game.enemy_ship.get_capture_quality()

        title = font_big.render("SALVAGE — Choose a Piece", True, COL_ACCENT)
        surface.blit(title, (WINDOW_W // 2 - title.get_width() // 2, 12))

        # Quality + loot summary (compact)
        qual_col = COL_SUCCESS if "capture" in quality else COL_DANGER if "shatter" in quality else COL_TEXT
        qual_txt = font.render(f"Quality: {quality.upper()}  |  +{self.loot.scrap} scrap  +{self.loot.feast} feast  +{self.ratings_earned} ratings", True, qual_col)
        surface.blit(qual_txt, (WINDOW_W // 2 - qual_txt.get_width() // 2, 48))

        # Player ship preview (left side, small)
        if self.game.player_ship and not self.placement_mode:
            try:
                font_title_surf = font_title.render("YOUR SHIP", True, COL_ACCENT)
                surface.blit(font_title_surf, (15, 75))
                self.game.tile_renderer.render_ship(
                    surface, self.game.player_ship, 15, 95, faction="player", scale=0.8
                )
            except Exception:
                pass

        # ─── Chunk Selection: Show chunks as visual ship pieces ────────────
        if not self.placement_mode:
            # Layout: chunks spread across the screen in a row
            num_chunks = len(self.salvage_options)
            if num_chunks > 0:
                # Calculate spacing
                chunk_area_x = 180
                chunk_area_w = WINDOW_W - 200
                chunk_slot_w = min(180, chunk_area_w // max(num_chunks, 1))
                chunk_y_base = 90

                for i, chunk in enumerate(self.salvage_options):
                    cx = chunk_area_x + i * chunk_slot_w + chunk_slot_w // 2 - 50
                    cy = chunk_y_base

                    # Determine if this chunk button is hovered (match to pygame_gui buttons)
                    is_selected = (i == self.selected_chunk_idx)

                    # Draw chunk panel background
                    panel_rect = pygame.Rect(cx - 8, cy - 5, chunk_slot_w - 10, WINDOW_H - 170)
                    panel_col = (30, 50, 60, 200) if not is_selected else (40, 80, 60, 220)
                    p_surf = pygame.Surface((panel_rect.w, panel_rect.h), pygame.SRCALPHA)
                    p_surf.fill(panel_col)
                    surface.blit(p_surf, panel_rect.topleft)
                    border_col = COL_ACCENT if is_selected else COL_PANEL_BORDER
                    pygame.draw.rect(surface, border_col, panel_rect, 2 if is_selected else 1)

                    # Chunk name
                    name_txt = font_title.render(chunk.name[:18], True, COL_GOLD)
                    surface.blit(name_txt, (cx, cy + 5))

                    # Render chunk visually using tile renderer
                    try:
                        # All corridors in a salvaged chunk are "active" (not attached to a ship yet)
                        chunk_corridors = {p for p, c in chunk.cells.items() if c.type == CellType.CORRIDOR and c.state == CellState.INTACT}
                        temp_chunk_obj = type('obj', (object,), {
                            'cells': chunk.cells,
                            'core': next(iter(chunk_corridors), (0, 0)),
                            'get_active_corridors': lambda s, cells=chunk.cells: {p for p, c in cells.items() if c.type == CellType.CORRIDOR and c.state == CellState.INTACT},
                            'is_component_active': lambda s, p: True,
                            'faction': 'player'
                        })()
                        self.game.tile_renderer.render_ship(
                            surface, temp_chunk_obj, cx, cy + 25, faction="raider", scale=0.7
                        )
                    except Exception:
                        # Fallback: colored rectangles (green = corridor, grey = destroyed)
                        tile = 12
                        for (dx, dy), cell in chunk.cells.items():
                            gx = cx + dx * tile
                            gy = cy + 25 + dy * tile
                            if cell.state == CellState.DESTROYED:
                                col = (40, 20, 20)
                            elif cell.type == CellType.CORRIDOR:
                                col = (30, 120, 50) if cell.state == CellState.INTACT else (50, 50, 55)
                            elif cell.type == CellType.COMPONENT:
                                col = (40, 50, 100)
                            else:
                                col = (80, 40, 80)
                            pygame.draw.rect(surface, col, (gx, gy, tile-1, tile-1))

                    # Component/artifact descriptions below the visual
                    desc_y = cy + 140
                    comps = [(c.component_kind, c.state) for c in chunk.cells.values()
                             if c.type == CellType.COMPONENT and c.component_kind]
                    arts = [(c.artifact_kind, c.state) for c in chunk.cells.values()
                            if c.type == CellType.ARTIFACT and c.artifact_kind]

                    # Cell count summary
                    intact = sum(1 for c in chunk.cells.values() if c.state == CellState.INTACT)
                    damaged = sum(1 for c in chunk.cells.values() if c.state == CellState.DISABLED)
                    destroyed = sum(1 for c in chunk.cells.values() if c.state == CellState.DESTROYED)
                    summary_txt = font_sm.render(f"{len(chunk.cells)} cells: {intact}ok {damaged}dmg {destroyed}brk", True, COL_TEXT_DIM)
                    surface.blit(summary_txt, (cx - 4, desc_y))
                    desc_y += 16

                    # Components with descriptions
                    for comp_kind, state in comps[:4]:
                        state_icon = "●" if state == CellState.INTACT else "○" if state == CellState.DISABLED else "✗"
                        desc = self._get_component_desc(comp_kind)
                        col = COL_SUCCESS if state == CellState.INTACT else COL_GOLD if state == CellState.DISABLED else COL_DANGER
                        comp_txt = font_sm.render(f"{state_icon} {comp_kind.upper()}", True, col)
                        surface.blit(comp_txt, (cx - 4, desc_y))
                        desc_y += 13
                        desc_txt = font_sm.render(f"  {desc[:28]}", True, COL_TEXT_DIM)
                        surface.blit(desc_txt, (cx - 4, desc_y))
                        desc_y += 13

                    # Artifacts
                    for art_kind, state in arts[:3]:
                        state_icon = "◆" if state == CellState.INTACT else "◇"
                        desc = self._get_artifact_desc(art_kind)
                        col = (180, 80, 200) if state == CellState.INTACT else COL_TEXT_DIM
                        art_txt = font_sm.render(f"{state_icon} {art_kind.upper()}", True, col)
                        surface.blit(art_txt, (cx - 4, desc_y))
                        desc_y += 13
                        desc_txt = font_sm.render(f"  {desc[:28]}", True, COL_TEXT_DIM)
                        surface.blit(desc_txt, (cx - 4, desc_y))
                        desc_y += 13

        # ─── Placement mode visuals ────────────────────────────────────────
        if self.placement_mode and self.placement_candidates:
            # Player ship for context
            if self.game.player_ship:
                try:
                    self.game.tile_renderer.render_ship(
                        surface, self.game.player_ship, 40, 100, faction="player", scale=1.0
                    )
                except Exception:
                    pass

            # Dock positions text
            y = 420
            for i, (spos, cport) in enumerate(self.placement_candidates):
                col = COL_ACCENT if i == self.selected_attach_idx else COL_TEXT_DIM
                t = font_sm.render(f"  Dock {i+1}: ship@{spos}  chunk-port@{cport}", True, col)
                surface.blit(t, (420, y))
                y += 18

            # Preview of current variant
            v = self.placement_variants[self.placement_variant_idx]
            try:
                temp_preview = type('obj', (object,), {
                    'cells': v.cells,
                    'get_active_corridors': lambda s, cells=v.cells: {p for p, c in cells.items() if c.type == CellType.CORRIDOR and c.state == CellState.INTACT},
                    'is_component_active': lambda s, p: True,
                    'faction': 'player'
                })()
                self.game.tile_renderer.render_ship(
                    surface, temp_preview, 550, 320, faction="player", scale=1.0
                )
            except Exception:
                pass
            prev = font_sm.render(f"Rotation {self.placement_variant_idx+1}/4: {len(v.cells)} cells", True, COL_GOLD)
            surface.blit(prev, (550, y + 10))

        # Attachment animation (satisfying "snap in" feel)
        if self.anim_graft:
            ag = self.anim_graft
            now = pygame.time.get_ticks()
            prog = min(1.0, (now - ag["start_ms"]) / ag["duration_ms"])
            ship_x, ship_y = 40, 100
            target_x = ship_x + ag["attach"][0] * 18
            target_y = ship_y + ag["attach"][1] * 18
            start_x = WINDOW_W + 50
            start_y = target_y - 30
            cx = start_x + (target_x - start_x) * prog
            cy = start_y + (target_y - start_y) * (prog ** 0.7)
            v = ag["variant"]
            try:
                temp_ghost = type('obj', (object,), {
                    'cells': v.cells,
                    'get_active_corridors': lambda s, cells=v.cells: {p for p, c in cells.items() if c.type == CellType.CORRIDOR and c.state == CellState.INTACT},
                    'is_component_active': lambda s, p: True,
                    'faction': 'player'
                })()
                self.game.tile_renderer.render_ship(
                    surface, temp_ghost, int(cx) - 10, int(cy) - 10, faction="player", scale=0.6
                )
            except Exception:
                tile = 18
                for (dx, dy), cell in v.cells.items():
                    gx = cx + dx * tile
                    gy = cy + dy * tile
                    if cell.type == CellType.CORRIDOR:
                        col = (80, 180, 220)
                    elif cell.type == CellType.COMPONENT:
                        col = (220, 200, 80)
                    else:
                        col = (180, 80, 200)
                    pygame.draw.rect(surface, col, (gx, gy, tile-1, tile-1), 0)
                    pygame.draw.rect(surface, (40, 40, 60), (gx, gy, tile-1, tile-1), 1)
            if prog >= 0.98:
                self.anim_graft = None


# ─── Hub / City Screen ───────────────────────────────────────────────────────

class HubScreen(BaseScreen):
    def __init__(self, game: Game):
        super().__init__(game)
        self.current_location: str = "plaza"
        self.contract_choice_buttons: List[pygame_gui.elements.UIButton] = []
        self.selected_contract_ids: List[str] = []

        # Frame selection (now lives inside the Vats location)
        self.frame_buttons: List[pygame_gui.elements.UIButton] = []
        self.selected_frame_for_preview: str = game.chosen_frame if hasattr(game, 'chosen_frame') else "basic"

        # Navigation buttons that are always present (location bar)
        self.location_buttons: Dict[str, pygame_gui.elements.UIButton] = {}

    def on_enter(self):
        # Reset cooldowns for this hub visit (each return from a run = fresh actions)
        self.game.hub_cooldowns.reset()

        # Reset to central plaza when entering the full city stage, or keep last location if desired
        if self.current_location not in GRAFTYARD_LOCATIONS:
            self.current_location = "plaza"
        self.selected_contract_ids = [c.get("id") for c in (self.game.active_contracts or [])]
        self.selected_frame_for_preview = getattr(self.game, 'chosen_frame', 'basic')

        # Occasional random event at the home base stage (visitors, audience demands, etc.)
        if self.current_location == "plaza" and random.random() < 0.2:
            ctx = {"location": "base"}
            ev = roll_random_event(ctx)
            self.game.combat_log.append(f"[BASE EVENT] {ev['title']}: {ev['desc'][:80]}")
            if ev.get("options"):
                # Auto "safe" for now
                self.game.combat_log.append(f"  Handled: {ev['options'][0]['text'][:50]}")

        # Special flavor if we just died and woke in the tube (fleshed death narrative)
        recent_logs = " ".join(self.game.combat_log[-3:]).lower()
        if "vat fluid" in recent_logs or "tube again" in recent_logs:
            self.game.combat_log.append("[TUBE] The producers greet your return: 'Rough exit out there, but the audience is still talking about it. Back to the vats — new body, new run.'")

        # Simple post-run feast party flavor for high performing seasons (narrative + small hook)
        if self.game.season_stats.get("shattered_count", 0) + self.game.season_stats.get("total_feast", 0) > 18:
            if self.game.hub_cooldowns.is_available("feast_party_auto"):
                self.game.combat_log.append("[CITY] The vats threw a wrap party for last season's 'donations'. The audience is still buzzing. +5 morale (run).")
                self.game.run_morale = min(200, getattr(self.game, 'run_morale', 65) + 5)
                self.game.hub_cooldowns.use("feast_party_auto")

        # Extra plaza entry flavor - the square is always 'on air'
        if self.current_location == "plaza":
            brutality = self.game.season_stats.get("shattered_count", 0) + self.game.season_stats.get("spectacle_count", 0)
            if brutality > 3:
                self.game.combat_log.append("[PLAZA] The square's screens are looping your last big shatter. People point and whisper.")
            if self.game.resources.ratings > 70:
                self.game.combat_log.append("[PLAZA] A small crowd of fans (and rivals) has gathered. You're a name now.")
            if isinstance(self.game.unlocks, dict) and self.game.unlocks.get("statue_dedicated"):
                self.game.combat_log.append("[PLAZA] Your dedication at the Colossus is still talked about in the square.")
            if isinstance(self.game.unlocks, dict) and self.game.unlocks.get("entertainment_expanded"):
                self.game.combat_log.append("[PLAZA] The expanded pits are drawing bigger crowds through the square.")

        # Initial flavor when entering feast for the first time in session (story drip)
        if self.current_location == "feast" and not hasattr(self, '_feast_entered'):
            self._feast_entered = True
            if self.game.resources.feast > 15:
                self.game.combat_log.append("[FEAST HALL] The hall is thick with the smell of the last run's 'donations'.")
            self.game.combat_log.append("[FEAST HALL] The vats hum. You are what you eat.")

        if self.current_location == "lounge" and not hasattr(self, '_lounge_entered'):
            self._lounge_entered = True
            self.game.combat_log.append("[LOUNGE] The air is thick with cigar smoke and deals. 'Welcome back, star.'")
            if self.game.resources.ratings > 100:
                self.game.combat_log.append("[LOUNGE] The executives nod approvingly at your ratings.")

        # Vats entry flavor - the core meta moment, reactive to chosen/preview and career
        if self.current_location == "vats" and not hasattr(self, '_vats_entered'):
            self._vats_entered = True
            cur = getattr(self.game, 'chosen_frame', 'basic')
            finfo = STARTING_FRAMES.get(cur, {})
            self.game.combat_log.append(f"[VATS] The nutrient tanks hum. Which monster will they grow you as this season? Current: {finfo.get('name', cur)}")
            if self.game.resources.ratings > 60:
                self.game.combat_log.append("[VATS] The catwalks are crowded. Producers and sponsors are here to watch the choice.")
            if isinstance(self.game.unlocks, dict) and any(k.startswith("vat_special_") for k in self.game.unlocks):
                self.game.combat_log.append("[VATS] Some templates have 'special' clearance from prior infamy. The vats look... eager.")

        # Contracts office entry - the live TV board
        if self.current_location == "contracts" and not hasattr(self, '_contracts_entered'):
            self._contracts_entered = True
            active = len(self.game.active_contracts or [])
            if active > 0:
                self.game.combat_log.append(f"[CONTRACTS] The board is live with your accepted contracts. The audience is waiting for the highlights.")
            else:
                self.game.combat_log.append("[CONTRACTS] The holo-screens scroll with fresh bloodthirsty demands. Pick your televised acts.")
            if self.game.resources.ratings > 70:
                self.game.combat_log.append("[CONTRACTS] The producers recognize you. Better contracts may be on offer.")

        self._build_ui()

    def _build_ui(self):
        for el in self.ui_elements:
            el.kill()
        self.ui_elements.clear()
        self.contract_choice_buttons.clear()
        self.frame_buttons.clear()
        self.location_buttons.clear()

        cx = WINDOW_W // 2
        btn_w, btn_h = 280, 38
        loc_btn_h = 32

        # Top navigation bar - the "map" of the home town
        # Player clicks these to move between districts of the Graftyard City.
        # This is the core "map the home town" structure.
        loc_names = list(GRAFTYARD_LOCATIONS.keys())
        bar_y = 8
        bar_x = 30
        for loc_id in loc_names:
            info = GRAFTYARD_LOCATIONS[loc_id]
            is_current = (loc_id == self.current_location)
            allowed, gate_reason = can_enter_district(loc_id, self.game.resources.ratings, self.game.unlocks)
            label = info["short"] if not is_current else f"> {info['short']} <"
            if not allowed:
                label = f"[LOCKED] {info['short'][:12]}"
            btn = pygame_gui.elements.UIButton(
                relative_rect=pygame.Rect(bar_x, bar_y, 160, loc_btn_h),
                text=label[:20],
                manager=self.game.ui_manager,
            )
            if is_current or not allowed:
                btn.disable()
            btn.location_id = loc_id
            btn.gate_reason = gate_reason
            self.location_buttons[loc_id] = btn
            self.ui_elements.append(btn)
            bar_x += 168

        # Location-specific content
        y = 55

        if self.current_location == "plaza":
            self._build_plaza_content(cx, y, btn_w, btn_h)
        elif self.current_location == "vats":
            self._build_vats_content(cx, y, btn_w, btn_h)
        elif self.current_location == "contracts":
            self._build_contracts_content(cx, y, btn_w, btn_h)
        elif self.current_location == "entertainment":
            self._build_entertainment_content(cx, y, btn_w, btn_h)
        elif self.current_location == "feast":
            self._build_feast_content(cx, y, btn_w, btn_h)
        elif self.current_location == "market":
            self._build_market_content(cx, y, btn_w, btn_h)
        elif self.current_location == "lounge":
            self._build_lounge_content(cx, y, btn_w, btn_h)

        # Always-available launch / retire (accessible from any district, but thematically best from plaza)
        launch_y = WINDOW_H - 90
        self.btn_launch = pygame_gui.elements.UIButton(
            relative_rect=pygame.Rect(cx - 140, launch_y, 280, 34),
            text="LAUNCH NEXT SEASON",
            manager=self.game.ui_manager,
        )
        self.ui_elements.append(self.btn_launch)

        self.btn_retire = pygame_gui.elements.UIButton(
            relative_rect=pygame.Rect(cx + 160, launch_y, 200, 34),
            text="RETIRE / END CAREER",
            manager=self.game.ui_manager,
        )
        self.ui_elements.append(self.btn_retire)

    # ─── Location-specific content builders ─────────────────────────────────────
    # These build the interactive "stage" for each district of the Graftyard City.
    # As if background images exist (user will generate them later based on the image_hint
    # descriptions in GRAFTYARD_LOCATIONS).

    def _build_plaza_content(self, cx, y, btn_w, btn_h):
        """Central Plaza - the beating heart of the Graftyard stage.
        Fleshed with reactive interactions: crowd work, holo-replays, statue lore, producer networking.
        Ties season brutality, ratings, and prior district/events into story drip visible in combat_log.
        """
        info = GRAFTYARD_LOCATIONS["plaza"]
        self._add_location_header(info, y)

        # Quick travel shortcuts (top nav is primary map, these are convenient from heart)
        active_count = len(self.game.active_contracts or [])
        self.btn_frames = pygame_gui.elements.UIButton(
            relative_rect=pygame.Rect(cx - btn_w // 2, y + 100, btn_w, 28),
            text="Go to Clone Vats (choose your body)",
            manager=self.game.ui_manager,
        )
        self.ui_elements.append(self.btn_frames)

        self.btn_contracts = pygame_gui.elements.UIButton(
            relative_rect=pygame.Rect(cx - btn_w // 2, y + 132, btn_w, 28),
            text=f"Go to Contract Office ({active_count} active)",
            manager=self.game.ui_manager,
        )
        self.ui_elements.append(self.btn_contracts)

        # Fleshed plaza stage actions (4 core interacts) — all cooldown-gated
        item_y = y + 175
        brutality = self.game.season_stats.get("shattered_count", 0) + self.game.season_stats.get("spectacle_count", 0)

        # 1. Address the crowd
        addr_avail = self.game.hub_cooldowns.is_available("plaza_address")
        label = "Address the Crowd from the Balcony (hype + ratings)"
        if brutality > 4:
            label = "Rally Fans with Shatter Highlights (big ratings!)"
        if not addr_avail:
            label = "[DONE THIS VISIT] Address Crowd"
        self.btn_plaza_address = pygame_gui.elements.UIButton(
            relative_rect=pygame.Rect(cx - btn_w // 2, item_y, btn_w, btn_h),
            text=label[:55],
            manager=self.game.ui_manager,
        )
        if not addr_avail:
            self.btn_plaza_address.disable()
        self.ui_elements.append(self.btn_plaza_address)
        item_y += 42

        # 2. Watch the giant screens
        scr_avail = self.game.hub_cooldowns.is_available("plaza_screens")
        label = "Watch the Plaza Holo-Screens (replays + story)"
        if self.game.combat_log:
            label = "Watch Recent Carnage Reels on the Big Screens"
        if not scr_avail:
            label = "[DONE THIS VISIT] Watch Screens"
        self.btn_plaza_screens = pygame_gui.elements.UIButton(
            relative_rect=pygame.Rect(cx - btn_w // 2, item_y, btn_w, btn_h),
            text=label[:55],
            manager=self.game.ui_manager,
        )
        if not scr_avail:
            self.btn_plaza_screens.disable()
        self.ui_elements.append(self.btn_plaza_screens)
        item_y += 42

        # 3. Predator statue
        stat_avail = self.game.hub_cooldowns.is_available("plaza_statue")
        label = "Pay Respects at the Predator Colossus"
        if self.game.resources.ratings > 80 or self.game.season > 2:
            label = "Dedicate a 'Trophy' at the Statue (infamy + flavor)"
        if not stat_avail:
            label = "[DONE THIS VISIT] Statue"
        self.btn_plaza_statue = pygame_gui.elements.UIButton(
            relative_rect=pygame.Rect(cx - btn_w // 2, item_y, btn_w, btn_h),
            text=label[:55],
            manager=self.game.ui_manager,
        )
        if not stat_avail:
            self.btn_plaza_statue.disable()
        self.ui_elements.append(self.btn_plaza_statue)
        item_y += 42

        # Fleshed UI: always-available "current bonuses" viewer (helps players understand what their city spends bought them)
        self.btn_view_bonuses = pygame_gui.elements.UIButton(
            relative_rect=pygame.Rect(cx - btn_w // 2, item_y, btn_w, 32),
            text="View Current Launch Bonuses & Effects",
            manager=self.game.ui_manager,
        )
        self.ui_elements.append(self.btn_view_bonuses)
        item_y += 38

        # 4. Network / quick pitch
        net_avail = self.game.hub_cooldowns.is_available("plaza_network")
        label = "Network with Passing Producers"
        if self.game.resources.ratings > 60:
            label = "Flag a Producer for Private Pitch (high-ratings)"
        if not net_avail:
            label = "[DONE THIS VISIT] Network"
        self.btn_plaza_network = pygame_gui.elements.UIButton(
            relative_rect=pygame.Rect(cx - btn_w // 2, item_y, btn_w, btn_h),
            text=label[:55],
            manager=self.game.ui_manager,
        )
        if not net_avail:
            self.btn_plaza_network.disable()
        self.ui_elements.append(self.btn_plaza_network)

    def _build_vats_content(self, cx, y, btn_w, btn_h):
        info = GRAFTYARD_LOCATIONS["vats"]
        self._add_location_header(info, y)

        current = self.game.chosen_frame
        y_start = y + 90
        self.frame_buttons = []
        frame_order = ["basic", "predator", "siege", "feast_barge", "artifact_host", "volatile", "pop_fiz"]
        for fid in frame_order:
            finfo = STARTING_FRAMES.get(fid, {"name": fid, "desc": ""})
            unlocked = fid in self.game.unlocked_frames
            is_current = (fid == current)
            label = finfo.get("name", fid)
            if is_current:
                label = "[CURRENT] " + label
            if not unlocked:
                cost = finfo.get("cost_ratings", 50)
                reqs = finfo.get("requires_contracts", [])
                req_note = " [needs contract]" if reqs else ""
                label = f"(LOCKED {cost}R{req_note}) " + label
            btn = pygame_gui.elements.UIButton(
                relative_rect=pygame.Rect(cx - btn_w // 2, y_start, btn_w, 32),
                text=label[:52],
                manager=self.game.ui_manager,
            )
            if not unlocked:
                btn.disable()
            btn.frame_id = fid
            self.frame_buttons.append(btn)
            self.ui_elements.append(btn)
            y_start += 36

        self.btn_confirm_frame = pygame_gui.elements.UIButton(
            relative_rect=pygame.Rect(cx - btn_w // 2, y_start + 10, btn_w, btn_h),
            text="CONFIRM FRAME FOR NEXT RUN",
            manager=self.game.ui_manager,
        )
        self.ui_elements.append(self.btn_confirm_frame)

        self.btn_unlock_next = pygame_gui.elements.UIButton(
            relative_rect=pygame.Rect(cx - btn_w // 2, y_start + 55, btn_w, 32),
            text="UNLOCK NEXT (spend Ratings in Vat)",
            manager=self.game.ui_manager,
        )
        self.ui_elements.append(self.btn_unlock_next)

        # Fleshed Clone Vats stage interactions (after the selector list).
        # This is the "front of the run" meta choice: different bodies look/play different.
        # Audience watches the vat choice. Reactive to selected frame, ratings, contracts, past brutality.
        # "As if" the tanks and catwalks are the background image.
        item_y = y_start + 100
        preview = getattr(self, 'selected_frame_for_preview', current)
        pinfo = STARTING_FRAMES.get(preview, {})
        pname = pinfo.get("name", preview)
        is_unlocked_preview = preview in self.game.unlocked_frames
        brutality = self.game.season_stats.get("shattered_count", 0) + self.game.season_stats.get("spectacle_count", 0)

        # 1. Deep dive / bond with the chosen vat template (story drip + frame-flavored effect)
        bond_label = f"Bond / Memory Dive with {pname[:20]}"
        if preview == "pop_fiz":
            bond_label = "Embrace the Reef 'Joy' (Pop Fiz dive - dark fun fact)"
        elif preview == "volatile":
            bond_label = "Stabilize the Volatile Template (risk/reward dive)"
        self.btn_vat_bond = pygame_gui.elements.UIButton(
            relative_rect=pygame.Rect(cx - btn_w // 2, item_y, btn_w, btn_h),
            text=bond_label[:55],
            manager=self.game.ui_manager,
        )
        self.ui_elements.append(self.btn_vat_bond)
        item_y += 42

        # 2. Vat simulation / test the body (small spend, see how it 'performs' for audience)
        test_label = f"Simulate Test Run ({pname[:18]})"
        if brutality > 3:
            test_label = f"Public Vat Demo - {pname[:18]} (big spectacle!)"
        self.btn_vat_test = pygame_gui.elements.UIButton(
            relative_rect=pygame.Rect(cx - btn_w // 2, item_y, btn_w, btn_h),
            text=test_label[:55],
            manager=self.game.ui_manager,
        )
        self.ui_elements.append(self.btn_vat_test)
        item_y += 42

        # 3. Targeted sponsor / unlock (better than blind 'next'; show costs from registry)
        unlock_label = "Sponsor / Unlock a Specific Template"
        if not is_unlocked_preview and preview != "basic":
            cost = pinfo.get("cost_ratings", 50)
            unlock_label = f"Sponsor {pname[:18]} ({cost} Ratings)"
        self.btn_vat_sponsor = pygame_gui.elements.UIButton(
            relative_rect=pygame.Rect(cx - btn_w // 2, item_y, btn_w, btn_h),
            text=unlock_label[:55],
            manager=self.game.ui_manager,
        )
        self.ui_elements.append(self.btn_vat_sponsor)
        item_y += 42

        # 4. Producer special / accelerate (high ratings or high brutality variant for current preview)
        special_label = "Petition Producers for Exotic Clearance"
        if self.game.resources.ratings > 80 or brutality > 5:
            special_label = f"Fast-Track Vat Growth for {pname[:16]} (high-infamy)"
        self.btn_vat_special = pygame_gui.elements.UIButton(
            relative_rect=pygame.Rect(cx - btn_w // 2, item_y, btn_w, btn_h),
            text=special_label[:55],
            manager=self.game.ui_manager,
        )
        self.ui_elements.append(self.btn_vat_special)

    def _build_contracts_content(self, cx, y, btn_w, btn_h):
        info = GRAFTYARD_LOCATIONS["contracts"]
        self._add_location_header(info, y)

        # Existing core picker (the "board" - select up to 2 televised horrors the audience demands)
        contracts = get_available_contracts(self.game.unlocks, self.game.season)
        y_start = y + 90
        self.contract_choice_buttons = []
        for ct in contracts[:5]:
            already = ct.id in self.selected_contract_ids
            label = f"{'[TAKEN] ' if already else ''}{ct.title} (+{ct.bonus_ratings})"
            btn = pygame_gui.elements.UIButton(
                relative_rect=pygame.Rect(cx - btn_w // 2, y_start, btn_w, 32),
                text=label[:52],
                manager=self.game.ui_manager,
            )
            btn.contract_id = ct.id
            self.contract_choice_buttons.append(btn)
            self.ui_elements.append(btn)
            y_start += 36

        self.btn_confirm_contracts = pygame_gui.elements.UIButton(
            relative_rect=pygame.Rect(cx - btn_w // 2, y_start + 10, btn_w, btn_h),
            text="CONFIRM CONTRACTS FOR SEASON",
            manager=self.game.ui_manager,
        )
        self.ui_elements.append(self.btn_confirm_contracts)

        # Fleshed Contract Office stage - the TV studio / Producers' Board.
        # Additional interactions for story drip, hype, and audience reactivity.
        # Everything here is "live on air" for the home base. Ties directly to season_stats + active contracts.
        item_y = y_start + 55
        active_count = len(self.game.active_contracts or [])
        brutality = self.game.season_stats.get("shattered_count", 0) + self.game.season_stats.get("spectacle_count", 0)
        has_active = active_count > 0

        # 1. Live Audience Demand Ticker / monitor
        ticker_label = "Check the LIVE AUDIENCE DEMAND Ticker"
        if brutality > 4:
            ticker_label = "Ticker: 'More Shatters! Feed the Bloodlust!' (big hype)"
        elif has_active:
            ticker_label = "Monitor Progress on Active Contracts (TV ticker)"
        self.btn_contracts_ticker = pygame_gui.elements.UIButton(
            relative_rect=pygame.Rect(cx - btn_w // 2, item_y, btn_w, btn_h),
            text=ticker_label[:55],
            manager=self.game.ui_manager,
        )
        self.ui_elements.append(self.btn_contracts_ticker)
        item_y += 42

        # 2. Pitch a contract idea (subversive player-driven content)
        pitch_label = "Pitch a New Atrocity to the Board"
        if brutality > 3:
            pitch_label = "Pitch 'Live Harvest Special' (high-brutality idea)"
        self.btn_contracts_pitch = pygame_gui.elements.UIButton(
            relative_rect=pygame.Rect(cx - btn_w // 2, item_y, btn_w, btn_h),
            text=pitch_label[:55],
            manager=self.game.ui_manager,
        )
        self.ui_elements.append(self.btn_contracts_pitch)
        item_y += 42

        # 3. Review past contract TV replays / highlights
        replay_label = "Review Prime-Time Contract Replays"
        if self.game.combat_log or has_active:
            replay_label = "Watch Archived Contract Highlights (TV gold)"
        self.btn_contracts_replays = pygame_gui.elements.UIButton(
            relative_rect=pygame.Rect(cx - btn_w // 2, item_y, btn_w, btn_h),
            text=replay_label[:55],
            manager=self.game.ui_manager,
        )
        self.ui_elements.append(self.btn_contracts_replays)
        item_y += 42

        # 4. Schmooze / bribe for premium contracts (high-infamy gateway, city evolution)
        schmooze_label = "Schmooze the Producers Board"
        if self.game.resources.ratings > 60:
            schmooze_label = "Bribe for Premium Contract Slots (high-ratings)"
        self.btn_contracts_schmooze = pygame_gui.elements.UIButton(
            relative_rect=pygame.Rect(cx - btn_w // 2, item_y, btn_w, btn_h),
            text=schmooze_label[:55],
            manager=self.game.ui_manager,
        )
        self.ui_elements.append(self.btn_contracts_schmooze)

        # Genocide declaration UI (only appears if player has reached MAX aggression with 1+ factions via betrayals)
        # This is the "choose between them at the start of a run" once eligible. Sets the target for this season's "last one".
        self.genocide_buttons = []
        maxed = get_maxed_factions(self.game.career)
        current_gt = getattr(self.game, 'genocide_target', None)
        if maxed and not current_gt:
            g_y = item_y + 10
            for fac in maxed:
                btn = pygame_gui.elements.UIButton(
                    relative_rect=pygame.Rect(cx - btn_w // 2, g_y, btn_w, btn_h),
                    text=f"DECLARE GENOCIDE ON {fac.upper()} (this run — they will be the last)",
                    manager=self.game.ui_manager,
                )
                btn.genocide_faction = fac
                self.genocide_buttons.append(btn)
                self.ui_elements.append(btn)
                g_y += 42
        elif current_gt:
            note = pygame_gui.elements.UIButton(
                relative_rect=pygame.Rect(cx - btn_w // 2, item_y + 10, btn_w, 30),
                text=f"GENOCIDE TARGET THIS RUN: {current_gt.upper()} (last ones)",
                manager=self.game.ui_manager,
            )
            note.disable()
            self.ui_elements.append(note)

    def _build_entertainment_content(self, cx, y, btn_w, btn_h):
        info = GRAFTYARD_LOCATIONS["entertainment"]
        self._add_location_header(info, y)

        item_y = y + 90
        is_expanded = "entertainment_expanded" in self.game.unlocks

        # 1. Watch highlights — cooldown once per visit
        hl_available = self.game.hub_cooldowns.is_available("watch_highlights")
        hl_label = "Watch Recent Highlights (story + morale)"
        if not hl_available:
            hl_label = "[DONE THIS VISIT] Watch Highlights"
        self.btn_watch_highlights = pygame_gui.elements.UIButton(
            relative_rect=pygame.Rect(cx - btn_w // 2, item_y, btn_w, btn_h),
            text=hl_label[:55],
            manager=self.game.ui_manager,
        )
        if not hl_available:
            self.btn_watch_highlights.disable()
        self.ui_elements.append(self.btn_watch_highlights)
        item_y += 42

        # 2. Bet on your own infamy — cooldown once per visit
        bet_available = self.game.hub_cooldowns.is_available("bet_infamy")
        bet_label = "Bet on Your Infamy (risk morale for ratings)"
        if not bet_available:
            bet_label = "[DONE THIS VISIT] Bet on Infamy"
        self.btn_bet_infamy = pygame_gui.elements.UIButton(
            relative_rect=pygame.Rect(cx - btn_w // 2, item_y, btn_w, btn_h),
            text=bet_label[:55],
            manager=self.game.ui_manager,
        )
        if not bet_available or self.game.run_morale < 10:
            self.btn_bet_infamy.disable()
        self.ui_elements.append(self.btn_bet_infamy)
        item_y += 42

        # 3. Fan replay — cooldown once per visit
        brutality = self.game.season_stats.get("shattered_count", 0) + self.game.season_stats.get("spectacle_count", 0)
        replay_available = self.game.hub_cooldowns.is_available("fan_replay")
        label = "Access Fan Favorite Replay (ratings boost)"
        if brutality > 5:
            label = "Access 'Brutal Legend' Replay (big ratings!)"
        if not replay_available:
            label = "[DONE THIS VISIT] Fan Replay"
        self.btn_fan_replay = pygame_gui.elements.UIButton(
            relative_rect=pygame.Rect(cx - btn_w // 2, item_y, btn_w, btn_h),
            text=label[:55],
            manager=self.game.ui_manager,
        )
        if not replay_available:
            self.btn_fan_replay.disable()
        self.ui_elements.append(self.btn_fan_replay)
        item_y += 42

        # 4. Pitch content — cooldown once per visit
        pitch_available = self.game.hub_cooldowns.is_available("pitch_content")
        pitch_label = "Pitch New Content to Producers (story + ratings)"
        if not pitch_available:
            pitch_label = "[DONE THIS VISIT] Content Pitched"
        self.btn_pitch_content = pygame_gui.elements.UIButton(
            relative_rect=pygame.Rect(cx - btn_w // 2, item_y, btn_w, btn_h),
            text=pitch_label[:55],
            manager=self.game.ui_manager,
        )
        if not pitch_available:
            self.btn_pitch_content.disable()
        self.ui_elements.append(self.btn_pitch_content)
        item_y += 42

        # 5. Purge revel — cooldown once per visit
        agg = getattr(self.game, 'faction_aggression', {})
        total_agg = sum(agg.values())
        purge_available = self.game.hub_cooldowns.is_available("purge_revel")
        purge_label = "Revel in Your Betrayals (aggression replay value)"
        if total_agg > 8:
            purge_label = "Festival of Purges (high aggression crowd goes wild!)"
        if not purge_available:
            purge_label = "[DONE THIS VISIT] Purge Revel"
        self.btn_purge_revel = pygame_gui.elements.UIButton(
            relative_rect=pygame.Rect(cx - btn_w // 2, item_y, btn_w, btn_h),
            text=purge_label[:55],
            manager=self.game.ui_manager,
        )
        if not purge_available:
            self.btn_purge_revel.disable()
        self.ui_elements.append(self.btn_purge_revel)
        item_y += 42

        # ─── Expanded Pits (gated behind entertainment_expanded upgrade) ──────────
        if is_expanded:
            item_y += 10
            # 6. Challenge rival predator (new: expanded-only, bigger ratings risk/reward)
            rival_available = self.game.hub_cooldowns.is_available("rival_challenge")
            rival_label = "Challenge a Rival Predator (big risk/big ratings)"
            if not rival_available:
                rival_label = "[DONE THIS VISIT] Rival Challenge"
            self.btn_rival_challenge = pygame_gui.elements.UIButton(
                relative_rect=pygame.Rect(cx - btn_w // 2, item_y, btn_w, btn_h),
                text=rival_label[:55],
                manager=self.game.ui_manager,
            )
            if not rival_available:
                self.btn_rival_challenge.disable()
            self.ui_elements.append(self.btn_rival_challenge)
            item_y += 42

            # 7. Premium highlight reel (expanded-only: bigger ratings than basic replay)
            premium_available = self.game.hub_cooldowns.is_available("premium_reel")
            premium_label = "Commission Premium Highlight Reel (30 scrap -> big ratings)"
            if not premium_available:
                premium_label = "[DONE THIS VISIT] Premium Reel"
            self.btn_premium_reel = pygame_gui.elements.UIButton(
                relative_rect=pygame.Rect(cx - btn_w // 2, item_y, btn_w, btn_h),
                text=premium_label[:55],
                manager=self.game.ui_manager,
            )
            if not premium_available or self.game.resources.scrap < 30:
                self.btn_premium_reel.disable()
            self.ui_elements.append(self.btn_premium_reel)
        else:
            # Hint that expansion exists
            hint_label = "(Expand Entertainment in Lounge to unlock more options)"
            hint_btn = pygame_gui.elements.UIButton(
                relative_rect=pygame.Rect(cx - btn_w // 2, item_y, btn_w, 28),
                text=hint_label,
                manager=self.game.ui_manager,
            )
            hint_btn.disable()
            self.ui_elements.append(hint_btn)

    def _build_feast_content(self, cx, y, btn_w, btn_h):
        info = GRAFTYARD_LOCATIONS["feast"]
        self._add_location_header(info, y)

        # Fleshed out Feast Hall - the grim "feast" stage where captured biomass is processed.
        # Heavy on monster tone: audience watches the vats, clones "bond" with the feast, subversive entertainment.
        # Multiple spend options tying into meta (feast tree, vat, ratings from cruelty).
        # Dynamic based on brutality/contracts for story.

        item_y = y + 90

        # ─── Feast Tree (tiered permanent upgrades) ───────────────────────────────
        self.feast_tree_buttons: List[pygame_gui.elements.UIButton] = []
        tree_status = get_feast_tree_status(self.game.unlocks)
        for entry in tree_status:
            node = entry["node"]
            unlocked = entry["unlocked"]
            available = entry["available"]
            if unlocked:
                label = f"[DONE] {node.name}: {node.desc[:35]}"
            elif available:
                label = f"{node.name} ({node.cost_feast} feast) — {node.desc[:30]}"
            else:
                label = f"(LOCKED) {node.name} — requires tier {node.tier - 1}"
            btn = pygame_gui.elements.UIButton(
                relative_rect=pygame.Rect(cx - btn_w // 2, item_y, btn_w, btn_h),
                text=label[:55],
                manager=self.game.ui_manager,
            )
            if unlocked or not available:
                btn.disable()
            btn.feast_node_id = node.id
            self.feast_tree_buttons.append(btn)
            self.ui_elements.append(btn)
            item_y += 40

        item_y += 10

        # "Feast Party" - host for audience entertainment (ratings boost, costs morale) — cooldown once per visit
        party_available = self.game.hub_cooldowns.is_available("feast_party")
        party_label = "Host Feast Party (10 feast -> ratings + story)"
        if not party_available:
            party_label = "[DONE THIS VISIT] Feast Party"
        self.btn_feast_party = pygame_gui.elements.UIButton(
            relative_rect=pygame.Rect(cx - btn_w // 2, item_y, btn_w, btn_h),
            text=party_label[:55],
            manager=self.game.ui_manager,
        )
        if not party_available or self.game.resources.feast < 10:
            self.btn_feast_party.disable()
        self.ui_elements.append(self.btn_feast_party)
        item_y += 42

        # Subversive "entertainment" option if high brutality — cooldown once per visit
        brutality = self.game.season_stats.get("shattered_count", 0) + self.game.season_stats.get("spectacle_count", 0)
        show_available = self.game.hub_cooldowns.is_available("feast_show")
        label = "Private 'Feast Show' for Producers (ratings, dark flavor)"
        if brutality > 5:
            label = "Premium 'Live Harvest' Broadcast (big ratings!)"
        if not show_available:
            label = "[DONE THIS VISIT] Feast Show"
        self.btn_feast_show = pygame_gui.elements.UIButton(
            relative_rect=pygame.Rect(cx - btn_w // 2, item_y, btn_w, btn_h),
            text=label[:55],
            manager=self.game.ui_manager,
        )
        if not show_available:
            self.btn_feast_show.disable()
        self.ui_elements.append(self.btn_feast_show)
        item_y += 42

        # Special final harvest for max aggression races (genocide tie-in) — cooldown
        agg = getattr(self.game, 'faction_aggression', {})
        maxed = [f for f in FACTIONS if agg.get(f, 0) >= AGGRESSION_MAX]
        harvest_available = self.game.hub_cooldowns.is_available("final_harvest")
        harvest_label = "Special Final Harvest (aggression bonus)"
        if maxed:
            harvest_label = f"Harvest the Last of {maxed[0].title()} (genocide feast!)"
        if not harvest_available:
            harvest_label = "[DONE THIS VISIT] Final Harvest"
        self.btn_final_harvest = pygame_gui.elements.UIButton(
            relative_rect=pygame.Rect(cx - btn_w // 2, item_y, btn_w, btn_h),
            text=harvest_label[:55],
            manager=self.game.ui_manager,
        )
        if not harvest_available:
            self.btn_final_harvest.disable()
        self.ui_elements.append(self.btn_final_harvest)

    def _build_market_content(self, cx, y, btn_w, btn_h):
        info = GRAFTYARD_LOCATIONS["market"]
        self._add_location_header(info, y)

        # Prominent scrap display for the shop feel
        scrap_txt = self.game.font.render(
            f"Available Scrap from destroyed ships: {self.game.resources.scrap}",
            True, COL_GOLD
        )
        # We'll draw this in the main draw method for the location; here we just create shop buttons

        # Dynamic stock from the expanded component/artifact diversity + classic trades.
        # The market now "stocks" specific parts and artifacts you can buy with scrap earned from shatters.
        self.game.refresh_market_stock()
        item_y = y + 90
        self.shop_buttons = []

        # First the dynamic stocked items (real specific components and artifacts)
        for item in self.game.market_stock:
            label = f"{item['name']} ({item['cost']} scrap) — {item.get('desc', '')}"[:60]
            cost = item["cost"]
            # Capture item in closure
            def make_action(it=item):
                return lambda: self._buy_stocked_item(it)
            btn = pygame_gui.elements.UIButton(
                relative_rect=pygame.Rect(cx - btn_w // 2, item_y, btn_w, btn_h),
                text=label,
                manager=self.game.ui_manager,
            )
            btn.shop_cost = cost
            btn.shop_action = make_action()
            if self.game.resources.scrap < cost:
                btn.disable()
            self.shop_buttons.append(btn)
            self.ui_elements.append(btn)
            item_y += 42

        # Classic flavor trades (ratings, black market, processors) - always available
        flavor_items = [
            ("Broadcast Rights (20 scrap) - turn your kills into paid content", 20, lambda: self._buy_broadcast()),
            ("Feast Processor (12 scrap) - convert some scrap into feast biomass", 12, lambda: self._buy_feast_processor()),
            ("'Special' Black Market Slot (18 scrap) - high-risk high-reward entertainment package", 18, lambda: self._buy_black_market()),
        ]
        for label, cost, action in flavor_items:
            btn = pygame_gui.elements.UIButton(
                relative_rect=pygame.Rect(cx - btn_w // 2, item_y, btn_w, btn_h),
                text=label[:55],
                manager=self.game.ui_manager,
            )
            btn.shop_cost = cost
            btn.shop_action = action
            if self.game.resources.scrap < cost:
                btn.disable()
            self.shop_buttons.append(btn)
            self.ui_elements.append(btn)
            item_y += 42

        # Keep the basic repair as a quick action
        self.btn_repair = pygame_gui.elements.UIButton(
            relative_rect=pygame.Rect(cx - btn_w // 2, item_y + 10, btn_w, btn_h),
            text="REPAIR SHIP (2 scrap per cell)",
            manager=self.game.ui_manager,
        )
        self.ui_elements.append(self.btn_repair)

    def _build_lounge_content(self, cx, y, btn_w, btn_h):
        info = GRAFTYARD_LOCATIONS["lounge"]
        self._add_location_header(info, y)

        item_y = y + 90

        # ─── Permanent Ratings Upgrades (from registry) ──────────────────────────
        self.lounge_upgrade_buttons: List[pygame_gui.elements.UIButton] = []
        available_upgrades = get_available_ratings_upgrades(self.game.unlocks, self.game.season)
        for upgrade in available_upgrades[:5]:  # show up to 5 at a time
            affordable = self.game.resources.ratings >= upgrade.cost_ratings
            label = f"{upgrade.name} ({upgrade.cost_ratings}R) — {upgrade.desc[:30]}"
            btn = pygame_gui.elements.UIButton(
                relative_rect=pygame.Rect(cx - btn_w // 2, item_y, btn_w, btn_h),
                text=label[:55],
                manager=self.game.ui_manager,
            )
            if not affordable:
                btn.disable()
            btn.upgrade_id = upgrade.id
            self.lounge_upgrade_buttons.append(btn)
            self.ui_elements.append(btn)
            item_y += 40

        if not available_upgrades:
            done_btn = pygame_gui.elements.UIButton(
                relative_rect=pygame.Rect(cx - btn_w // 2, item_y, btn_w, 28),
                text="All permanent upgrades purchased!",
                manager=self.game.ui_manager,
            )
            done_btn.disable()
            self.ui_elements.append(done_btn)
            item_y += 40

        item_y += 10

        # Private executive screening — cooldown once per visit
        exec_available = self.game.hub_cooldowns.is_available("executive_screening")
        exec_label = "Private Executive Screening (50 ratings -> story + big ratings)"
        if not exec_available:
            exec_label = "[DONE THIS VISIT] Executive Screening"
        self.btn_executive = pygame_gui.elements.UIButton(
            relative_rect=pygame.Rect(cx - btn_w // 2, item_y, btn_w, btn_h),
            text=exec_label[:55],
            manager=self.game.ui_manager,
        )
        if not exec_available or self.game.resources.ratings < 50:
            self.btn_executive.disable()
        self.ui_elements.append(self.btn_executive)
        item_y += 42

        # Purge documentary — cooldown once per visit
        agg = getattr(self.game, 'faction_aggression', {})
        maxed = [f for f in FACTIONS if agg.get(f, 0) >= AGGRESSION_MAX]
        doc_available = self.game.hub_cooldowns.is_available("purge_doc")
        doc_label = "Sponsor 'Purge Documentary' (60R -> aggression content)"
        if maxed:
            doc_label = f"Greenlight 'Extinction of {maxed[0].title()}' (genocide special!)"
        if not doc_available:
            doc_label = "[DONE THIS VISIT] Purge Doc"
        self.btn_purge_doc = pygame_gui.elements.UIButton(
            relative_rect=pygame.Rect(cx - btn_w // 2, item_y, btn_w, btn_h),
            text=doc_label[:55],
            manager=self.game.ui_manager,
        )
        if not doc_available or self.game.resources.ratings < 60:
            self.btn_purge_doc.disable()
        self.ui_elements.append(self.btn_purge_doc)

    def _add_location_header(self, info, y):
        """Helper - flavor text is drawn in the main draw() method per location."""
        pass  # flavor and bg handled in draw() so images can be swapped in easily later

    # --- Graft Market Shop Helpers (trading scrap from destroyed ships) ---
    # Scrap is the direct currency of your brutality. The shop lets you recycle carnage into advantages
    # or more "entertainment" value for the home base audience.

    def _buy_medical(self):
        player = self.game.player_ship
        if player:
            xs = [p[0] for p in player.cells] or [0]
            pos = (max(xs) + 1, 0)
            player.add_cell(pos, Cell(CellType.CORRIDOR))
            player.add_cell((pos[0] + 1, 0), Cell(CellType.COMPONENT, component_kind="medical"))
            self.game.combat_log.append("Bought Medical Kit from the market. Added temp medical support.")
        else:
            self.game.combat_log.append("No ship to upgrade.")

    def _buy_armor(self):
        player = self.game.player_ship
        if player:
            xs = [p[0] for p in player.cells] or [0]
            pos = (max(xs) + 1, 0)
            player.add_cell(pos, Cell(CellType.CORRIDOR))
            player.add_cell((pos[0] + 1, 0), Cell(CellType.COMPONENT, component_kind="armor"))
            self.game.combat_log.append("Bought Armor Plating. Your ship is a bit tankier for this run.")
        else:
            self.game.combat_log.append("No ship to upgrade.")

    def _buy_broadcast(self):
        # Subversive/entertainment option: turn your scrap (destruction) into direct ratings
        self.game.resources.ratings += 10
        self.game.combat_log.append("Purchased Broadcast Rights. Your recent kills are now premium content for the audience. +10 RATINGS.")
        # Small morale hit? Some clones don't like being "content".
        self.game.run_morale = max(0, self.game.run_morale - 3)

    def _buy_exotic_part(self):
        player = self.game.player_ship
        if player:
            kinds = ["gun", "laser", "shield", "power", "medical"]
            kind = random.choice(kinds)
            xs = [p[0] for p in player.cells] or [0]
            pos = (max(xs) + 1, 0)
            player.add_cell(pos, Cell(CellType.CORRIDOR))
            player.add_cell((pos[0] + 1, 0), Cell(CellType.COMPONENT, component_kind=kind))
            self.game.combat_log.append(f"Bought exotic {kind} part on the black market. Added to your franken-ship.")
        else:
            self.game.combat_log.append("No ship to upgrade.")

    def _buy_feast_processor(self):
        # Trade scrap (from shatter) for feast (from capture vibe, but recycled)
        convert = min(8, self.game.resources.scrap)
        self.game.resources.scrap -= convert
        self.game.resources.feast += convert // 2
        self.game.combat_log.append(f"Used the Feast Processor on {convert} scrap. Gained {convert//2} feast biomass for the vats.")

    def _buy_black_market(self):
        # Fun subversive shop item: high ratings but potential downside (ties to cruel events theme)
        self.game.resources.ratings += 25
        self.game.run_morale = max(0, self.game.run_morale - 8)
        self.game.combat_log.append("Bought a 'Special' black market slot. +25 RATINGS from some very questionable 'entertainment'. Your clones are side-eyeing you.")
        # Chance of a small random "regret" or extra scrap? For now, the morale hit is the cost of doing dark business.

    def _buy_stocked_item(self, item: dict):
        """Buy a specific stocked component or artifact from the market's current selection.
        Adds it to the current hub ship for preview + records in market_purchases so it gets applied
        on LAUNCH to the real starting frame (fixes the previous 'buys didn't carry' issue).
        This is now the proper way the store sells the diverse components and artifacts for scrap."""
        ptype = item.get("type")
        kind = item.get("kind")
        player = self.game.player_ship
        if not player:
            self.game.combat_log.append("No ship to modify.")
            return
        # Deduct already happened in caller; here just apply
        xs = [p[0] for p in player.cells] or [0]
        base_x = max(xs) + 2
        player.add_cell((base_x, 0), Cell(CellType.CORRIDOR))
        if ptype == "component":
            player.add_cell((base_x + 1, 0), Cell(CellType.COMPONENT, component_kind=kind))
            self.game.combat_log.append(f"Bought {item['name']} from the market stall. Added {kind} to your current body (will carry to launch).")
        else:
            player.add_cell((base_x + 1, 0), Cell(CellType.ARTIFACT, artifact_kind=kind))
            self.game.combat_log.append(f"Bought {item['name']} from the market. Grafted the artifact (will be on your launched ship).")
        # Record for the actual run ship (applied in _launch)
        self.game.market_purchases.append({"type": ptype, "kind": kind})
        # Remove from current stock (sold out this visit)
        if item in self.game.market_stock:
            self.game.market_stock.remove(item)

    def handle_event(self, event: pygame.event.Event):
        if event.type == pygame_gui.UI_BUTTON_PRESSED:
            # Location navigation bar clicks - the core "map" interaction
            for loc_id, btn in self.location_buttons.items():
                if event.ui_element == btn:
                    allowed, reason = can_enter_district(loc_id, self.game.resources.ratings, self.game.unlocks)
                    if not allowed:
                        self.game.combat_log.append(f"[LOCKED] {reason}")
                        self._build_ui()
                        return
                    self.current_location = loc_id
                    self._build_ui()
                    return

            # Plaza quick nav shortcuts (now functional; top bar is the full district map)
            if event.ui_element == getattr(self, 'btn_frames', None):
                self.current_location = "vats"
                self._build_ui()
                return
            if event.ui_element == getattr(self, 'btn_contracts', None):
                self.current_location = "contracts"
                self._build_ui()
                return

            # Location-specific handling
            if self.current_location == "contracts":
                if event.ui_element == getattr(self, 'btn_confirm_contracts', None):
                    self.game.active_contracts = [{"id": cid} for cid in self.selected_contract_ids]
                    self.game.combat_log.append(f"Accepted {len(self.selected_contract_ids)} contracts for the season.")
                    self._build_ui()
                    return
                for btn in self.contract_choice_buttons:
                    if event.ui_element == btn:
                        cid = getattr(btn, 'contract_id', None)
                        if cid:
                            if cid in self.selected_contract_ids:
                                self.selected_contract_ids.remove(cid)
                            elif len(self.selected_contract_ids) < 2:
                                self.selected_contract_ids.append(cid)
                            self._build_ui()
                        return

                # Fleshed Contract Office actions (TV studio stage)
                if event.ui_element == getattr(self, 'btn_contracts_ticker', None):
                    brutality = self.game.season_stats.get("shattered_count", 0) + self.game.season_stats.get("spectacle_count", 0)
                    active = len(self.game.active_contracts or [])
                    gain = 5 + (brutality // 2)
                    self.game.resources.ratings += gain
                    msg = f"[CONTRACTS] Live ticker: Audience is hungry. +{gain} RATINGS hype from the board."
                    if brutality > 4:
                        msg = f"[CONTRACTS] Ticker screams for more shatters! Crowd is rabid. +{gain} RATINGS. The producers smile."
                    elif active > 0:
                        msg = f"[CONTRACTS] Monitoring active contracts on air. +{gain} RATINGS. The home audience is watching for results."
                    self.game.combat_log.append(msg)
                    self._build_ui()
                    return

                if event.ui_element == getattr(self, 'btn_contracts_pitch', None):
                    gain = 15 + (self.game.season_stats.get("shattered_count", 0) * 2)
                    self.game.resources.ratings += gain
                    self.game.run_morale = max(0, self.game.run_morale - 3)
                    self.game.combat_log.append(f"[CONTRACTS] You pitched a fresh atrocity to the board. They greenlit the concept. +{gain} RATINGS (teaser hype). Some clones are disturbed by how eager the producers were.")
                    # Could influence future contracts in a real system; for now strong log drip + immediate value
                    self._build_ui()
                    return

                if event.ui_element == getattr(self, 'btn_contracts_replays', None):
                    gain = 10
                    story = "You watched archived contract replays in the studio. The old atrocities still play well."
                    if self.game.season > 1 or self.game.season_stats.get("fights", 0) > 3:
                        gain = 22
                        story = "[CONTRACTS] Prime-time replay of a completed contract. The highlights reel got big numbers. +ratings + the story lives on in the Graftyard."
                    self.game.resources.ratings += gain
                    self.game.combat_log.append(story)
                    self.game.combat_log.append(f"[CONTRACTS] +{gain} RATINGS from replay value.")
                    self._build_ui()
                    return

                if event.ui_element == getattr(self, 'btn_contracts_schmooze', None):
                    if self.game.resources.ratings >= 50:
                        self.game.resources.ratings -= 30
                        gain = 40
                        self.game.resources.ratings += gain
                        self.game.combat_log.append(f"[CONTRACTS] Schmoozed / bribed the board. Premium slots opened up. Net +{gain-30} RATINGS. Expect juicier contracts next season.")
                        if not isinstance(self.game.unlocks, dict):
                            self.game.unlocks = {}
                        self.game.unlocks["premium_contracts"] = True  # city evolution hook
                        self.game.persist_meta()
                    else:
                        self.game.resources.ratings += 8
                        self.game.combat_log.append("[CONTRACTS] You chatted up a junior producer. Small advance hype. +8 RATINGS. Bring more carnage for real influence.")
                    self._build_ui()
                    return

                # Genocide buttons (if shown)
                for btn in getattr(self, 'genocide_buttons', []):
                    if event.ui_element == btn:
                        fac = getattr(btn, 'genocide_faction', None)
                        if fac:
                            self.game.genocide_target = fac
                            self.game.combat_log.append(f"[CONTRACTS] You declare a genocide campaign against the {fac}. The producers approve — this run, they are marked as the last ones. Special events and victory payout await if you finish the purge.")
                            self._build_ui()
                        return

            if self.current_location == "vats":
                if event.ui_element == getattr(self, 'btn_confirm_frame', None):
                    if self.selected_frame_for_preview in self.game.unlocked_frames:
                        self.game.chosen_frame = self.selected_frame_for_preview
                        self.game.combat_log.append(f"Frame locked for next run: {STARTING_FRAMES.get(self.selected_frame_for_preview, {}).get('name')}")
                        self.game.persist_meta()
                    self._build_ui()
                    return
                if event.ui_element == getattr(self, 'btn_unlock_next', None):
                    self._do_vat()
                    self._build_ui()
                    return
                for btn in self.frame_buttons:
                    if event.ui_element == btn:
                        fid = getattr(btn, 'frame_id', None)
                        if fid:
                            self.selected_frame_for_preview = fid
                            finfo = STARTING_FRAMES.get(fid, {})
                            unlocked = fid in self.game.unlocked_frames
                            status = "UNLOCKED" if unlocked else "LOCKED"
                            cost = finfo.get("cost_ratings", 0)
                            reqs = finfo.get("requires_contracts", [])
                            req_str = f" req:{','.join(reqs)}" if reqs else ""
                            self.game.combat_log.append(f"{finfo.get('name', fid)} ({status}, {cost}R{req_str}): {finfo.get('desc', '')}")
                            if not unlocked:
                                self.game.combat_log.append(f"  To unlock: spend Ratings here or complete required contracts first.")
                            self._build_ui()
                        return

                # Fleshed Vats district actions - memory, sims, targeted sponsor, specials. All feed ratings/story + frame meta.
                if event.ui_element == getattr(self, 'btn_vat_bond', None):
                    if self.game.hub_cooldowns.is_available("vat_bond"):
                        self.game.hub_cooldowns.use("vat_bond")
                        self._do_vat_bond()
                    else:
                        self.game.combat_log.append("[VATS] Already bonded this visit.")
                    self._build_ui()
                    return
                if event.ui_element == getattr(self, 'btn_vat_test', None):
                    if self.game.hub_cooldowns.is_available("vat_test"):
                        self.game.hub_cooldowns.use("vat_test")
                        self._do_vat_test()
                    else:
                        self.game.combat_log.append("[VATS] Already tested this visit.")
                    self._build_ui()
                    return
                if event.ui_element == getattr(self, 'btn_vat_sponsor', None):
                    if self.game.hub_cooldowns.is_available("vat_sponsor"):
                        self.game.hub_cooldowns.use("vat_sponsor")
                        self._do_vat_sponsor()
                    else:
                        self.game.combat_log.append("[VATS] Already sponsored this visit.")
                    self._build_ui()
                    return
                if event.ui_element == getattr(self, 'btn_vat_special', None):
                    if self.game.hub_cooldowns.is_available("vat_special"):
                        self.game.hub_cooldowns.use("vat_special")
                        self._do_vat_special()
                    else:
                        self.game.combat_log.append("[VATS] Already petitioned this visit.")
                    self._build_ui()
                    return

            # Global / plaza / market actions
            if event.ui_element == getattr(self, 'btn_repair', None):
                self._do_repair()
            elif event.ui_element == getattr(self, 'btn_launch', None):
                self._launch()
            elif event.ui_element == getattr(self, 'btn_retire', None):
                self.game.persist_meta()
                # End game flavor if recent genocide victory
                if getattr(self.game, 'last_genocide_victory', None):
                    self.game.combat_log.append("[RETIRE] The producers roll the credits on your final purge. A legend is born.")
                self.game.change_state(GameState.GAME_OVER)

            # Location-specific button actions (entertainment, etc.) — all cooldown-gated
            elif event.ui_element == getattr(self, 'btn_watch_highlights', None):
                if self.game.hub_cooldowns.is_available("watch_highlights"):
                    gain = 8
                    msg = "[PITS] You watched the replay. The audience loved it again. +morale"
                    if self.game.season_stats.get("shattered_count", 0) > 2:
                        gain += 5
                        msg = "[PITS] The shatter highlights had the crowd on their feet. Big morale boost!"
                    self.game.run_morale = min(200, self.game.run_morale + gain)
                    self.game.combat_log.append(msg)
                    self.game.hub_cooldowns.use("watch_highlights")
                self._build_ui()

            elif event.ui_element == getattr(self, 'btn_bet_infamy', None):
                if self.game.hub_cooldowns.is_available("bet_infamy") and self.game.run_morale >= 10:
                    self.game.run_morale -= 10
                    gain = 10 + self.game.season_stats.get("shattered_count", 0)  # tuned for pacing
                    self.game.resources.ratings += gain
                    self.game.combat_log.append(f"[PITS] You bet on your infamy and won big! -10 morale, +{gain} RATINGS. The crowd roared.")
                    self.game.hub_cooldowns.use("bet_infamy")
                else:
                    self.game.combat_log.append("[PITS] Not enough morale or already bet this visit.")
                self._build_ui()

            elif event.ui_element == getattr(self, 'btn_fan_replay', None):
                if self.game.hub_cooldowns.is_available("fan_replay"):
                    brutality = self.game.season_stats.get("shattered_count", 0) + self.game.season_stats.get("spectacle_count", 0)
                    gain = 12 if brutality <= 5 else 30
                    self.game.resources.ratings += gain
                    self.game.combat_log.append(f"[PITS] Purchased fan replay package. +{gain} RATINGS. The audience can't get enough of your carnage.")
                    self.game.hub_cooldowns.use("fan_replay")
                self._build_ui()

            elif event.ui_element == getattr(self, 'btn_pitch_content', None):
                if self.game.hub_cooldowns.is_available("pitch_content"):
                    gain = 20
                    if self.game.active_contracts:
                        gain += 10
                    self.game.resources.ratings += gain
                    self.game.run_morale = max(0, self.game.run_morale - 5)
                    self.game.combat_log.append(f"[PITS] You pitched your latest atrocities as 'must-see'. +{gain} RATINGS. Some clones are disturbed by how into it the producers are.")
                    self.game.hub_cooldowns.use("pitch_content")
                self._build_ui()

            elif event.ui_element == getattr(self, 'btn_purge_revel', None):
                if self.game.hub_cooldowns.is_available("purge_revel"):
                    agg = getattr(self.game, 'faction_aggression', {})
                    total = sum(agg.values())
                    gain = 10 + total * 2
                    self.game.resources.ratings += gain
                    self.game.combat_log.append(f"[PITS] The crowd revels in your betrayals and purges. +{gain} RATINGS. High aggression makes every replay of the last of a race pure gold.")
                    self.game.hub_cooldowns.use("purge_revel")
                self._build_ui()

            # Expanded Entertainment Pits actions (only available with entertainment_expanded unlock)
            elif event.ui_element == getattr(self, 'btn_rival_challenge', None):
                if self.game.hub_cooldowns.is_available("rival_challenge"):
                    # Big risk/reward: lose morale but gain big ratings
                    if self.game.run_morale >= 20:
                        self.game.run_morale -= 20
                        gain = 40 + self.game.season_stats.get("shattered_count", 0) * 3
                        self.game.resources.ratings += gain
                        self.game.combat_log.append(f"[PITS] You challenged a rival predator! Brutal display. -20 morale, +{gain} RATINGS. The crowd is on fire.")
                    else:
                        gain = 10
                        self.game.resources.ratings += gain
                        self.game.combat_log.append(f"[PITS] Your rival laughed at the challenge. Weak showing. +{gain} pity RATINGS.")
                    self.game.hub_cooldowns.use("rival_challenge")
                self._build_ui()

            elif event.ui_element == getattr(self, 'btn_premium_reel', None):
                if self.game.hub_cooldowns.is_available("premium_reel") and self.game.resources.scrap >= 30:
                    self.game.resources.scrap -= 30
                    gain = 50 + self.game.season_stats.get("spectacle_count", 0) * 2
                    self.game.resources.ratings += gain
                    self.game.combat_log.append(f"[PITS] Commissioned a premium highlight reel. -30 scrap, +{gain} RATINGS. Professional editing makes the carnage sing.")
                    self.game.hub_cooldowns.use("premium_reel")
                self._build_ui()

            # Feast Hall interactions — feast tree purchases + cooldown-gated actions
            # Feast Tree node purchases
            for btn in getattr(self, 'feast_tree_buttons', []):
                if event.ui_element == btn:
                    node_id = getattr(btn, 'feast_node_id', None)
                    if node_id and node_id in FEAST_TREE_BY_ID:
                        node = FEAST_TREE_BY_ID[node_id]
                        if self.game.resources.feast >= node.cost_feast and node_id not in self.game.unlocks:
                            self.game.resources.feast -= node.cost_feast
                            if not isinstance(self.game.unlocks, set):
                                self.game.unlocks = set(self.game.unlocks) if self.game.unlocks else set()
                            self.game.unlocks.add(node_id)
                            self.game.combat_log.append(f"[FEAST HALL] {node.name} unlocked! {node.desc}")
                            self.game.persist_meta()
                        else:
                            self.game.combat_log.append(f"Not enough feast for {node.name} ({node.cost_feast} needed).")
                    self._build_ui()
                    return

            if event.ui_element == getattr(self, 'btn_feast_party', None):
                if self.game.hub_cooldowns.is_available("feast_party") and self.game.resources.feast >= 10:
                    self.game.resources.feast -= 10
                    gain = 12 + self.game.season_stats.get("shattered_count", 0)
                    self.game.resources.ratings += gain
                    self.game.run_morale = max(0, self.game.run_morale - 4)
                    self.game.hub_cooldowns.use("feast_party")
                    self.game.combat_log.append(f"[FEAST HALL] Hosted the party. The audience feasted on the 'donations'. +{gain} RATINGS. Morale dip from the excess.")
                else:
                    self.game.combat_log.append("The vats aren't full enough or already hosted this visit.")
                self._build_ui()

            elif event.ui_element == getattr(self, 'btn_feast_show', None):
                if self.game.hub_cooldowns.is_available("feast_show"):
                    brutality = self.game.season_stats.get("shattered_count", 0) + self.game.season_stats.get("spectacle_count", 0)
                    gain = 15 if brutality <= 5 else 35
                    self.game.resources.ratings += gain
                    self.game.run_morale = max(0, self.game.run_morale - 8)
                    self.game.hub_cooldowns.use("feast_show")
                    self.game.combat_log.append(f"[FEAST HALL] The 'Live Harvest' was a hit. +{gain} RATINGS. Pure dark entertainment for the home base. Clones unsettled.")
                self._build_ui()

            elif event.ui_element == getattr(self, 'btn_final_harvest', None):
                if self.game.hub_cooldowns.is_available("final_harvest"):
                    agg = getattr(self.game, 'faction_aggression', {})
                    maxed = [f for f in FACTIONS if agg.get(f, 0) >= AGGRESSION_MAX]
                    gain = 20
                    if maxed:
                        gain = 40 + len(maxed) * 10
                        self.game.combat_log.append(f"[FEAST HALL] You processed the last remnants of {', '.join(maxed)} as a special final course. The vats sing. +{gain} RATINGS. Genocide feast complete.")
                    else:
                        self.game.combat_log.append(f"[FEAST HALL] Special harvest from your high-aggression betrayals. +{gain} RATINGS.")
                    self.game.resources.ratings += gain
                    self.game.hub_cooldowns.use("final_harvest")
                self._build_ui()

            # Producers' Lounge — permanent upgrades from registry
            for btn in getattr(self, 'lounge_upgrade_buttons', []):
                if event.ui_element == btn:
                    uid = getattr(btn, 'upgrade_id', None)
                    if uid and uid in RATINGS_UPGRADES_BY_ID:
                        upgrade = RATINGS_UPGRADES_BY_ID[uid]
                        if self.game.resources.ratings >= upgrade.cost_ratings and uid not in self.game.unlocks:
                            self.game.resources.ratings -= upgrade.cost_ratings
                            if not isinstance(self.game.unlocks, set):
                                self.game.unlocks = set(self.game.unlocks) if self.game.unlocks else set()
                            self.game.unlocks.add(uid)
                            self.game.combat_log.append(f"[LOUNGE] Purchased: {upgrade.name}! {upgrade.desc}")
                            self.game.persist_meta()
                        else:
                            self.game.combat_log.append(f"Not enough ratings for {upgrade.name} ({upgrade.cost_ratings}R).")
                    self._build_ui()
                    return

            if event.ui_element == getattr(self, 'btn_executive', None):
                if self.game.hub_cooldowns.is_available("executive_screening") and self.game.resources.ratings >= 50:
                    self.game.resources.ratings -= 50
                    gain = 25 + (self.game.season * 5)
                    self.game.resources.ratings += gain
                    self.game.combat_log.append(f"[LOUNGE] Private executive screening. Net +{gain-50} RATINGS.")
                    if self.game.season > 1:
                        self.game.combat_log.append("[LOUNGE] 'You've become one of our most reliable stars.'")
                    self.game.hub_cooldowns.use("executive_screening")
                self._build_ui()

            elif event.ui_element == getattr(self, 'btn_purge_doc', None):
                if self.game.hub_cooldowns.is_available("purge_doc") and self.game.resources.ratings >= 60:
                    self.game.resources.ratings -= 40
                    agg = getattr(self.game, 'faction_aggression', {})
                    maxed = [f for f in FACTIONS if agg.get(f, 0) >= AGGRESSION_MAX]
                    gain = 30 + (len(maxed) * 15 if maxed else 10)
                    self.game.resources.ratings += gain
                    note = "Your betrayals are now premium content."
                    if maxed:
                        note = f"The 'Extinction of {maxed[0].title()}' special is a ratings monster."
                    self.game.combat_log.append(f"[LOUNGE] Purge documentary. Net +{gain-40} RATINGS. {note}")
                    if not isinstance(self.game.unlocks, set):
                        self.game.unlocks = set(self.game.unlocks) if self.game.unlocks else set()
                    self.game.unlocks.add("purge_content_deal")
                    self.game.hub_cooldowns.use("purge_doc")
                    self.game.persist_meta()
                self._build_ui()

            # Central Plaza actions — cooldown-gated
            elif event.ui_element == getattr(self, 'btn_plaza_address', None):
                if self.game.hub_cooldowns.is_available("plaza_address"):
                    brutality = self.game.season_stats.get("shattered_count", 0) + self.game.season_stats.get("spectacle_count", 0)
                    gain = 8 + (brutality * 1)  # tuned down for better economy pacing
                    self.game.resources.ratings += gain
                    self.game.run_morale = min(200, self.game.run_morale + 5)
                    msg = f"[PLAZA] You addressed the crowd. The square erupted. +{gain} RATINGS."
                    if brutality > 4:
                        msg = f"[PLAZA] You played the shatter reel on the balcony. The mob chanted your name. +{gain} RATINGS."
                    self.game.combat_log.append(msg)
                    self.game.hub_cooldowns.use("plaza_address")
                self._build_ui()

            elif event.ui_element == getattr(self, 'btn_plaza_screens', None):
                if self.game.hub_cooldowns.is_available("plaza_screens"):
                    gain = 8
                    story = "[PLAZA] You watched the holo replays. The audience cheered."
                    if self.game.season_stats.get("shattered_count", 0) > 1:
                        gain = 18
                        story = "[PLAZA] The big screens showed your last shatter in slow-mo. +ratings."
                    self.game.resources.ratings += gain
                    self.game.combat_log.append(story)
                    self.game.hub_cooldowns.use("plaza_screens")
                self._build_ui()

            elif event.ui_element == getattr(self, 'btn_plaza_statue', None):
                if self.game.hub_cooldowns.is_available("plaza_statue"):
                    if self.game.resources.ratings > 80 or self.game.season > 2:
                        self.game.resources.ratings += 15
                        if not isinstance(self.game.unlocks, set):
                            self.game.unlocks = set(self.game.unlocks) if self.game.unlocks else set()
                        self.game.unlocks.add("statue_dedicated")
                        self.game.combat_log.append("[PLAZA] Dedicated a trophy to the Colossus. The legend grows. +15 RATINGS.")
                        self.game.persist_meta()
                    else:
                        self.game.run_morale = min(200, self.game.run_morale + 8)
                        self.game.combat_log.append("[PLAZA] You stood at the Colossus. +morale.")
                    self.game.hub_cooldowns.use("plaza_statue")
                self._build_ui()

            elif event.ui_element == getattr(self, 'btn_view_bonuses', None):
                # Fleshed bonuses viewer (uses the shared calculator so terminal and GUI stay in sync)
                try:
                    from space_derelict.hub_progression import calculate_launch_bonuses, get_feast_tree_status
                    bons = calculate_launch_bonuses(self.game.unlocks if isinstance(self.game.unlocks, (set, dict)) else set())
                    tree = get_feast_tree_status(self.game.unlocks if isinstance(self.game.unlocks, (set, dict)) else set())
                    unlocked_tree = [t["node"].name for t in tree if t.get("unlocked")]
                    msg = "Active launch bonuses: " + (", ".join(f"{k}:{v}" for k,v in sorted(bons.items())[:6]) or "none")
                    if unlocked_tree:
                        msg += " | Feast Tree: " + ", ".join(unlocked_tree)
                    self.game.combat_log.append(f"[BONUSES] {msg}")
                    # Also surface a couple key effects
                    if bons.get("ratings_mult"):
                        self.game.combat_log.append(f"  +{int(bons['ratings_mult']*100)}% ratings from hype contracts.")
                    if bons.get("free_repairs"):
                        self.game.combat_log.append(f"  {bons['free_repairs']} free repairs at run start from Vat upgrades.")
                except Exception:
                    self.game.combat_log.append("[BONUSES] (calculator unavailable this visit)")
                self._build_ui()

            elif event.ui_element == getattr(self, 'btn_plaza_network', None):
                if self.game.hub_cooldowns.is_available("plaza_network"):
                    if self.game.resources.ratings >= 60:
                        self.game.resources.ratings -= 15
                        gain = 35 + (self.game.season * 3)
                        self.game.resources.ratings += gain
                        self.game.combat_log.append(f"[PLAZA] Producer pitch landed. Net +{gain-15} RATINGS.")
                    else:
                        self.game.resources.ratings += 10
                        self.game.combat_log.append("[PLAZA] Chatted up a junior producer. +10 RATINGS.")
                    self.game.hub_cooldowns.use("plaza_network")
                self._build_ui()

            # Shop buttons in the Graft Market - trade scrap from destroyed ships
            elif hasattr(event.ui_element, 'shop_action') and event.ui_element in getattr(self, 'shop_buttons', []):
                cost = getattr(event.ui_element, 'shop_cost', 0)
                if self.game.resources.scrap >= cost:
                    self.game.resources.scrap -= cost
                    action = event.ui_element.shop_action
                    action()
                    self._build_ui()  # refresh to show new scrap
                else:
                    self.game.combat_log.append("Not enough scrap from your destroyed enemies.")
                    self._build_ui()

    def _do_repair(self):
        player = self.game.player_ship
        if player:
            repaired, cost = player.repair_all_disabled(cost_per=2)
            if repaired > 0 and self.game.resources.scrap >= cost:
                self.game.resources.scrap -= cost
                self.game.combat_log.append(f"Repaired {repaired} cells for {cost} scrap.")
            else:
                self.game.combat_log.append("Nothing to repair or not enough scrap.")

    def _do_vat(self):
        # Core meta: spend Ratings to unlock better starting ship frames (Vat Templates)
        # Player sees all in the CLONE VATS chooser (greyed if locked).
        frame_order = ["basic", "predator", "siege", "feast_barge", "artifact_host", "volatile", "pop_fiz"]
        unlocked = self.game.unlocked_frames

        # Find the first locked one in order
        next_frame = None
        for f in frame_order:
            if f not in unlocked:
                next_frame = f
                break
        if not next_frame:
            self.game.combat_log.append("All known vat templates unlocked!")
            return

        finfo = STARTING_FRAMES.get(next_frame, {})
        cost = finfo.get("cost_ratings", 50)

        if self.game.resources.ratings >= cost:
            self.game.resources.ratings -= cost
            self.game.unlocked_frames.add(next_frame)
            # Also set as chosen if player wants the new hotness immediately
            self.game.chosen_frame = next_frame
            self.game.combat_log.append(f"Vat approved new template: {finfo.get('name', next_frame)}!")
            self.game.combat_log.append(f"Added to your available starting bodies. It is now selected for next run.")
            self.game.persist_meta()
        else:
            self.game.combat_log.append(f"Not enough Ratings to unlock {finfo.get('name', next_frame)} ({cost} needed).")

    # ─── New Vats district helpers (fleshed stage actions for frame meta) ──────────

    def _do_vat_bond(self):
        """Memory dive / bond with the previewed vat frame. Frame-specific story + small effects.
        Ties into the 'you are what you grow' + televised birth of the monster theme.
        Special handling for psychopathic frames like pop_fiz (backfire + dark fact, like events).
        """
        preview = getattr(self, 'selected_frame_for_preview', self.game.chosen_frame)
        pinfo = STARTING_FRAMES.get(preview, {})
        pname = pinfo.get("name", preview)
        if preview == "pop_fiz":
            self.game.run_morale = max(0, self.game.run_morale - 5)
            self.game.resources.ratings += 10
            self.game.combat_log.append(f"[VATS] You dove the Pop Fiz reef. The 'joy' is infectious... and horrifying. (21st-c orcas recorded tossing baby seals for sport, playing with prey for fun.) -5 morale but the audience eats it up. +10 RATINGS.")
            self.game.combat_log.append("[VATS] The techs look uneasy. This template may be a little too 'entertaining'.")
        elif preview == "volatile":
            self.game.resources.ratings += 18
            self.game.run_morale = min(200, self.game.run_morale + 4)
            self.game.combat_log.append(f"[VATS] You 'stabilized' the volatile template in the tank. Maximum spectacle, maximum risk. +18 RATINGS. The vats glow brighter; the crowd on the catwalks cheers the danger.")
        elif preview == "artifact_host":
            self.game.resources.ratings += 12
            self.game.combat_log.append(f"[VATS] Bonded with the Artifact Host. The pre-wired relics whisper. +12 RATINGS. High variance means high entertainment value.")
        else:
            gain = 6 + (4 if self.game.resources.ratings > 40 else 0)
            self.game.run_morale = min(200, self.game.run_morale + gain)
            self.game.resources.ratings += 5
            self.game.combat_log.append(f"[VATS] You bonded with the {pname} vat memories. The clones in the tanks 'remember' this body. +{gain} morale, +5 RATINGS from the quiet birth broadcast.")
        self.game.persist_meta()

    def _do_vat_test(self):
        """Simulate or publicly demo the preview frame. Small ratings cost for test data + spectacle.
        Dynamic: high brutality = public demo with bigger payout. Adds flavor component to current ship for 'feel'.
        """
        preview = getattr(self, 'selected_frame_for_preview', self.game.chosen_frame)
        pinfo = STARTING_FRAMES.get(preview, {})
        pname = pinfo.get("name", preview)
        brutality = self.game.season_stats.get("shattered_count", 0) + self.game.season_stats.get("spectacle_count", 0)
        cost = 8 if brutality > 3 else 5
        if self.game.resources.ratings < cost:
            self.game.combat_log.append("Not enough ratings to run the vat test/demo.")
            return
        self.game.resources.ratings -= cost
        gain = 15 + (brutality * 2 if brutality > 3 else 5)
        self.game.resources.ratings += gain
        player = self.game.player_ship
        if player:
            xs = [p[0] for p in player.cells] or [0]
            pos = (max(xs) + 1, 0)
            kind = "gun" if preview in ("predator", "volatile") else ("armor" if preview == "siege" else "medical")
            player.add_cell(pos, Cell(CellType.COMPONENT, component_kind=kind))
            self.game.combat_log.append(f"[VATS] Test sim grafted a {kind} for the {pname} feel (temp for preview).")
        msg = f"[VATS] Vat simulation of {pname} complete. +{gain} RATINGS (test data sold as teaser content)."
        if brutality > 3:
            msg = f"[VATS] Public vat demo of {pname} drew a crowd. The body performed. +{gain} RATINGS. Pure spectacle."
        self.game.combat_log.append(msg)
        self.game.persist_meta()

    def _do_vat_sponsor(self):
        """Targeted unlock/sponsor for the currently previewed frame (better UX than blind next).
        Respects cost + loose req check from STARTING_FRAMES. If already unlocked, do a refinement spend.
        """
        preview = getattr(self, 'selected_frame_for_preview', self.game.chosen_frame)
        pinfo = STARTING_FRAMES.get(preview, {})
        pname = pinfo.get("name", preview)
        if preview in self.game.unlocked_frames:
            # refinement for already owned
            if self.game.resources.ratings >= 25:
                self.game.resources.ratings -= 25
                self.game.run_morale = min(200, self.game.run_morale + 8)
                self.game.combat_log.append(f"[VATS] Sponsored a refinement vat pass on {pname}. The template feels sharper. -25 RATINGS +morale.")
                self.game.persist_meta()
            else:
                self.game.combat_log.append("Need 25 ratings to refine an unlocked template.")
            return
        cost = pinfo.get("cost_ratings", 50)
        reqs = pinfo.get("requires_contracts", [])
        met_reqs = True
        if reqs:
            # Loose: having done contracts or high season or high brutality proxies "proved yourself"
            met_reqs = bool(self.game.active_contracts) or self.game.season > 1 or self.game.season_stats.get("shattered_count", 0) > 2
        if self.game.resources.ratings >= cost and met_reqs:
            self.game.resources.ratings -= cost
            self.game.unlocked_frames.add(preview)
            self.game.chosen_frame = preview
            self.game.combat_log.append(f"[VATS] Producers greenlit the {pname} template! -{cost} RATINGS.")
            if reqs:
                self.game.combat_log.append(f"  (Contract reqs {reqs} satisfied by your record.)")
            self.game.combat_log.append("It is now unlocked and selected for next run.")
            self.game.persist_meta()
        else:
            msg = f"Not enough Ratings ({cost} needed) or missing reqs {reqs} for {pname}."
            self.game.combat_log.append(msg)

    def _do_vat_special(self):
        """High-infamy / high-brutality special: fast-track, exotic clearance, or producer pet project.
        Bigger effect if ratings or season high. Ties city evolution (more options feel unlocked).
        """
        preview = getattr(self, 'selected_frame_for_preview', self.game.chosen_frame)
        pinfo = STARTING_FRAMES.get(preview, {})
        pname = pinfo.get("name", preview)
        if self.game.resources.ratings >= 40:
            spend = 25
            self.game.resources.ratings -= spend
            gain = 45
            self.game.resources.ratings += gain
            self.game.combat_log.append(f"[VATS] Producer fast-track / exotic clearance for {pname}. Net +{gain - spend} RATINGS. The tanks are bubbling with special nutrients.")
            if preview in ("pop_fiz", "volatile", "artifact_host"):
                self.game.combat_log.append("[VATS] 'This one's going to be a star. Make it ugly out there.'")
            # Small evolution hook: mark a vat_special for this frame
            if not isinstance(self.game.unlocks, dict):
                self.game.unlocks = {}
            self.game.unlocks[f"vat_special_{preview}"] = True
            self.game.persist_meta()
        else:
            # low cost teaser
            self.game.resources.ratings += 8
            self.game.combat_log.append("[VATS] The producers are watching the tanks but want more infamy before fast-tracking. +8 teaser RATINGS.")

    def _launch(self):
        """Start a new season (new sector, keep ship + resources). Active contracts (if any picked in city) will be evaluated on return."""
        self.game.season += 1
        self.game.last_genocide_victory = None
        nodes, conns = generate_branching_sector(4, unlocks=self.game.unlocks, genocide_target=getattr(self.game, 'genocide_target', None))
        self.game.sector = nodes
        self.game.sector_connections = conns
        self.game.current_node_idx = 0
        self.game.fight_num = 1
        self.game.combat_log = []
        # run-only reset via _reset (includes morale, upgrades, mults, backtrack cost)
        # season_stats start fresh; active_contracts were set in the city before clicking Launch
        self.game.season_stats = {
            "factions_defeated": {},
            "shattered_count": 0,
            "techopuritan_cleared": 0,
            "total_destroyed": 0,
            "spectacle_count": 0,
            "fights": 0,
            "avg_destroyed_ratio": 0.0,
            "clean_sweeps": 0,
            "genocide_progress": 0,
            "clean_captures": 0,
            "backtracks": 0,
            "total_feast": 0,
        }

        self.game._reset_run_only_vars()

        # Apply chosen starting frame for the new run (core meta - player chose this in city)
        frame = self.game.chosen_frame if self.game.chosen_frame in self.game.unlocked_frames else "basic"
        self.game.player_ship = make_starter_player_ship(frame)

        # ─── Apply permanent bonuses from Feast Tree + Ratings Upgrades ───────────
        bonuses = calculate_launch_bonuses(self.game.unlocks)
        bonus_feast = bonuses.get("starting_feast", 0)
        bonus_scrap = bonuses.get("starting_scrap", 0)
        free_repairs = bonuses.get("free_repairs", 0)
        extra_corridors = int(bonuses.get("starting_extra_corridors", 0))
        artifact_chance = bonuses.get("starting_artifact_chance", 0)
        starting_comp = bonuses.get("starting_component")
        ratings_mult = 1.0 + bonuses.get("ratings_mult", 0) + bonuses.get("sector_ratings_mult", 0)

        if bonus_feast > 0:
            self.game.resources.feast += bonus_feast
            self.game.combat_log.append(f"[LAUNCH] Feast Tree bonus: +{bonus_feast} starting feast.")
        if bonus_scrap > 0:
            self.game.resources.scrap += bonus_scrap
            self.game.combat_log.append(f"[LAUNCH] Sponsor bonus: +{bonus_scrap} starting scrap.")
        if free_repairs > 0 and self.game.player_ship:
            repaired, _ = self.game.player_ship.repair_all_disabled(cost_per=0)
            self.game.combat_log.append(f"[LAUNCH] Free repairs: {free_repairs} cells restored.")
        if extra_corridors > 0 and self.game.player_ship:
            for _ in range(extra_corridors):
                xs = [p[0] for p in self.game.player_ship.cells] or [0]
                self.game.player_ship.add_cell((max(xs) + 1, 0), Cell(CellType.CORRIDOR))
            self.game.combat_log.append(f"[LAUNCH] Feast Processing bonus: +{extra_corridors} extra corridor(s).")
        if artifact_chance > 0 and self.game.player_ship and random.random() < artifact_chance:
            art_kinds = ["scanner", "pulse", "scatter", "accumulator"]
            kind = random.choice(art_kinds)
            xs = [p[0] for p in self.game.player_ship.cells] or [0]
            self.game.player_ship.add_cell((max(xs) + 1, 0), Cell(CellType.ARTIFACT, artifact_kind=kind))
            self.game.combat_log.append(f"[LAUNCH] Advanced Vat bonus: free starting {kind} artifact!")
        if starting_comp and self.game.player_ship:
            xs = [p[0] for p in self.game.player_ship.cells] or [0]
            self.game.player_ship.add_cell((max(xs) + 1, 0), Cell(CellType.CORRIDOR))
            self.game.player_ship.add_cell((max(xs) + 2, 0), Cell(CellType.COMPONENT, component_kind=starting_comp))
            self.game.combat_log.append(f"[LAUNCH] Prototype Pod: starting {starting_comp} equipped.")
        # Store ratings multiplier for this run (applied in record_fight_result)
        self.game.contract_ratings_mult = ratings_mult * (1.12 if getattr(self.game, 'active_contracts', None) else 1.0)

        # Apply any components/artifacts bought in the Graft Market this city visit.
        # This makes the store a real way to stock and trade scrap for the diverse parts and artifacts.
        for purch in list(self.game.market_purchases):
            if not self.game.player_ship:
                break
            xs = [p[0] for p in self.game.player_ship.cells] or [0]
            bx = max(xs) + 2
            self.game.player_ship.add_cell((bx, 0), Cell(CellType.CORRIDOR))
            if purch.get("type") == "component":
                self.game.player_ship.add_cell((bx + 1, 0), Cell(CellType.COMPONENT, component_kind=purch.get("kind")))
            else:
                self.game.player_ship.add_cell((bx + 1, 0), Cell(CellType.ARTIFACT, artifact_kind=purch.get("kind")))
            self.game.combat_log.append(f"[MARKET] Fitted purchased {purch.get('kind')} from the Graft Market.")
        self.game.market_purchases.clear()  # used up for this launch
        self.game.market_stock = []  # fresh stock next time you visit the city market
        # Clean any stale mid-run resume files on fresh launch
        try:
            for fname in ["current_run_player.json", "current_run_enemy.json"]:
                p = Path("dev_ships") / fname
                if p.exists():
                    p.unlink()
            if Path("space_derelict_current_run.json").exists():
                Path("space_derelict_current_run.json").unlink()
        except Exception:
            pass

        # Light tie-in: high aggression with a race (esp pop_fiz) gives the matching frame a small run bonus
        agg = getattr(self.game, 'faction_aggression', {})
        if frame == "pop_fiz" and agg.get("pop_fiz", 0) >= 4:
            if self.game.player_ship:
                xs = [p[0] for p in self.game.player_ship.cells] or [0]
                self.game.player_ship.add_cell((max(xs) + 1, 0), Cell(CellType.ARTIFACT, artifact_kind="pulse"))
                self.game.combat_log.append("[LAUNCH] Your high Pop Fiz aggression gives this frame an extra 'plaything' artifact for the run.")
        elif frame == "predator" and agg.get("felonia", 0) >= 4:
            if self.game.player_ship:
                xs = [p[0] for p in self.game.player_ship.cells] or [0]
                self.game.player_ship.add_cell((max(xs) + 1, 0), Cell(CellType.COMPONENT, component_kind="gun"))
                self.game.combat_log.append("[LAUNCH] High Felonia aggression sharpens your Predator frame with an extra gun this run.")

        # End game tie: genocide veteran permanent bonus for future runs (fleshed retirement reward)
        veteran = self.game.unlocks.get("genocide_veteran", 0) if isinstance(self.game.unlocks, dict) else 0
        if veteran > 0:
            bonus = 25 * veteran
            self.game.resources.ratings += bonus
            self.game.combat_log.append(f"[LAUNCH] Genocide Veteran bonus: +{bonus} starting Ratings from past extinctions. The audience expects more.")

        self.game.persist_meta()
        self.game.change_state(GameState.SECTOR_MAP)

    def draw(self, surface: pygame.Surface):
        font_big = pygame.font.SysFont("consolas", 36, bold=True)
        font = pygame.font.SysFont("consolas", 16)
        font_sm = pygame.font.SysFont("consolas", 13)

        loc_id = self.current_location
        loc_info = GRAFTYARD_LOCATIONS.get(loc_id, GRAFTYARD_LOCATIONS["plaza"])

        # Background: load generated graftyard image if present (from image_gen using the image_hints)
        bg_path = os.path.join("assets", f"graftyard_{loc_id}.jpg")
        if os.path.exists(bg_path):
            try:
                bg = pygame.image.load(bg_path).convert()
                bg = pygame.transform.scale(bg, (WINDOW_W, WINDOW_H))
                surface.blit(bg, (0, 0))
                # subtle dark overlay so UI text/buttons remain readable
                overlay = pygame.Surface((WINDOW_W, WINDOW_H), pygame.SRCALPHA)
                overlay.fill((10, 10, 20, 110))
                surface.blit(overlay, (0, 0))
            except Exception:
                surface.fill(loc_info.get("bg_color", COL_BG))
        else:
            # fallback solid
            surface.fill(loc_info.get("bg_color", COL_BG))

        # Location header (prominent)
        title = font_big.render(loc_info["name"], True, COL_ACCENT)
        surface.blit(title, (40, 50))

        # Visual flesh: persistent 'LIVE FEED' / game show bar at top of all city screens (reinforces tone)
        live_bar = font_sm.render("● LIVE FROM THE GRAFTYARD  •  AUDIENCE RATINGS FEED  •  THE SHOW MUST GO ON", True, (200, 50, 50))
        surface.blit(live_bar, (40, 20))

        sub = font.render(loc_info["desc"][:140] + "...", True, COL_TEXT_DIM)
        surface.blit(sub, (40, 95))

        # Global resources bar (always visible, "stage" HUD)
        res = font.render(
            f"Scrap: {self.game.resources.scrap}  |  Feast: {self.game.resources.feast}  |  Ratings: {self.game.resources.ratings}  |  Season: {self.game.season}",
            True, COL_GOLD
        )
        surface.blit(res, (40, 130))

        # Current chosen frame (meta reminder)
        cur_frame = getattr(self.game, 'chosen_frame', 'basic')
        frame_name = STARTING_FRAMES.get(cur_frame, {}).get('name', cur_frame)
        frame_txt = font_sm.render(f"Chosen for next run: {frame_name}", True, COL_ACCENT)
        surface.blit(frame_txt, (40, 155))

        # Faction aggression (betrayal rep) - always visible compact in the stage
        agg = getattr(self.game, 'faction_aggression', {})
        if agg:
            atxt = "Aggression (home betrayal rep): " + " ".join(f"{f[:3]}:{agg.get(f,0)}" for f in FACTIONS)
            agg_r = font_sm.render(atxt, True, COL_GOLD)
            surface.blit(agg_r, (40, 175))
            maxed = [f for f in FACTIONS if agg.get(f, 0) >= AGGRESSION_MAX]
            if maxed:
                gt = getattr(self.game, 'genocide_target', None)
                gtxt = f"MAXED: {', '.join(maxed)}" + (f"  TARGET THIS RUN: {gt}" if gt else "  (declare in Contracts for 'last one' run)")
                g_r = font_sm.render(gtxt, True, COL_DANGER)
                surface.blit(g_r, (40, 190))

        # Ship preview (contextual - always useful on the stage)
        player = self.game.player_ship
        if player:
            self.game.tile_renderer.render_ship(
                surface, player, WINDOW_W - 380, 200,
                faction="player", scale=1
            )

        # Location-specific extra flavor / tips (will be richer when images + more text are in)
        if loc_id == "plaza":
            tip = font_sm.render("Central Plaza: the live stage. Address the crowd, watch the big replays, dedicate to the legend, network producers. Everything you do here is televised back to the city.", True, COL_GOLD)
            surface.blit(tip, (40, 680))
            brutality = self.game.season_stats.get("shattered_count", 0) + self.game.season_stats.get("spectacle_count", 0)
            if brutality > 0:
                stat_tip = font_sm.render(f"Public brutality score: {brutality} (drives bigger plaza reactions and ratings gains).", True, COL_TEXT_DIM)
                surface.blit(stat_tip, (40, 700))
            if self.game.resources.ratings > 50:
                infamy_tip = font_sm.render(f"Infamy level {self.game.resources.ratings}. The statue feels closer.", True, COL_TEXT_DIM)
                surface.blit(infamy_tip, (40, 720))
            if self.game.active_contracts:
                ctip = font_sm.render("Active contracts are public knowledge here. The square expects results.", True, COL_TEXT_DIM)
                surface.blit(ctip, (40, 740))
            # Quick active contracts list in plaza
            if self.game.active_contracts:
                act = ", ".join(c.get("id","?") for c in self.game.active_contracts[:2])
                cbar = font_sm.render(f"Public contracts: {act}", True, COL_ACCENT)
                surface.blit(cbar, (40, 745))
        elif loc_id == "vats":
            tip = font_sm.render("CLONE VATS: The front of every run. Different frames look and play differently (never just 'bigger'). Choose here before LAUNCH. Only basic at true start; others greyed until Ratings + contracts unlock them.", True, COL_GOLD)
            surface.blit(tip, (40, 680))
            preview = getattr(self, 'selected_frame_for_preview', getattr(self.game, 'chosen_frame', 'basic'))
            pinfo = STARTING_FRAMES.get(preview, {})
            pname = pinfo.get("name", preview)
            cost = pinfo.get("cost_ratings", 0)
            unlocked = preview in self.game.unlocked_frames
            status = "UNLOCKED" if unlocked else f"LOCKED ({cost}R)"
            frame_tip = font_sm.render(f"Preview: {pname} ({status}) - {pinfo.get('desc', '')[:60]}", True, COL_TEXT_DIM)
            surface.blit(frame_tip, (40, 700))
            if pinfo.get("requires_contracts"):
                req_tip = font_sm.render(f"Unlock reqs: {pinfo['requires_contracts']}", True, COL_TEXT_DIM)
                surface.blit(req_tip, (40, 720))
            if self.game.resources.ratings > 50:
                hype_tip = font_sm.render("High infamy: Producers are more willing to greenlight exotic templates.", True, COL_TEXT_DIM)
                surface.blit(hype_tip, (40, 740))
            # Frame portrait image (right side)
            portrait_path = os.path.join("assets", "frames", f"{preview}.png")
            if os.path.exists(portrait_path):
                cache_key = f"frame_portrait_{preview}"
                if cache_key not in _bg_cache:
                    try:
                        pimg = pygame.image.load(portrait_path).convert_alpha()
                        _bg_cache[cache_key] = pygame.transform.smoothscale(pimg, (200, 200))
                    except Exception:
                        pass
                if cache_key in _bg_cache:
                    px = WINDOW_W - 260
                    py = 420
                    # Vignette behind portrait
                    vig = pygame.Surface((220, 220), pygame.SRCALPHA)
                    vig.fill((0, 0, 0, 160))
                    pygame.draw.rect(vig, COL_PANEL_BORDER, vig.get_rect(), 1, border_radius=4)
                    surface.blit(vig, (px - 10, py - 10))
                    surface.blit(_bg_cache[cache_key], (px, py))
                    # Label under portrait
                    plabel = font_sm.render(pname, True, COL_ACCENT)
                    surface.blit(plabel, (px + 100 - plabel.get_width() // 2, py + 205))
        elif loc_id == "contracts":
            tip = font_sm.render("CONTRACT OFFICE: The Producers' Board / live TV studio. Pick up to 2 televised horrific acts the audience demands this season. Complete them in-run for bonus Ratings + prime-time replays back home.", True, COL_GOLD)
            surface.blit(tip, (40, 680))
            active = self.game.active_contracts or []
            if active:
                act_str = ", ".join(c.get("id", "?") for c in active[:2])
                active_tip = font_sm.render(f"Active contracts (public): {act_str} — fulfill for TV glory + ratings.", True, COL_ACCENT)
                surface.blit(active_tip, (40, 700))
            brutality = self.game.season_stats.get("shattered_count", 0) + self.game.season_stats.get("spectacle_count", 0)
            if brutality > 0:
                stat_tip = font_sm.render(f"Your brutality feeds the demand ticker. More shatters = hotter contracts and bigger payouts.", True, COL_TEXT_DIM)
                surface.blit(stat_tip, (40, 720))
            if self.game.resources.ratings > 50:
                hype_tip = font_sm.render("High infamy: The board offers premium slots when you schmooze.", True, COL_TEXT_DIM)
                surface.blit(hype_tip, (40, 740))
        elif loc_id == "entertainment":
            tip = font_sm.render("Entertainment Pits: Relive the carnage, bet on your brutality, pitch content to the producers. The audience is always watching.", True, COL_GOLD)
            surface.blit(tip, (40, 680))
            brutality = self.game.season_stats.get("shattered_count", 0) + self.game.season_stats.get("spectacle_count", 0)
            if brutality > 0:
                stat_tip = font_sm.render(f"Your brutality score this season: {brutality} (more = better replays and bets).", True, COL_TEXT_DIM)
                surface.blit(stat_tip, (40, 700))
            if self.game.active_contracts:
                contract_tip = font_sm.render("Completed contracts make great replay material here.", True, COL_TEXT_DIM)
                surface.blit(contract_tip, (40, 720))
            agg = getattr(self.game, 'faction_aggression', {})
            high_agg = [f for f in FACTIONS if agg.get(f, 0) >= 3]
            if high_agg:
                pit_agg = font_sm.render(f"High aggression with {', '.join(high_agg)} means the pits love your purge footage even more.", True, COL_TEXT_DIM)
                surface.blit(pit_agg, (40, 740))
        elif loc_id == "feast":
            tip = font_sm.render("Feast Hall: Process the 'donations', host parties for the audience, bond with the vats. The clones are what you eat.", True, COL_GOLD)
            surface.blit(tip, (40, 680))
            if self.game.resources.feast > 10:
                feast_tip = font_sm.render(f"Feast biomass ready: {self.game.resources.feast}. The vats are waiting.", True, COL_TEXT_DIM)
                surface.blit(feast_tip, (40, 700))
            if self.game.season_stats.get("shattered_count", 0) > 2:
                dark_tip = font_sm.render("High brutality makes for richer, more 'entertaining' biomass.", True, COL_TEXT_DIM)
                surface.blit(dark_tip, (40, 720))
            agg = getattr(self.game, 'faction_aggression', {})
            maxed = [f for f in FACTIONS if agg.get(f, 0) >= AGGRESSION_MAX]
            if maxed:
                feast_gen = font_sm.render(f"The last of {', '.join(maxed)} make for a special 'final harvest' in the vats.", True, COL_DANGER)
                surface.blit(feast_gen, (40, 740))
        elif loc_id == "lounge":
            tip = font_sm.render("Producers' Lounge: The exclusive VIP area. Big ratings spends for permanent power and city evolution. Only the most infamous get in.", True, COL_GOLD)
            surface.blit(tip, (40, 680))
            if self.game.resources.ratings > 50:
                ratings_tip = font_sm.render(f"Current infamy: {self.game.resources.ratings} ratings. The executives are interested.", True, COL_TEXT_DIM)
                surface.blit(ratings_tip, (40, 700))
            if self.game.season > 1:
                season_tip = font_sm.render(f"Season {self.game.season} veteran. Sponsors know your name.", True, COL_TEXT_DIM)
                surface.blit(season_tip, (40, 720))
            agg = getattr(self.game, 'faction_aggression', {})
            maxed = [f for f in FACTIONS if agg.get(f, 0) >= AGGRESSION_MAX]
            if maxed:
                lounge_gen = font_sm.render(f"Producers are bidding on 'The Extinction of {maxed[0].title()}' documentaries.", True, COL_GOLD)
                surface.blit(lounge_gen, (40, 740))
        elif loc_id == "market":
            tip = font_sm.render("The Graft Market: trade scrap from your destroyed enemies for parts, upgrades, or more 'content' opportunities.", True, COL_GOLD)
            surface.blit(tip, (40, 680))
            # Show current shop-relevant resources
            res_tip = font_sm.render(f"Scrap on hand: {self.game.resources.scrap}  |  Use it to recycle your carnage into advantages or ratings.", True, COL_TEXT_DIM)
            surface.blit(res_tip, (40, 700))
            shop_hint = font_sm.render("Vendors here love the scrap from shatter play. Some deals are... creative for the audience back home.", True, COL_TEXT_DIM)
            surface.blit(shop_hint, (40, 720))

        # Recent log (the "stage" news feed) - pushed down to avoid tip overlap in rich districts like plaza
        log_y = 765
        recent = self.game.combat_log[-2:]
        for i, entry in enumerate(recent):
            txt = font_sm.render(entry[:75], True, COL_TEXT_DIM)
            surface.blit(txt, (40, log_y + i * 14))

        # Image generation hint for this location (copy to image_gen tool):
        # {loc_info.get('image_hint', 'No hint')}


# ─── Game Over / Retire ──────────────────────────────────────────────────────

class GameOverScreen(BaseScreen):
    def on_enter(self):
        self._build_ui()

    def _build_ui(self):
        for el in self.ui_elements:
            el.kill()
        self.ui_elements.clear()

        cx = WINDOW_W // 2
        btn_w, btn_h = 250, 50

        self.btn_menu = pygame_gui.elements.UIButton(
            relative_rect=pygame.Rect(cx - btn_w // 2, 500, btn_w, btn_h),
            text="MAIN MENU",
            manager=self.game.ui_manager,
        )
        self.ui_elements.append(self.btn_menu)

    def handle_event(self, event: pygame.event.Event):
        if event.type == pygame_gui.UI_BUTTON_PRESSED:
            if event.ui_element == self.btn_menu:
                self.game.persist_meta()
                self.game.change_state(GameState.MAIN_MENU)

    def draw(self, surface: pygame.Surface):
        # Background
        _draw_screen_bg(surface, "game_over_bg.png", overlay_alpha=130)

        font_big = pygame.font.SysFont("consolas", 40, bold=True)
        font = pygame.font.SysFont("consolas", 18)
        font_sm = pygame.font.SysFont("consolas", 14)

        title = font_big.render("CAREER OVER", True, COL_GOLD)
        surface.blit(title, (WINDOW_W // 2 - title.get_width() // 2, 80))

        # Stats
        r = self.game.resources
        career = getattr(self.game, 'career', {})
        agg = career.get("faction_aggression", {}) if isinstance(career, dict) else {}
        agg_str = " | ".join(f"{f[:4]}:{agg.get(f,0)}/5" for f in ["felonia","confederacy","pop_fiz","techopuritan"]) if agg else "none"
        gcs = career.get("genocides_completed", {}) if isinstance(career, dict) else {}
        gen_str = ", ".join(f"{k}:{v}" for k,v in gcs.items()) if gcs else "none"
        total_gen = sum(gcs.values()) if gcs else 0

        # Dynamic epilogue based on achievements (end game flavor)
        epilogue = "The producers are satisfied. For now."
        if total_gen >= 3:
            epilogue = "You are a legend of extinction. Whole races erased for the ratings. The audience demands the reunion special."
        elif total_gen >= 1:
            epilogue = "You ended civilizations on live TV. The home base still cheers your final purges."
        elif max(agg.values() or [0]) >= 5:
            epilogue = "Even without full genocide, your betrayals made you a monster of infamy. They fear your name."
        elif r.ratings > 200:
            epilogue = "The audience will never forget the carnage. Ratings immortal."

        # Fleshed brutal moments / highlight reel for the retire report (narrative payoff)
        moments = extract_brutal_moments(getattr(self.game, 'combat_log', None), getattr(self.game, 'season_stats', None), r.ratings)
        highlights = " | ".join(moments[:2]) if moments else "A workmanlike reign of terror."

        lines = [
            f"Seasons Survived: {self.game.season}",
            f"Total Ratings (Infamy): {r.ratings}",
            f"Total Feast Consumed: {r.feast}",
            f"Scrap Remaining: {r.scrap}",
            "",
            f"Aggression (final betrayal rep): {agg_str}",
            f"Genocides Completed: {gen_str} (total {total_gen})",
            "",
            f"Audience Score: {r.ratings + 2 * r.feast + 10 * len(self.game.unlocks) + total_gen * 100}",
            "",
            f"Brutal Highlights: {highlights}",
            "",
            epilogue,
            "The show must go on... in the memories of the Graftyard.",
        ]

        y = 160
        for line in lines:
            if line == "":
                y += 8
                continue
            col = COL_GOLD if "Score" in line or "Genocides" in line or "Aggression" in line else COL_TEXT
            if "legend" in line.lower() or "extinction" in line.lower() or "genocide" in line.lower():
                col = COL_DANGER
            txt = font.render(line, True, col)
            surface.blit(txt, (WINDOW_W // 2 - txt.get_width() // 2, y))
            y += 26


# ─── Entry Point ─────────────────────────────────────────────────────────────

def run_game():
    """Launch the full graphical game."""
    logger = get_logger()
    try:
        logger.info("run_game() invoked")
        game = Game()
        game.run()
    except SystemExit:
        raise
    except Exception:
        logger.exception("Unhandled error from run_game() / Game()")
        raise
    finally:
        try:
            shutdown_logging()
        except Exception:
            pass


if __name__ == "__main__":
    run_game()
