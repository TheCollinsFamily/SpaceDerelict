"""Tile atlas loading and cell-to-sprite mapping for Space Derelict.

Each DithArt tileset is a 32×32 grid arranged in 8 columns.
Tiles are addressed by (col, row) index, 0-based.

Faction tilesets:
  - Dark Organic Spaceship → player ship (frankenstein monster aesthetic)
  - Sci-Fi Base (01)       → raider / confederacy (scrappy or lawful military)
  - Alien Spaceship        → felonia (cat-like bio)
  - Sci-Fi Med Bay (02)    → techopuritan (sterile high-tech zealots)
  - Sci-Fi Dungeon         → pop_fiz (chaotic psychotic reef) or derelict fields
  (Tied to model.enemy_faction in SectorNode; different PNG art styles from asset packs provide distinct "looking ships")

Robot Warfare pack provides effects and UI overlays.
"""

import os
import pygame
from typing import Dict, Tuple, Optional, List
from pathlib import Path

from space_derelict.model import CellType, CellState


# ─── Paths ───────────────────────────────────────────────────────────────────

ASSET_PACKS_DIR = Path(__file__).parent.parent / "asset packs"

# DithArt tileset paths (32×32 base, 8 columns)
TILESETS = {
    "dark_organic": ASSET_PACKS_DIR / "Ditharts_DarkOrganicSpaceship_Tileset_v0.1" / "texture" / "dark_organic_spaceship_tileset.png",
    "scifi_base": ASSET_PACKS_DIR / "Ditharts_SciFi_Tileset_v0.6" / "texture" / "scifi_tileset_01.png",
    "alien": ASSET_PACKS_DIR / "Ditharts_AlienSpaceship_Tileset_v0.2" / "texture" / "alien_spaceship_tileset.png",
    "medbay": ASSET_PACKS_DIR / "Ditharts_SciFi_Tileset_02_v0.5" / "texture" / "scifi_tileset_02.png",
    "dungeon": ASSET_PACKS_DIR / "Ditharts_ScifiDungeon_Tileset_v0.1" / "texture" / "scifi_dungeon_tileset.png",
}

# Robot Warfare effects/UI
EFFECTS_DIR = ASSET_PACKS_DIR / "Robot Warfare Asset Pack 24-11-21" / "Robot Warfare Asset Pack 22-11-24"

TILE_SIZE = 32
COLUMNS = 8


# ─── Tile Index Definitions ──────────────────────────────────────────────────
# (col, row) coordinates into the tileset spritesheet.
# All DithArt sci-fi sheets share a similar structure:
#   Rows 0-7:   Wall autotile (cross pattern)
#   Row 8:      Horizontal decorations / detailed walls
#   Rows 9-12:  Floor tiles (corridors)
#   Rows 13-14: Grate/damaged floors
#   Row 15:     Colored indicator panels
#   Rows 16+:   Special elements, pipes, large structures

# Each faction has its own mapping of game concepts to tile coords.
# Format: { "role": (col, row) }

