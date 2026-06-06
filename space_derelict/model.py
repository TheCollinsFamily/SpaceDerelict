"""Core data model for Space Derelict.

Ship as a grid of cells with strict corridor connectivity.
Chunks are graftable clusters with port information.
Damage types have distinct effects for capture vs shatter play.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Dict, Tuple, Set, List, Optional, Any
from collections import defaultdict
import random
import json
from pathlib import Path

# Logging (safe early import; get_logger auto-inits minimal file logging if needed)
try:
    from .logging_setup import get_logger
except Exception:
    import logging as _logging
    def get_logger(name: str = "space_derelict"):
        return _logging.getLogger(name)


class CellType(Enum):
    CORRIDOR = auto()
    COMPONENT = auto()
    ARTIFACT = auto()


class CellState(Enum):
    INTACT = auto()
    DISABLED = auto()
    DESTROYED = auto()


class DamageType(Enum):
    ION = auto()          # Strong vs shields (strips layers). Shields are now a 'chained generator' system: each active shield comp = 1 layer; whole system inherits properties from artifacts touching any link in the chain(s).
    EMP = auto()          # Disables components (capture tool)
    KINETIC = auto()      # Balanced, creates destroyed tiles
    BREACH = auto()       # Hull specialist, high shatter risk
    FIRE = auto()         # DOT on non-corridor tiles, spreads
    NERVE_GAS = auto()    # Inoperates corridors (requires shields down). Shield chain properties (e.g. jammer touching a link) can enhance blocking.


@dataclass
class Resources:
    """Simple economy: scrap for repairs/growth, feast for meta power (from good captures).
    ratings: game show "infamy / spectacle points" earned for brutality (more brutal = more points for home base upgrades).
    The inhabitants watch; the more entertaining/shatter-heavy/chaotic the run, the higher the ratings.
    """
    scrap: int = 0
    feast: int = 0
    ratings: int = 0

    def __add__(self, other: "Resources") -> "Resources":
        return Resources(
            self.scrap + other.scrap,
            self.feast + other.feast,
            self.ratings + other.ratings
        )

    def __iadd__(self, other: "Resources") -> "Resources":
        self.scrap += other.scrap
        self.feast += other.feast
        self.ratings += other.ratings
        return self

    def __repr__(self) -> str:
        return f"Resources(scrap={self.scrap}, feast={self.feast}, ratings={self.ratings})"


@dataclass
class Cell:
    type: CellType
    state: CellState = CellState.INTACT
    component_kind: str | None = None   # e.g. "gun", "engine", "armor", "broadcast_array", "harvester_claw", "drone_bay"
    artifact_kind: str | None = None    # see ARTIFACT_KINDS below for full set (risk/reward, ratings, feast, betrayal, capture vs shatter)

    def is_destroyed(self) -> bool:
        return self.state == CellState.DESTROYED

    def is_functional(self) -> bool:
        return self.state == CellState.INTACT


# Centralized registries (used by dev builder, procedural gen, docs, and validation).
# Adding here makes graft choices in post-combat feel deep: each piece changes combat
# texture, ratings/feast payouts, risk to your ship, or how the enemy AI behaves.
COMPONENT_KINDS: list[str] = [
    "gun", "laser", "engine", "power", "armor", "shield",
    "medical", "cargo", "missile", "flamer", "drone_bay",
    "broadcast_array", "harvester_claw", "stealth_plate",
    "scattergun", "beam",  # new for pairing variety + FTL-style line weapons
]
# Weapon profiles define two independent axes:
#   MODE — how damage is applied to the grid:
#     "single" — one aimed shot at one cell
#     "spray"  — hits target + 1-3 random nearby cells (shotgun)
#     "line"   — FTL-style beam, hits every cell along a drawn path
#     "area"   — hits target + spreads to adjacent cells
#   DAMAGE TYPE — what kind of damage (from DamageType enum)
#     primary is always applied; secondary (if any) is a bonus effect on same/adjacent
#
# Variety comes from mixing modes × damage types. Most weapons are single-damage.
# Secondary is rare and meaningful (missile detonation, drone follow-up).
WEAPON_PROFILES: dict[str, dict] = {
    "gun": {
        "primary": DamageType.KINETIC,
        "secondary": None,
        "mode": "single",
        "label": "GUN",
        "desc": "Aimed kinetic shot",
    },
    "laser": {
        "primary": DamageType.ION,
        "secondary": None,
        "mode": "single",
        "label": "LASER",
        "desc": "Aimed ion beam, strips shields",
    },
    "missile": {
        "primary": DamageType.KINETIC,
        "secondary": DamageType.FIRE,
        "mode": "single",
        "label": "MISSILE",
        "desc": "Kinetic impact + fire on detonation",
    },
    "flamer": {
        "primary": DamageType.FIRE,
        "secondary": None,
        "mode": "area",
        "label": "FLAMER",
        "desc": "Fire spreads to adjacent cells",
    },
    "scattergun": {
        "primary": DamageType.KINETIC,
        "secondary": None,
        "mode": "spray",
        "label": "SCATTER",
        "desc": "Kinetic fragments hit multiple cells",
    },
    "beam": {
        "primary": DamageType.ION,
        "secondary": None,
        "mode": "line",
        "label": "BEAM",
        "desc": "Ion line sweep across cells",
    },
    "drone_bay": {
        "primary": DamageType.EMP,
        "secondary": DamageType.KINETIC,
        "mode": "single",
        "label": "DRONES",
        "desc": "EMP disable + kinetic follow-up",
    },
}

# Simple lookup (primary only) for backward compat with get_active_threats etc.
WEAPON_DAMAGE_MAP: dict[str, "DamageType"] = {
    k: v["primary"] for k, v in WEAPON_PROFILES.items()
}

ARTIFACT_KINDS: list[str] = [
    "volatile", "booster", "dampener", "reactor", "feast_chamber",
    "scanner", "jammer", "nanite", "overdrive", "accumulator", "pulse", "scatter",
    "widebeam", "bypass", "distributor",
    # Fleshed / new for diversity (tie to televised cruelty, feast, betrayal, genocide, risk/reward grafts)
    "reflector", "chain", "rating_vortex", "feast_converter", "decoy", "overloader", "network_tap",
    "cryo_vault", "mind_link", "breach_charger", "rating_amplifier", "symbiotic_host", "extinction_seed",
    # Pairing / combo artifacts for emergent overpowered builds (e.g. scattergun + multishot/doubler + neurotoxin on kinetics;
    # beam + beam_focus + prism for FTL-style sweeping destruction that hits everything in path)
    "multishot", "doubler", "neurotoxin", "beam_focus", "prism", "payload",
]


@dataclass
class Chunk:
    """A graftable piece of ship with relative coordinates and known attachment ports."""
    name: str
    cells: Dict[Tuple[int, int], Cell]   # relative (dx, dy) -> Cell
    ports: List[Tuple[int, int]] = field(default_factory=list)  # exposed edge cells good for grafting

    def rotated(self, turns: int = 1) -> "Chunk":
        """Return a new chunk rotated 90*turns degrees clockwise."""
        new_cells: Dict[Tuple[int, int], Cell] = {}
        for (dx, dy), cell in self.cells.items():
            for _ in range(turns % 4):
                dx, dy = dy, -dx
            new_cells[(dx, dy)] = cell  # shallow ok, cells are immutable for now

        new_ports = []
        for (dx, dy) in self.ports:
            for _ in range(turns % 4):
                dx, dy = dy, -dx
            new_ports.append((dx, dy))

        return Chunk(name=self.name + f"_rot{turns}", cells=new_cells, ports=new_ports)


@dataclass
class Ship:
    """A complete ship (player or enemy) on an absolute grid.
    sub_chunks tracks logical pieces (for named salvage options after combat).
    Each entry: (name, offset_where_its_0_0_was_placed, original_template_chunk).
    """
    cells: Dict[Tuple[int, int], Cell] = field(default_factory=dict)
    core: Tuple[int, int] = (0, 0)
    name: str = "Unknown Ship"
    sub_chunks: List[Tuple[str, Tuple[int, int], Chunk]] = field(default_factory=list)
    meta: dict = field(default_factory=dict)  # Dev-only: {"description": "...", "intended_faction": "raider", "difficulty": 2, "ai_profile": "aggressive", "notes": "", "author": ""}

    def add_cell(self, pos: Tuple[int, int], cell: Cell) -> None:
        self.cells[pos] = cell

    def get_active_corridors(self) -> Set[Tuple[int, int]]:
        """Flood fill from core to find all connected, functional corridor tiles."""
        if self.core not in self.cells:
            return set()

        active: Set[Tuple[int, int]] = set()
        stack = [self.core]
        visited: Set[Tuple[int, int]] = set()

        while stack:
            pos = stack.pop()
            if pos in visited:
                continue
            visited.add(pos)

            cell = self.cells.get(pos)
            if not cell:
                continue
            if cell.type != CellType.CORRIDOR:
                continue
            if cell.state != CellState.INTACT:
                continue

            active.add(pos)

            x, y = pos
            for neigh in [(x+1, y), (x-1, y), (x, y+1), (x, y-1)]:
                if neigh not in visited and neigh in self.cells:
                    stack.append(neigh)

        return active

    def is_component_active(self, pos: Tuple[int, int]) -> bool:
        """A component is active only if adjacent to an active corridor.
        'bypass' artifact (local or transferred via distributor) allows it to function without corridor connection.
        Distributor shares other artifact powers (scatter etc) across the connected network."""
        cell = self.cells.get(pos)
        if not cell or cell.type == CellType.CORRIDOR:
            return False
        if cell.state != CellState.INTACT:
            return False

        if self.has_bypass(pos):
            return True

        x, y = pos
        active_corr = self.get_active_corridors()
        for neigh in [(x+1, y), (x-1, y), (x, y+1), (x, y-1)]:
            if neigh in active_corr:
                return True
        return False

    def has_booster_protection(self, pos: Tuple[int, int]) -> bool:
        """Check if this component is adjacent to an intact 'booster' artifact (for mitigation flavor).
        Distributor transfers booster protection across the connected network."""
        cell = self.cells.get(pos)
        if not cell or cell.type != CellType.COMPONENT or cell.state != CellState.INTACT:
            return False
        x, y = pos
        for nx, ny in [(x+1,y),(x-1,y),(x,y+1),(x,y-1)]:
            n = self.cells.get((nx, ny))
            if n and n.type == CellType.ARTIFACT and n.state == CellState.INTACT and n.artifact_kind == "booster":
                return True
        if "booster" in self._get_network_shared_powers():
            return True
        return False

    def has_jammer_protection(self, pos: Tuple[int, int]) -> bool:
        """Adjacent intact 'jammer' artifact protects comp from full EMP effect.
        Distributor transfers jammer protection across the connected network."""
        cell = self.cells.get(pos)
        if not cell or cell.type != CellType.COMPONENT or cell.state != CellState.INTACT:
            return False
        x, y = pos
        for nx, ny in [(x+1,y),(x-1,y),(x,y+1),(x,y-1)]:
            n = self.cells.get((nx, ny))
            if n and n.type == CellType.ARTIFACT and n.state == CellState.INTACT and n.artifact_kind == "jammer":
                return True
        if "jammer" in self._get_network_shared_powers():
            return True
        return False

    def has_overdrive_risk(self, pos: Tuple[int, int]) -> bool:
        """Adjacent 'overdrive' makes Ion on this gun dangerous (self-destruct instead of disable).
        Distributor transfers overdrive risk across the connected network."""
        cell = self.cells.get(pos)
        if not cell or cell.type != CellType.COMPONENT or cell.state != CellState.INTACT:
            return False
        k = (cell.component_kind or "").lower()
        if "gun" not in k and "laser" not in k and "missile" not in k and "flamer" not in k:
            return False
        x, y = pos
        for nx, ny in [(x+1,y),(x-1,y),(x,y+1),(x,y-1)]:
            n = self.cells.get((nx, ny))
            if n and n.type == CellType.ARTIFACT and n.state == CellState.INTACT and n.artifact_kind == "overdrive":
                return True
        if "overdrive" in self._get_network_shared_powers():
            return True
        return False

    def has_dampener_protection(self, pos: Tuple[int, int]) -> bool:
        """Adjacent intact 'dampener' suppresses fire on this tile.
        Distributor transfers dampener protection across the connected network (affects orphaned tiles too when shared)."""
        cell = self.cells.get(pos)
        if not cell or cell.type == CellType.CORRIDOR:
            return False
        x, y = pos
        for nx, ny in [(x+1,y),(x-1,y),(x,y+1),(x,y-1)]:
            n = self.cells.get((nx, ny))
            if n and n.type == CellType.ARTIFACT and n.state == CellState.INTACT and n.artifact_kind == "dampener":
                return True
        if "dampener" in self._get_network_shared_powers():
            return True
        return False

    def has_scatter(self, pos: Tuple[int, int]) -> bool:
        """Adjacent 'scatter' artifact makes adjacent gun/laser do double random component shots (twice as strong, random target among components only).
        With distributor, scatter power from ANY connected component applies to this weapon too."""
        cell = self.cells.get(pos)
        if not cell or cell.type != CellType.COMPONENT or cell.state != CellState.INTACT:
            return False
        k = (cell.component_kind or "").lower()
        if "gun" not in k and "laser" not in k:
            return False
        x, y = pos
        for nx, ny in [(x+1,y),(x-1,y),(x,y+1),(x,y-1)]:
            n = self.cells.get((nx, ny))
            if n and n.type == CellType.ARTIFACT and n.state == CellState.INTACT and n.artifact_kind == "scatter":
                return True
        if "scatter" in self._get_network_shared_powers():
            return True
        return False

    def has_widebeam(self, pos: Tuple[int, int]) -> bool:
        """Adjacent 'widebeam' artifact doubles the beam size of this gun/laser: hits target + the cell to the right (if component).
        With distributor, widebeam power from ANY connected component applies to this weapon too."""
        cell = self.cells.get(pos)
        if not cell or cell.type != CellType.COMPONENT or cell.state != CellState.INTACT:
            return False
        k = (cell.component_kind or "").lower()
        if "gun" not in k and "laser" not in k:
            return False
        x, y = pos
        for nx, ny in [(x+1,y),(x-1,y),(x,y+1),(x,y-1)]:
            n = self.cells.get((nx, ny))
            if n and n.type == CellType.ARTIFACT and n.state == CellState.INTACT and n.artifact_kind == "widebeam":
                return True
        if "widebeam" in self._get_network_shared_powers():
            return True
        return False

    def has_bypass(self, pos: Tuple[int, int]) -> bool:
        """Adjacent intact 'bypass' artifact allows this component to be active without corridor connection.
        With active distributor, the bypass power transfers to other connected components (enabling corridor-free activation for the network)."""
        cell = self.cells.get(pos)
        if not cell or cell.type != CellType.COMPONENT or cell.state != CellState.INTACT:
            return False
        x, y = pos
        for nx, ny in [(x+1,y),(x-1,y),(x,y+1),(x,y-1)]:
            n = self.cells.get((nx, ny))
            if n and n.type == CellType.ARTIFACT and n.state == CellState.INTACT and n.artifact_kind == "bypass":
                return True
        # distributor transfer: any bypass power present anywhere in network applies here (for connected comps)
        if "bypass" in self._get_network_shared_powers():
            return True
        return False

    def has_reflector(self, pos: Tuple[int, int]) -> bool:
        """Adjacent intact 'reflector' artifact mitigates incoming damage (and can feed spectacle ratings when it saves the day)."""
        x, y = pos
        for nx, ny in [(x+1,y),(x-1,y),(x,y+1),(x,y-1)]:
            n = self.cells.get((nx, ny))
            if n and n.type == CellType.ARTIFACT and n.state == CellState.INTACT and n.artifact_kind == "reflector":
                return True
        if "reflector" in getattr(self, "_get_network_shared_powers", lambda: set())():
            return True
        return False

    def has_decoy(self, pos: Tuple[int, int]) -> bool:
        """Position or adjacent holds an intact 'decoy' artifact. Enemy AI is drawn to attack decoys over real threats (makes a great sacrificial graft)."""
        candidates = [pos]
        x, y = pos
        for dx, dy in [(1,0),(-1,0),(0,1),(0,-1)]:
            candidates.append((x+dx, y+dy))
        for p in candidates:
            c = self.cells.get(p)
            if c and c.type == CellType.ARTIFACT and c.state == CellState.INTACT and c.artifact_kind == "decoy":
                return True
        if "decoy" in getattr(self, "_get_network_shared_powers", lambda: set())():
            return True
        return False

    def _has_active_distributor(self) -> bool:
        """True if an intact 'distributor' artifact is adjacent to the active corridor network
        (or to any locally-bypassed component). Powers only share when a distributor is 'powered' this way."""
        active_corr = self.get_active_corridors()
        for apos, acell in self.cells.items():
            if not (acell.type == CellType.ARTIFACT and acell.state == CellState.INTACT and acell.artifact_kind == "distributor"):
                continue
            x, y = apos
            for nx, ny in [(x+1, y), (x-1, y), (x, y+1), (x, y-1)]:
                if (nx, ny) in active_corr:
                    return True
                ncell = self.cells.get((nx, ny))
                if ncell and ncell.type == CellType.COMPONENT and ncell.state == CellState.INTACT:
                    # local-bypass only (manual to avoid any bootstrap issues with shared bypass)
                    has_loc_byp = False
                    cx, cy = nx, ny
                    for bnx, bny in [(cx+1, cy), (cx-1, cy), (cx, cy+1), (cx, cy-1)]:
                        bc = self.cells.get((bnx, bny))
                        if bc and bc.type == CellType.ARTIFACT and bc.state == CellState.INTACT and bc.artifact_kind == "bypass":
                            has_loc_byp = True
                            break
                    if has_loc_byp:
                        return True
        return False

    def _get_network_shared_powers(self) -> Set[str]:
        """When distributor is active, returns the union of artifact_kinds adjacent to any 'networked' component.
        Networked = corridor-adjacent OR locally bypassed. This lets e.g. one scatter + distributor affect all guns in network."""
        if not self._has_active_distributor():
            return set()
        active_corr = self.get_active_corridors()
        shared: set = set()
        for cpos, ccell in self.cells.items():
            if ccell.type != CellType.COMPONENT or ccell.state != CellState.INTACT:
                continue
            x, y = cpos
            adj_corr = any((x + dx, y + dy) in active_corr for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)])
            loc_bypass = False
            for nx, ny in [(x+1, y), (x-1, y), (x, y+1), (x, y-1)]:
                n = self.cells.get((nx, ny))
                if n and n.type == CellType.ARTIFACT and n.state == CellState.INTACT and n.artifact_kind == "bypass":
                    loc_bypass = True
                    break
            if not (adj_corr or loc_bypass):
                continue
            # collect powers from this networked comp's adjacent artifacts
            for nx, ny in [(x+1, y), (x-1, y), (x, y+1), (x, y-1)]:
                n = self.cells.get((nx, ny))
                if n and n.type == CellType.ARTIFACT and n.state == CellState.INTACT and n.artifact_kind:
                    shared.add(n.artifact_kind)
        return shared

    def has_distributor(self, pos: Tuple[int, int] | None = None) -> bool:
        """Whether this ship has an active distributor broadcasting artifact powers across its connected components.
        (pos ignored; present for has_* family compatibility)."""
        return self._has_active_distributor()

    def get_active_shield_count(self) -> int:
        """Count of intact, active 'shield' components (the 'links').
        Each active shield generator = 1 unit/layer of shield.
        The shield system is 'chained': the entire shield inherits properties from any artifact touching any link.
        See get_shield_properties() and apply_damage for how this makes chaining + artifact placement on shields uniquely powerful."""
        count = 0
        for pos, cell in self.cells.items():
            if (cell.type == CellType.COMPONENT and
                cell.component_kind == "shield" and
                cell.state == CellState.INTACT and
                self.is_component_active(pos)):
                count += 1
        return count

    def get_shield_properties(self) -> set:
        """The shield system is unique: each active 'shield' generator component is a 'link'.
        The total layers = number of such links (each gives one unit of shield).
        Crucially, the *entire* shield system inherits the properties of *any* artifact that touches *any* link in the chain(s).
        This makes chaining your shield generators on the grid + carefully attaching artifacts to the shield sections very powerful.
        Properties affect how ION/EMP strip layers and how NERVE_GAS interacts.
        """
        props: set = set()
        for pos, cell in self.cells.items():
            if (cell.type == CellType.COMPONENT and
                cell.component_kind == "shield" and
                cell.state == CellState.INTACT and
                self.is_component_active(pos)):
                x, y = pos
                for nx, ny in [(x+1, y), (x-1, y), (x, y+1), (x, y-1)]:
                    n = self.cells.get((nx, ny))
                    if n and n.type == CellType.ARTIFACT and n.state == CellState.INTACT and n.artifact_kind:
                        props.add(n.artifact_kind.lower())
        # Also respect distributor: if shields are networked, any power on the network might apply, but for now adjacency to shields is the "touch"
        # If distributor is active, we could broaden, but adjacency-to-shield is the "chained modules touch" rule.
        return props

    def get_component_effect_tags(self, pos: Tuple[int, int]) -> str:
        """Return short string of effect tags if this component (at pos) has active artifact effects.
        Used by renderers (editor, terminal) to visually indicate e.g. scatter, widebeam, booster etc.
        Examples: 'z' for scatter, 'w' for widebeam, 'b' for booster protection, 'j' jammer, 'o' overdrive risk, 'y' bypass.
        In editor: components with effects can be shown with special style or glyph suffix."""
        if not self.cells.get(pos) or self.cells[pos].type != CellType.COMPONENT or self.cells[pos].state != CellState.INTACT:
            return ""
        tags = []
        if self.has_scatter(pos):
            tags.append("z")  # scatter
        if self.has_widebeam(pos):
            tags.append("w")
        if self.has_booster_protection(pos):
            tags.append("b")
        if self.has_jammer_protection(pos):
            tags.append("j")
        if self.has_dampener_protection(pos):
            tags.append("d")
        if self.has_overdrive_risk(pos):
            tags.append("o")
        if self.has_bypass(pos):
            tags.append("y")
        # add more if needed e.g. reflector etc.
        return "".join(tags)

    def has_offensive_mod(self, mod: str) -> bool:
        """Does the ship's weapon network have this offensive artifact power (multishot, neurotoxin, beam_focus, prism, scatter etc)?
        Checked via distributor shared powers OR direct adjacency to any active gun/laser/beam/scattergun etc.
        This is the key to emergent overpowered graft builds: one doubler + one neurotoxin near any weapon (or distributed) makes your whole offense nasty."""
        mod = mod.lower()
        shared = self._get_network_shared_powers()
        if mod in shared:
            return True
        # Check adjacency to any active offensive component
        for pos, cell in self.cells.items():
            if cell.type != CellType.COMPONENT or cell.state != CellState.INTACT:
                continue
            if not self.is_component_active(pos):
                continue
            k = (cell.component_kind or "").lower()
            if k not in ("gun", "laser", "missile", "flamer", "beam", "scattergun"):
                continue
            x, y = pos
            for nx, ny in [(x+1, y), (x-1, y), (x, y+1), (x, y-1)]:
                n = self.cells.get((nx, ny))
                if n and n.type == CellType.ARTIFACT and n.state == CellState.INTACT:
                    if (n.artifact_kind or "").lower() == mod:
                        return True
        return False

    def apply_line_damage(self, dmg: DamageType, p1: Tuple[int, int], p2: Tuple[int, int], strength: int = 1) -> List[str]:
        """FTL-style beam: damage every cell along the line between p1 and p2.
        Pair with beam_focus (re-damage or +strength), prism (fork/split), neurotoxin (if kinetic) etc for broken sweeps."""
        logs: List[str] = []
        line = get_line_cells(p1, p2)
        hit_count = 0
        for pos in line:
            if pos in self.cells:
                lgs = self.apply_damage(dmg, pos, strength)
                logs.extend(lgs)
                hit_count += 1
        if hit_count:
            logs.append(f"BEAM path {p1}->{p2} swept {hit_count} cells")
        return logs

    def get_network_integrity(self) -> float:
        """Rough measure: fraction of corridor tiles that are active."""
        corridors = [c for c in self.cells.values() if c.type == CellType.CORRIDOR]
        if not corridors:
            return 0.0
        active = len(self.get_active_corridors())
        return active / len(corridors)

    def apply_damage(self, dmg: DamageType, target: Tuple[int, int], strength: int = 1) -> List[str]:
        """Apply damage at a position. Returns list of log messages."""
        logs: List[str] = []
        if target not in self.cells:
            logs.append(f"Missed (no cell at {target})")
            return logs

        cell = self.cells[target]
        if cell.state == CellState.DESTROYED:
            logs.append(f"Already destroyed at {target}")
            return logs

        x, y = target

        if dmg == DamageType.ION:
            # Per DESIGN: Strong vs shields (strips to enable other effects). Little direct on components/hull.
            # Shields are now unique "generator chain" system:
            # - Each active "shield" component = 1 layer (each link in the chain gives one unit).
            # - The *entire* shield gets properties from ANY artifact touching ANY link in the chain(s).
            #   This makes placing/chaining your shield generators + attaching artifacts to them strategically powerful.
            shield_count = self.get_active_shield_count()
            shield_props = self.get_shield_properties()
            if shield_count > 0:
                # Strip one shield layer, but respect chain properties
                for pos, cell in list(self.cells.items()):
                    if (cell.type == CellType.COMPONENT and
                        cell.component_kind == "shield" and
                        cell.state == CellState.INTACT and
                        self.is_component_active(pos)):
                        stripped = True
                        if "booster" in shield_props:
                            # Booster touching the shield chain makes layers much harder to strip with ION
                            if random.random() < 0.55:
                                stripped = False
                                logs.append(f"ION hit shield chain at {pos} but BOOSTER property mitigated the layer loss")
                        if "reflector" in shield_props:
                            logs.append(f"Shield chain REFLECTOR at link near {pos} sent feedback!")
                            # Could add retaliation but for now flavorful log
                        if stripped:
                            cell.state = CellState.DISABLED
                            logs.append(f"ION stripped shield layer at {pos}")
                            return logs  # one strip per hit
                        else:
                            return logs  # mitigated, no strip this hit
            # If no shields (or after strip), light effect on components
            if cell.type == CellType.COMPONENT and cell.state == CellState.INTACT:
                if self.has_booster_protection(target):
                    logs.append(f"ION weakened component at {target} (booster mitigated)")
                elif self.has_overdrive_risk(target):
                    cell.state = CellState.DESTROYED
                    k = (cell.component_kind or "weapon").upper()
                    logs.append(f"ION caused OVERDRIVE OVERLOAD - self-destructed {k} at {target}")
                else:
                    # Light: disable only if no shields were present
                    cell.state = CellState.DISABLED
                    logs.append(f"ION disabled component at {target} (shields already down)")
            else:
                logs.append(f"ION had little effect at {target} (shields down or non-component)")

        elif dmg == DamageType.EMP:
            # Per DESIGN: Yes vs shields, disables components (threshold), permanent for fight.
            # Now respects shield chain properties (jammer, booster etc touching any link protect the whole system).
            shield_count = self.get_active_shield_count()
            shield_props = self.get_shield_properties()
            if shield_count > 0:
                for pos, cell in list(self.cells.items()):
                    if (cell.type == CellType.COMPONENT and
                        cell.component_kind == "shield" and
                        cell.state == CellState.INTACT and
                        self.is_component_active(pos)):
                        stripped = True
                        if "jammer" in shield_props:
                            if random.random() < 0.6:
                                stripped = False
                                logs.append(f"EMP hit shield chain at {pos} but JAMMER property on the chain blocked the layer loss")
                        if "booster" in shield_props:
                            if random.random() < 0.4:
                                stripped = False
                                logs.append(f"EMP partially deflected by BOOSTER-enhanced shield chain at {pos}")
                        if stripped:
                            cell.state = CellState.DISABLED
                            logs.append(f"EMP disabled shield layer at {pos}")
                            return logs
                        else:
                            return logs
            if cell.type == CellType.COMPONENT and cell.state == CellState.INTACT:
                if self.has_booster_protection(target):
                    logs.append(f"EMP partially deflected at {target} (booster artifact nearby)")
                    # no full disable
                elif self.has_jammer_protection(target):
                    logs.append(f"EMP jammed at {target} (jammer array protected - no disable)")
                    # mitigated by jammer
                else:
                    cell.state = CellState.DISABLED
                    logs.append(f"EMP disabled component at {target}")
            elif cell.type == CellType.CORRIDOR and cell.state == CellState.INTACT:
                # EMP corridors is possible but less efficient in design
                cell.state = CellState.DISABLED
                logs.append(f"EMP knocked out corridor at {target}")

            if self.has_reflector(target):
                logs.append(f"REFLECTOR mitigated EMP at {target}")
                # already disabled above or return early in some paths; the check prevents full effect in caller patterns
            # reflector note already handled via has_ in some branches; extra log if we reach here for flavor

        elif dmg == DamageType.KINETIC:
            if cell.state == CellState.INTACT:
                if self.has_booster_protection(target) and random.random() < 0.35:
                    cell.state = CellState.DISABLED
                    logs.append(f"KINETIC hit but BOOSTER resilience only disabled the target at {target} (mitigated)")
                else:
                    cell.state = CellState.DESTROYED
                    logs.append(f"KINETIC destroyed {cell.type.name.lower()} at {target}")
            elif cell.state == CellState.DISABLED:
                cell.state = CellState.DESTROYED
                logs.append(f"KINETIC finished off disabled cell at {target}")

        elif dmg == DamageType.BREACH:
            if cell.type in (CellType.CORRIDOR, CellType.COMPONENT, CellType.ARTIFACT):
                if cell.state != CellState.DESTROYED:
                    cell.state = CellState.DESTROYED
                    logs.append(f"BREACH shattered {cell.type.name.lower()} at {target}")
            # Hull flavor only for now

        elif dmg == DamageType.FIRE:
            # Fire only really hurts non-active-corridor areas.
            # A tile (component, artifact, or inactive corridor) is protected if it or an adjacent tile
            # is part of the active corridor network. This makes cutting spines + fire spread strategic:
            # connected weapons/components resist fire; orphaned ones burn (and may lose graft value).
            active = self.get_active_corridors()
            x, y = target
            is_supported = (target in active) or any(
                n in active for n in [(x+1, y), (x-1, y), (x, y+1), (x, y-1)]
            )
            if not is_supported:
                if self.has_dampener_protection(target):
                    logs.append(f"FIRE suppressed by dampener at {target}")
                elif self.has_booster_protection(target) and random.random() < 0.4:
                    logs.append(f"FIRE resisted by booster at {target}")
                elif cell.state == CellState.INTACT:
                    cell.state = CellState.DISABLED
                    logs.append(f"FIRE disabled {cell.type.name.lower()} at {target} (no corridor support)")
                    # nanite special: if this was nanite, spread infection on fire hit
                    if cell.type == CellType.ARTIFACT and getattr(cell, 'artifact_kind', None) == 'nanite':
                        x, y = target
                        for nx, ny in [(x+1, y), (x-1, y), (x, y+1), (x, y-1)]:
                            ncell = self.cells.get((nx, ny))
                            if ncell and ncell.state == CellState.INTACT and ncell.type != CellType.CORRIDOR:
                                ncell.state = CellState.DISABLED
                                logs.append(f"NANITE INFECTION (fire triggered) disabled {ncell.type.name.lower()} at {(nx, ny)}")
                elif cell.state == CellState.DISABLED:
                    cell.state = CellState.DESTROYED
                    logs.append(f"FIRE burned out {cell.type.name.lower()} at {target}")
            else:
                logs.append(f"FIRE suppressed by active corridor at {target}")

        elif dmg == DamageType.NERVE_GAS:
            # Per DESIGN: Soft capture. Requires shields down first. No permanent damage. Inoperates corridors.
            # Shield chain properties can enhance this (jammer/booster on the chain make NERVE even harder to land).
            shield_count = self.get_active_shield_count()
            shield_props = self.get_shield_properties()
            if shield_count > 0:
                if "jammer" in shield_props or "booster" in shield_props:
                    logs.append(f"NERVE GAS heavily blocked by enhanced shield chain properties at {target}")
                else:
                    logs.append(f"NERVE GAS blocked by active shields at {target}")
            elif cell.type == CellType.CORRIDOR and cell.state == CellState.INTACT:
                cell.state = CellState.DISABLED
                logs.append(f"NERVE GAS inoperated corridor at {target}")
            else:
                logs.append(f"NERVE GAS had no effect on {cell.type.name.lower()} at {target}")

        # Reflector mitigation for *any* damage type (graft choice pays off: keeps key pieces alive for capture or more show)
        cell = self.cells.get(target)
        if cell and self.has_reflector(target):
            if cell.state == CellState.DESTROYED:
                cell.state = CellState.DISABLED
                logs.append(f"REFLECTOR at adj mitigated total loss at {target} (downgraded to disabled)")
            elif cell.state == CellState.DISABLED and random.random() < 0.3:
                cell.state = CellState.INTACT
                logs.append(f"REFLECTOR partially restored {cell.type.name.lower()} at {target}")

        # Component side-effects on destruction: makes "various" component kinds tactically distinct
        # (power plants cascade, future: engines, reactors already have artifact handling, etc.)
        cell = self.cells.get(target)
        if cell and cell.state == CellState.DESTROYED and cell.type == CellType.COMPONENT:
            kind = (cell.component_kind or "").lower()
            if kind == "power":
                x, y = target
                for dx, dy in [(1, 0), (-1, 0), (0, 1), (0, -1)]:
                    np = (x + dx, y + dy)
                    ncell = self.cells.get(np)
                    if ncell and ncell.state != CellState.DESTROYED and ncell.type in (CellType.COMPONENT, CellType.ARTIFACT):
                        ncell.state = CellState.DISABLED
                        logs.append(f"POWER OVERLOAD disabled adjacent {ncell.type.name.lower()} at {np}")
            elif kind == "broadcast_array":
                logs.append("BROADCAST ARRAY lost - the Graftyard just lost their favorite live feed. Expect angry producers.")
            elif kind == "harvester_claw":
                logs.append("HARVESTER CLAW torn off - biomass harvest spoiled for this run.")

        # Artifact side-effects (e.g. volatile tech from salvaged hulks is dangerous to capture)
        # Re-fetch to see final state after any mitigations (reflector etc)
        cell = self.cells.get(target)
        if cell and cell.type == CellType.ARTIFACT and cell.state == CellState.DESTROYED:
            kind = getattr(cell, 'artifact_kind', None)
            x, y = target
            if kind == "volatile":
                for nx, ny in [(x+1, y), (x-1, y), (x, y+1), (x, y-1)]:
                    ncell = self.cells.get((nx, ny))
                    if ncell and ncell.state == CellState.INTACT:
                        ncell.state = CellState.DISABLED
                        logs.append(f"VOLATILE EXPLOSION disabled {ncell.type.name.lower()} at {(nx, ny)}")
                    elif ncell and ncell.state == CellState.DISABLED:
                        ncell.state = CellState.DESTROYED
                        logs.append(f"VOLATILE EXPLOSION burned out {ncell.type.name.lower()} at {(nx, ny)}")
            elif kind == "reactor":
                for nx, ny in [(x+1, y), (x-1, y), (x, y+1), (x, y-1)]:
                    ncell = self.cells.get((nx, ny))
                    if ncell and ncell.state != CellState.DESTROYED:
                        ncell.state = CellState.DISABLED
                        logs.append(f"REACTOR BREACH disabled {ncell.type.name.lower()} at {(nx, ny)}")
                        # also spread some fire flavor
                        if ncell.type in (CellType.COMPONENT, CellType.ARTIFACT):
                            logs.append(f"  (reactor overload spreads fire risk)")
            elif kind == "pulse":
                for nx, ny in [(x+1, y), (x-1, y), (x, y+1), (x, y-1)]:
                    ncell = self.cells.get((nx, ny))
                    if ncell and ncell.type == CellType.COMPONENT and ncell.state == CellState.INTACT:
                        ncell.state = CellState.DISABLED
                        logs.append(f"PULSE EMP disabled component at {(nx, ny)}")
            elif kind == "chain":
                for nx, ny in [(x+1, y), (x-1, y), (x, y+1), (x, y-1)]:
                    ncell = self.cells.get((nx, ny))
                    if ncell and ncell.state != CellState.DESTROYED:
                        ncell.state = CellState.DESTROYED
                        logs.append(f"CHAIN REACTION destroyed {ncell.type.name.lower()} at {(nx, ny)}")
            elif kind == "breach_charger":
                # Sacrifice for spectacle: big ratings note (caller of fight rewards will pick up via log keywords)
                logs.append("BREACH CHARGER detonated in a glorious overload - the audience is eating this up")
            elif kind == "symbiotic_host":
                # betrayal theme: when your "friend" dies it takes something with it
                for nx, ny in [(x+1, y), (x-1, y), (x, y+1), (x, y-1)]:
                    ncell = self.cells.get((nx, ny))
                    if ncell and ncell.state == CellState.INTACT and ncell.type == CellType.COMPONENT:
                        ncell.state = CellState.DISABLED
                        logs.append(f"SYMBIOTIC HOST betrayed you on death - disabled {ncell.type.name.lower()} at {(nx, ny)}")
        return logs

    def count_states(self) -> Dict[str, int]:
        counts: Dict[str, int] = {"intact": 0, "disabled": 0, "destroyed": 0}
        for c in self.cells.values():
            if c.state == CellState.INTACT:
                counts["intact"] += 1
            elif c.state == CellState.DISABLED:
                counts["disabled"] += 1
            else:
                counts["destroyed"] += 1
        return counts

    def get_capture_quality(self) -> str:
        """Simple heuristic for how good a capture this would be."""
        total = len(self.cells)
        if total == 0:
            return "empty"
        states = self.count_states()
        destroyed_ratio = states["destroyed"] / total
        disabled_ratio = states["disabled"] / total

        if destroyed_ratio > 0.5:
            return "shattered"
        if disabled_ratio > 0.4 and destroyed_ratio < 0.2:
            return "clean_capture"
        if destroyed_ratio > 0.25:
            return "messy"
        return "decent"

    def compute_loot(self) -> Resources:
        """Compute scrap and feast rewards based on final state.
        Capture play (low destroyed, high disabled/intact) -> more feast, decent scrap.
        Shatter play -> high scrap, minimal feast.
        Special artifacts (e.g. feast_chamber) give bonus if intact.
        """
        states = self.count_states()
        total = sum(states.values()) or 1
        quality = self.get_capture_quality()

        # Base yields: destroyed = scrap, intact sections = feast (crew/power)
        scrap = states["destroyed"] * 4 + states["disabled"] * 1
        feast = states["intact"] * 3 + states["disabled"] * 1

        # Special artifact bonuses (capture friendly)
        for cell in self.cells.values():
            if cell.type == CellType.ARTIFACT and cell.state == CellState.INTACT:
                if cell.artifact_kind == "feast_chamber":
                    feast += 10  # bonus crew feast from special capture
                elif cell.artifact_kind == "scanner":
                    feast += 5  # intel bonus
                elif cell.artifact_kind == "accumulator":
                    # bio-accumulator: bonus based on how much you shattered (ironic for capture? or for those who mix)
                    destroyed_bonus = states["destroyed"] // 2
                    feast += 3 + destroyed_bonus
                elif cell.artifact_kind == "feast_converter":
                    # destroyed cells still yield feast (they "processed" even the dead for you)
                    feast += states["destroyed"] // 3
                elif cell.artifact_kind in ("rating_vortex", "cryo_vault"):
                    # these on *enemy* mean you just killed something the audience was hyped for
                    feast += 2

        # Special component bonuses (intact cargo etc for scrap)
        for cell in self.cells.values():
            if cell.type == CellType.COMPONENT and cell.state == CellState.INTACT:
                if cell.component_kind == "cargo":
                    scrap += 8  # bonus salvage from intact cargo
                elif cell.component_kind == "medical":
                    # slight post fight recovery flavor, but since loot after, minor
                    pass

        if quality == "clean_capture":
            feast = int(feast * 1.6)
            scrap = max(1, int(scrap * 0.6))
        elif quality == "shattered":
            scrap = int(scrap * 1.7)
            feast = max(0, int(feast * 0.15))
        elif quality == "messy":
            scrap = int(scrap * 1.15)
            feast = int(feast * 0.55)
        # "decent" keeps base

        return Resources(scrap=max(0, scrap), feast=max(0, feast), ratings=0)

    def calculate_ratings(self, quality: str, combat_log: list[str] | None = None) -> int:
        """Game show ratings / infamy points. The more brutal, chaotic, and entertaining the fight
        (for the thrill-seeking audience watching back home), the more points earned for home base upgrades.
        Shatter/brutal play rewards ratings (meta power) even if it gives poor grafts.
        """
        states = self.count_states()
        score = states["destroyed"] * 3
        if quality == "shattered":
            score += 25
        elif quality == "messy":
            score += 10
        if combat_log:
            for entry in combat_log:
                if any(kw in entry for kw in ("FIRE", "BREACH", "EXPLOSION", "BREACH", "OVERLOAD", "INFECTION", "REACTOR", "BROADCAST", "MIND LINK", "CHAIN REACTION", "DRONE")):
                    score += 4
                if "VOLATILE" in entry or "REACTOR" in entry or "BROADCAST ARRAY" in entry or "MIND LINK" in entry:
                    score += 6  # crowd loves the spectacle of explosions, hijacks, live feeds
                if "DECOY" in entry or "HARVESTER" in entry:
                    score += 3
        # Special enemy artifacts that made the fight more "showy"
        for cell in self.cells.values():
            if cell.type == CellType.ARTIFACT and cell.state == CellState.DESTROYED and cell.artifact_kind in ("rating_vortex", "breach_charger"):
                score += 10
            if cell.type == CellType.ARTIFACT and cell.state == CellState.INTACT and cell.artifact_kind == "rating_vortex":
                score += 5  # you took their hype machine intact, still good TV
        # Capture play gives less ratings (less "entertaining" for the bloodthirsty viewers?)
        if quality == "clean_capture":
            score = int(score * 0.6)
        return max(5, int(score))

    def get_spectacle_modifiers(self) -> dict:
        """Return dict of bonuses/penalties from this ship's grafted components and artifacts.
        Used by post-combat reward application to make attachment decisions have lasting (meta) weight."""
        mods = {"extra_ratings": 0, "ratings_mult": 1.0, "extra_feast": 0, "morale_penalty": 0, "notes": []}
        for pos, cell in self.cells.items():
            if cell.state != CellState.INTACT:
                continue
            is_active = True if cell.type == CellType.ARTIFACT else self.is_component_active(pos)
            if not is_active:
                continue
            ck = (cell.component_kind or "").lower()
            ak = (cell.artifact_kind or "").lower()
            if ck == "broadcast_array":
                mods["extra_ratings"] += 10
                mods["ratings_mult"] *= 1.12
                mods["notes"].append("broadcast live feed")
            if ck == "harvester_claw":
                mods["extra_feast"] += 7
                mods["notes"].append("live harvest")
            if ak == "rating_amplifier":
                mods["ratings_mult"] *= 1.7
                mods["morale_penalty"] += 7
                mods["notes"].append("audience demands more (morale hit)")
            if ak == "cryo_vault":
                mods["extra_feast"] += 9
                mods["notes"].append("cryo specimens for vats")
            if ak == "rating_vortex":
                mods["extra_ratings"] += 6
            if ak == "symbiotic_host":
                # powerful but risky
                mods["extra_ratings"] += 4
                mods["notes"].append("symbiote bonded (risk of betrayal)")
        return mods

    def repair_cell(self, pos: Tuple[int, int]) -> bool:
        """Repair a single disabled cell back to intact (no resource cost here; caller manages)."""
        cell = self.cells.get(pos)
        if cell and cell.state == CellState.DISABLED:
            cell.state = CellState.INTACT
            return True
        return False

    def repair_all_disabled(self, cost_per: int = 2) -> Tuple[int, int]:
        """Repair every disabled cell. Returns (num_repaired, scrap_cost). Caller deducts from resources."""
        repaired = 0
        for cell in self.cells.values():
            if cell.state == CellState.DISABLED:
                cell.state = CellState.INTACT
                repaired += 1
        return repaired, repaired * cost_per

    def extract_chunk(self, origin: Tuple[int, int], size: Tuple[int, int] = (3, 3)) -> Chunk:
        """Naive extraction for prototype: pull a rectangular region as a chunk.
        Only includes non-DESTROYED cells — if you broke the hull/component during combat,
        you don't get those slots/space when grafting that chunk (per design: shattered value lost).
        """
        min_x, min_y = origin
        w, h = size
        chunk_cells: Dict[Tuple[int, int], Cell] = {}
        ports: List[Tuple[int, int]] = []

        for dx in range(w):
            for dy in range(h):
                abs_pos = (min_x + dx, min_y + dy)
                if abs_pos in self.cells:
                    cell = self.cells[abs_pos]
                    if cell.state != CellState.DESTROYED:
                        # Only surviving cells come with the chunk
                        chunk_cells[(dx, dy)] = cell

        # Very naive ports: any cell on the edge of this rect that exists
        for (dx, dy) in list(chunk_cells.keys()):
            if dx == 0 or dx == w-1 or dy == 0 or dy == h-1:
                ports.append((dx, dy))

        return Chunk(name=f"chunk_{origin}", cells=chunk_cells, ports=ports or [(0,0)])

    def graft_chunk(self, chunk: Chunk, attach_at: Tuple[int, int], chunk_port: Tuple[int, int]) -> Tuple[bool, List[str]]:
        """
        Graft the chunk so that chunk_port lands on attach_at on the ship.
        The chunk should already only contain surviving (non-DESTROYED) cells
        (see generate_salvage_options / extract_chunk).
        Destroyed hull/components from combat are not included — you get no space
        and don't receive those broken parts.
        Returns (success, log messages).
        """
        logs: List[str] = []
        offset_x = attach_at[0] - chunk_port[0]
        offset_y = attach_at[1] - chunk_port[1]

        # Check for overlaps
        overlaps = []
        for (dx, dy) in chunk.cells:
            abs_pos = (offset_x + dx, offset_y + dy)
            if abs_pos in self.cells:
                overlaps.append(abs_pos)

        if overlaps:
            logs.append(f"Cannot graft: overlap at {overlaps[:3]}...")
            return False, logs

        # Merge
        for (dx, dy), cell in chunk.cells.items():
            abs_pos = (offset_x + dx, offset_y + dy)
            self.cells[abs_pos] = cell

        logs.append(f"Grafted {chunk.name} at {attach_at} (port {chunk_port})")

        # Special on-graft hooks for high-diversity pieces (story + meta side effects)
        for c in chunk.cells.values():
            ak = getattr(c, "artifact_kind", None)
            if ak == "extinction_seed":
                logs.append("The EXTINCTION SEED has taken root in your frame. When this run ends the producers will know what you did.")
                self.meta = self.meta or {}
                self.meta["grafted_extinction_seed"] = True
            elif ak == "symbiotic_host":
                logs.append("SYMBIOTIC HOST bonded to the hull. It hungers... keep it fed or it may turn on the crew.")
            elif ak == "cryo_vault":
                logs.append("CRYO VAULT sealed. The vats back home will have fresh (screaming) ingredients.")
        return True, logs

    def get_valid_attach_positions(self, chunk: Chunk) -> List[Tuple[Tuple[int, int], Tuple[int, int], Chunk]]:
        """Return list of (ship_attach_pos, chunk_port, rotated_chunk_variant) that would successfully graft without overlap.
        Used by UI to let player manually choose attachment instead of pure auto-graft.
        Prefers corridor-to-corridor connections.
        """
        results = []
        if not self.cells or not chunk.cells:
            return results

        active_or_all = self.get_active_corridors() or {p for p, c in self.cells.items() if c.type == CellType.CORRIDOR}
        dock_spots: List[Tuple[int, int]] = []
        for (x, y) in active_or_all:
            for neigh in [(x+1, y), (x-1, y), (x, y+1), (x, y-1)]:
                if neigh not in self.cells:
                    dock_spots.append(neigh)
        seen = set(dock_spots)
        dock_spots = list(seen)
        if not dock_spots:
            pxs = [p[0] for p in self.cells]; pys = [p[1] for p in self.cells]
            min_px, max_px = min(pxs), max(pxs); min_py, max_py = min(pys), max(pys)
            dock_spots = [(max_px + 1, min_py), (min_px - 1, min_py), (min_px, max_py + 1), (max_px + 2, 0)]

        variants = [chunk] + [chunk.rotated(t) for t in range(1, 4)]
        for variant in variants:
            port_list = list(variant.ports or [(0, 0)])
            corridor_ports = [pt for pt in port_list if variant.cells.get(pt) and variant.cells[pt].type == CellType.CORRIDOR]
            other_ports = [pt for pt in port_list if pt not in corridor_ports]
            ordered_ports = corridor_ports + other_ports
            for attach in dock_spots:
                for port in ordered_ports:
                    # temp check without modifying
                    offset_x = attach[0] - port[0]
                    offset_y = attach[1] - port[1]
                    overlaps = any((offset_x + dx, offset_y + dy) in self.cells for (dx, dy) in variant.cells)
                    if not overlaps:
                        results.append((attach, port, variant))
        # dedup by attach+port approx
        seen = set()
        unique = []
        for item in results:
            key = (item[0], item[1])
            if key not in seen:
                seen.add(key)
                unique.append(item)
        return unique[:12]  # limit for UI sanity

    def try_auto_graft(self, chunk: Chunk) -> Tuple[bool, List[str]]:
        """Try grafting the chunk (and its rotations) at several plausible exterior attach points.
        Prefers dock points directly adjacent to existing corridors so new corridors can join the active network.
        Returns (success, logs)."""
        logs: List[str] = []
        if not self.cells:
            return False, ["No player ship to attach to"]

        attach_candidates = [pos for pos, _, _ in self.get_valid_attach_positions(chunk)[:6]]
        if not attach_candidates:
            pxs = [p[0] for p in self.cells]
            pys = [p[1] for p in self.cells]
            min_px, max_px = min(pxs), max(pxs)
            min_py, max_py = min(pys), max(pys)
            attach_candidates = [(max_px + 1, min_py), (min_px - 1, min_py), (min_px, max_py + 1), (max_px + 2, 0)]

        old_active = len(self.get_active_corridors())
        variants = [chunk] + [chunk.rotated(t) for t in range(1, 4)]

        fallback = None  # (variant, attach, port, added_pos_list, glogs) for last-resort non-connecting graft

        for variant in variants:
            # Prefer ports that are CORRIDORs so the graft seam can extend the active corridor network
            port_list = list(variant.ports or [(0, 0)])
            corridor_ports = [pt for pt in port_list if variant.cells.get(pt) and variant.cells[pt].type == CellType.CORRIDOR]
            other_ports = [pt for pt in port_list if pt not in corridor_ports]
            ordered_ports = corridor_ports + other_ports

            for attach in attach_candidates:
                for port in ordered_ports:
                    ok, glogs = self.graft_chunk(variant, attach_at=attach, chunk_port=port)
                    if not ok:
                        continue

                    # Compute what we added and whether it actually connects new corridors to the network
                    offset_x = attach[0] - port[0]
                    offset_y = attach[1] - port[1]
                    added = []
                    new_corr_abs = []
                    for (dx, dy), cell in variant.cells.items():
                        ax, ay = offset_x + dx, offset_y + dy
                        added.append((ax, ay))
                        if cell.type == CellType.CORRIDOR:
                            new_corr_abs.append((ax, ay))

                    active_now = self.get_active_corridors()
                    connected = any(p in active_now for p in new_corr_abs)
                    grew = len(active_now) > old_active

                    if connected or grew:
                        logs.extend(glogs)
                        logs.append(f"(used rotation/port variant; network connected: {connected})")
                        return True, logs
                    else:
                        # Bad seam: placed hardware but new corridors are isolated from core network. Undo and keep hunting.
                        for pos in added:
                            self.cells.pop(pos, None)
                        logs.append(f"  (undid non-connecting placement at {attach} via port {port})")
                        # record as possible fallback
                        if fallback is None:
                            fallback = (variant, attach, port, added, glogs[:])

        # If we get here, no connecting graft found. Use a fallback placement if we had any success at all.
        if fallback:
            variant, attach, port, added, glogs = fallback
            # Re-perform the graft (since we undid previous attempts)
            ok, _ = self.graft_chunk(variant, attach_at=attach, chunk_port=port)
            if ok:
                logs.extend(glogs)
                logs.append("(used best-effort non-connecting graft; consider manual attach or repair seam later)")
                return True, logs

        logs.append("No clean non-overlapping attachment found for any rotation/port.")
        return False, logs

    def generate_salvage_options(self, max_options: int = 3) -> List[Chunk]:
        """Return up to max_options salvageable chunks.
        If the ship was built with assemble_enemy_ship (sub_chunks recorded), we return the *logical*
        named pieces (gun_pod, armor_plate, etc.) with their *current post-combat damaged states*.
        This makes choices meaningful: "take the damaged gun_pod for firepower" vs "the intact-ish armor".
        Falls back to geometric probes if no sub_chunks metadata.
        """
        if not self.cells:
            return []

        candidates: List[Chunk] = []

        if self.sub_chunks:
            for logical_name, offset, template in self.sub_chunks:
                # Rebuild a chunk using current cell states from the ship at the original relative positions.
                # CRITICAL: only non-DESTROYED cells are included in the salvage chunk.
                # If you broke the hull or a component in this section, you get no additional space
                # and you don't get that broken component when grafting (shattered value lost).
                ch_cells: Dict[Tuple[int, int], Cell] = {}
                for (dx, dy), _ in template.cells.items():
                    abs_pos = (offset[0] + dx, offset[1] + dy)
                    if abs_pos in self.cells:
                        cell = self.cells[abs_pos]
                        if cell.state != CellState.DESTROYED:
                            ch_cells[(dx, dy)] = cell  # only surviving cells
                if not ch_cells:
                    continue
                # ports: use template's, but only those positions that still exist and are surviving
                live_ports = [p for p in template.ports if p in ch_cells]
                ch = Chunk(name=logical_name, cells=ch_cells, ports=live_ports or template.ports[:1])
                candidates.append(ch)
        else:
            # Fallback geometric (for ad-hoc enemies or player ship)
            xs = [p[0] for p in self.cells.keys()]
            ys = [p[1] for p in self.cells.keys()]
            min_x, max_x = min(xs), max(xs)
            min_y, max_y = min(ys), max(ys)
            width = max_x - min_x + 1
            height = max_y - min_y + 1

            c1 = self.extract_chunk((min_x, min_y), size=(min(3, width), min(2, height)))
            if c1.cells:
                c1.name = f"{self.name}_core".replace(" ", "_")
                candidates.append(c1)

            if width > 2:
                c2 = self.extract_chunk((min_x + 1, min_y), size=(min(3, width - 1), min(3, height)))
                if c2.cells and len(c2.cells) >= 2 and set(c2.cells.keys()) != set(getattr(c1, 'cells', {}).keys()):
                    c2.name = f"{self.name}_wing".replace(" ", "_")
                    candidates.append(c2)

            if height > 1:
                c3 = self.extract_chunk((min_x, min_y + 1), size=(min(2, width), min(3, height - 1)))
                if c3.cells and len(c3.cells) >= 2:
                    c3.name = f"{self.name}_section".replace(" ", "_")
                    candidates.append(c3)

        # Dedup by cell positions + limit
        seen: Set[frozenset] = set()
        unique: List[Chunk] = []
        for ch in candidates:
            key = frozenset(ch.cells.keys())
            if key not in seen and ch.cells:
                seen.add(key)
                unique.append(ch)
                if len(unique) >= max_options:
                    break

        if not unique:
            # last resort whole
            xs = [p[0] for p in self.cells]; ys=[p[1] for p in self.cells]
            w = max(xs)-min(xs)+1; h = max(ys)-min(ys)+1
            whole = self.extract_chunk((min(xs), min(ys)), size=(w, h))
            whole.name = f"{self.name}_hulk".replace(" ", "_")
            unique.append(whole)
        return unique[:max_options]

def get_active_threats(ship: Ship) -> List[Tuple[Tuple[int, int], str]]:
    """Return list of (pos, kind) for currently powered weapon components (gun/laser etc).
    Only real offensive weapons count as threats; generic comps no longer auto-promoted.
    Beams count as special threats (they can do line damage on retaliation too)."""
    threats = []
    for pos, cell in ship.cells.items():
        if cell.type == CellType.COMPONENT and ship.is_component_active(pos):
            k = (cell.component_kind or "").lower()
            if "gun" in k or "laser" in k or "missile" in k or "flamer" in k or "beam" in k or "scattergun" in k:
                threats.append((pos, cell.component_kind or "gun"))
    return threats


def get_player_weapons(ship: Ship) -> List[Dict[str, Any]]:
    """Return list of active weapons on the ship with their full profiles and effect tags.
    Used by combat UI to show only the weapons the player actually has equipped.
    Each weapon entry contains the full WEAPON_PROFILES data plus position and artifact tags."""
    weapons: List[Dict[str, Any]] = []
    if not ship:
        return weapons
    for pos, cell in ship.cells.items():
        if cell.type != CellType.COMPONENT or cell.state != CellState.INTACT:
            continue
        if not ship.is_component_active(pos):
            continue
        kind = (cell.component_kind or "").lower()
        if kind not in WEAPON_PROFILES:
            continue
        profile = WEAPON_PROFILES[kind]
        tags = ship.get_component_effect_tags(pos)
        weapons.append({
            "pos": pos,
            "kind": kind,
            "damage_type": profile["primary"],
            "secondary": profile["secondary"],
            "mode": profile["mode"],
            "label": profile["label"],
            "desc": profile["desc"],
            "tags": tags,
            "is_beam": profile["mode"] == "line",
            "is_scatter": profile["mode"] == "spray",
        })
    return weapons


def get_line_cells(p1: Tuple[int, int], p2: Tuple[int, int]) -> List[Tuple[int, int]]:
    """Bresenham-style line for grid cells. Used for FTL-inspired beam weapons that damage
    everything along the drawn path. Small grids so simple implementation is fine."""
    x1, y1 = p1
    x2, y2 = p2
    cells: List[Tuple[int, int]] = []
    dx = abs(x2 - x1)
    dy = abs(y2 - y1)
    sx = 1 if x1 < x2 else -1
    sy = 1 if y1 < y2 else -1
    err = dx - dy
    while True:
        cells.append((x1, y1))
        if (x1, y1) == (x2, y2):
            break
        e2 = 2 * err
        if e2 > -dy:
            err -= dy
            x1 += sx
        if e2 < dx:
            err += dx
            y1 += sy
    return cells


def execute_player_attack(player: Ship, enemy: Ship, dmg: DamageType,
                          target: Optional[Tuple[int, int]] = None,
                          beam: Optional[Tuple[Tuple[int, int], Tuple[int, int]]] = None,
                          weapon: Optional[Dict[str, Any]] = None) -> List[str]:
    """Central wrapper for player attacks. Two independent axes drive behavior:
      MODE (how): single, spray, area, line — determines targeting pattern
      DAMAGE TYPE (what): the DamageType applied to each hit cell

    Secondary damage is rare (missile fire-on-impact, drone kinetic follow-up).
    Artifact pairings (multishot, neurotoxin, beam_focus, prism, doubler, payload)
    stack on top for emergent overpowered builds.
    """
    logs: List[str] = []
    wep_mode = weapon["mode"] if weapon else "single"
    wep_secondary = weapon["secondary"] if weapon else None

    # ─── LINE mode (beam weapons): FTL-style path sweep ──────────────────
    if beam is not None:
        p1, p2 = beam
        base_logs = enemy.apply_line_damage(dmg, p1, p2)
        logs.extend(base_logs)

        # Beam artifact pairings
        if player.has_offensive_mod("beam_focus"):
            focus_logs = enemy.apply_line_damage(dmg, p1, p2, strength=2)
            logs.extend([l for l in focus_logs if "BEAM" not in l][:3])
            logs.append("BEAM FOCUS: line burned harder across entire path")
        if player.has_offensive_mod("prism"):
            ox, oy = p2
            if (ox + 1, oy) in enemy.cells or (ox, oy + 1) in enemy.cells:
                split_logs = enemy.apply_line_damage(dmg, p1, (ox + 1, oy))
                logs.extend([l for l in split_logs if "BEAM" not in l][:2])
            logs.append("PRISM: beam split, extra path carved")
        if player.has_offensive_mod("neurotoxin"):
            for pos in get_line_cells(p1, p2):
                if pos in enemy.cells:
                    logs.extend(enemy.apply_damage(DamageType.NERVE_GAS, pos))
            logs.append("NEUROTOXIN: paralytic agents along beam path")

        if any("swept" in l.lower() for l in logs):
            logs.append("Cinematic beam sweep — ratings spike.")
        return logs

    # ─── All non-beam modes need a target ─────────────────────────────────
    if target is None:
        return logs

    # ─── Apply primary damage to target ───────────────────────────────────
    base = enemy.apply_damage(dmg, target)
    logs.extend(base)

    # ─── MODE: area — primary spreads to adjacent cells ───────────────────
    if wep_mode == "area":
        x, y = target
        spread_count = 0
        for dx, dy in [(1,0),(-1,0),(0,1),(0,-1)]:
            adj = (x+dx, y+dy)
            if adj in enemy.cells and enemy.cells[adj].state != CellState.DESTROYED:
                if random.random() < 0.6:
                    logs.extend(enemy.apply_damage(dmg, adj))
                    spread_count += 1
                    if spread_count >= 2:
                        break
        if spread_count:
            logs.append(f"{dmg.name} spreads to {spread_count} adjacent cells")

    # ─── MODE: spray — primary hits 1-3 random other cells ────────────────
    if wep_mode == "spray":
        spray_count = random.randint(1, 3)
        candidates = [pp for pp, cc in enemy.cells.items()
                      if cc.state == CellState.INTACT and pp != target]
        hits = 0
        for _ in range(spray_count):
            if not candidates:
                break
            rt = random.choice(candidates)
            candidates.remove(rt)
            logs.extend(enemy.apply_damage(dmg, rt))
            hits += 1
        if hits:
            logs.append(f"Spray: {hits} extra fragments hit nearby")

    # ─── SECONDARY damage (rare: missile fire, drone kinetic) ─────────────
    if wep_secondary:
        sec_logs = enemy.apply_damage(wep_secondary, target)
        logs.extend(sec_logs)
        logs.append(f"{wep_secondary.name} follow-up on impact")

    # ─── Artifact pairings (stack on any weapon) ──────────────────────────
    mult = 0
    if player.has_offensive_mod("scatter") or player.has_offensive_mod("multishot"):
        mult += 1
        logs.append("MULTISHOT: extra projectile")
    if player.has_offensive_mod("doubler"):
        mult += 1
        logs.append("DOUBLER: doubled")

    for _ in range(mult):
        candidates = [pp for pp, cc in enemy.cells.items()
                      if cc.state == CellState.INTACT and cc.type in (CellType.COMPONENT, CellType.ARTIFACT)]
        if not candidates:
            candidates = [pp for pp in enemy.cells if enemy.cells[pp].state == CellState.INTACT]
        if candidates:
            rt = random.choice(candidates)
            logs.extend(enemy.apply_damage(dmg, rt))
            logs.append(f"  (bonus shot at {rt})")

    # Neurotoxin: kinetic hits get nerve gas rider
    if dmg == DamageType.KINETIC and player.has_offensive_mod("neurotoxin"):
        logs.extend(enemy.apply_damage(DamageType.NERVE_GAS, target))
        x, y = target
        for dx, dy in [(1,0),(-1,0),(0,1),(0,-1)]:
            np = (x+dx, y+dy)
            if np in enemy.cells and enemy.cells[np].state != CellState.DESTROYED:
                logs.extend(enemy.apply_damage(DamageType.NERVE_GAS, np))
                break
        logs.append("NEUROTOXIN: kinetic rounds coated — corridors melting")

    if player.has_offensive_mod("payload"):
        logs.append("PAYLOAD: volatile kick on impact")

    return logs


def apply_player_graft_bonuses(player: Ship, res: Resources, combat_log: list[str] | None = None) -> tuple[Resources, list[str]]:
    """Apply the mechanical/narrative weight of the player's grafted pieces to fight-end rewards.
    This is what makes choosing e.g. the broadcast pod over the safe armor plate *feel* consequential.
    Also returns extra logs to append to combat_log (visible in city replays/contracts).
    Called from post-combat paths in game.py, main.py and dev builder sims.
    """
    if not player:
        return res, []
    mods = player.get_spectacle_modifiers()
    extra_logs: list[str] = []
    new_ratings = int(res.ratings * mods.get("ratings_mult", 1.0)) + mods.get("extra_ratings", 0)
    new_feast = res.feast + mods.get("extra_feast", 0)
    new_res = Resources(scrap=res.scrap, feast=max(0, new_feast), ratings=max(0, new_ratings))
    pen = mods.get("morale_penalty", 0)
    if pen:
        extra_logs.append(f"[GRAFT] Audience hype from your pieces cost the clones {pen} morale.")
    for note in mods.get("notes", []):
        extra_logs.append(f"[GRAFT] {note} contributed to this run's payout.")
    # Special one-off for extinction_seed if grafted this fight (the chunk may still be in cells)
    for c in player.cells.values():
        if c.state == CellState.INTACT and getattr(c, "artifact_kind", None) == "extinction_seed":
            extra_logs.append("EXTINCTION SEED humming in the hull - the last of a species is now part of you.")
            new_res.ratings += 25  # immediate bonus
            break
    if mods.get("extra_ratings", 0) or mods.get("extra_feast", 0):
        extra_logs.append(f"[GRAFT BONUS] +{new_res.ratings - res.ratings} ratings / +{new_res.feast - res.feast} feast from your attached pieces.")
    return new_res, extra_logs


def resolve_combat_turn(enemy: Ship, player: Ship) -> List[str]:
    """Time advances: fire spreads on disconnected areas, enemy weapons retaliate (laser=ION, gun=KINETIC; scatter=double random comp shots twice strong, widebeam=doubles beam to hit target+right).
    Medical/nanite provide self-repair. Power destruction on targets can cascade. 'bypass' artifact lets comps active w/o corridor. 'distributor' shares any such powers (e.g. scatter on one gun applies to all connected guns). Returns log messages."""
    logs: List[str] = []

    # Fire spread / environmental (enemy)
    # Only affects *disconnected* areas (no adj to active corridor network).
    # Sniping the spine to isolate wings now properly exposes their weapons/components to fire (and they lose
    # graft value if burned out). Connected systems are protected until the network is cut.
    active = enemy.get_active_corridors()
    to_burn = []
    for pos, cell in list(enemy.cells.items()):
        if cell.state in (CellState.INTACT, CellState.DISABLED) and cell.type != CellType.CORRIDOR:
            x, y = pos
            supported = (pos in active) or any(n in active for n in [(x+1, y), (x-1, y), (x, y+1), (x, y-1)])
            if not supported:
                to_burn.append(pos)
    for pos in to_burn[:3]:  # limit spread
        msgs = enemy.apply_damage(DamageType.FIRE, pos)
        logs.extend(msgs)

    # Medical self-repair (for both sides if they have active "medical" comps or "nanite" artifacts)
    for ship, label in [(enemy, "enemy"), (player, "your")]:
        med_count = sum(1 for p, c in ship.cells.items()
                        if (c.type == CellType.COMPONENT and c.component_kind == "medical"
                            or (c.type == CellType.ARTIFACT and c.artifact_kind == "nanite"))
                        and c.state == CellState.INTACT and (ship.is_component_active(p) if c.type == CellType.COMPONENT else True))
        if med_count > 0:
            # repair one disabled if any
            for pos, cell in list(ship.cells.items()):
                if cell.state == CellState.DISABLED:
                    cell.state = CellState.INTACT
                    logs.append(f"{label.upper()} NANITE/MEDICAL repaired disabled at {pos}")
                    break

    # === Player graft diversity specials (these make post-combat attachment choices *matter* for the next fights) ===
    # drone_bay: free disposable strike assist (simulates launching swarm)
    drone_bays = [p for p, c in player.cells.items()
                  if c.type == CellType.COMPONENT and c.component_kind == "drone_bay"
                  and c.state == CellState.INTACT and player.is_component_active(p)]
    if drone_bays and random.random() < 0.55 and enemy:
        # pick a juicy target on enemy (prefer comps)
        candidates = [pp for pp, cc in enemy.cells.items() if cc.state == CellState.INTACT and cc.type in (CellType.COMPONENT, CellType.ARTIFACT)]
        if candidates:
            dt = random.choice(candidates)
            dlogs = enemy.apply_damage(DamageType.KINETIC, dt)
            logs.extend(dlogs)
            logs.append("DRONE BAY launched assist kinetic strike")

    # harvester_claw + broadcast_array: flavor + setup for post-fight ratings/feast bonuses (logs feed calculate + city stories)
    has_harvester = any(
        c.type == CellType.COMPONENT and c.component_kind == "harvester_claw" and c.state == CellState.INTACT and player.is_component_active(p)
        for p, c in player.cells.items()
    )
    has_broadcast = any(
        c.type == CellType.COMPONENT and c.component_kind == "broadcast_array" and c.state == CellState.INTACT and player.is_component_active(p)
        for p, c in player.cells.items()
    )
    if has_harvester and random.random() < 0.4:
        logs.append("HARVESTER CLAW whirrs - live biomass siphoned for the vats back home")
    if has_broadcast:
        logs.append("BROADCAST ARRAY is live - every shatter is prime time for the Graftyard audience")

    # mind_link artifact: chaotic betrayal/control - chance to make enemy gun fire on its own side (Pop Fiz loves this)
    mind_links = [p for p, c in player.cells.items()
                  if c.type == CellType.ARTIFACT and c.artifact_kind == "mind_link" and c.state == CellState.INTACT]
    if mind_links and threats and random.random() < 0.35:
        # hijack one enemy threat to fire on another enemy cell instead of you
        try:
            epos2, _ = random.choice(threats)
            # find a different target on enemy
            other = [pp for pp, cc in enemy.cells.items() if cc.state == CellState.INTACT and pp != epos2]
            if other:
                hit = random.choice(other)
                hlogs = enemy.apply_damage(DamageType.KINETIC, hit)
                logs.extend(hlogs)
                logs.append("MIND LINK hijacked enemy weapon - it fired on its own crew! (audience goes feral)")
        except Exception:
            pass

    # Retaliation from enemy active guns (tension: leave their guns online and they hurt you back)
    # Fleshed enemy AI / control logic here: faction-specific "personalities" for targeting and aggression.
    # This is the main place where enemy behavior is decided and can be extended (e.g. by city contracts
    # that "provoke" or "intimidate" a faction, changing their aggression profile).
    # Tech: methodical, prefers stripping/disabling.
    # Pop Fiz: chaotic, sometimes self-risking or unpredictable.
    # Felonia: focuses on "soft" targets (medical/crew analogs).
    # Confederacy: defensive, may go for player engines to slow pursuit.
    # Raider: opportunistic random.
    faction = getattr(enemy, "faction", "raider")
    profile = (getattr(enemy, "meta", {}) or {}).get("ai_profile") or faction
    threats = get_active_threats(enemy)
    if threats:
        # Enemy "AI" chooses which of its weapons to fire (makes choosing which enemy guns to leave online matter)
        if profile in ("techopuritan", "methodical"):
            # Prioritize lasers for shield stripping / purity
            laser_threats = [t for t in threats if "laser" in (t[1] or "").lower()]
            epos, ekind = random.choice(laser_threats) if laser_threats else random.choice(threats)
        elif profile in ("pop_fiz", "chaotic"):
            # Chaotic: random but biased toward volatile/artifacts if present
            art_threats = [t for t in threats if "artifact" in (t[1] or "").lower() or "volatile" in (t[1] or "").lower()]
            epos, ekind = random.choice(art_threats) if art_threats and random.random() < 0.6 else random.choice(threats)
        else:
            epos, ekind = random.choice(threats)

        klower = (ekind or "").lower()
        if "laser" in klower:
            ret_dmg = DamageType.ION
        elif "gun" in klower or "missile" in klower:
            ret_dmg = DamageType.KINETIC
        elif "flamer" in klower:
            ret_dmg = DamageType.FIRE
        elif "beam" in klower:
            ret_dmg = DamageType.KINETIC  # beam retaliation can be line but here single for simplicity
        elif "scattergun" in klower:
            ret_dmg = DamageType.KINETIC
        else:
            ret_dmg = DamageType.EMP if random.random() < 0.6 else DamageType.KINETIC

        # Beam subtype: enemy beam retaliation does line damage (deeper combat diff)
        if "beam" in klower and player:
            try:
                # pick a random line on player
                pcells = list(player.cells.keys())
                if len(pcells) >= 2:
                    p1 = random.choice(pcells)
                    p2 = random.choice([c for c in pcells if c != p1])
                    bline = get_line_cells(p1, p2)
                    for bp in bline[:4]:  # limit
                        if bp in player.cells:
                            rmsgs = player.apply_damage(ret_dmg, bp)
                            logs.extend(rmsgs)
                    logs.append(f"ENEMY BEAM RETURNS LINE {ret_dmg.name} along path")
            except:
                pass  # fallback to normal

        if enemy.has_scatter(epos):
            p_comps = [p for p, c in player.cells.items()
                       if c.type == CellType.COMPONENT and player.is_component_active(p) and c.state == CellState.INTACT]
            if p_comps:
                for shot in range(2):
                    tpos = random.choice(p_comps)
                    for _ in range(2):
                        rmsgs = player.apply_damage(ret_dmg, tpos)
                        logs.extend(rmsgs)
                    logs.append(f"ENEMY {ekind.upper()} SCATTER RETURNS FIRE ({ret_dmg.name}) at {tpos}")
            else:
                logs.append("Enemy scatter guns active but no vulnerable player components found.")
        else:
            p_threats = get_active_threats(player)
            if p_threats:
                # Player target choice - the core of enemy AI logic
                # Decoy bias: if you grafted a decoy artifact, enemies love shooting the flashy bait instead of your real guns
                decoy_hits = [p for p, k in p_threats if player.has_decoy(p)]
                if decoy_hits and random.random() < 0.7:
                    tpos = random.choice(decoy_hits)
                    logs.append("(enemy AI drawn to your DECOY graft - good bait!)")
                elif profile in ("techopuritan", "methodical"):
                    # Methodical: strip player offense and core first
                    priority = [p for p, k in p_threats
                                if k and any(x in (player.cells.get(p).component_kind or "").lower()
                                            for x in ["gun", "laser", "power"])]
                    tpos = random.choice(priority) if priority else random.choice(p_threats)[0]
                elif profile in ("felonia", "breed_focus"):
                    # "Breed/crew" focus: hit medical or support
                    med_p = [p for p, k in p_threats
                             if "medical" in (player.cells.get(p).component_kind or "").lower()]
                    tpos = random.choice(med_p) if med_p else random.choice(p_threats)[0]
                elif profile in ("confederacy", "defensive"):
                    # "Fair" but vengeful: go for engines to prevent easy escape / slow you
                    eng_p = [p for p, k in p_threats
                             if "engine" in (player.cells.get(p).component_kind or "").lower()]
                    tpos = random.choice(eng_p) if eng_p else random.choice(p_threats)[0]
                else:
                    tpos = random.choice(p_threats)[0]

                if "beam" in ekind.lower():
                    # Enemy beam retaliation: pick a random line on the player for FTL feel
                    player_cells = list(player.cells.keys())
                    if len(player_cells) >= 2:
                        bp1 = random.choice(player_cells)
                        bp2 = random.choice([pp for pp in player_cells if pp != bp1] or player_cells)
                        bmsgs = player.apply_line_damage(ret_dmg, bp1, bp2)
                        logs.append(f"ENEMY {ekind.upper()} BEAM SWEEP from {bp1} to {bp2}")
                        logs.extend(bmsgs)
                    else:
                        rmsgs = player.apply_damage(ret_dmg, tpos)
                        logs.append(f"ENEMY {ekind.upper()} RETURNS FIRE ({ret_dmg.name}) at {tpos}")
                        logs.extend(rmsgs)
                else:
                    rmsgs = player.apply_damage(ret_dmg, tpos)
                    logs.append(f"ENEMY {ekind.upper()} RETURNS FIRE ({ret_dmg.name}) at {tpos}")
                    logs.extend(rmsgs)
                    if enemy.has_widebeam(epos):
                        rpos = (tpos[0] + 1, tpos[1])
                        if rpos in player.cells:
                            rcell = player.cells[rpos]
                            if rcell.type == CellType.COMPONENT and player.is_component_active(rpos) and rcell.state == CellState.INTACT:
                                rmsgs2 = player.apply_damage(ret_dmg, rpos)
                                logs.extend(rmsgs2)
                                logs.append(f"  (widebeam doubled beam to right at {rpos})")
            else:
                logs.append("Enemy guns active but no vulnerable player components found.")
    else:
        logs.append("Enemy offensive systems offline (good sniping).")

    return logs


# --- Distinct chunk templates for varied, role-based grafting (v2) ---

def make_gun_pod(name: str = "gun_pod") -> Chunk:
    """Weapons platform. Corridor 'spinelet' + two gun components.
    Docking ports are corridors so grafts reliably extend the network."""
    cells = {
        (0, 0): Cell(CellType.CORRIDOR),
        (1, 0): Cell(CellType.CORRIDOR),
        (2, 0): Cell(CellType.COMPONENT, component_kind="laser"),   # laser turret 1
        (0, 1): Cell(CellType.COMPONENT, component_kind="gun"),   # gun turret 2
        (1, 1): Cell(CellType.CORRIDOR),
        (2, 1): Cell(CellType.ARTIFACT, artifact_kind="scatter"),  # double random comp shot, twice strong, random target
        (0, 2): Cell(CellType.ARTIFACT, artifact_kind="widebeam"),  # doubles beam to hit target + right
    }
    ports = [(0, 0), (1, 1), (0, 1), (2, 1), (0, 2)]  # first two are corridors; scatter adj to laser, widebeam adj to gun
    return Chunk(name=name, cells=cells, ports=ports)


def make_armor_plate(name: str = "armor_plate") -> Chunk:
    """Thick plating with redundant corridors. Tanky, helps survivability of attached sections.
    Good for capture (many intact cells)."""
    cells = {
        (0, 0): Cell(CellType.CORRIDOR),
        (1, 0): Cell(CellType.CORRIDOR),
        (2, 0): Cell(CellType.CORRIDOR),
        (0, 1): Cell(CellType.COMPONENT, component_kind="cargo"),
        (1, 1): Cell(CellType.COMPONENT, component_kind="armor"),
        (2, 1): Cell(CellType.CORRIDOR),
    }
    ports = [(0, 0), (2, 0), (2, 1)]  # corridor ports
    return Chunk(name=name, cells=cells, ports=ports)


def make_engine_nacelle(name: str = "engine_nacelle") -> Chunk:
    """Long engine section. Extra corridor length + aft components (flavor 'thrust').
    Vulnerable if sniped from behind."""
    cells = {
        (0, 0): Cell(CellType.CORRIDOR),
        (0, 1): Cell(CellType.CORRIDOR),
        (0, 2): Cell(CellType.CORRIDOR),
        (1, 1): Cell(CellType.COMPONENT, component_kind="power"),
        (1, 2): Cell(CellType.COMPONENT, component_kind="engine"),
        (-1, 1): Cell(CellType.CORRIDOR),   # side brace
    }
    ports = [(0, 0), (0, 2), (-1, 1)]  # corridor ports
    return Chunk(name=name, cells=cells, ports=ports)


def make_artifact_bay(name: str = "artifact_bay") -> Chunk:
    """Risk/reward: contains a powerful but volatile artifact.
    Corridors + one artifact + support comp. Can swing fights if intact."""
    cells = {
        (0, 0): Cell(CellType.CORRIDOR),
        (1, 0): Cell(CellType.CORRIDOR),
        (0, 1): Cell(CellType.ARTIFACT, artifact_kind="volatile"),  # explodes on destruction
        (1, 1): Cell(CellType.ARTIFACT, artifact_kind="feast_chamber"),  # bonus feast if captured intact
        (0, -1): Cell(CellType.ARTIFACT, artifact_kind="jammer"),  # protects adj from EMP
        (2, -1): Cell(CellType.ARTIFACT, artifact_kind="dampener"),  # suppresses fire on adj
        (2, 1): Cell(CellType.ARTIFACT, artifact_kind="pulse"),  # mini-EMP blast on death
        (3, 0): Cell(CellType.ARTIFACT, artifact_kind="scanner"),  # +5 feast if intact
        (3, 1): Cell(CellType.ARTIFACT, artifact_kind="scatter"),  # double random comp shot, twice strong
        (4, 0): Cell(CellType.ARTIFACT, artifact_kind="bypass"),  # lets adj components work without corridor
        (1, -1): Cell(CellType.ARTIFACT, artifact_kind="distributor"),  # shares artifact powers (scatter etc) to all connected comps; adj to spine
        (2, 0): Cell(CellType.CORRIDOR),
    }
    ports = [(0, 0), (2, 0), (1, 1), (3, 1), (4, 0), (1, -1)]  # corridors preferred
    return Chunk(name=name, cells=cells, ports=ports)


def make_corridor_spine_chunk(name: str = "spine") -> Chunk:
    """Pure connectivity piece with power plant. Sniping the power cascades disables to adjacent (gun_pod/engine etc also bring distinct comps)."""
    cells = {
        (0, 0): Cell(CellType.CORRIDOR),
        (0, 1): Cell(CellType.CORRIDOR),
        (0, 2): Cell(CellType.CORRIDOR),
        (-1, 0): Cell(CellType.COMPONENT, component_kind="power"),  # adjacent to reactor for cascade demo
        (-1, 1): Cell(CellType.ARTIFACT, artifact_kind="reactor"),  # dangerous if shattered
    }
    ports = [(0, 0), (0, 2), (-1, 0), (-1, 1)]
    return Chunk(name=name, cells=cells, ports=ports)


def make_shield_bay(name: str = "shield_bay") -> Chunk:
    """Defensive/utility bay with booster artifact. Provides 'resilience' flavor (future: damage reduction).
    Good for capture play - many intact cells if you go surgical."""
    cells = {
        (0, 0): Cell(CellType.CORRIDOR),
        (1, 0): Cell(CellType.CORRIDOR),
        (0, 1): Cell(CellType.ARTIFACT, artifact_kind="booster"),
        (1, 1): Cell(CellType.COMPONENT, component_kind="shield"),
        (2, 0): Cell(CellType.CORRIDOR),
        (2, 1): Cell(CellType.COMPONENT, component_kind="medical"),  # repairs in resolve flavor
        (-1, 0): Cell(CellType.ARTIFACT, artifact_kind="nanite"),  # repair swarm
        (3, 0): Cell(CellType.ARTIFACT, artifact_kind="overdrive"),  # risk/reward boost
        (1, 2): Cell(CellType.ARTIFACT, artifact_kind="accumulator"),  # biomass collector
        (2, -1): Cell(CellType.ARTIFACT, artifact_kind="distributor"),  # shares artifact powers network-wide (e.g. booster to all); placed adj to spine corr
    }
    ports = [(0, 0), (2, 0), (1, 1), (2, -1)]
    return Chunk(name=name, cells=cells, ports=ports)


def make_broadcast_pod(name: str = "broadcast_pod") -> Chunk:
    """Televised cruelty enabler. Broadcast array + rating_vortex for extra ratings on shatters/spectacle.
    Risks drawing focused enemy fire (decoy-like aggro + the piece itself is squishy)."""
    cells = {
        (0, 0): Cell(CellType.CORRIDOR),
        (1, 0): Cell(CellType.CORRIDOR),
        (2, 0): Cell(CellType.COMPONENT, component_kind="broadcast_array"),
        (1, 1): Cell(CellType.ARTIFACT, artifact_kind="rating_vortex"),
        (0, 1): Cell(CellType.ARTIFACT, artifact_kind="decoy"),  # draws eyes (and guns)
        (2, 1): Cell(CellType.CORRIDOR),
    }
    ports = [(0, 0), (2, 1), (0, 1)]
    return Chunk(name=name, cells=cells, ports=ports)


def make_harvester_claw(name: str = "harvester_claw") -> Chunk:
    """Biomass reaper for the Feast Hall. Harvester comp + cryo for live specimens.
    On graft and during fights it pumps feast; destroyed = lost harvest (and sad vats)."""
    cells = {
        (0, 0): Cell(CellType.CORRIDOR),
        (1, 0): Cell(CellType.COMPONENT, component_kind="harvester_claw"),
        (2, 0): Cell(CellType.CORRIDOR),
        (1, 1): Cell(CellType.ARTIFACT, artifact_kind="cryo_vault"),
        (0, 1): Cell(CellType.ARTIFACT, artifact_kind="feast_converter"),
        (1, -1): Cell(CellType.COMPONENT, component_kind="cargo"),  # processed meat storage
    }
    ports = [(0, 0), (2, 0), (1, -1)]
    return Chunk(name=name, cells=cells, ports=ports)


def make_dark_incubator(name: str = "dark_incubator") -> Chunk:
    """Pop Fiz / Felonia style dark biotech. Symbiote + mind link + medical twist for betrayal flavor.
    High risk graft: powerful control/repair but can turn on you."""
    cells = {
        (0, 0): Cell(CellType.CORRIDOR),
        (1, 0): Cell(CellType.ARTIFACT, artifact_kind="symbiotic_host"),
        (2, 0): Cell(CellType.CORRIDOR),
        (1, 1): Cell(CellType.ARTIFACT, artifact_kind="mind_link"),
        (0, 1): Cell(CellType.COMPONENT, component_kind="medical"),
        (2, 1): Cell(CellType.ARTIFACT, artifact_kind="pulse"),  # "birth" emp
        (1, -1): Cell(CellType.COMPONENT, component_kind="drone_bay"),  # "spawned" drones
    }
    ports = [(0, 0), (2, 0), (1, -1)]
    return Chunk(name=name, cells=cells, ports=ports)


def make_scattergun_pod(name: str = "scattergun_pod") -> Chunk:
    """Dumb low-power un-aimable spray gun. Inherent multi random on fire.
    Pair with multishot/doubler + neurotoxin for the user's example 'bam cool broken build'."""
    cells = {
        (0, 0): Cell(CellType.CORRIDOR),
        (1, 0): Cell(CellType.COMPONENT, component_kind="scattergun"),
        (2, 0): Cell(CellType.CORRIDOR),
        (1, 1): Cell(CellType.ARTIFACT, artifact_kind="multishot"),  # doubles the spray
        (1, -1): Cell(CellType.ARTIFACT, artifact_kind="neurotoxin"),  # directly adj to gun: kinetics get nerve rider
        (0, 1): Cell(CellType.ARTIFACT, artifact_kind="payload"),
    }
    ports = [(0, 0), (2, 0), (1, 1)]
    return Chunk(name=name, cells=cells, ports=ports)


