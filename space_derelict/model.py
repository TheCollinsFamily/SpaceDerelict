"""Core data model for Space Derelict.

Ship as a grid of cells with strict corridor connectivity.
Chunks are graftable clusters with port information.
Damage types have distinct effects for capture vs shatter play.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Dict, Tuple, Set, List, Optional


class CellType(Enum):
    CORRIDOR = auto()
    COMPONENT = auto()
    ARTIFACT = auto()


class CellState(Enum):
    INTACT = auto()
    DISABLED = auto()
    DESTROYED = auto()


class DamageType(Enum):
    ION = auto()          # Strong vs shields, opens other options
    EMP = auto()          # Disables components (capture tool)
    KINETIC = auto()      # Balanced, creates destroyed tiles
    BREACH = auto()       # Hull specialist, high shatter risk
    FIRE = auto()         # DOT on non-corridor tiles, spreads
    NERVE_GAS = auto()    # Inoperates corridors (requires shields down)


@dataclass
class Cell:
    type: CellType
    state: CellState = CellState.INTACT
    # Future: component_kind: str | None = None
    # artifact_kind: str | None = None
    # hp: int = 3   # for more granular destruction

    def is_destroyed(self) -> bool:
        return self.state == CellState.DESTROYED

    def is_functional(self) -> bool:
        return self.state == CellState.INTACT


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
    """A complete ship (player or enemy) on an absolute grid."""
    cells: Dict[Tuple[int, int], Cell] = field(default_factory=dict)
    core: Tuple[int, int] = (0, 0)
    name: str = "Unknown Ship"

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
        """A component/artifact is active only if adjacent to an active corridor."""
        cell = self.cells.get(pos)
        if not cell or cell.type == CellType.CORRIDOR:
            return False
        if cell.state != CellState.INTACT:
            return False

        x, y = pos
        active_corr = self.get_active_corridors()
        for neigh in [(x+1, y), (x-1, y), (x, y+1), (x, y-1)]:
            if neigh in active_corr:
                return True
        return False

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
            # For now treat as light disable on components + "shield strip" flavor
            if cell.type == CellType.COMPONENT and cell.state == CellState.INTACT:
                cell.state = CellState.DISABLED
                logs.append(f"ION disabled component at {target}")
            else:
                logs.append(f"ION had little effect at {target}")

        elif dmg == DamageType.EMP:
            if cell.type == CellType.COMPONENT and cell.state == CellState.INTACT:
                cell.state = CellState.DISABLED
                logs.append(f"EMP disabled component at {target}")
            elif cell.type == CellType.CORRIDOR and cell.state == CellState.INTACT:
                # EMP corridors is possible but less efficient in design
                cell.state = CellState.DISABLED
                logs.append(f"EMP knocked out corridor at {target}")

        elif dmg == DamageType.KINETIC:
            if cell.state == CellState.INTACT:
                cell.state = CellState.DESTROYED
                logs.append(f"KINETIC destroyed {cell.type.name.lower()} at {target}")
            elif cell.state == CellState.DISABLED:
                cell.state = CellState.DESTROYED
                logs.append(f"KINETIC finished off disabled cell at {target}")

        elif dmg == DamageType.BREACH:
            if cell.type in (CellType.CORRIDOR, CellType.COMPONENT):
                if cell.state != CellState.DESTROYED:
                    cell.state = CellState.DESTROYED
                    logs.append(f"BREACH shattered {cell.type.name.lower()} at {target}")
            # Hull flavor only for now

        elif dmg == DamageType.FIRE:
            # Fire only really hurts non-active-corridor areas
            active = self.get_active_corridors()
            if target not in active:
                if cell.state == CellState.INTACT:
                    cell.state = CellState.DISABLED
                    logs.append(f"FIRE disabled {cell.type.name.lower()} at {target} (no corridor support)")
                elif cell.state == CellState.DISABLED:
                    cell.state = CellState.DESTROYED
                    logs.append(f"FIRE burned out {cell.type.name.lower()} at {target}")
            else:
                logs.append(f"FIRE suppressed by active corridor at {target}")

        elif dmg == DamageType.NERVE_GAS:
            if cell.type == CellType.CORRIDOR and cell.state == CellState.INTACT:
                cell.state = CellState.DISABLED
                logs.append(f"NERVE GAS inoperated corridor at {target}")
            else:
                logs.append(f"NERVE GAS had no effect on {cell.type.name.lower()} at {target}")

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

    def extract_chunk(self, origin: Tuple[int, int], size: Tuple[int, int] = (3, 3)) -> Chunk:
        """Naive extraction for prototype: pull a rectangular region as a chunk."""
        min_x, min_y = origin
        w, h = size
        chunk_cells: Dict[Tuple[int, int], Cell] = {}
        ports: List[Tuple[int, int]] = []

        for dx in range(w):
            for dy in range(h):
                abs_pos = (min_x + dx, min_y + dy)
                if abs_pos in self.cells:
                    # Copy the cell (we keep state for now)
                    chunk_cells[(dx, dy)] = self.cells[abs_pos]

        # Very naive ports: any cell on the edge of this rect that exists
        for (dx, dy) in list(chunk_cells.keys()):
            if dx == 0 or dx == w-1 or dy == 0 or dy == h-1:
                ports.append((dx, dy))

        return Chunk(name=f"chunk_{origin}", cells=chunk_cells, ports=ports or [(0,0)])

    def graft_chunk(self, chunk: Chunk, attach_at: Tuple[int, int], chunk_port: Tuple[int, int]) -> Tuple[bool, List[str]]:
        """
        Graft the chunk so that chunk_port lands on attach_at on the ship.
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
        return True, logs


# --- Example chunk templates for prototype ---

def make_basic_enemy_chunk(name: str = "raider_wing") -> Chunk:
    """A simple 3x2 asymmetric chunk with corridors + components."""
    cells = {
        (0, 0): Cell(CellType.CORRIDOR),
        (1, 0): Cell(CellType.CORRIDOR),
        (2, 0): Cell(CellType.COMPONENT),
        (0, 1): Cell(CellType.COMPONENT),
        (1, 1): Cell(CellType.CORRIDOR),
    }
    ports = [(0, 0), (2, 0), (0, 1)]  # some exposed edges
    return Chunk(name=name, cells=cells, ports=ports)


def make_corridor_spine_chunk() -> Chunk:
    cells = {
        (0, 0): Cell(CellType.CORRIDOR),
        (0, 1): Cell(CellType.CORRIDOR),
        (0, 2): Cell(CellType.CORRIDOR),
        (1, 1): Cell(CellType.COMPONENT),
        (-1, 1): Cell(CellType.ARTIFACT),
    }
    ports = [(0, 0), (0, 2), (1, 1), (-1, 1)]
    return Chunk(name="spine", cells=cells, ports=ports)


def make_starter_player_ship() -> Ship:
    """A minimal starting franken-ship."""
    ship = Ship(name="Your Derelict", core=(0, 0))
    # Core corridor cross
    ship.add_cell((0, 0), Cell(CellType.CORRIDOR))
    ship.add_cell((1, 0), Cell(CellType.CORRIDOR))
    ship.add_cell((0, 1), Cell(CellType.CORRIDOR))
    ship.add_cell((-1, 0), Cell(CellType.COMPONENT))  # some weapon
    ship.add_cell((0, -1), Cell(CellType.COMPONENT))
    return ship