TILE_MAP_DARK_ORGANIC = {
    # Corridors — main floor tiles at row 14 (Tiled IDs 113, 114, 116, 119, 120)
    "corridor_intact":     (0, 14),   # standard organic floor
    "corridor_intact_2":   (1, 14),   # variant
    "corridor_intact_3":   (7, 14),   # variant
    "corridor_disabled":   (0, 9),    # darker damaged floor (row 9)
    "corridor_destroyed":  (1, 10),   # dark void tile

    # Components — decorative 2x2 elements at rows 12-13
    "component_gun":       (0, 12),   # weapon mount (paired top-left)
    "component_laser":     (2, 12),   # energy weapon
    "component_engine":    (0, 16),   # propulsion machinery
    "component_shield":    (3, 15),   # shield generator (grate row)
    "component_armor":     (0, 15),   # heavy plating (grate tile)
    "component_power":     (1, 15),   # power core (grate variant)
    "component_medical":   (2, 13),   # med station
    "component_cargo":     (3, 13),   # storage
    "component_generic":   (1, 12),   # generic component

    # Artifacts — special glyph/symbol tiles at rows 16-17
    "artifact_volatile":   (5, 17),   # dangerous glow decoration
    "artifact_booster":    (6, 17),   # power boost
    "artifact_jammer":     (7, 17),   # ECM device
    "artifact_dampener":   (3, 14),   # protection (floor variant)
    "artifact_generic":    (2, 18),   # organic structure
    # Additional comps (reuse nearby for now; tilesets have variation)
    "component_missile":   (1, 12),
    "component_flamer":    (2, 12),
    "component_drone_bay": (3, 12),
    "component_broadcast_array": (0, 13),
    "component_harvester_claw": (1, 13),
    "component_stealth_plate": (2, 13),
    "component_scattergun": (0, 16),
    "component_beam":      (1, 16),
    # Additional artifacts (use indicator/special rows)
    "artifact_reactor":    (4, 17),
    "artifact_feast_chamber": (5, 17),
    "artifact_scanner":    (6, 17),
    "artifact_nanite":     (7, 17),
    "artifact_overdrive":  (3, 18),
    "artifact_accumulator": (4, 18),
    "artifact_pulse":      (5, 18),
    "artifact_scatter":    (6, 18),
    "artifact_widebeam":   (7, 18),
    "artifact_bypass":     (0, 19),
    "artifact_distributor": (1, 19),
    "artifact_reflector":  (2, 19),
    "artifact_chain":      (3, 19),
    "artifact_rating_vortex": (4, 15),
    "artifact_feast_converter": (5, 15),
    "artifact_decoy":      (6, 15),
    "artifact_overloader": (7, 15),
    "artifact_network_tap": (0, 20),
    "artifact_cryo_vault": (1, 20),
    "artifact_mind_link":  (2, 20),
    "artifact_breach_charger": (3, 20),
    "artifact_rating_amplifier": (4, 20),
    "artifact_symbiotic_host": (5, 20),
    "artifact_extinction_seed": (6, 20),
    "artifact_multishot":  (7, 20),
    "artifact_doubler":    (0, 21),
    "artifact_neurotoxin": (1, 21),
    "artifact_beam_focus": (2, 21),
    "artifact_prism":      (3, 21),
    "artifact_payload":    (4, 21),

    # Walls/borders (autotile rows 0-5)
    "wall_top":            (3, 0),
    "wall_bottom":         (3, 4),
    "wall_left":           (0, 2),
    "wall_right":          (6, 2),

    # Decorations
    "door_h_closed":       (4, 4),    # door closed
    "door_h_open":         (5, 4),    # door open
    "door_v_closed":       (5, 5),    # vertical door
    "pipe_h":              (0, 22),   # horizontal pipe
    "pipe_v":              (2, 22),   # vertical pipe
}