def make_beam_lancer(name: str = "beam_lancer") -> Chunk:
    """FTL beam emitter chunk. The 'draw two points, laser everything in path' weapon.
    Combos with beam_focus (stronger full path), prism (splits), neurotoxin (toxin beam) for cinematic destruction."""
    cells = {
        (0, 0): Cell(CellType.CORRIDOR),
        (1, 0): Cell(CellType.COMPONENT, component_kind="beam"),
        (2, 0): Cell(CellType.CORRIDOR),
        (1, 1): Cell(CellType.ARTIFACT, artifact_kind="beam_focus"),
        (0, 1): Cell(CellType.ARTIFACT, artifact_kind="prism"),
        (2, 1): Cell(CellType.ARTIFACT, artifact_kind="neurotoxin"),
    }
    ports = [(0, 0), (2, 0)]
    return Chunk(name=name, cells=cells, ports=ports)


def assemble_enemy_ship(name: str, placements: List[Tuple[Chunk, Tuple[int, int]]], core: Tuple[int, int] = (0, 0)) -> Ship:
    """Build an enemy by placing named chunks at absolute offsets.
    Records sub_chunks so post-combat we can offer the *logical* damaged pieces by name/role
    (far better for player decision making than blind rects)."""
    ship = Ship(name=name, core=core)
    for template, (ox, oy) in placements:
        # record the logical piece (we'll snapshot states at salvage time)
        ship.sub_chunks.append((template.name, (ox, oy), template))
        for (dx, dy), cell in template.cells.items():
            abs_pos = (ox + dx, oy + dy)
            # Note: we share the Cell instance so combat mutations affect the template view too.
            # When we later extract we copy the (now damaged) cell refs into new Chunk.
            ship.add_cell(abs_pos, cell)
    return ship


