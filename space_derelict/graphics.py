"""Graphical renderer for Space Derelict using pygame.

Reuses the pure model from space_derelict.model (Ship, Cell, etc.).
Loads pixel art from assets/ (spritesheet.jpg for base tiles, overlays.jpg, background.jpg).

Tile size: 32x32 (from generated art).
Spritesheet layout (8x8 grid, row-major) - LEGACY for simple_graphics / --old mode.
Full graphical (run_graphical.py) uses rich per-faction tilesets from "asset packs/" (DithArt PNGs):
- Dark Organic: player (franken)
- SciFi Base: raider/confederacy
- Alien: felonia/pop_fiz
- MedBay/SciFi02: techopuritan
- Dungeon: derelict/pop_fiz variants
Different asset pack art styles + tile mappings in tiles.py give each faction distinct "looking ships".
(See space_derelict/tiles.py FACTION_TILESET, ShipTileRenderer, and model factions in generate/get_node_enemy for types.)

Usage:
  from space_derelict.graphics import PygameRenderer
  renderer = PygameRenderer()
  renderer.render_ship(ship, title="Player Ship")
  # In main loop: renderer.draw(), handle events, etc.

For full graphical game, this can be extended with input handling
(mouse targeting, buttons for dmg types) while calling the same
model methods (apply_damage, post_combat etc.).
"""

import pygame
import os
from typing import Tuple, Dict, Optional
from space_derelict.model import Ship, Cell, CellType, CellState

TILE_SIZE = 32
SPRITESHEET_COLS = 8

# Mapping from (type, kind or state) to (row, col) in spritesheet
# Corridors use state for variation
TILE_MAP: Dict[Tuple[str, Optional[str]], Tuple[int, int]] = {
    # Corridors (use state: INTACT, DISABLED, DESTROYED)
    ("CORRIDOR", "INTACT"): (0, 0),
    ("CORRIDOR", "DISABLED"): (0, 1),
    ("CORRIDOR", "DESTROYED"): (0, 2),
    ("EMPTY", None): (0, 3),  # background/empty

    # Components (kind)
    ("COMPONENT", "gun"): (1, 0),
    ("COMPONENT", "laser"): (1, 1),
    ("COMPONENT", "engine"): (1, 2),
    ("COMPONENT", "power"): (1, 3),
    ("COMPONENT", "armor"): (1, 4),
    ("COMPONENT", "shield"): (1, 5),
    ("COMPONENT", "medical"): (1, 6),
    ("COMPONENT", "cargo"): (1, 7),

    # Artifacts row 2
    ("ARTIFACT", "volatile"): (2, 0),
    ("ARTIFACT", "booster"): (2, 1),
    ("ARTIFACT", "dampener"): (2, 2),
    ("ARTIFACT", "reactor"): (2, 3),
    ("ARTIFACT", "feast_chamber"): (2, 4),
    ("ARTIFACT", "scanner"): (2, 5),
    ("ARTIFACT", "jammer"): (2, 6),
    ("ARTIFACT", "nanite"): (2, 7),

    # More artifacts / extras row 3
    ("ARTIFACT", "overdrive"): (3, 0),
    ("ARTIFACT", "accumulator"): (3, 1),
    ("ARTIFACT", "pulse"): (3, 2),
    ("ARTIFACT", "scatter"): (3, 3),
    ("ARTIFACT", "widebeam"): (3, 4),
    ("ARTIFACT", "bypass"): (3, 5),
    ("ARTIFACT", "distributor"): (3, 6),
    # add more as generated
}

# Overlay tiles from overlays.jpg (2 rows x 4 cols for now)
OVERLAY_MAP = {
    "fire": (0, 0),
    "breach": (0, 1),
    "highlight": (0, 2),
    "disabled_haze": (0, 3),
    "rubble": (1, 0),
    "glow": (1, 1),
}

ASSETS_DIR = os.path.join(os.path.dirname(__file__), "..", "assets")