TILE_MAP_SCIFI_BASE = {
    # Corridors — row 14 (same layout convention across all DithArt sheets)
    "corridor_intact":     (0, 14),
    "corridor_intact_2":   (1, 14),
    "corridor_intact_3":   (7, 14),
    "corridor_disabled":   (0, 9),
    "corridor_destroyed":  (1, 10),

    # Components — rows 12-13
    "component_gun":       (0, 12),
    "component_laser":     (2, 12),
    "component_engine":    (0, 16),
    "component_shield":    (3, 15),
    "component_armor":     (0, 15),
    "component_power":     (1, 15),
    "component_medical":   (2, 13),
    "component_cargo":     (3, 13),
    "component_generic":   (1, 12),

    # Artifacts — colored indicator panels row 15 cols 4-7
    "artifact_volatile":   (4, 15),
    "artifact_booster":    (5, 15),
    "artifact_jammer":     (6, 15),
    "artifact_dampener":   (7, 15),
    "artifact_generic":    (3, 14),
    # Additional for new comps/arts (scifi layout)
    "component_missile":   (1, 12),
    "component_flamer":    (2, 12),
    "component_drone_bay": (3, 12),
    "component_broadcast_array": (0, 13),
    "component_harvester_claw": (1, 13),
    "component_stealth_plate": (2, 13),
    "component_scattergun": (0, 16),
    "component_beam":      (1, 16),
    "artifact_reactor":    (4, 15),
    "artifact_feast_chamber": (5, 15),
    "artifact_scanner":    (6, 15),
    "artifact_nanite":     (7, 15),
    "artifact_overdrive":  (3, 14),
    "artifact_accumulator": (4, 14),
    "artifact_pulse":      (5, 14),
    "artifact_scatter":    (6, 14),
    "artifact_widebeam":   (7, 14),
    "artifact_bypass":     (0, 16),
    "artifact_distributor": (1, 16),
    "artifact_reflector":  (2, 16),
    "artifact_chain":      (3, 16),
    "artifact_rating_vortex": (4, 16),
    "artifact_feast_converter": (5, 16),
    "artifact_decoy":      (6, 16),
    "artifact_overloader": (7, 16),
    "artifact_network_tap": (0, 17),
    "artifact_cryo_vault": (1, 17),
    "artifact_mind_link":  (2, 17),
    "artifact_breach_charger": (3, 17),
    "artifact_rating_amplifier": (4, 17),
    "artifact_symbiotic_host": (5, 17),
    "artifact_extinction_seed": (6, 17),
    "artifact_multishot":  (7, 17),
    "artifact_doubler":    (0, 18),
    "artifact_neurotoxin": (1, 18),
    "artifact_beam_focus": (2, 18),
    "artifact_prism":      (3, 18),
    "artifact_payload":    (4, 18),

    # Walls
    "wall_top":            (3, 0),
    "wall_bottom":         (3, 4),
    "wall_left":           (0, 2),
    "wall_right":          (6, 2),

    # Decorations (base sheet has 20 rows, max index 19)
    "door_h_closed":       (4, 4),
    "door_h_open":         (5, 4),
    "door_v_closed":       (5, 5),
    "pipe_h":              (0, 17),   # structural elements row
    "pipe_v":              (2, 17),
}

TILE_MAP_ALIEN = {
    # Corridors
    "corridor_intact":     (0, 14),
    "corridor_intact_2":   (1, 14),
    "corridor_intact_3":   (7, 14),
    "corridor_disabled":   (0, 9),
    "corridor_destroyed":  (1, 10),

    # Components
    "component_gun":       (0, 12),
    "component_laser":     (2, 12),
    "component_engine":    (0, 16),
    "component_shield":    (3, 15),
    "component_armor":     (0, 15),
    "component_power":     (1, 15),
    "component_medical":   (2, 13),
    "component_cargo":     (3, 13),
    "component_generic":   (1, 12),

    # Artifacts — colored panels
    "artifact_volatile":   (4, 15),
    "artifact_booster":    (5, 15),
    "artifact_jammer":     (6, 15),
    "artifact_dampener":   (7, 15),
    "artifact_generic":    (3, 14),
    # Additional for new comps/arts (scifi layout)
    "component_missile":   (1, 12),
    "component_flamer":    (2, 12),
    "component_drone_bay": (3, 12),
    "component_broadcast_array": (0, 13),
    "component_harvester_claw": (1, 13),
    "component_stealth_plate": (2, 13),
    "component_scattergun": (0, 16),
    "component_beam":      (1, 16),
    "artifact_reactor":    (4, 15),
    "artifact_feast_chamber": (5, 15),
    "artifact_scanner":    (6, 15),
    "artifact_nanite":     (7, 15),
    "artifact_overdrive":  (3, 14),
    "artifact_accumulator": (4, 14),
    "artifact_pulse":      (5, 14),
    "artifact_scatter":    (6, 14),
    "artifact_widebeam":   (7, 14),
    "artifact_bypass":     (0, 16),
    "artifact_distributor": (1, 16),
    "artifact_reflector":  (2, 16),
    "artifact_chain":      (3, 16),
    "artifact_rating_vortex": (4, 16),
    "artifact_feast_converter": (5, 16),
    "artifact_decoy":      (6, 16),
    "artifact_overloader": (7, 16),
    "artifact_network_tap": (0, 17),
    "artifact_cryo_vault": (1, 17),
    "artifact_mind_link":  (2, 17),
    "artifact_breach_charger": (3, 17),
    "artifact_rating_amplifier": (4, 17),
    "artifact_symbiotic_host": (5, 17),
    "artifact_extinction_seed": (6, 17),
    "artifact_multishot":  (7, 17),
    "artifact_doubler":    (0, 18),
    "artifact_neurotoxin": (1, 18),
    "artifact_beam_focus": (2, 18),
    "artifact_prism":      (3, 18),
    "artifact_payload":    (4, 18),

    # Walls
    "wall_top":            (3, 0),
    "wall_bottom":         (3, 4),
    "wall_left":           (0, 2),
    "wall_right":          (6, 2),

    # Decorations
    "door_h_closed":       (4, 4),
    "door_h_open":         (5, 4),
    "door_v_closed":       (5, 5),
    "pipe_h":              (0, 22),
    "pipe_v":              (2, 22),
}