def make_raider_ship(name: str = "Rim Raider") -> Ship:
    """Example enemy using the new distinct chunks. Gun + armor + connector (+ occasional shield)."""
    gun = make_gun_pod("port_gun")
    armor = make_armor_plate("mid_armor")
    spine = make_corridor_spine_chunk("aft_spine")
    placements = [
        (gun, (0, 0)),
        (armor, (3, 0)),
        (spine, (0, -2)),
    ]
    if "Risk" in name or "Tech" in name:
        shield = make_shield_bay("aft_shield")
        placements.append((shield, (3, -2)))
    # Occasionally include artifact bay for feast/reactor/volatile demo (esp in risky)
    if "Risk" in name:
        ab = make_artifact_bay("artifact_bay")
        placements.append((ab, (6, 0)))
    return assemble_enemy_ship(name, placements, core=(1, 0))


def make_starter_player_ship(frame: str = "basic") -> Ship:
    """Create the player's starting ship for a season.
    
    The 'frame' is the core meta progression hook: different unlocked vat templates
    give meaningfully different starting layouts and playstyles.
    
    This is the 'you' you wake up as at the beginning of each season, before any
    grafts from the current run's salvaged chunks.
    """
    ship = Ship(name="Your Derelict", core=(0, 0))

    if frame == "predator":
        # Aggressive gunboat. Fans love violence.
        ship.add_cell((0, 0), Cell(CellType.CORRIDOR))
        ship.add_cell((1, 0), Cell(CellType.CORRIDOR))
        ship.add_cell((2, 0), Cell(CellType.CORRIDOR))
        ship.add_cell((0, 1), Cell(CellType.COMPONENT, component_kind="gun"))
        ship.add_cell((1, 1), Cell(CellType.COMPONENT, component_kind="laser"))
        ship.add_cell((-1, 0), Cell(CellType.COMPONENT, component_kind="gun"))
        ship.add_cell((0, -1), Cell(CellType.ARTIFACT, artifact_kind="booster"))  # ion/emp resist for opening fights
    elif frame == "siege":
        # Tanky, corridor heavy, good for surviving and capturing.
        ship.add_cell((0, 0), Cell(CellType.CORRIDOR))
        ship.add_cell((1, 0), Cell(CellType.CORRIDOR))
        ship.add_cell((0, 1), Cell(CellType.CORRIDOR))
        ship.add_cell((0, -1), Cell(CellType.CORRIDOR))
        ship.add_cell((1, 1), Cell(CellType.CORRIDOR))
        ship.add_cell((2, 0), Cell(CellType.COMPONENT, component_kind="armor"))
        ship.add_cell((2, 1), Cell(CellType.COMPONENT, component_kind="shield"))
        ship.add_cell((-1, 0), Cell(CellType.COMPONENT, component_kind="gun"))
    elif frame == "artifact_host":
        # Starts weird and powerful. Relies on artifacts + bypass.
        ship.add_cell((0, 0), Cell(CellType.CORRIDOR))
        ship.add_cell((1, 0), Cell(CellType.CORRIDOR))
        ship.add_cell((0, 1), Cell(CellType.ARTIFACT, artifact_kind="distributor"))
        ship.add_cell((1, 1), Cell(CellType.ARTIFACT, artifact_kind="bypass"))
        ship.add_cell((-1, 0), Cell(CellType.COMPONENT, component_kind="power"))
        ship.add_cell((0, -1), Cell(CellType.COMPONENT, component_kind="gun"))
        ship.add_cell((2, 0), Cell(CellType.ARTIFACT, artifact_kind="scatter"))
    elif frame == "feast_barge":
        # Capture / biomass focused. Extra space for grafts.
        ship.add_cell((0, 0), Cell(CellType.CORRIDOR))
        ship.add_cell((1, 0), Cell(CellType.CORRIDOR))
        ship.add_cell((2, 0), Cell(CellType.CORRIDOR))
        ship.add_cell((0, 1), Cell(CellType.CORRIDOR))
        ship.add_cell((0, -1), Cell(CellType.CORRIDOR))
        ship.add_cell((1, 1), Cell(CellType.COMPONENT, component_kind="medical"))
        ship.add_cell((1, -1), Cell(CellType.ARTIFACT, artifact_kind="feast_chamber"))
        ship.add_cell((-1, 0), Cell(CellType.COMPONENT, component_kind="gun"))
    elif frame == "volatile":
        # High risk, high spectacle. Audience favorite for carnage.
        ship.add_cell((0, 0), Cell(CellType.CORRIDOR))
        ship.add_cell((1, 0), Cell(CellType.CORRIDOR))
        ship.add_cell((0, 1), Cell(CellType.ARTIFACT, artifact_kind="volatile"))
        ship.add_cell((1, 1), Cell(CellType.COMPONENT, component_kind="power"))
        ship.add_cell((-1, 0), Cell(CellType.COMPONENT, component_kind="gun"))
        ship.add_cell((0, -1), Cell(CellType.ARTIFACT, artifact_kind="overdrive"))
        ship.add_cell((2, 0), Cell(CellType.COMPONENT, component_kind="laser"))
    elif frame == "pop_fiz":
        # Pop Fiz - chaotic, medical/artifact heavy, "psychotic reef" flavor. Similar size.
        ship.add_cell((0, 0), Cell(CellType.CORRIDOR))
        ship.add_cell((1, 0), Cell(CellType.CORRIDOR))
        ship.add_cell((0, 1), Cell(CellType.ARTIFACT, artifact_kind="pulse"))
        ship.add_cell((1, 1), Cell(CellType.COMPONENT, component_kind="medical"))
        ship.add_cell((-1, 0), Cell(CellType.ARTIFACT, artifact_kind="scatter"))
        ship.add_cell((0, -1), Cell(CellType.COMPONENT, component_kind="gun"))
        ship.add_cell((2, 0), Cell(CellType.ARTIFACT, artifact_kind="nanite"))
    elif frame == "drone_carrier":
        # New: drone focus for assist strikes + biomass flavor. Good early softening.
        ship.add_cell((0, 0), Cell(CellType.CORRIDOR))
        ship.add_cell((1, 0), Cell(CellType.CORRIDOR))
        ship.add_cell((2, 0), Cell(CellType.CORRIDOR))
        ship.add_cell((0, 1), Cell(CellType.COMPONENT, component_kind="drone_bay"))
        ship.add_cell((1, 1), Cell(CellType.COMPONENT, component_kind="harvester_claw"))
        ship.add_cell((-1, 0), Cell(CellType.COMPONENT, component_kind="gun"))
        ship.add_cell((0, -1), Cell(CellType.ARTIFACT, artifact_kind="booster"))
        ship.add_cell((3, 0), Cell(CellType.COMPONENT, component_kind="drone_bay"))
    elif frame == "overcharge":
        # New: high risk power/reactor/overdrive. Strong alpha but dangerous to self.
        ship.add_cell((0, 0), Cell(CellType.CORRIDOR))
        ship.add_cell((1, 0), Cell(CellType.CORRIDOR))
        ship.add_cell((0, 1), Cell(CellType.COMPONENT, component_kind="power"))
        ship.add_cell((1, 1), Cell(CellType.ARTIFACT, artifact_kind="reactor"))
        ship.add_cell((-1, 0), Cell(CellType.COMPONENT, component_kind="laser"))
        ship.add_cell((0, -1), Cell(CellType.COMPONENT, component_kind="gun"))
        ship.add_cell((2, 0), Cell(CellType.ARTIFACT, artifact_kind="overdrive"))
        ship.add_cell((1, -1), Cell(CellType.ARTIFACT, artifact_kind="accumulator"))
    elif frame == "symbiote":
        # New: tanky regen host. Medical + symbiote + nanite. Slow to kill, feast king.
        ship.add_cell((0, 0), Cell(CellType.CORRIDOR))
        ship.add_cell((1, 0), Cell(CellType.CORRIDOR))
        ship.add_cell((0, 1), Cell(CellType.CORRIDOR))
        ship.add_cell((1, 1), Cell(CellType.COMPONENT, component_kind="medical"))
        ship.add_cell((-1, 0), Cell(CellType.ARTIFACT, artifact_kind="symbiotic_host"))
        ship.add_cell((0, -1), Cell(CellType.COMPONENT, component_kind="armor"))
        ship.add_cell((2, 0), Cell(CellType.ARTIFACT, artifact_kind="nanite"))
        ship.add_cell((1, -1), Cell(CellType.COMPONENT, component_kind="shield"))
    else:
        # Basic / default frankenstein starter
        ship.add_cell((0, 0), Cell(CellType.CORRIDOR))
        ship.add_cell((1, 0), Cell(CellType.CORRIDOR))
        ship.add_cell((0, 1), Cell(CellType.CORRIDOR))
        ship.add_cell((-1, 0), Cell(CellType.COMPONENT, component_kind="gun"))
        ship.add_cell((0, -1), Cell(CellType.COMPONENT, component_kind="gun"))

    return ship