class PygameRenderer:
    def __init__(self, tile_size: int = TILE_SIZE, scale: int = 1):
        pygame.init()
        self.tile_size = tile_size
        self.scale = scale
        self.display_size = (800, 600)  # default window
        self.screen = pygame.display.set_mode(self.display_size)
        pygame.display.set_caption("Space Derelict - Graphical Prototype")

        # Load images
        self.spritesheet = self._load_image("spritesheet.jpg")
        self.overlays = self._load_image("overlays.jpg")
        self.background = self._load_image("background.jpg")

        self.font = pygame.font.SysFont("consolas", 14)
        self.clock = pygame.time.Clock()

        # For multi-ship views
        self.ship_surfaces: Dict[int, pygame.Surface] = {}  # cache by id

    def _load_image(self, name: str) -> pygame.Surface:
        path = os.path.join(ASSETS_DIR, name)
        if not os.path.exists(path):
            # Fallback solid color if missing
            surf = pygame.Surface((256, 256))
            surf.fill((40, 40, 60))
            return surf
        return pygame.image.load(path).convert_alpha()

    def _get_tile(self, sheet: pygame.Surface, row: int, col: int, size: int = TILE_SIZE) -> pygame.Surface:
        x = col * size
        y = row * size
        tile = sheet.subsurface(pygame.Rect(x, y, size, size)).copy()
        if self.scale != 1:
            tile = pygame.transform.scale(tile, (size * self.scale, size * self.scale))
        return tile

    def _cell_to_tile_pos(self, cell: Cell) -> Tuple[int, int]:
        """Return (row, col) in spritesheet for this cell."""
        key = (cell.type.name, None)
        if cell.type == CellType.CORRIDOR:
            state_name = cell.state.name if hasattr(cell.state, 'name') else str(cell.state)
            key = (cell.type.name, state_name)
        elif cell.type == CellType.COMPONENT:
            key = (cell.type.name, cell.component_kind)
        elif cell.type == CellType.ARTIFACT:
            key = (cell.type.name, cell.artifact_kind)

        if key in TILE_MAP:
            return TILE_MAP[key]
        # fallback
        return (0, 3)  # empty

    def render_ship_to_surface(self, ship: Ship, title: str = "", highlight_pos: Optional[Tuple[int, int]] = None) -> pygame.Surface:
        """Render a Ship to a pygame Surface (for embedding in UI or saving)."""
        if not ship.cells:
            surf = pygame.Surface((200, 100))
            surf.fill((20, 20, 30))
            return surf

        # Compute bounds
        xs = [p[0] for p in ship.cells.keys()]
        ys = [p[1] for p in ship.cells.keys()]
        min_x, max_x = min(xs), max(xs)
        min_y, max_y = min(ys), max(ys)
        width = (max_x - min_x + 1) * self.tile_size * self.scale
        height = (max_y - min_y + 1) * self.tile_size * self.scale

        surf = pygame.Surface((width + 20, height + 40))
        surf.fill((10, 10, 20))

        # Draw background tiles
        bg_tile = self._get_tile(self.background, 0, 0)
        for gy in range(0, height + self.tile_size * self.scale, self.tile_size * self.scale):
            for gx in range(0, width + self.tile_size * self.scale, self.tile_size * self.scale):
                surf.blit(bg_tile, (gx + 10, gy + 30))

        active = ship.get_active_corridors()

        for (x, y), cell in ship.cells.items():
            gx = (x - min_x) * self.tile_size * self.scale + 10
            gy = (y - min_y) * self.tile_size * self.scale + 30

            row, col = self._cell_to_tile_pos(cell)
            tile = self._get_tile(self.spritesheet, row, col)

            # State effects
            if cell.state == CellState.DISABLED:
                haze = self._get_tile(self.overlays, *OVERLAY_MAP["disabled_haze"])
                surf.blit(tile, (gx, gy))
                surf.blit(haze, (gx, gy))
            elif cell.state == CellState.DESTROYED:
                rubble = self._get_tile(self.overlays, *OVERLAY_MAP["rubble"])
                surf.blit(tile, (gx, gy))
                surf.blit(rubble, (gx, gy))
            else:
                surf.blit(tile, (gx, gy))

            # Active glow for powered components/artifacts
            if cell.type != CellType.CORRIDOR and ship.is_component_active((x, y)):
                glow = self._get_tile(self.overlays, *OVERLAY_MAP.get("glow", (1,1)))
                surf.blit(glow, (gx, gy), special_flags=pygame.BLEND_ADD)

            # Inactive (lost corridor connection, not working): go grey/dim
            if cell.type != CellType.CORRIDOR and not ship.is_component_active((x, y)) and cell.state == CellState.INTACT:
                dim = pygame.Surface((self.tile_size * self.scale, self.tile_size * self.scale), pygame.SRCALPHA)
                dim.fill((80, 80, 100, 140))  # grey-blue dim overlay
                surf.blit(dim, (gx, gy))

            # Component has artifact effects (e.g. scatter, booster etc.): green tint to show "buffed"
            if cell.type == CellType.COMPONENT and cell.state == CellState.INTACT:
                try:
                    if ship.get_component_effect_tags((x, y)):
                        effect_tint = pygame.Surface((self.tile_size * self.scale, self.tile_size * self.scale), pygame.SRCALPHA)
                        effect_tint.fill((50, 180, 80, 60))  # subtle green
                        surf.blit(effect_tint, (gx, gy))
                except Exception:
                    pass

            # Highlight
            if highlight_pos and (x, y) == highlight_pos:
                hl = self._get_tile(self.overlays, *OVERLAY_MAP["highlight"])
                surf.blit(hl, (gx, gy))

        # Title
        if title:
            txt = self.font.render(title, True, (200, 220, 255))
            surf.blit(txt, (10, 5))

        return surf

    def draw_ship(self, ship: Ship, x: int, y: int, title: str = "", highlight: Optional[Tuple[int,int]] = None):
        """Blit a ship render onto the main screen at position."""
        surf = self.render_ship_to_surface(ship, title, highlight)
        self.screen.blit(surf, (x, y))
        return surf.get_size()

    def handle_events(self) -> bool:
        """Basic event pump. Returns False on quit."""
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                return False
            if event.type == pygame.KEYDOWN and event.key == pygame.K_ESCAPE:
                return False
        return True

    def update_display(self, fps: int = 30):
        pygame.display.flip()
        self.clock.tick(fps)

    def quit(self):
        pygame.quit()