# Map faction names to tileset + tile map
FACTION_TILESET = {
    "player":       ("dark_organic", TILE_MAP_DARK_ORGANIC),
    "raider":       ("scifi_base",   TILE_MAP_SCIFI_BASE),
    "felonia":      ("alien",        TILE_MAP_ALIEN),
    "techopuritan": ("medbay",       TILE_MAP_SCIFI_BASE),  # uses base map layout
    "derelict":     ("dungeon",      TILE_MAP_SCIFI_BASE),
    "confederacy":  ("scifi_base",   TILE_MAP_SCIFI_BASE),  # lawful military scifi look
    "pop_fiz":      ("dungeon",      TILE_MAP_SCIFI_BASE),  # gritty chaotic reef/dungeon for psychotic
}


# ─── TileAtlas Class ─────────────────────────────────────────────────────────

class TileAtlas:
    """Loads a tileset PNG and provides fast tile extraction."""

    def __init__(self, path: Path, tile_size: int = TILE_SIZE, columns: int = COLUMNS):
        self.path = path
        self.tile_size = tile_size
        self.columns = columns
        self.surface: Optional[pygame.Surface] = None
        self.rows = 0
        self._cache: Dict[Tuple[int, int], pygame.Surface] = {}

    def load(self):
        """Load the tileset image. Call after pygame.init()."""
        if not self.path.exists():
            print(f"[TileAtlas] WARNING: Tileset not found: {self.path}")
            return
        self.surface = pygame.image.load(str(self.path)).convert_alpha()
        self.rows = self.surface.get_height() // self.tile_size

    def get_tile(self, col: int, row: int) -> Optional[pygame.Surface]:
        """Get a single tile by grid position. Cached."""
        if self.surface is None:
            return None
        key = (col, row)
        if key in self._cache:
            return self._cache[key]
        if col < 0 or col >= self.columns or row < 0 or row >= self.rows:
            return None
        x = col * self.tile_size
        y = row * self.tile_size
        tile = self.surface.subsurface(pygame.Rect(x, y, self.tile_size, self.tile_size)).copy()
        self._cache[key] = tile
        return tile

    def get_tile_scaled(self, col: int, row: int, scale: int = 2) -> Optional[pygame.Surface]:
        """Get a tile scaled up."""
        tile = self.get_tile(col, row)
        if tile is None:
            return None
        key = (col, row, scale)
        if key in self._cache:
            return self._cache[key]
        scaled = pygame.transform.scale(tile, (self.tile_size * scale, self.tile_size * scale))
        self._cache[key] = scaled
        return scaled


# ─── Effect Sprite Loader ────────────────────────────────────────────────────