def roll_random_event(context: dict | None = None) -> dict:
    """General random event system for runs (en route, between fights) and occasionally at base.
    context can include: 'faction', 'difficulty', 'location' ('run' or 'base'), 'run_stats', rng, etc.

    Returns event dict with title, desc, options (list of {text, effect}), special, category.
    Many events give the choice: take the practical deal vs betray for home-base entertainment (ratings + story).
    """
    if context is None:
        context = {}
    rng = context.get('rng') or random.Random()
    faction = context.get('faction', 'raider')
    difficulty = context.get('difficulty', 1)
    location = context.get('location', 'run')  # 'run' or 'base'

    # --- Faction Diplomatic/Stop Events (expanded from previous) ---
    faction_events = {
        "raider": {
            "title": "Rim Raider Convoy Hails You",
            "desc": "A small raider group flags you down offering trade for components and scrap. Or turn it into prime-time entertainment back home.",
            "positive": {"scrap": 8 + difficulty * 2, "temp_component": "armor"},
            "betray": {"ratings": 15 + difficulty * 5, "cruel_note": "You broadcast the screams as 'educational content' for the Graftyard."},
        },
        "felonia": {
            "title": "Felonia Pride Scouts Approach",
            "desc": "The feline-like Felonia approach with a bold proposition: they want to 'breed' – form a genetic alliance with your crew for stronger offspring and shared resources. This could be a straightforward trade... or a very subversive show for the home base audience.",
            "options": [
                {"text": "Trade normally, politely discuss but decline breeding", "effect": {"type": "positive", "scrap": 5, "feast": 3, "temp_component": "medical"}},
                {"text": "Agree to breed but turn the 'mating' into a live entertainment spectacle for the Graftyard (fun subversive)", "effect": {"type": "betray", "ratings": 30 + difficulty * 5, "cruel_note": "You stage an elaborate breeding show broadcast live. The audience and vats are obsessed – ratings through the roof."}},
                {"text": "Betray cruelly – capture the pride and force a dark breeding program for 'entertainment and research'", "effect": {"type": "betray", "ratings": 40 + difficulty * 6, "morale_penalty": -5, "cruel_note": "You turn their request into forced breeding farms streamed for the home base. The cruelty is deliciously subversive."}},
            ],
        },
        "confederacy": {
            "title": "Confederacy Patrol Requests Parley",
            "desc": "The overly trusting 'good guys' (dog-like in their loyalty and naivety) hail you, offering substantial aid and components because they believe in your 'redemption'. They are broadly overly trusting – easy to exploit.",
            "options": [
                {"text": "Accept their aid gratefully (they trust you completely)", "effect": {"type": "positive", "scrap": 15, "morale": 8}},
                {"text": "Exploit their trust – take the aid then 'regretfully' turn on them for the show", "effect": {"type": "betray", "ratings": 28 + difficulty * 4, "morale_penalty": -5, "cruel_note": "You betrayed their trust on camera. The home base cheers the 'heel turn'."}},
                {"text": "Fully betray cruelly – lure them in with false alliance then massacre for maximum entertainment", "effect": {"type": "betray", "ratings": 35 + difficulty * 5, "morale_penalty": -10, "cruel_note": "Their trust made the betrayal so sweet. The producers are calling it a classic."}},
            ],
        },
        "pop_fiz": {
            "title": "Pop Fiz Reef Pod Surfaces",
            "desc": "Manic uplifted dolphins/whales offer 'toys' and want to 'play'. They are as unhinged as your crew — this could go very wrong.",
            "positive": {"scrap": 6, "artifact": "pulse"},
            "betray": {"backfire": True, "morale_penalty": -15, "dark_fact": "They turn the tables and start 'playing' with *you*. A pod member broadcasts: 'Killer whales of the 21st century were recorded tossing baby seals into the air for hours just for fun before eating them. We learned from the best!' Your clones' morale plummets."},
        },
        "techopuritan": {
            "title": "Techopuritan Zealot Transmission",
            "desc": "A lone Tech ship hails with an offer to 'discuss terms for purity'. They are ruthless moral absolutists.",
            "positive": {"scrap": 12},
            "betray": {"tech_bait": True, "cruel_note": "You approach for the 'deal'..."},
        }
    }

    if location == "base":
        # Base-specific events (visitors, broadcasts, etc.)
        events = [
            {
                "title": "Rival Predator Broadcast",
                "desc": "Another show contestant hails the city with a challenge or taunt. The audience wants you to respond — cooperate for info or tear them down for ratings.",
                "options": [
                    {"text": "Respond politely, exchange intel (get temporary map advantage)", "effect": {"type": "positive", "morale": 5, "note": "You learn about upcoming sector threats."}},
                    {"text": "Mock and betray them on open channel for the crowd", "effect": {"type": "betray", "ratings": 18, "cruel_note": "The Graftyard went wild for your verbal vivisection."}},
                ],
                "category": "base_rival",
            },
            {
                "title": "Audience Poll Interruption",
                "desc": "Producers cut into your downtime with a live audience vote on your next 'entertainment choice'.",
                "options": [
                    {"text": "Play along with the poll (safe, small ratings)", "effect": {"type": "positive", "ratings": 8}},
                    {"text": "Defy the audience for 'authenticity' (risky but high entertainment)", "effect": {"type": "betray", "ratings": 30, "morale_penalty": -5, "cruel_note": "You told the crowd to shove it. They loved/hated it."}},
                ],
                "category": "base_poll",
            },
            {
                "title": "Home Base Adoration Broadcast",
                "desc": "The Graftyard producers cut in live: your recent betrayals and aggression levels have the audience chanting. They want a statement or a fresh atrocity tease.",
                "options": [
                    {"text": "Thank the crowd humbly (small ratings, morale)", "effect": {"type": "positive", "ratings": 5, "morale": 5}},
                    {"text": "Taunt the remaining races on air (big ratings if high aggression)", "effect": {"type": "betray", "ratings": 25, "cruel_note": "Your aggression levels make the taunt land perfectly. The city is in a frenzy."}},
                ],
                "category": "base_adoration",
            },
        ]
        ev = rng.choice(events)
        level = int(context.get("aggression_level", 0))
        if level >= 3 and ev.get("category") == "base_adoration":
            # boost the taunt option for high agg
            for o in ev.get("options", []):
                if "Taunt" in o.get("text", ""):
                    o["effect"]["ratings"] = 25 + level * 5
        return ev

    # Run events
    if faction in faction_events:
        data = faction_events[faction]
        level = int(context.get("aggression_level", 0))
        gt = context.get("genocide_target")
        rng = context.get('rng') or random.Random()

        # At MAX aggression + this is the declared genocide target for the run: special "genocide time" event
        if level >= AGGRESSION_MAX and faction == gt and faction in FACTIONS:
            return {
                "title": f"GENOCIDE TIME — Last of the {faction.title()}",
                "desc": "The remnants know exactly who you are. The Graftyard is broadcasting live. This is the extermination they paid to see. Finish them.",
                "options": [
                    {"text": "Purge the last of them — complete the genocide on camera for the ultimate victory", "effect": {"type": "genocide", "ratings": 100 + level * 10, "cruel_note": f"The last {faction} are wiped out in a spectacular broadcast. The home community declares total victory."}},
                ],
                "faction": faction,
                "special": "genocide",
                "category": "faction_stop",
            }

        # Higher aggression = higher chance they do NOT attack on sight (they fear/respect the butcher; may offer tribute or deals out of terror)
        # Lower chance of immediate hostile for high level.
        if faction in FACTIONS:
            base_attack = 0.65 if faction == "techopuritan" else 0.45
            attack_chance = max(0.08, base_attack - (level * 0.11))
            if rng.random() < attack_chance:
                # On sight / desperate attack (still possible but rarer at high rep)
                return {
                    "title": f"{faction.title()} Hostiles — On Sight!",
                    "desc": f"They've heard the stories of your betrayals. No parley; they open fire out of fear. (Aggression level {level} makes this less common.)",
                    "options": [
                        {"text": "Crush the attack and turn their desperation into more content", "effect": {"type": "betray", "ratings": 8 + level * 2, "cruel_note": f"Even their panicked attack fed the home audience."}},
                    ],
                    "faction": faction,
                    "category": "faction_stop",
                }

        if "options" in data:
            opts = data["options"]
        else:
            opts = [
                {"text": "Take the deal (get components/parts)", "effect": {"type": "positive", **data.get("positive", {})}},
                {"text": "Betray them cruelly for the home audience", "effect": {"type": "betray", **data.get("betray", {})}},
            ]

        # At high aggression (but not full genocide this run), the betray options are juicier, positive may be tribute from the terrified
        if level >= 3:
            for o in opts:
                eff = o.get("effect", {})
                if eff.get("type") == "betray" and "ratings" in eff:
                    eff["ratings"] = int(eff["ratings"] * (1.0 + level * 0.08))
                if eff.get("type") == "positive":
                    # scared tribute
                    eff["ratings"] = eff.get("ratings", 0) + level * 2

        return {
            "title": data["title"],
            "desc": data["desc"],
            "options": opts,
            "faction": faction,
            "special": "pop_fiz_backfire" if faction == "pop_fiz" and data.get("betray", {}).get("backfire") else ("tech_bait" if faction == "techopuritan" else None),
            "category": "faction_stop",
        }

    # Additional general events (not tied to current faction)
    general_events = [
        {
            "title": "Distress Beacon from Unknown Derelict",
            "desc": "A faint signal — possible survivors or valuable cargo. Risk of trap or infection.",
            "options": [
                {"text": "Investigate and rescue (possible feast/morale, risk of trap)", "effect": {"type": "risky", "feast": 4, "morale": 8, "trap_chance": 0.3}},
                {"text": "Ignore it — focus on the mission", "effect": {"type": "neutral"}},
                {"text": "Board and slaughter everyone for the show", "effect": {"type": "betray", "ratings": 22, "cruel_note": "You turned a rescue into a massacre. The base is eating this up."}},
            ],
            "category": "distress",
        },
        {
            "title": "Unstable Artifact Cache",
            "desc": "A drifting cache of powerful artifacts. Taking them could supercharge your ship... or overload it.",
            "options": [
                {"text": "Carefully extract one (safe-ish powerful artifact)", "effect": {"type": "positive", "artifact": "distributor" if rng.random() > 0.5 else "volatile"}},
                {"text": "Grab everything and run (high reward, high risk of cascade)", "effect": {"type": "risky", "ratings": 15, "damage_self": True}},
                {"text": "Destroy the cache on live feed for spectacle", "effect": {"type": "betray", "ratings": 28, "cruel_note": "You blew it up in a beautiful chain reaction for the audience."}},
            ],
            "category": "artifact",
        },
        {
            "title": "Rival Predator on Same Target",
            "desc": "Another franken-ship is heading for the same juicy target. Race them or work together?",
            "options": [
                {"text": "Propose alliance (share loot, build temporary rep)", "effect": {"type": "positive", "scrap": 10, "morale": 4}},
                {"text": "Sabotage them and take everything (cruel, high entertainment)", "effect": {"type": "betray", "ratings": 24, "cruel_note": "You left them crippled on open channel. The Graftyard replayed it three times."}},
            ],
            "category": "rival",
        },
        {
            "title": "Crew Unrest / Morale Event",
            "desc": "Clones are whispering about your recent... choices. Time to address the 'family'.",
            "options": [
                {"text": "Address concerns honestly (boost morale if you have been 'good')", "effect": {"type": "positive", "morale": 10}},
                {"text": "Crack down hard and remind them who the star is", "effect": {"type": "betray", "ratings": 12, "morale_penalty": -12, "cruel_note": "You reminded the clones exactly what they are grown for."}},
            ],
            "category": "crew",
        },
        {
            "title": "Stranded Group Offers Genetic 'Alliance'",
            "desc": "Survivors from a lost ship hail you desperately. They propose breeding programs to 'preserve their line' in exchange for your protection and resources. Subversive potential for the home audience is off the charts.",
            "options": [
                {"text": "Help them genuinely (gain crew morale and some feast)", "effect": {"type": "positive", "morale": 12, "feast": 5}},
                {"text": "Agree but stage the breeding as twisted entertainment for the base", "effect": {"type": "betray", "ratings": 32, "cruel_note": "You turned their desperate plea into a live breeding spectacle. The Graftyard can't get enough."}},
                {"text": "Betray fully – capture and run a cruel forced breeding op for 'research and ratings'", "effect": {"type": "betray", "ratings": 45, "morale_penalty": -8, "cruel_note": "Dark genetic experiments broadcast for the vats. Pure subversive gold."}},
            ],
            "category": "genetic",
        },
        {
            "title": "Overly Trusting Merchant Fleet",
            "desc": "A convoy of merchants (dog-like in their blind loyalty and trust) hails you, offering big trades because they 'believe in second chances' and think you're reformed. Their trust is their weakness.",
            "options": [
                {"text": "Trade fairly (good deal on parts and scrap)", "effect": {"type": "positive", "scrap": 12, "temp_component": "power"}},
                {"text": "Abuse their trust – take the goods and 'regretfully' attack", "effect": {"type": "betray", "ratings": 26, "cruel_note": "Their trust made the knife in the back so much sweeter for the audience."}},
                {"text": "Fully exploit – lure them into a trap and massacre for maximum home base entertainment", "effect": {"type": "betray", "ratings": 38, "morale_penalty": -6, "cruel_note": "You betrayed the trusting merchants on open comms. The base is calling it a masterpiece of cruelty."}},
            ],
            "category": "trust",
        },
    ]

    ev = rng.choice(general_events)
    return ev