def simple_graphical_demo():
    """Run a simple pygame demo that renders ships from the model.
    Loads a dev ship if available, otherwise creates a starter.
    Shows side-by-side player / enemy, allows basic cycling.
    """
    from space_derelict.model import (
        make_starter_player_ship, get_random_dev_ship, generate_sector, get_node_enemy,
        Cell, CellType, CellState, DamageType
    )

    renderer = PygameRenderer(scale=2)  # 2x for visibility
    player = make_starter_player_ship()

    dev = get_random_dev_ship()
    if dev:
        enemy = dev
        enemy.name = "Demo Enemy (dev ship)"
    else:
        sector = generate_sector(1)
        enemy = get_node_enemy(sector[0], 1)

    running = True
    show_help = True
    current_highlight = None

    print("Graphical demo running. ESC to quit. Click to highlight cells (demo).")
    print("This reuses the exact model - no changes to logic.")

    while running:
        running = renderer.handle_events()

        # Simple mouse highlight (demo of input)
        mouse_pos = pygame.mouse.get_pos()
        # For demo, just clear highlight or set based on last ship
        current_highlight = None  # extend with real mapping if wanted

        renderer.screen.fill((15, 15, 25))

        # Draw two ships side by side
        p_size = renderer.draw_ship(player, 20, 40, "Your Derelict")
        e_size = renderer.draw_ship(enemy, 20 + p_size[0] + 30, 40, enemy.name or "Enemy")

        # Instructions
        if show_help:
            lines = [
                "SPACE DERELICT - Graphical Prototype",
                "Model is 100% reused from terminal version.",
                "ESC: quit   (Click grid in future for targeting)",
                "Dev ships from builder now render here too!",
            ]
            y = 40 + max(p_size[1], e_size[1]) + 20
            for i, line in enumerate(lines):
                txt = renderer.font.render(line, True, (180, 200, 220))
                renderer.screen.blit(txt, (20, y + i * 18))

        renderer.update_display()

    renderer.quit()


if __name__ == "__main__":
    simple_graphical_demo()