class EffectSprites:
    """Loads effect spritesheets from Robot Warfare pack."""

    def __init__(self):
        self.explosion_frames: List[pygame.Surface] = []
        self.hit_sparks: List[pygame.Surface] = []
        self.smoke_frames: List[pygame.Surface] = []
        self.target_cursor: Optional[pygame.Surface] = None
        self.range_grid: List[pygame.Surface] = []

    def load(self):
        """Load effect sprites. Call after pygame.init()."""
        effects_path = EFFECTS_DIR / "Effects"
        ui_path = EFFECTS_DIR / "UI"

        # Small explosion (strip of frames, each 32×32)
        self._load_strip(effects_path / "small-explosion.png", self.explosion_frames, 32)
        self._load_strip(effects_path / "hit-sparks.png", self.hit_sparks, 32)
        self._load_strip(effects_path / "smoke.png", self.smoke_frames, 32)

        # Target cursor
        if (ui_path / "target-cursor.png").exists():
            sheet = pygame.image.load(str(ui_path / "target-cursor.png")).convert_alpha()
            # Extract first frame (16×16 assumed based on the small image)
            self.target_cursor = sheet

        # Range grid overlays (strip of colored squares)
        self._load_strip(ui_path / "range-grid.png", self.range_grid, 16)

    def _load_strip(self, path: Path, target: list, frame_size: int):
        """Load a horizontal spritestrip into individual frames."""
        if not path.exists():
            return
        sheet = pygame.image.load(str(path)).convert_alpha()
        w = sheet.get_width()
        h = sheet.get_height()
        # Frames are arranged horizontally
        num_frames = w // frame_size
        for i in range(num_frames):
            frame = sheet.subsurface(pygame.Rect(i * frame_size, 0, frame_size, min(frame_size, h))).copy()
            target.append(frame)


# ─── Ship Tile Renderer ──────────────────────────────────────────────────────