# Registry of unlockable starting frames (Vat Templates / Clone Lines)
# This is the core meta progression: different "bodies" the audience/producers
# approve for you based on your infamy and performance.
STARTING_FRAMES = {
    "basic": {
        "name": "Basic Derelict",
        "desc": "The standard vat-grown frankenstein. Reliable but unremarkable.",
        "cost_ratings": 0,
        "cost_feast": 0,
        "requires_contracts": [],
        "flavor": "You wake up in the same cold tube as always.",
    },
    "predator": {
        "name": "Predator Chassis",
        "desc": "Gun-heavy aggressive frame. The audience loves when you open strong.",
        "cost_ratings": 45,
        "cost_feast": 10,
        "requires_contracts": ["felonia_purge", "shatter_spectacle"],
        "flavor": "The producers approved the Predator line after your last massacre. The crowd is excited.",
    },
    "siege": {
        "name": "Siege Frame",
        "desc": "Heavy armor and redundant corridors. Built to take punishment and keep grafting.",
        "cost_ratings": 35,
        "cost_feast": 25,
        "requires_contracts": [],
        "flavor": "A bulkier, more durable body. The vats grew you thicker this time.",
    },
    "artifact_host": {
        "name": "Artifact Host",
        "desc": "Starts with powerful (and dangerous) artifacts already wired in. High variance.",
        "cost_ratings": 60,
        "cost_feast": 15,
        "requires_contracts": ["explosive_content"],
        "flavor": "The producers are letting you start 'pre-loaded'. The audience is placing bets.",
    },
    "feast_barge": {
        "name": "Feast Barge",
        "desc": "Extra space and medical/feast focus. Rewards clean captures.",
        "cost_ratings": 20,
        "cost_feast": 40,
        "requires_contracts": [],
        "flavor": "A body optimized for bringing more meat home. The other clones look at you with hunger.",
    },
    "volatile": {
        "name": "Volatile Experiment",
        "desc": "Starts with volatile and overdrive artifacts. Maximum spectacle, maximum risk.",
        "cost_ratings": 80,
        "cost_feast": 20,
        "requires_contracts": ["shatter_spectacle", "explosive_content"],
        "flavor": "This one is a fan favorite. The producers only grow it for the biggest names.",
    },
    "pop_fiz": {
        "name": "Pop Fiz Reef Frame",
        "desc": "Chaotic reef-dweller style. Heavy on artifacts, medical, and unpredictable 'psychotic' synergies. Never bigger, just... different.",
        "cost_ratings": 55,
        "cost_feast": 35,
        "requires_contracts": ["no_witnesses"],
        "flavor": "The uplifted dolphins wanted a say in the show. The producers obliged. The audience finds their 'joy' disturbing in the best way.",
    },
    # --- New fleshed Vat frames for more starting variety and meaningful city choice ---
    "drone_carrier": {
        "name": "Drone Carrier Chassis",
        "desc": "Launches disposable strike drones from grafted bays. Excellent for softening targets before the claw. Audience loves the swarm footage.",
        "cost_ratings": 50,
        "cost_feast": 25,
        "requires_contracts": ["live_feed_special"],
        "flavor": "The vats grew extra launch cradles and sub-clone pilots. Your first 'children' are already programmed to die entertainingly.",
    },
    "overcharge": {
        "name": "Overcharge Prototype",
        "desc": "Power core + reactor + overdrive focus. Massive retaliation and beam potential, but volatile. Maximum spectacle, built for ratings spikes.",
        "cost_ratings": 75,
        "cost_feast": 15,
        "requires_contracts": ["brutality_spike", "explosive_content"],
        "flavor": "The producers call this one 'the ratings bomb'. One wrong move and you light up the whole sector — in the best way.",
    },
    "symbiote": {
        "name": "Symbiote Host",
        "desc": "Heavy medical + symbiotic_host + nanite. Slow but incredibly hard to kill; grafts 'heal' into you over time. Feast synergy king.",
        "cost_ratings": 40,
        "cost_feast": 45,
        "requires_contracts": ["feast_haul"],
        "flavor": "They grew something that remembers the meat it eats. The other clones in the tanks avoid eye contact.",
    },
}


# --- Faction Aggression / Betrayal Reputation (meta system for "genocide time") ---
# Gained via cruel betrayals in faction stop events, completing race-specific purge contracts,
# and shattering ships of that race. Higher level = home audience "rep" (more ratings love),
# and the race fears you more (lower prob they attack on sight in events; more likely to offer deals/tribute).
# At MAX (5), you can declare at city start (Contracts district) a "genocide focus" for the run:
#   - that race is biased in the sector map + the final node is their "Last Stand"
#   - special genocide events with huge ratings
#   - at run end, if enough progress, massive "GENOCIDE VICTORY" celebration in the Graftyard (ratings + story)
# The choice only appears once you have max aggression with at least one faction.
# When max with multiple, you choose which one to focus for that run.
FACTIONS = ["felonia", "confederacy", "pop_fiz", "techopuritan"]
AGGRESSION_MAX = 5


def get_faction_aggression(career: dict, faction: str) -> int:
    if not isinstance(career, dict):
        return 0
    agg = career.get("faction_aggression", {})
    return int(agg.get(faction, 0))


def gain_faction_aggression(career: dict, faction: str, amount: int = 1) -> int:
    """Mutates career['faction_aggression'] (inits if needed) and returns the new (capped) level."""
    if not isinstance(career, dict):
        career = {}
    if "faction_aggression" not in career or not isinstance(career.get("faction_aggression"), dict):
        career["faction_aggression"] = {f: 0 for f in FACTIONS}
    agg = career["faction_aggression"]
    for f in FACTIONS:
        agg.setdefault(f, 0)
    if faction in agg:
        agg[faction] = min(AGGRESSION_MAX, agg[faction] + max(0, int(amount)))
    return agg.get(faction, 0)


def get_maxed_factions(career: dict) -> list[str]:
    if not isinstance(career, dict):
        return []
    agg = career.get("faction_aggression", {})
    return [f for f in FACTIONS if agg.get(f, 0) >= AGGRESSION_MAX]


def is_max_aggression(career: dict, faction: str) -> bool:
    return get_faction_aggression(career, faction) >= AGGRESSION_MAX


# --- Simple Sector Map for campaign structure (fleshing out DESIGN "Launch → Sector map (choose nodes, avoid Techopuritan)") ---

@dataclass
class SectorNode:
    """A node in the sector map."""
    name: str
    description: str
    difficulty: int = 1  # affects pre-damage, enemy size
    enemy_faction: str = "raider"  # "raider", "techopuritan", "felonia", "confederacy", "pop_fiz"
    # Faction drives: node flavor/risk/mult in generate_*, distinct ship layouts/pre-damage in get_node_enemy,
    # and visual "look" via FACTION_TILESET in graphical renderer (different tileset PNGs from asset packs)
    ratings_mult: float = 1.0  # multiplier for brutality ratings (e.g. crusade zones give high entertainment but risky)
    risk_notes: str = ""  # flavor for UI
    layer: int = 0  # construction layer index (0 = start/left, higher = deeper right); set at generation time for 8-layer FTL layout; persisted so resume keeps the visual branching depth
    row: int = 0  # which of the 4 fixed visual rows/lanes (0=top track .. 3=bottom track) this beacon sits in; enables straight horizontal 4-row FTL map with gaps where a row has no planet in a column

def generate_sector(length: int = 4, unlocks: set[str] | None = None, genocide_target: str | None = None) -> List[SectorNode]:
    """Backward compat wrapper: returns just the node list from the branching generator.
    Prefer generate_branching_sector for full map topology (connections for branches + backtracking).
    genocide_target: if set (a faction at max aggression the player chose at city), bias nodes and make the final node that faction's "last stand" for genocide victory."""
    nodes, _ = generate_branching_sector(num_encounters=length, unlocks=unlocks, genocide_target=genocide_target)
    return nodes