class ShipTileRenderer:
    """Renders ships using tileset sprites instead of colored rectangles.

    Usage:
        renderer = ShipTileRenderer()
        renderer.load_all()
        cell_rects = renderer.render_ship(surface, ship, x, y, faction="player", scale=2)
    """

    def __init__(self):
        self.atlases: Dict[str, TileAtlas] = {}
        self.effects = EffectSprites()
        self._tint_cache: Dict[Tuple[int, str], pygame.Surface] = {}
        self._font_sm: Optional[pygame.font.Font] = None

    def load_all(self):
        """Load all tileset atlases and effects."""
        for name, path in TILESETS.items():
            atlas = TileAtlas(path)
            atlas.load()
            self.atlases[name] = atlas
        self.effects.load()

    def get_cell_tile(self, cell_type: CellType, cell_state: CellState,
                      component_kind: Optional[str], artifact_kind: Optional[str],
                      faction: str = "player", scale: int = 2) -> Optional[pygame.Surface]:
        """Get the appropriate tile for a cell based on its type, state, and faction."""
        tileset_name, tile_map = FACTION_TILESET.get(faction, ("scifi_base", TILE_MAP_SCIFI_BASE))
        atlas = self.atlases.get(tileset_name)
        if atlas is None or atlas.surface is None:
            return None

        # Determine tile key
        tile_key = self._get_tile_key(cell_type, cell_state, component_kind, artifact_kind)
        coords = tile_map.get(tile_key)
        if coords is None:
            # Fallback
            coords = tile_map.get("corridor_intact", (0, 14))

        col, row = coords
        tile = atlas.get_tile_scaled(col, row, scale)
        if tile is None:
            return None

        # Apply state-aware tinting
        if cell_state == CellState.DISABLED:
            if cell_type == CellType.CORRIDOR:
                # Corridors: red tint (fire/kinetic damage feel)
                tile = self._apply_tint(tile, (120, 20, 20, 90))
            else:
                # Components/Artifacts: blue tint (EMP damage feel)
                tile = self._apply_tint(tile, (40, 60, 180, 100))
        elif cell_state == CellState.DESTROYED:
            # Dark charred tint
            tile = self._apply_tint(tile, (30, 10, 10, 180))

        return tile

    def _get_tile_key(self, cell_type: CellType, cell_state: CellState,
                      component_kind: Optional[str], artifact_kind: Optional[str]) -> str:
        """Map cell properties to a tile_map key.

        Destroyed/disabled cells still use their original tile (component_gun etc)
        so you can see WHAT was destroyed. Tinting + overlays handle the state.
        """
        if cell_type == CellType.CORRIDOR:
            if cell_state == CellState.DESTROYED:
                return "corridor_destroyed"
            elif cell_state == CellState.DISABLED:
                return "corridor_disabled"
            return "corridor_intact"

        elif cell_type == CellType.COMPONENT:
            # Always show the component type tile (even if damaged)
            kind = component_kind or "generic"
            key = f"component_{kind}"
            known_comps = ("gun", "laser", "engine", "shield", "armor", "power", "medical", "cargo",
                           "missile", "flamer", "drone_bay", "broadcast_array", "harvester_claw",
                           "stealth_plate", "scattergun", "beam")
            if kind in known_comps:
                return key
            return "component_generic"

        elif cell_type == CellType.ARTIFACT:
            # Always show the artifact type tile (even if damaged)
            kind = artifact_kind or "generic"
            known_arts = ("volatile", "booster", "jammer", "dampener", "reactor", "feast_chamber",
                          "scanner", "nanite", "overdrive", "accumulator", "pulse", "scatter",
                          "widebeam", "bypass", "distributor", "reflector", "chain", "rating_vortex",
                          "feast_converter", "decoy", "overloader", "network_tap", "cryo_vault",
                          "mind_link", "breach_charger", "rating_amplifier", "symbiotic_host",
                          "extinction_seed", "multishot", "doubler", "neurotoxin", "beam_focus",
                          "prism", "payload")
            if kind in known_arts:
                return f"artifact_{kind}"
            return "artifact_generic"

        return "corridor_intact"

    def _apply_tint(self, surface: pygame.Surface, tint_color: Tuple[int, ...]) -> pygame.Surface:
        """Apply a colored overlay tint to a surface."""
        # Create a copy to avoid modifying cached tiles
        tinted = surface.copy()
        overlay = pygame.Surface(tinted.get_size(), pygame.SRCALPHA)
        overlay.fill(tint_color)
        tinted.blit(overlay, (0, 0))
        return tinted

    def render_ship(self, surface: pygame.Surface, ship, x_offset: int, y_offset: int,
                    faction: str = "player", scale: int = 2,
                    highlight_cell: Optional[Tuple[int, int]] = None,
                    active_corridors=None) -> Dict[Tuple[int, int], pygame.Rect]:
        """Render a ship using tileset sprites. Returns clickable cell rects.

        Args:
            surface: Target pygame surface
            ship: Ship model instance
            x_offset, y_offset: Top-left position
            faction: Faction name for tileset selection
            scale: Pixel scale multiplier (2 = 64px rendered tiles)
            highlight_cell: Optional cell to draw targeting highlight on
            active_corridors: Precomputed set of active corridor positions

        Returns:
            Dict mapping (grid_x, grid_y) to screen Rect for click detection
        """
        cell_rects: Dict[Tuple[int, int], pygame.Rect] = {}
        if not ship or not ship.cells:
            return cell_rects

        tile_sz = TILE_SIZE * scale

        # Compute grid bounds
        xs = [p[0] for p in ship.cells.keys()]
        ys = [p[1] for p in ship.cells.keys()]
        min_x, min_y = min(xs), min(ys)

        if active_corridors is None:
            active_corridors = ship.get_active_corridors()

        for (cx, cy), cell in ship.cells.items():
            gx = x_offset + (cx - min_x) * tile_sz
            gy = y_offset + (cy - min_y) * tile_sz

            # Get the tile sprite
            tile_surf = self.get_cell_tile(
                cell.type, cell.state,
                cell.component_kind, cell.artifact_kind,
                faction=faction, scale=scale
            )

            if tile_surf:
                surface.blit(tile_surf, (gx, gy))
            else:
                # Fallback: colored rectangle (same as before)
                self._draw_fallback(surface, cell, (cx, cy), gx, gy, tile_sz, active_corridors)

            # ── Damage state overlays ──
            if cell.state == CellState.DESTROYED:
                # Big red X through the cell
                self._draw_destroyed_x(surface, gx, gy, tile_sz)
            elif cell.state == CellState.DISABLED:
                # Blinking electricity-out symbol
                self._draw_disabled_symbol(surface, gx, gy, tile_sz)

            # Active corridor glow indicator — STRONG green for connected, grey for disconnected
            if cell.type == CellType.CORRIDOR and cell.state == CellState.INTACT:
                if (cx, cy) in active_corridors:
                    # Connected to core: green glow
                    glow = pygame.Surface((tile_sz, tile_sz), pygame.SRCALPHA)
                    glow.fill((0, 200, 60, 55))
                    surface.blit(glow, (gx, gy))
                    # Green border to reinforce connectivity
                    pygame.draw.rect(surface, (0, 180, 60, 120), pygame.Rect(gx, gy, tile_sz, tile_sz), 1)
                else:
                    # Disconnected from core: dark grey overlay — clearly "off"
                    grey = pygame.Surface((tile_sz, tile_sz), pygame.SRCALPHA)
                    grey.fill((40, 40, 50, 140))
                    surface.blit(grey, (gx, gy))

            # Core indicator (pilot's room / life support origin)
            if (cx, cy) == getattr(ship, 'core', None):
                # Draw a small bright diamond/pip at center to mark the core
                core_color = (255, 220, 80)
                mid_x = gx + tile_sz // 2
                mid_y = gy + tile_sz // 2
                pip_sz = max(3, tile_sz // 8)
                pygame.draw.polygon(surface, core_color, [
                    (mid_x, mid_y - pip_sz),
                    (mid_x + pip_sz, mid_y),
                    (mid_x, mid_y + pip_sz),
                    (mid_x - pip_sz, mid_y),
                ])

            # Component active indicator (small dot)
            if (cell.type in (CellType.COMPONENT, CellType.ARTIFACT) and
                cell.state == CellState.INTACT and
                ship.is_component_active((cx, cy))):
                pygame.draw.circle(surface, (0, 255, 100), (gx + tile_sz - 6, gy + 6), 3)

            # Inactive components (lost corridor connection, stop working): grey overlay
            if (cell.type == CellType.COMPONENT and
                cell.state == CellState.INTACT and
                not ship.is_component_active((cx, cy))):
                grey = pygame.Surface((tile_sz, tile_sz), pygame.SRCALPHA)
                grey.fill((60, 60, 80, 150))
                surface.blit(grey, (gx, gy))

            # Component has artifact effect(s) (e.g. scatter, widebeam, booster): green tint to indicate "modified by artifact"
            if cell.type == CellType.COMPONENT and cell.state == CellState.INTACT:
                try:
                    tags = ship.get_component_effect_tags((cx, cy))
                    if tags:
                        tint = pygame.Surface((tile_sz, tile_sz), pygame.SRCALPHA)
                        tint.fill((30, 140, 50, 45))
                        surface.blit(tint, (gx, gy))
                except Exception:
                    pass

            # Cell label overlay
            if self._font_sm is None:
                self._font_sm = pygame.font.SysFont("consolas", 10)
            lbl = self._get_label(cell)
            if lbl:
                lbl_surf = self._font_sm.render(lbl, True, (200, 210, 230))
                surface.blit(lbl_surf, (gx + 2, gy + tile_sz - 14))

            rect = pygame.Rect(gx, gy, tile_sz, tile_sz)
            cell_rects[(cx, cy)] = rect

            # Highlight (targeting)
            if highlight_cell == (cx, cy):
                # Draw targeting overlay
                if self.effects.range_grid and len(self.effects.range_grid) > 1:
                    # Use red grid overlay, scaled up
                    overlay = pygame.transform.scale(self.effects.range_grid[1], (tile_sz, tile_sz))
                    surface.blit(overlay, (gx, gy))
                else:
                    pygame.draw.rect(surface, (255, 200, 60), rect, 3)

        return cell_rects

    def _draw_destroyed_x(self, surface: pygame.Surface, gx: int, gy: int, tile_sz: int):
        """Draw a red X over a destroyed cell."""
        pad = tile_sz // 6
        color = (200, 40, 40)
        thickness = max(2, tile_sz // 16)
        # Top-left to bottom-right
        pygame.draw.line(surface, color, (gx + pad, gy + pad),
                         (gx + tile_sz - pad, gy + tile_sz - pad), thickness)
        # Top-right to bottom-left
        pygame.draw.line(surface, color, (gx + tile_sz - pad, gy + pad),
                         (gx + pad, gy + tile_sz - pad), thickness)

    def _draw_disabled_symbol(self, surface: pygame.Surface, gx: int, gy: int, tile_sz: int):
        """Draw a blinking electricity-out symbol on a disabled cell.

        Shows a small lightning bolt with a diagonal slash through it,
        blinking on/off every ~400ms.
        """
        # Blink: visible for 400ms, hidden for 400ms
        ticks = pygame.time.get_ticks()
        if (ticks // 400) % 2 == 0:
            return  # hidden phase

        cx = gx + tile_sz // 2
        cy = gy + tile_sz // 2
        sz = tile_sz // 4  # symbol radius

        # Lightning bolt shape (simplified: zigzag)
        bolt_color = (180, 220, 255)
        points = [
            (cx - sz // 3, cy - sz),
            (cx + sz // 6, cy - sz // 4),
            (cx - sz // 6, cy),
            (cx + sz // 3, cy + sz),
            (cx, cy + sz // 4),
            (cx + sz // 6, cy),
        ]
        pygame.draw.lines(surface, bolt_color, False, points, max(2, tile_sz // 24))

        # Diagonal slash through it ("no power")
        slash_color = (255, 80, 80)
        pygame.draw.line(surface, slash_color,
                         (cx - sz, cy - sz), (cx + sz, cy + sz),
                         max(2, tile_sz // 20))

    def _get_label(self, cell) -> str:
        """Short label for cell overlay. For components, append effect tag if it has artifact buffs (e.g. GUNz)."""
        if cell.state == CellState.DESTROYED:
            return ""
        if cell.type == CellType.COMPONENT and cell.component_kind:
            base = cell.component_kind[:3].upper()
            # Try to append effect indicator if ship context allows (caller passes ship? but here simple)
            # Since label is per cell, and effects need ship, we keep base; the tint/overlay in render handles visual "has effect"
            return base
        if cell.type == CellType.ARTIFACT and cell.artifact_kind:
            return cell.artifact_kind[:4].upper()
        return ""

    def _draw_fallback(self, surface, cell, pos, gx, gy, tile_sz, active_corridors):
        """Fallback colored rectangle if tiles aren't loaded."""
        if cell.state == CellState.DESTROYED:
            color = (40, 20, 20)
        elif cell.state == CellState.DISABLED:
            color = (40, 40, 60)
        elif cell.type == CellType.CORRIDOR:
            # Strong visual distinction: bright green = connected, dark grey = disconnected
            color = (30, 120, 50) if pos in active_corridors else (50, 50, 55)
        elif cell.type == CellType.COMPONENT:
            color = (30, 40, 80)
        elif cell.type == CellType.ARTIFACT:
            color = (60, 30, 60)
        else:
            color = (30, 30, 30)
        rect = pygame.Rect(gx, gy, tile_sz - 1, tile_sz - 1)
        pygame.draw.rect(surface, color, rect)
        border_col = (60, 180, 80) if (cell.type == CellType.CORRIDOR and cell.state == CellState.INTACT and pos in active_corridors) else (60, 60, 80)
        pygame.draw.rect(surface, border_col, rect, 1)