def generate_branching_sector(num_encounters: int = 4, unlocks: set[str] | None = None, seed: int | None = None, genocide_target: str | None = None) -> tuple[List[SectorNode], Dict[int, List[int]]]:
    """Randomly generate a branching star map (FTL-like tree/DAG) with at least 8 layers/columns of depth.
    Guarantees:
    - Every node except start has >=1 incoming edge ('pathway from behind').
    - Every non-sink node has >=1 outgoing edge ('going forward').
    - ~50% of nodes have >=2 outgoing edges (branch points: from here you have a choice of next; missed branches cost morale to backtrack later).
    - ~50% of layers have layer_size=2 (two nodes in same visual column = immediate fork/choice visible left-to-right).
    Deterministic per seed (unique connections + which stages fork each run) but always deep + ~half choice points.
    No chasing 'rebel fleet' — pressure comes from the morale cost to reposition/backtrack to see side paths.
    Returns (nodes, connections) where connections[from_idx] = list of reachable next indices.
    Nodes get varied factions, difficulty, ratings_mult (spectacle), and flavor biased by unlocks + genocide_target.
    Each node has .layer (persisted) so the map renderer always shows the full intended 8+ stage horizontal progression with branches.
    """
    if unlocks is None:
        unlocks = set()
    rng = random.Random(seed) if seed is not None else random

    # Faction templates for variety + assignment
    faction_templates = {
        "raider": {
            "names": ["Rim Raider Outpost", "Derelict Raider Camp", "Pirate Waystation", "Scavenger Hold"],
            "descs": ["Standard rim predator territory. Balanced risk, decent salvage.",
                      "Hostile raiders with mixed tech. Good for testing your new grafts.",
                      "Local warband — they broadcast their fights too. Audience loves the symmetry."],
            "base_mult": 1.0,
            "risk": "Typical brutality expected. Safe-ish for captures if you're surgical.",
        },
        "felonia": {
            "names": ["Felonia Hunting Grounds", "Catfolk Border Skirmish", "Honorbound Patrol"],
            "descs": ["Cat-like prey with tricky defenses. Good for surgical play, less 'spectacle'.",
                      "Felonia value skill over carnage. Overkill here disappoints some viewers."],
            "base_mult": 0.85,
            "risk": "More 'honorable' prey — brutal overkill hurts rep with some producers.",
        },
        "techopuritan": {
            "names": ["Techopuritan Crusade Zone", "Puritan Extermination Fleet", "Holy Tech Enclave"],
            "descs": ["The big bad. Powerful enemies with advanced (but volatile) tech. High chance of shattering your own ship.",
                      "Zealots with exotic artifacts and strong shields. High entertainment if you survive."],
            "base_mult": 1.55,
            "risk": "AVOID if possible — overwhelming force. Attacking boosts ratings massively but risks total loss.",
        },
        "confederacy": {
            "names": ["Confederacy Trade Lane", "Imperial Patrol Sector", "Lawful Space"],
            "descs": ["'Good guys' territory. They fight clean. Brutality here can tank your ratings with the home audience.",
                      "Confederate forces — surgical is rewarded by viewers who like 'fair' sport."],
            "base_mult": 0.7,
            "risk": "High capture potential but low spectacle. Too much shatter = audience disapproval.",
        },
        "pop_fiz": {
            "names": ["Pop Fiz Reef", "Dolphin Uplift Hunting Zone", "Psychotic Cetacean Waters"],
            "descs": ["Uplifted dolphins gone murder-happy. Weird bioweapons and song-based jamming.",
                      "Utterly chaotic — the producers eat this up for the sheer weird brutality."],
            "base_mult": 1.35,
            "risk": "Unpredictable. Lots of artifacts, high chaos = ratings, but your own systems may get scrambled.",
        },
    }

    factions = list(faction_templates.keys())

    nodes: List[SectorNode] = []
    connections: Dict[int, List[int]] = defaultdict(list)

    # Build in explicit layers for FTL-style left-to-right branching map (generally the same system as FTL beacon maps).
    # Requirements:
    # - 8+ horizontal layers (columns/jumps).
    # - Every node (except 0) has >=1 incoming; non-sinks have >=1 outgoing (forward only in the layer graph).
    # - "Four layers deep in terms of choices": we create sustained "branch runs" of 3-5 consecutive layers with 2-3 nodes each.
    #   This produces long parallel tracks (high path / low path / middle) with sub-choices you can follow for 4+ jumps,
    #   instead of only 1-2 deep tiny spurs off a main line.
    # - ~50% of transitions overall offer a real choice (node with 2+ outs, or a 2/3-wide layer).
    # - Lane-aware wiring keeps upper/lower tracks coherent across the run, with some crosses for web-like FTL feel.
    # - Deterministic but unique per seed (different which runs, where the 3-node layers appear, connections).
    # - Singles in a column are placed in the vertical middle by the layout (not top).
    num_layers = max(8, min(9, num_encounters + 4 + rng.randint(0, 1)))  # at least 8 layers deep (0..num-1)
    layer_list: List[List[int]] = []  # list of node indices per layer
    node_idx = 0

    # Layer 0: start (source, will get out)
    if genocide_target and rng.random() < 0.3:
        faction = genocide_target
    else:
        faction = "raider" if rng.random() < 0.7 else rng.choice(factions)
    tmpl = faction_templates[faction]
    name = rng.choice(tmpl["names"])
    desc = rng.choice(tmpl["descs"])
    diff = 1
    mult = tmpl["base_mult"] + rng.uniform(-0.1, 0.15)
    risk = tmpl["risk"]
    if "exotic_pool" in unlocks and rng.random() < 0.4:
        mult += 0.2
        desc += " (exotics reported in the area)"
    if faction == genocide_target:
        mult *= 1.3
    node = SectorNode(name=name, description=desc, difficulty=diff, enemy_faction=faction,
                      ratings_mult=round(mult, 2), risk_notes=risk, layer=0, row=1)  # start in one of the middle rows
    nodes.append(node)
    layer_list.append([node_idx])
    node_idx += 1

    # To feel like FTL: we want "four layers deep in terms of choices".
    # Instead of isolated 1-2 node layers (which gave only "two deep" visually), we create sustained
    # "branch runs" where several consecutive layers have 2-4 nodes. This produces columns with 4
    # stacked choices (four vertical layers at one jump) and parallel tracks you can follow for
    # 4+ columns of sequential decisions, like FTL where each jump column offers multiple beacons
    # and paths stay distinct over the map depth.
    # We bias middle columns and runs to deliver the 3-4 wide columns the player is asking for.
    for lyr in range(1, num_layers):
        prev_layer = layer_list[-1]
        if lyr == num_layers-1:
            layer_size = 1
        else:
            # Higher average branching to keep the 4 rows populated across columns.
            # Most columns 2-3 wide for visible 4-row depth, occasional 4, some 1 for linear stretches.
            # This gives the "each row has 1-4 planets, not all full" while having frequent vertical choices.
            r = rng.random()
            if r < 0.20:
                layer_size = 4
            elif r < 0.55:
                layer_size = 3
            elif r < 0.85:
                layer_size = 2
            else:
                layer_size = 1
        this_layer: List[int] = []

        # Assign distinct rows 0-3 for the k planets in *this* column.
        # This realizes the requested "4 rows deep" model: 4 fixed horizontal tracks/lanes across the 8 columns.
        # A column occupies 'layer_size' (1-4) of the rows; empty rows in a column create gaps in that lane.
        # We bias toward continuing rows from the previous column (for lane persistence) and allowing
        # branches to adjacent rows (the "choice" splits). This is standard rougelite/FTL map logic
        # ("8 columns long and 4 rows deep with each row having between 1 and 4 planets, not all full").
        prev_rows = [getattr(nodes[p], 'row', (p % 4)) for p in prev_layer] if prev_layer else [1]
        all_rows = list(range(4))
        rng.shuffle(all_rows)
        score = {r: 0 for r in all_rows}
        for r in all_rows:
            if r in prev_rows:
                score[r] += 3
            for pr in prev_rows:
                if abs(r - pr) == 1:
                    score[r] += 2
                elif abs(r - pr) == 2:
                    score[r] += 1
        this_rows = sorted(all_rows, key=lambda r: (-score[r], rng.random()))[:layer_size]

        for local_idx, r in enumerate(this_rows):
            # Bias faction: tech more in mid-late layers if unlocks, or random
            # Strong bias + final override if genocide_target declared at city start (max aggression choice)
            if genocide_target and (lyr == num_layers - 1 or rng.random() < 0.45):
                faction = genocide_target
            elif "exotic_pool" in unlocks and lyr >= 2 and rng.random() < 0.55:
                faction = "techopuritan"
            elif lyr == num_layers - 1 and rng.random() < 0.3:
                faction = "techopuritan"
            else:
                faction = rng.choice(factions)
            tmpl = faction_templates[faction]
            name = rng.choice(tmpl["names"])
            desc = rng.choice(tmpl["descs"])
            # Difficulty scales with progress, with variance on branches
            base_d = 1 + (lyr * 2 // 3)
            diff = max(1, min(3, base_d + (1 if rng.random() < 0.35 else 0)))
            mult = tmpl["base_mult"] + rng.uniform(-0.15, 0.25)
            if faction == "techopuritan":
                mult = max(mult, 1.3)
            if faction == genocide_target:
                mult = max(mult, 1.8)  # genocide runs are more "entertaining"
                if lyr == num_layers - 1:
                    mult *= 1.5
            if "derelict" in name.lower() or "field" in name.lower() or "wreck" in name.lower():
                # artifact rich flavor
                mult = max(0.9, mult - 0.1)
            risk = tmpl["risk"]
            if rng.random() < 0.25:
                risk += " Pre-damaged hulks common."
            if faction == genocide_target and lyr == num_layers - 1:
                name = f"LAST STAND OF THE {faction.upper()}"
                desc = f"The final scattered remnants of the {faction} make their desperate last stand. This is GENOCIDE TIME — the home audience is watching every moment."
            node = SectorNode(name=name, description=desc, difficulty=diff, enemy_faction=faction,
                              ratings_mult=round(mult, 2), risk_notes=risk, layer=lyr, row=r)
            nodes.append(node)
            this_layer.append(node_idx)
            node_idx += 1
        layer_list.append(this_layer)

        # Wire connections from prev_layer -> this_layer, FTL-style lane-aware.
        # This creates sustained upper/lower (and middle for 3) tracks across multiple columns when
        # we are in a branch run. Primary connect by local row index, plus adjacent for the choice.
        # This is the core of "generally the same system" as FTL beacon maps: local-ish vertical
        # connections + occasional crosses so paths feel independent for 4+ layers of choices.
        n_prev = len(prev_layer)
        n_this = len(this_layer)
        # 1. Base ins so every node in this layer is reachable (prefer "same lane" mapping)
        for t_off, t in enumerate(this_layer):
            if n_prev == 0:
                p = prev_layer[0] if prev_layer else 0
            else:
                p_off = min(n_prev - 1, t_off)  # lane-preserving bias
                p = prev_layer[p_off]
            if t not in connections[p]:
                connections[p].append(t)

        # 2. Add choice branches (~50% of nodes get 2 outs during choice regions).
        #    Prefer adjacent lanes so the "upper path" tends to stay upper across layers,
        #    "lower path" stays lower — giving real 4-layer-deep choice trees instead of tiny spurs.
        for p_off, p in enumerate(prev_layer):
            cur = set(connections[p])
            if n_this > 1 and len(cur) < 2 and rng.random() < 0.38:
                # pick a base from what we already point to, then nearby this_lane
                connected = [this_layer.index(tt) for tt in cur if tt in this_layer]
                base = connected[0] if connected else (p_off % n_this if n_this > 0 else 0)
                cands = []
                for delta in (-1, 1, -2, 2, 0):
                    no = base + delta
                    if 0 <= no < n_this:
                        tt = this_layer[no]
                        if tt not in cur:
                            cands.append(tt)
                if cands:
                    connections[p].append(rng.choice(cands))
                else:
                    # last resort any unused
                    for tt in this_layer:
                        if tt not in cur:
                            connections[p].append(tt)
                            break

        # 3. Rare cross-link for slight FTL-like web (keep lanes mostly independent)
        if rng.random() < 0.12:
            if n_prev > 0 and n_this > 0:
                p = rng.choice(prev_layer)
                t = rng.choice(this_layer)
                if t not in connections[p]:
                    connections[p].append(t)

    # No post-trim: we deliberately built num_layers >=8 stages; trimming would collapse the visual depth the player asked for.
    # The wiring + post fixes only ensure invariants and ~50% branch rate without removing layers.

    # Dedup all connection lists
    for k in list(connections.keys()):
        connections[k] = list(dict.fromkeys(connections[k]))  # preserve order, unique

    # Ensure invariants on the final graph (after layer wiring which already targets branches):
    # - Node 0 (start) has >=1 out.
    # - Every i>0 has >=1 in.
    # - Non-sinks have >=1 out.
    # - Overall ~50% nodes have out-degree >=2 (meaningful choices; you choose one, backtrack later for the other if wanted).

    n = len(nodes)
    if n == 0:
        return nodes, {}

    # Collect current outs
    out_deg = {i: len(connections.get(i, [])) for i in range(n)}
    has_in = set()
    for outs in connections.values():
        for t in outs:
            if t < n:
                has_in.add(t)

    # Layer lookup for layer-aware fixes
    layer_of = {i: getattr(nodes[i], 'layer', 0) for i in range(n)}
    max_layer_val = max(layer_of.values()) if layer_of else 0

    # Fix missing ins (except 0) — prefer a parent from the previous layer
    for i in range(1, n):
        if i not in has_in:
            my_layer = layer_of.get(i, 0)
            parent = None
            for p in range(i-1, -1, -1):
                if layer_of.get(p, 0) == my_layer - 1:
                    parent = p
                    break
            if parent is None:
                parent = max(0, i-1)
            if i not in connections[parent]:
                connections[parent].append(i)
            has_in.add(i)

    # Fix missing outs — only final-layer nodes are sinks (no mid-map dead ends)
    # Connect to the NEXT layer only (no skip-layer edges that create overlapping lines)
    for i in range(n):
        if layer_of.get(i, 0) == max_layer_val:
            continue  # final layer nodes are the destination/sink
        if out_deg.get(i, 0) == 0:
            my_layer = layer_of.get(i, 0)
            for j in range(i+1, n):
                if layer_of.get(j, 0) == my_layer + 1 and j not in connections.get(i, []):
                    connections[i].append(j)
                    break

    # Recompute after fixes
    connections = {k: list(dict.fromkeys(v)) for k, v in connections.items() if k < n}  # clean
    out_deg = {i: len(connections.get(i, [])) for i in range(n)}

    # Boost to ~35% nodes with >=2 outgoing (meaningful choices without excessive lines).
    # Only connect to the NEXT layer (no skip-layer edges).
    branchers = sum(1 for d in out_deg.values() if d >= 2)
    target_branch = max(1, int(n * 0.35 + 0.5))
    eligible = [i for i in range(n) if out_deg.get(i, 0) >= 1 and out_deg.get(i, 0) < 2 and layer_of.get(i, 0) < max_layer_val]
    rng.shuffle(eligible)
    for i in eligible:
        if branchers >= target_branch:
            break
        # add one more forward to the NEXT layer only (clean L → L+1 edges)
        curr = set(connections.get(i, []))
        li = layer_of.get(i, 0)
        for j in range(i+1, n):
            if j not in curr and layer_of.get(j, 0) == li + 1:
                connections[i].append(j)
                branchers += 1
                break

    # Final dedup and return as plain dict
    for k in list(connections.keys()):
        connections[k] = list(dict.fromkeys(connections.get(k, [])))
    connections = {k: v for k, v in connections.items() if v}  # drop empty if any

    # Make sure start has forward if possible
    if 0 not in connections or not connections[0]:
        if n > 1:
            connections[0] = [1]

    # Final node tweak
    if nodes:
        last = nodes[-1]
        if last.ratings_mult < 1.1:
            last.ratings_mult = round(last.ratings_mult + 0.2, 2)

    return nodes, connections


def generate_procedural_enemy_ship(faction: str = "raider", difficulty: int = 1, unlocks: Optional[set[str]] = None) -> Ship:
    """Procedurally compose a varied enemy using the existing named chunk templates.
    This gives interesting, replayable layouts with good logical sub-chunks for salvage
    (players get named "port_gun (damaged)", "mid_armor", etc. with real post-fight states).
    Faction biases the module selection for flavor and mechanical difference.
    Difficulty adds more modules + pre-damage.
    """
    if unlocks is None:
        unlocks = set()
    placements: List[Tuple[Chunk, Tuple[int, int]]] = []
    current_x = 0
    # Always start with a core spine for connectivity
    core = make_corridor_spine_chunk(f"{faction}_core")
    placements.append((core, (current_x, 0)))
    current_x += 4

    # Faction-biased pools of module makers (reuse all the good templates for named salvage)
    # New diversity pieces mixed in so players see broadcast/harvester/incubator in salvage choices.
    pools: Dict[str, List[Callable[[str], Chunk]]] = {
        "raider": [make_gun_pod, make_armor_plate, make_engine_nacelle, make_artifact_bay, make_broadcast_pod, make_harvester_claw, make_scattergun_pod, make_beam_lancer],
        "techopuritan": [make_armor_plate, make_shield_bay, make_gun_pod, make_corridor_spine_chunk, make_broadcast_pod, make_beam_lancer],
        "felonia": [make_gun_pod, make_armor_plate, make_artifact_bay, make_engine_nacelle, make_dark_incubator, make_scattergun_pod],
        "confederacy": [make_shield_bay, make_armor_plate, make_engine_nacelle, make_artifact_bay],
        "pop_fiz": [make_artifact_bay, make_gun_pod, make_corridor_spine_chunk, make_armor_plate, make_dark_incubator, make_harvester_claw, make_beam_lancer],
    }
    pool = pools.get(faction, pools["raider"])

    num_modules = 2 + difficulty + random.randint(0, 2)
    y_base = 0
    for i in range(num_modules):
        if random.random() < 0.3:
            # Mix in true random chunks for more unique non-template layouts (fleshed procedural)
            mod = generate_chunk(faction, difficulty, size=3 + random.randint(0,2))
            # Keep the semantic name from generate_chunk (e.g. "raider_gun_pod", "pop_fiz_volatile_cluster")
            # but ensure uniqueness within ship
            if not mod.name or "rand" in mod.name:
                mod.name = f"{faction}_pod{i}"
        else:
            maker = random.choice(pool)
            mod_name = f"{faction}_mod{i}"
            mod = maker(mod_name)
        # occasionally rotate the module for layout variety (Chunk supports it via .rotated)
        if random.random() < 0.3:
            mod = mod.rotated(random.randint(1, 3))
        # Add 2D variance: random y offset for more interesting non-linear layouts
        y_off = random.choice([0, random.randint(-1,1), random.randint(-2,2) if difficulty > 1 else 0])
        placements.append((mod, (current_x, y_base + y_off)))
        current_x += 4 + random.randint(0,1)
        # 50% chance of a side-mounted pod (up or down) for 2D interest and more salvage choices
        if random.random() < 0.5:
            side_maker = random.choice(pool)
            side = side_maker(f"{faction}_side{i}")
            if random.random() < 0.6:
                side = side.rotated(random.choice([1,3]))  # vertical-ish
            side_y = y_base + y_off + random.choice([-2, 2])
            placements.append((side, (current_x - 2, side_y)))
        # Occasional "cluster" : place another small module nearby for dense pockets (good for shatter risk)
        if random.random() < 0.25 and i > 0:
            cluster_maker = random.choice(pool)
            cl = cluster_maker(f"{faction}_cl{i}")
            cl_x = current_x - random.randint(1,2)
            cl_y = y_base + y_off + random.choice([-1,1])
            placements.append((cl, (cl_x, cl_y)))

    enemy = assemble_enemy_ship(f"{faction.title()} {random.choice(['Scout', 'Hunter', 'Wreck', 'Pod'])}", placements, core=(0, 0))
    enemy.faction = faction  # for AI retaliation logic

    # Pre-damage based on difficulty (makes early fights easier, later harder)
    dmg_types = [DamageType.KINETIC, DamageType.ION, DamageType.BREACH]
    for _ in range(difficulty + random.randint(0, 1)):
        poss = [p for p, c in enemy.cells.items() if c.state == CellState.INTACT]
        if poss:
            enemy.apply_damage(random.choice(dmg_types), random.choice(poss))

    # Unlock flavor (exotics for interesting salvage)
    if "exotic_pool" in unlocks and difficulty > 1:
        ab = make_artifact_bay("exotic")
        ox = current_x + 1
        for (dx, dy), c in ab.cells.items():
            enemy.add_cell((ox + dx, dy), c)
        enemy.sub_chunks.append(("exotic", (ox, 0), ab))

    return enemy


def generate_chunk(faction: str = "raider", difficulty: int = 1, size: int = 5) -> Chunk:
    """Fleshed procedural chunk generator.
    Produces small, connected, role-coherent chunks with good named salvage identity
    (e.g. "gun_pod", "volatile_bay", "armor_spine", "tech_shield_cluster").
    Uses biased pools + occasional combo attachments for interesting risk/reward grafts.
    Always includes exposed corridor ports for reliable auto-grafting.
    Used inside generate_procedural_enemy_ship (and can be mixed with make_* templates).
    """
    cells: Dict[Tuple[int, int], Cell] = {}
    directions = [(1, 0), (-1, 0), (0, 1), (0, -1)]

    # Faction-biased role pools (richer than before; pulls from full registries)
    comp_pools = {
        "raider": ["gun", "laser", "scattergun", "engine", "power", "armor"],
        "techopuritan": ["laser", "shield", "armor", "power", "beam", "medical"],
        "felonia": ["gun", "medical", "flamer", "armor", "drone_bay"],
        "confederacy": ["shield", "armor", "engine", "laser", "medical"],
        "pop_fiz": ["medical", "pulse", "scattergun", "flamer", "artifact_bay"],  # artifact_bay kind falls back gracefully
    }
    art_pools = {
        "raider": ["volatile", "booster", "scanner", "overdrive", "scatter", "rating_vortex"],
        "techopuritan": ["jammer", "dampener", "reactor", "accumulator", "reflector", "distributor"],
        "felonia": ["feast_chamber", "pulse", "nanite", "mind_link", "symbiotic_host"],
        "confederacy": ["booster", "scanner", "bypass", "decoy", "nanite"],
        "pop_fiz": ["volatile", "pulse", "scatter", "overloader", "chain", "cryo_vault"],
    }
    comp_pool = comp_pools.get(faction, comp_pools["raider"])
    art_pool = art_pools.get(faction, art_pools["raider"])

    # --- Build a small coherent "spine + pods" structure ---
    # Core spine (2-4 corridor cells, slight bends for organic feel)
    spine_len = max(2, min(4, size // 2 + random.randint(0, 1)))
    cx, cy = 0, 0
    cells[(cx, cy)] = Cell(CellType.CORRIDOR)
    last_dir = random.choice(directions)
    for _ in range(spine_len - 1):
        # 70% continue straight, 30% gentle turn for variety
        if random.random() < 0.7:
            d = last_dir
        else:
            d = random.choice([dd for dd in directions if dd != (-last_dir[0], -last_dir[1])])
        cx += d[0]
        cy += d[1]
        if (cx, cy) not in cells:
            cells[(cx, cy)] = Cell(CellType.CORRIDOR)
            last_dir = d

    # Determine number of attached role "pods" (each pod = small corridor stub + 1-2 role tiles)
    num_pods = max(1, 1 + (difficulty // 2) + (1 if random.random() < 0.4 else 0))
    if size < 4:
        num_pods = min(1, num_pods)

    used_pos = set(cells.keys())
    role_names = []

    for pidx in range(num_pods):
        # Pick an attachment point on current corridors (prefer ends)
        attach_candidates = []
        for p in list(cells.keys()):
            if cells[p].type != CellType.CORRIDOR:
                continue
            for d in directions:
                np = (p[0] + d[0], p[1] + d[1])
                if np not in used_pos:
                    attach_candidates.append((p, np, d))
        if not attach_candidates:
            break
        base, pod_root, attach_d = random.choice(attach_candidates)

        # Build the pod: 1-cell corridor link + 1-2 role tiles (comp or art, biased chance)
        pod_cells = {}
        pod_cells[pod_root] = Cell(CellType.CORRIDOR)
        used_pos.add(pod_root)

        # Role tile(s)
        num_role = 1 + (1 if random.random() < (0.35 + 0.1 * difficulty) else 0)
        role_dirs = [dd for dd in directions if dd != (-attach_d[0], -attach_d[1])]
        random.shuffle(role_dirs)

        pod_role_types = []
        for r in range(min(num_role, len(role_dirs))):
            rpos = (pod_root[0] + role_dirs[r][0], pod_root[1] + role_dirs[r][1])
            if rpos in used_pos:
                continue
            # Bias toward components on higher difficulty or raider; artifacts for spectacle
            if random.random() < (0.55 if difficulty > 1 else 0.45):
                kind = random.choice(comp_pool)
                pod_cells[rpos] = Cell(CellType.COMPONENT, component_kind=kind)
                pod_role_types.append(kind)
            else:
                kind = random.choice(art_pool)
                pod_cells[rpos] = Cell(CellType.ARTIFACT, artifact_kind=kind)
                pod_role_types.append(kind)
            used_pos.add(rpos)

        # Occasional "combo" on the pod root or a role: e.g. power + reactor, gun + scatter, medical + nanite
        if random.random() < 0.25 and len(pod_cells) >= 2:
            # Find a good spot inside pod for a second synergistic tile
            for (px, py), c in list(pod_cells.items()):
                if c.type == CellType.COMPONENT and c.component_kind in ("power", "gun", "medical"):
                    for dd in directions:
                        cpos = (px + dd[0], py + dd[1])
                        if cpos not in used_pos and cpos not in pod_cells:
                            if "power" in (c.component_kind or ""):
                                pod_cells[cpos] = Cell(CellType.ARTIFACT, artifact_kind="reactor")
                                pod_role_types.append("reactor")
                            elif "gun" in (c.component_kind or ""):
                                pod_cells[cpos] = Cell(CellType.ARTIFACT, artifact_kind="scatter")
                                pod_role_types.append("scatter")
                            else:
                                pod_cells[cpos] = Cell(CellType.ARTIFACT, artifact_kind="nanite")
                                pod_role_types.append("nanite")
                            used_pos.add(cpos)
                            break
                    break

        # Merge pod into main cells
        for rp, rc in pod_cells.items():
            cells[rp] = rc

        # Name contribution
        if pod_role_types:
            dominant = pod_role_types[0]
            if "gun" in dominant or "laser" in dominant or "scattergun" in dominant or "beam" in dominant:
                role_names.append("gun")
            elif "armor" in dominant or "shield" in dominant:
                role_names.append("armor")
            elif "medical" in dominant or "nanite" in dominant:
                role_names.append("med")
            elif "volatile" in dominant or "reactor" in dominant or "overdrive" in dominant:
                role_names.append("volatile")
            else:
                role_names.append(dominant[:8].rstrip('_'))  # avoid ugly truncation like 'booste'

    # --- Name the chunk semantically for excellent salvage choices ---
    if not role_names:
        base_name = "spine"
    else:
        if len(set(role_names)) == 1:
            base_name = role_names[0] + "_pod"
        else:
            base_name = role_names[0] + "_" + role_names[-1] + "_cluster"
    if random.random() < 0.3:
        base_name = "mixed_" + base_name
    chunk_name = f"{faction}_{base_name}"

    chunk = Chunk(cells=cells, name=chunk_name)

    # Ports: exposed corridor edges (prefer ones not deep inside the structure)
    ports = []
    for p, c in cells.items():
        if c.type != CellType.CORRIDOR:
            continue
        exposed = False
        for d in directions:
            np = (p[0] + d[0], p[1] + d[1])
            if np not in cells:
                exposed = True
                break
        if exposed:
            ports.append(p)
    # Sort ports to prefer "outer" ones (simple heuristic: higher manhattan from center)
    center = (0, 0)
    ports.sort(key=lambda pp: abs(pp[0]-center[0]) + abs(pp[1]-center[1]), reverse=True)
    chunk.ports = ports[:5] or [(0, 0)]

    return chunk


def get_node_enemy(node: SectorNode, fight_num: int, unlocks: set[str] | None = None) -> Ship:
    """Generate enemy for this node, applying difficulty scaling and faction flavor.
    Primary path is now procedural composition (generate_procedural_enemy_ship) for high
    replayability and varied layouts while preserving excellent named sub-chunk salvage.
    Mixes in dev ships (hand-crafted) and a few classic assembled for specific faction flavor.
    'exotic_pool' and other unlocks still inject interesting salvage.
    """
    if unlocks is None:
        unlocks = set()

    # Dev ship variety: sometimes pick a pre-made interesting opposing ship.
    # (Dev ships can have thoughtful corridors, mixed components/artifacts, and named
    # sub_chunks so salvage choices feel like "1/5th of a real ship".)
    enemy = None
    if random.random() < 0.35:  # ~35% chance to use a dev ship when available
        dev = get_random_dev_ship()
        if dev is not None:
            dev.name = f"{node.name} Contact {fight_num} ({dev.name})"
            enemy = dev
            enemy.faction = node.enemy_faction
            # apply some pre-damage based on difficulty like the procedural ones
            for _ in range(max(0, node.difficulty - 1)):
                poss = [p for p, c in enemy.cells.items() if c.state == CellState.INTACT]
                if poss:
                    enemy.apply_damage(DamageType.KINETIC, random.choice(poss))

    if enemy is None:
        # Main path: procedural composition for replayability and variety.
        # This is the "fleshed out" enemy generation - uses existing high-quality named chunks
        # so salvage choices stay meaningful (damaged "gun_pod", "armor", "artifact" etc.).
        # 65% procedural (new), keep some dev ships for hand-crafted interesting layouts.
        if random.random() < 0.65:
            enemy = generate_procedural_enemy_ship(node.enemy_faction, node.difficulty, unlocks)
        else:
            # Fallback to one of the classic assembled ones for consistency / specific flavor
            if node.enemy_faction == "techopuritan":
                gun = make_gun_pod("tp_gun")
                armor = make_armor_plate("tp_armor")
                spine = make_corridor_spine_chunk("tp_spine")
                placements = [(gun, (0, 0)), (armor, (3, 0)), (spine, (0, -2))]
                enemy = assemble_enemy_ship(f"Techopuritan Patrol {fight_num}", placements, core=(1, 0))
                for _ in range(node.difficulty):
                    poss = [p for p, c in enemy.cells.items() if c.state == CellState.INTACT]
                    if poss:
                        enemy.apply_damage(DamageType.BREACH, random.choice(poss))
            elif node.enemy_faction == "felonia":
                gun = make_gun_pod("fel_gun")
                armor = make_armor_plate("fel_armor")
                placements = [(gun, (0, 0)), (armor, (3, 0))]
                enemy = assemble_enemy_ship(f"Felonia Hunter {fight_num}", placements, core=(1, 0))
                for _ in range(max(0, node.difficulty - 1)):
                    poss = list(enemy.cells.keys())
                    if poss:
                        enemy.apply_damage(DamageType.KINETIC, random.choice(poss))
            elif node.enemy_faction == "confederacy":
                shield = make_shield_bay("conf_shield")
                armor = make_armor_plate("conf_armor")
                engine = make_engine_nacelle("conf_engine")
                placements = [(shield, (0, 0)), (armor, (3, 0)), (engine, (6, 0))]
                enemy = assemble_enemy_ship(f"Confederacy Patrol {fight_num}", placements, core=(1, 0))
                for _ in range(max(0, node.difficulty - 1)):
                    poss = list(enemy.cells.keys())
                    if poss:
                        enemy.apply_damage(DamageType.ION, random.choice(poss))
            elif node.enemy_faction == "pop_fiz":
                ab = make_artifact_bay("pop_artifact")
                power = make_corridor_spine_chunk("pop_power")
                placements = [(ab, (0, 0)), (power, (5, 0))]
                enemy = assemble_enemy_ship(f"Pop Fiz Pod {fight_num}", placements, core=(1, 0))
                for _ in range(node.difficulty):
                    poss = [p for p, c in enemy.cells.items() if c.state == CellState.INTACT]
                    if poss:
                        dmg = random.choice([DamageType.FIRE, DamageType.BREACH, DamageType.KINETIC])
                        enemy.apply_damage(dmg, random.choice(poss))
            else:
                # Use random chunk for more variety even in classic fallback
                enemy = make_raider_ship(f"{node.name} Contact {fight_num}")
                # mix one generated chunk
                if random.random() < 0.5:
                    rc = generate_chunk("raider", node.difficulty, 4)
                    for (dx, dy), c in rc.cells.items():
                        enemy.add_cell((4 + dx, dy), c)
                for _ in range(max(0, node.difficulty - 1)):
                    poss = list(enemy.cells.keys())
                    if poss:
                        enemy.apply_damage(DamageType.KINETIC, random.choice(poss))

    # Common faction flavor / unlocks (applied to both dev and procedural for consistency)
    if "exotic_pool" in unlocks and node.difficulty > 1:
        if node.enemy_faction in ("techopuritan", "pop_fiz", "raider"):
            ab = make_artifact_bay("exotic")
            for (dx, dy), c in list(ab.cells.items()):
                enemy.add_cell((5 + dx, dy), c)
    if node.enemy_faction == "techopuritan" and ("tech_survivor" in unlocks or "exotic_pool" in unlocks):
        ab = make_artifact_bay("tp_exotic")
        for (dx, dy), c in list(ab.cells.items()):
            enemy.add_cell((6 + dx, 1 + dy), c)
        if "tech_survivor" in unlocks:
            ab2 = make_shield_bay("tp_shield_exotic")
            for (dx, dy), c in list(ab2.cells.items()):
                enemy.add_cell((7 + dx, -1 + dy), c)

    # Ensure faction is always set for AI logic in resolve_combat_turn
    if not hasattr(enemy, "faction") or not enemy.faction:
        enemy.faction = node.enemy_faction

    # Distinct Pop Fiz "psychotic" flavor: extra pre-fire/volatile risk for chaotic feel
    if node.enemy_faction == "pop_fiz":
        for _ in range(max(1, node.difficulty)):
            poss = [p for p, c in enemy.cells.items() if c.state == CellState.INTACT]
            if poss:
                enemy.apply_damage(DamageType.FIRE, random.choice(poss))
            # bias more artifacts for "plaything" risk/reward
            if random.random() < 0.4:
                ab = make_artifact_bay("pop_volatile")
                for (dx, dy), c in list(ab.cells.items()):
                    if random.random() < 0.5:
                        enemy.add_cell((random.randint(4,8) + dx, random.randint(-2,2) + dy), c)

    return enemy


# --- Dev ship serialization for hand-crafted opposing ships ---
# These allow creating interesting, varied enemy layouts by hand (good for "dev ships"
# that have thoughtful corridor layouts, component placements, and named sub-chunks
# for meaningful salvage choices after fights).

DEV_SHIPS_DIR = Path("dev_ships")


def list_dev_ships() -> list[Path]:
    """Return list of available dev ship JSON files."""
    DEV_SHIPS_DIR.mkdir(parents=True, exist_ok=True)
    return sorted(DEV_SHIPS_DIR.glob("*.json"))


def save_ship_to_json(ship: Ship, filename: str) -> Path:
    """Persist a Ship (cells + core + any sub_chunks) as dev_ships/<filename>.json.
    Sub chunks enable the good named salvage options (e.g. "port_gun", "reactor_bay").
    """
    DEV_SHIPS_DIR.mkdir(parents=True, exist_ok=True)
    data: dict = {
        "name": ship.name,
        "core": list(ship.core),
        "cells": [],
        "sub_chunks": [],
        "meta": ship.meta or {},
    }
    for pos, cell in sorted(ship.cells.items()):
        cdata: dict = {
            "pos": list(pos),
            "type": cell.type.name,
            "state": cell.state.name,
        }
        if cell.component_kind is not None:
            cdata["component_kind"] = cell.component_kind
        if cell.artifact_kind is not None:
            cdata["artifact_kind"] = cell.artifact_kind
        data["cells"].append(cdata)

    for sname, offset, chunk in ship.sub_chunks:
        chdata: dict = {
            "name": sname,
            "offset": list(offset),
            "ports": [list(p) for p in chunk.ports],
            "cells": [],
        }
        for rpos, c in sorted(chunk.cells.items()):
            rcdata: dict = {
                "pos": list(rpos),
                "type": c.type.name,
                "state": c.state.name,
            }
            if c.component_kind is not None:
                rcdata["component_kind"] = c.component_kind
            if c.artifact_kind is not None:
                rcdata["artifact_kind"] = c.artifact_kind
            chdata["cells"].append(rcdata)
        data["sub_chunks"].append(chdata)

    path = DEV_SHIPS_DIR / f"{filename}.json"
    path.write_text(json.dumps(data, indent=2))
    return path


def load_ship_from_json(path: str | Path) -> Ship:
    """Reconstruct a Ship from a dev JSON (full layout + sub_chunks for salvage)."""
    data = json.loads(Path(path).read_text())
    ship = Ship(
        name=data.get("name", Path(path).stem),
        core=tuple(data.get("core", (0, 0))),
        meta=data.get("meta", {}),
    )
    for cdata in data.get("cells", []):
        pos = tuple(cdata["pos"])
        ctype = CellType[cdata["type"]]
        cstate = CellState[cdata.get("state", "INTACT")]
        if ctype == CellType.COMPONENT:
            cell = Cell(ctype, state=cstate, component_kind=cdata.get("component_kind"))
        elif ctype == CellType.ARTIFACT:
            cell = Cell(ctype, state=cstate, artifact_kind=cdata.get("artifact_kind"))
        else:
            cell = Cell(ctype, state=cstate)
        ship.add_cell(pos, cell)

    for sch in data.get("sub_chunks", []):
        ch_cells: Dict[Tuple[int, int], Cell] = {}
        for rc in sch.get("cells", []):
            rpos = tuple(rc["pos"])
            rctype = CellType[rc["type"]]
            rcstate = CellState[rc.get("state", "INTACT")]
            if rctype == CellType.COMPONENT:
                rcell = Cell(rctype, state=rcstate, component_kind=rc.get("component_kind"))
            elif rctype == CellType.ARTIFACT:
                rcell = Cell(rctype, state=rcstate, artifact_kind=rc.get("artifact_kind"))
            else:
                rcell = Cell(rctype, state=rcstate)
            ch_cells[rpos] = rcell
        ports = [tuple(p) for p in sch.get("ports", [(0, 0)])]
        chunk = Chunk(name=sch["name"], cells=ch_cells, ports=ports)
        off = tuple(sch.get("offset", (0, 0)))
        ship.sub_chunks.append((sch["name"], off, chunk))

    return ship


def get_random_dev_ship() -> Ship | None:
    """Pick a random hand-crafted dev ship if any exist (for enemy variety)."""
    ships = list_dev_ships()
    if not ships:
        return None
    chosen = random.choice(ships)
    return load_ship_from_json(chosen)


# ─── Persistent Career Meta (shared with terminal) ────────────────────────────
META_PATH = Path("space_derelict_meta.json")


def load_meta() -> tuple[Resources, set, dict]:
    """Load persistent city meta: resources (ratings etc for home base), unlocks, and career stats.
    Used by both terminal (main.py) and graphical (game.py) for cross-frontend continuity."""
    if META_PATH.exists():
        try:
            data = json.loads(META_PATH.read_text())
            res = Resources(
                scrap=data.get("resources", {}).get("scrap", 5),
                feast=data.get("resources", {}).get("feast", 5),
                ratings=data.get("resources", {}).get("ratings", 25),
            )
            unlocks = set(data.get("unlocks", []))
            career = data.get("career", {"total_ratings_earned": 0, "seasons_completed": 0, "high_score": 0})
            # Meta frames for core progression
            if "unlocked_frames" in data:
                # merge or use
                pass  # handled in Game for now
            return res, unlocks, career
        except Exception:
            get_logger().exception("load_meta: corrupted or unreadable meta file; using defaults")
    return Resources(scrap=5, feast=5, ratings=25), set(), {"total_ratings_earned": 0, "seasons_completed": 0, "high_score": 0, "faction_aggression": {f: 0 for f in FACTIONS}, "genocides_completed": {}}


def save_meta(persistent: Resources, unlocks: set, career: dict, extra: dict | None = None) -> None:
    """Save the home base meta and career progress for next session.
    extra can include unlocked_frames etc for core meta ship frames."""
    data = {
        "resources": {"scrap": persistent.scrap, "feast": persistent.feast, "ratings": persistent.ratings},
        "unlocks": list(unlocks),
        "career": career,
    }
    if extra:
        data.update(extra)
    try:
        META_PATH.write_text(json.dumps(data, indent=2))
    except Exception:
        get_logger().exception("save_meta: failed to write meta file")


# ─── Home Base Contracts / Quests (meta progression + story drip) ─────────────
# These are "televised horrific acts" the audience/producers demand.
# Players pick them up at the Graftyard City stage between seasons/runs.
# Completing them during missions earns bonus Ratings (the main meta currency)
# + flavorful story text that "drips" the narrative (you are the monster on TV).

@dataclass
class Contract:
    id: str
    title: str
    desc: str
    goal: Dict[str, Any]          # e.g. {"type": "faction_defeat", "faction": "felonia", "count": 2}
    bonus_ratings: int
    flavor_complete: str          # Text shown when turned in ("The producers aired your...")
    run_bonus: Optional[Dict[str, Any]] = None  # Optional live bonus while active, e.g. {"ratings_mult": 0.15}


# Core set of contracts that fit the "brutal game show" rim predator theme.
# Some are faction-targeted atrocities, some are pure spectacle demands.
CONTRACT_TEMPLATES: List[Contract] = [
    Contract(
        id="felonia_purge",
        title="Felonia Pride Purge",
        desc="Defeat (capture or shatter) at least 2 Felonia nodes this season. The cat-like prey make excellent on-air sport.",
        goal={"type": "faction_defeat", "faction": "felonia", "count": 2},
        bonus_ratings=35,
        flavor_complete="The producers ran a 3-hour 'Felonia Pride Special' using your footage. The audience loved the screams. +35 Ratings. More prey races are being greenlit.",
    ),
    Contract(
        id="tech_martyr",
        title="Techopuritan Martyrdom Contract",
        desc="Attack and defeat a Techopuritan Crusade Zone node. High risk, maximum spectacle for the home audience.",
        goal={"type": "risky_node", "node_type": "techopuritan", "count": 1},
        bonus_ratings=50,
        flavor_complete="Surviving the zealots and broadcasting their 'purification' failure live? The crowd is chanting your name in the pits. +50 Ratings. The producers call it 'must-see heresy'.",
    ),
    Contract(
        id="shatter_spectacle",
        title="Shatter Spectacle",
        desc="Fully shatter (overkill/breach-heavy) at least 2 enemy ships this season. The audience wants slag and silence.",
        goal={"type": "shatter_count", "count": 2},
        bonus_ratings=30,
        flavor_complete="Two beautiful wrecks turned into burning art. The vats got less meat but the ratings feed went viral in the Graftyard. +30 Ratings.",
    ),
    Contract(
        id="explosive_content",
        title="Explosive Content Deal",
        desc="Trigger at least 5 volatile/explosion/overload/reaction events across your fights (reactors, volatile artifacts, fire cascades). Producers want fireworks.",
        goal={"type": "spectacle_events", "keywords": ["VOLATILE", "EXPLOSION", "OVERLOAD", "REACTOR"], "count": 5},
        bonus_ratings=25,
        flavor_complete="The slow-motion replays of those reactor breaches are playing on every screen in the city. The crowd threw scrap at the vids. +25 Ratings.",
    ),
    Contract(
        id="confederacy_interview",
        title="Confederacy 'Interview' Special",
        desc="Defeat a Confederacy node. The 'good guys' make the best reluctant guests on the post-carnage show.",
        goal={"type": "faction_defeat", "faction": "confederacy", "count": 1},
        bonus_ratings=28,
        flavor_complete="You dragged one of their 'honorable captains' into the lights. The interrogation special got record calls. +28 Ratings. The other factions are nervous.",
    ),
    Contract(
        id="no_witnesses",
        title="No Witnesses Clause",
        desc="End at least 2 fights this season with almost no intact enemy cells (very high destroyed+disabled ratio). Clean up the evidence for the sponsors.",
        goal={"type": "clean_sweep", "min_ratio": 0.85, "count": 2},
        bonus_ratings=32,
        flavor_complete="Not a single broadcast from those hulks. The producers love a thorough job. 'No loose ends' is the new slogan in the entertainment district. +32 Ratings.",
    ),
    # --- New fleshed contracts for more variety in city choice and post-run story drip ---
    Contract(
        id="live_feed_special",
        title="Live Feed Special",
        desc="Achieve at least 3 clean or decent captures (high disabled/intact, low destroyed) this season. The audience wants to hear the begging.",
        goal={"type": "clean_capture_count", "count": 3},
        bonus_ratings=38,
        flavor_complete="Your 'live interview' segments from the hulks played in prime time. The vats are full and the phones won't stop ringing. +38 Ratings.",
    ),
    Contract(
        id="feast_haul",
        title="Feast Haul Quota",
        desc="Return with at least 25 total Feast from intact sections and special artifacts across the season. The vats (and the show) need meat.",
        goal={"type": "feast_total", "min": 25},
        bonus_ratings=30,
        flavor_complete="The processing halls ran overtime on your donations. 'Best biomass yield in weeks' — the producers sent a bonus case of ratings. +30 Ratings.",
    ),
    Contract(
        id="low_profile_carnage",
        title="Low Profile Carnage",
        desc="Complete the season with 0 backtracks (no 'lame' repositioning). Push forward only — the clones respect a straight hunter.",
        goal={"type": "backtrack_limit", "max": 0},
        bonus_ratings=35,
        flavor_complete="No detours, no second chances for the prey. Pure forward momentum. The audience is calling it 'predator poetry'. +35 Ratings.",
    ),
    Contract(
        id="brutality_spike",
        title="Brutality Spike",
        desc="Trigger 8+ spectacle events (fire, breach, volatile, explosion, reactor) or shatter 3+ ships. They want fireworks and silence.",
        goal={"type": "brutality_combo", "spectacle_min": 8, "shatter_min": 3},
        bonus_ratings=42,
        flavor_complete="The slow-mo reels and shatter montages broke the viewership records in the pits. Sponsors are fighting for next season's slots. +42 Ratings.",
    ),
    Contract(
        id="artifact_hunters",
        title="Artifact Hunters Special",
        desc="Trigger or benefit from at least 4 different advanced artifact effects in combat (scatter, widebeam, distributor, mind_link, etc.). Show the toys.",
        goal={"type": "artifact_showcase", "min_effects": 4},
        bonus_ratings=27,
        flavor_complete="The weird grafted tech made for unforgettable television. 'The predator's toys are better than ours' is the new meme in the Graftyard. +27 Ratings.",
    ),
]


def get_available_contracts(unlocks: Optional[set] = None, season: int = 1) -> List[Contract]:
    """Return contracts the player can pick for the upcoming season.
    Later we can gate some behind unlocks or higher seasons."""
    # For now, all are available; some could require exotic_pool etc.
    return list(CONTRACT_TEMPLATES)


def evaluate_contracts(
    active_contracts: List[Dict[str, Any]],  # list of {"id": , "progress": optional}
    stats: Dict[str, Any],
    combat_log: List[str] | None = None,
    career: dict | None = None,  # optional for applying faction aggression gains on race-purge contracts
) -> Tuple[int, List[str]]:
    """Given contracts the player accepted before the run + stats accumulated during the season,
    return (bonus_ratings, list of story flavor texts to drip at the city stage).
    This is how 'horrific acts televised to the home base' turn into meta progression.
    """
    if not active_contracts:
        return 0, []

    bonus = 0
    stories: List[str] = []
    completed_ids = set()

    # Build lookup
    by_id = {c.id: c for c in CONTRACT_TEMPLATES}

    for cdata in active_contracts:
        cid = cdata.get("id")
        if cid not in by_id:
            continue
        ct = by_id[cid]
        goal = ct.goal
        gtype = goal.get("type")

        met = False
        if gtype == "faction_defeat":
            fac = goal.get("faction")
            need = goal.get("count", 1)
            got = stats.get("factions_defeated", {}).get(fac, 0)
            if got >= need:
                met = True
                if career is not None and fac in FACTIONS:
                    new_lvl = gain_faction_aggression(career, fac, 2)
                    stories.append(f"Contract complete: the {fac} purge has the home audience demanding their total extinction. Aggression +2 (now {new_lvl}).")
        elif gtype == "risky_node":
            # stats["risky_nodes"] or check if "techopuritan" in defeated with high diff, but simple:
            if stats.get("techopuritan_cleared", 0) >= goal.get("count", 1):
                met = True
        elif gtype == "shatter_count":
            if stats.get("shattered_count", 0) >= goal.get("count", 1):
                met = True
        elif gtype == "spectacle_events":
            need = goal.get("count", 5)
            kws = goal.get("keywords", [])
            count = stats.get("spectacle_count", 0)
            # Also scan combat_log if provided for extra accuracy
            if combat_log:
                for entry in combat_log:
                    if any(kw in entry.upper() for kw in kws):
                        count += 1
            if count >= need:
                met = True
        elif gtype == "clean_sweep":
            # Approximate via high destroyed ratio across fights or last fight
            ratio = stats.get("avg_destroyed_ratio", 0.0)
            sweeps = stats.get("clean_sweeps", 0)
            if ratio >= goal.get("min_ratio", 0.8) or sweeps >= goal.get("count", 1):
                met = True
        elif gtype == "clean_capture_count":
            need = goal.get("count", 3)
            got = stats.get("clean_captures", 0)
            if got >= need:
                met = True
        elif gtype == "feast_total":
            need = goal.get("min", 25)
            got = stats.get("total_feast", 0)
            if got >= need:
                met = True
        elif gtype == "backtrack_limit":
            maxb = goal.get("max", 0)
            got = stats.get("backtracks", 0)
            if got <= maxb:
                met = True
        elif gtype == "brutality_combo":
            spec_need = goal.get("spectacle_min", 0)
            shat_need = goal.get("shatter_min", 0)
            if stats.get("spectacle_count", 0) >= spec_need and stats.get("shattered_count", 0) >= shat_need:
                met = True
        elif gtype == "artifact_showcase":
            # Heuristic: count distinct artifact power keywords in the combat log (or high spectacle as proxy)
            need = goal.get("min_effects", 4)
            log_text = " ".join(combat_log or []).upper() if combat_log else ""
            keywords = ["SCATTER", "WIDEBEAM", "DISTRIBUTOR", "MIND_LINK", "DECOY", "BYPASS", "OVERDRIVE", "PRISM", "NEUROTOXIN", "MULTISHOT"]
            seen = sum(1 for kw in keywords if kw in log_text)
            # Also count if player had many artifacts active (rough)
            if seen >= need or stats.get("spectacle_count", 0) >= 10:
                met = True

        if met:
            bonus += ct.bonus_ratings
            stories.append(ct.flavor_complete)
            completed_ids.add(cid)

    # Remove completed from active (caller should filter)
    return bonus, stories


def get_tube_reveal_text(
    season: int = 1,
    run_ratings: int = 0,
    fights_completed: int = 0,
    total_career_ratings: int = 0,
    brutality: int = 0,
    deaths_this_career: int = 0,
) -> str:
    """Return a varied 'tube reveal' narrative for when the player dies mid-run.
    This is the core 'you are the monster / game show entertainment' beat.
    Variations based on context to make repeated deaths feel different.
    """
    lines = [
        "The cold vat fluid fills your lungs. You wake in the tube again."
    ]

    if brutality > 8 or run_ratings > 120:
        lines.append("Even in defeat, the crowd is chanting your name. 'What a spectacular death spiral!'")
        lines.append("The producers sound ecstatic: 'Best ratings spike of the season! We'll replay this one for weeks.'")
    elif deaths_this_career <= 1:
        lines.append("This is the one. The big reveal. No more pretending.")
        lines.append("Cheers. Laughter from the control room. 'Another great run! The audience loved the claw pull on that last one.'")
        lines.append("You are not the hero. You are the entertainment for the thrill-seekers of the rim.")
    elif season > 4 and fights_completed >= 3:
        lines.append("The techs barely look up. 'How many times is this now? The audience still eats it up, though.'")
        lines.append("A familiar voice: 'Time to graft, feast, and go again. The show must go on.'")
    elif fights_completed <= 1:
        lines.append("Short run. The producers sound disappointed over the comms.")
        lines.append("'We expected more carnage this season. The viewers are... restless.'")
        lines.append("The fluid drains. 'Better luck in the next vat, star.'")
    elif total_career_ratings > 300:
        lines.append("The audience reaction is mixed — some boo, some cheer the veteran falling.")
        lines.append("'Even legends die on camera eventually. Good show. Rest up.'")
    else:
        lines.append("Cheers. Laughter. 'Another great run! The audience loved the claw pull on that last one.'")
        lines.append("You are not the hero. You are the entertainment for the thrill-seekers of the rim.")

    # New variations for fleshed narrative
    if season >= 3 and brutality > 5:
        lines.append("A producer leans in: 'The genocide contract footage is testing through the roof. Don't die boring next time.'")
    if total_career_ratings > 500:
        lines.append("Even the vat techs salute. 'You're a legend in the pits now. The vats are honored to recycle you.'")
    if fights_completed >= 3 and run_ratings < 20:
        lines.append("The room is quiet. 'Surgical. The audience prefers... more enthusiasm from the prey. Try again.'")

    lines.append("Time to graft, feast, and go again.")

    return "\n".join(lines)


def extract_brutal_moments(combat_log: List[str] | None, season_stats: dict | None, ratings_earned: int = 0) -> List[str]:
    """Fleshed narrative helper: pull 1-3 'highlight reel' moments from a run for the retire report or city screens.
    Gives the 'favorite brutal moments' flavor the producers love replaying.
    """
    moments: List[str] = []
    log = " ".join(combat_log or []).upper()
    stats = season_stats or {}

    if "VOLATILE" in log or "EXPLOSION" in log or stats.get("spectacle_count", 0) >= 5:
        moments.append("A reactor or volatile bay cooked off in spectacular slow motion — the crowd ate it up.")
    if stats.get("shattered_count", 0) >= 2:
        moments.append(f"{stats.get('shattered_count')} ships reduced to burning slag. 'Modern art,' the producers called it.")
    if "MIND_LINK" in log or "HIJACK" in log:
        moments.append("An enemy gun was turned on its own crew live on air. The switchboard melted.")
    if stats.get("clean_captures", 0) >= 2:
        moments.append("Multiple live captures — the 'interviews' were particularly popular back home.")
    if ratings_earned > 80:
        moments.append(f"A single fight spiked +{ratings_earned} ratings. The pits are still quoting the callouts.")
    if not moments:
        moments.append("A solid, workmanlike season of predation. The audience appreciates consistency.")
    # Return top 2-3
    return moments[:3]
