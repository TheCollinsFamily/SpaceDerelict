"""Dev-only ship builder for creating hand-crafted opposing/enemy ships.

Run: python dev_ship_builder.py
       python dev_ship_builder.py --demo   # quick non-interactive demo of the algorithmic builds
       python dev_ship_builder.py --help

Humans are great at designing interesting ship layouts (corridor spines, component
placement for interesting combat, artifact risks/rewards, and logical named sections
for the "choose 1/5th of the ship" salvage fantasy).

The builder lets you lay down corridors, components (gun, laser, power, engine, armor,
shield, medical, cargo), and artifacts (15 kinds: 'scatter' (double random comp shots), 'widebeam' (doubles beam hit target+right), 'bypass' (comps active w/o corridor), 'distributor' (shares artifact powers to all connected comps)) on a grid.

You can also define named sub-chunks (rects) so that when the ship is used as an
opposing vessel, post-combat salvage offers meaningful named choices carrying the
exact damage states from the fight.

Saved ships go to dev_ships/*.json and are occasionally used by get_node_enemy
for real variety (beyond the fixed chunk templates).

Commands (type at the > prompt):
  help
  list-kinds                  -- show all placeable component/artifact kinds
  show                        -- render current grid (with active network)
  place <type> <x>,<y>        -- e.g. "place corridor 0,0"
                                  "place component gun 2,1"
                                  "place artifact volatile 1,0"
  place-comp <kind> <x>,<y>   -- shortcut for components
  place-art <kind> <x>,<y>    -- shortcut for artifacts
  remove <x>,<y>
  set-core <x>,<y>
  define-chunk <name> <x1>,<y1> <x2>,<y2>   -- define a named sub region for salvage
                                               (rect inclusive; offset at x1,y1)
  list-chunks
  remove-chunk <name>
  validate                    -- check core, connectivity, basic sanity
  save <name>                 -- saves dev_ships/<name>.json (with sub_chunks)
  load <name>                 -- load a previous dev ship (or full path)
  new                         -- start fresh
  test                        -- quick print of active threats / integrity
  quit

  === Algorithmic build buttons (for fast dev iteration) ===
  build-spine [len] [dir]     -- e.g. build-spine 6 right
  auto-add-pod [gun|armor|shield|artifact|engine]  -- smart attach using corridor ports
  algo-generate [raider|tech|mixed]  -- full random-but-sensible ship + named subs
  random-build                -- same as algo-generate mixed
  (15 artifacts now; + 'distributor' (shares artifact powers e.g. scatter/widebeam/booster to all connected comps in network))

New: Meta support for dev workflow
  set-meta description "A fast asymmetric raider with volatile risks for high spectacle"
  set-meta intended_faction pop_fiz
  set-meta difficulty 3
  set-meta ai_profile chaotic
  show-meta
  (Saved in JSON; used by get_node_enemy for flavor, and future AI hooks)
"""

from __future__ import annotations

import sys
import random
from pathlib import Path
from typing import Tuple

from rich.console import Console
from rich.panel import Panel
from rich.prompt import Prompt

# Make imports work when run from root
sys.path.insert(0, ".")
from space_derelict.model import (
    Ship,
    Cell,
    CellType,
    CellState,
    Chunk,
    save_ship_to_json,
    load_ship_from_json,
    list_dev_ships,
    get_random_dev_ship,
    COMPONENT_KINDS,
    ARTIFACT_KINDS,
    make_gun_pod,
    make_armor_plate,
    make_engine_nacelle,
    make_artifact_bay,
    make_shield_bay,
    make_corridor_spine_chunk,
    make_broadcast_pod,
    make_harvester_claw,
    make_dark_incubator,
    make_scattergun_pod,
    make_beam_lancer,
)

console = Console()

# All supported kinds (centralized in model; re-exported here for CLI legend / validation)
# Do NOT duplicate here - edit space_derelict/model.py COMPONENT_KINDS / ARTIFACT_KINDS
print("[dev] using centralized COMPONENT_KINDS/ARTIFACT_KINDS from model")  # visible on run
# (the names are imported above)


def render_builder(ship: Ship, title: str = "Dev Ship") -> Panel:
    """Reuse the project's renderer (it already handles all kinds + active network)."""
    # We import render_ship from main to keep visuals identical.
    try:
        from main import render_ship
        return render_ship(ship, title=title)
    except Exception:
        # Fallback very basic if main not importable in some env
        from rich.table import Table
        from rich.text import Text
        from rich import box
        xs = [p[0] for p in ship.cells] or [0]
        ys = [p[1] for p in ship.cells] or [0]
        minx, maxx = min(xs), max(xs)
        miny, maxy = min(ys), max(ys)
        active = ship.get_active_corridors()
        table = Table.grid(padding=(0, 1))
        table.box = box.SIMPLE
        for y in range(miny, maxy + 1):
            row = []
            for x in range(minx, maxx + 1):
                pos = (x, y)
                cell = ship.cells.get(pos)
                if not cell:
                    row.append(Text(" . ", style="dim"))
                    continue
                if cell.state == CellState.DESTROYED:
                    ch = Text(" # ", style="bold red")
                elif cell.type == CellType.CORRIDOR:
                    ch = Text(" C ", style="bold cyan" if pos in active else "cyan")
                elif cell.type == CellType.COMPONENT:
                    k = (cell.component_kind or "?")[:1].upper()
                    try:
                        tags = ship.get_component_effect_tags(pos)
                    except Exception:
                        tags = ""
                    if tags:
                        display = f"{k}{tags[0]}"
                        style = "bold green" if ship.is_component_active(pos) else "green"
                    else:
                        display = k
                        style = "bold yellow" if ship.is_component_active(pos) else "dim yellow"
                    ch = Text(f" {display} ", style=style)
                else:
                    k = (cell.artifact_kind or "A")[:1].upper()
                    ch = Text(f" {k} ", style="bold magenta")
                row.append(ch)
            table.add_row(*row)
        return Panel(table, title=f"{title}  (core={ship.core})", border_style="blue")


def print_kinds():
    console.print("[bold]Component kinds (place component <kind> x,y ):[/bold]")
    console.print("  " + ", ".join(COMPONENT_KINDS))
    console.print("[bold]Artifact kinds (place artifact <kind> x,y ):[/bold]")
    console.print("  " + ", ".join(ARTIFACT_KINDS))
    console.print("[dim]Corridors use: place corridor x,y   (they form the active network from core)[/dim]")


def parse_pos(s: str) -> Tuple[int, int] | None:
    try:
        x, y = s.strip().split(",")
        return int(x), int(y)
    except Exception:
        return None


# --- Algorithmic build helpers (for "build button" speed) ---
# These let devs quickly scaffold interesting ships instead of manual cell-by-cell placement.
# They use the existing chunk factories + smart attachment so corridors connect to the network.

def find_exposed_corridors(ship: Ship) -> list[Tuple[int, int]]:
    """Find corridor cells that have at least one empty 4-adj neighbor (good for attaching new modules)."""
    exposed = []
    active = ship.get_active_corridors() or {p for p, c in ship.cells.items() if c.type == CellType.CORRIDOR}
    for (x, y) in active:
        for nx, ny in [(x+1, y), (x-1, y), (x, y+1), (x, y-1)]:
            if (nx, ny) not in ship.cells:
                exposed.append((x, y))
                break
    # Fallback to bbox edges if nothing exposed yet
    if not exposed and ship.cells:
        xs = [p[0] for p in ship.cells]
        ys = [p[1] for p in ship.cells]
        minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
        for x in range(minx, maxx+1):
            if (x, miny-1) not in ship.cells:
                exposed.append((x, miny))
            if (x, maxy+1) not in ship.cells:
                exposed.append((x, maxy))
        for y in range(miny, maxy+1):
            if (minx-1, y) not in ship.cells:
                exposed.append((minx, y))
            if (maxx+1, y) not in ship.cells:
                exposed.append((maxx, y))
    return list(set(exposed))  # dedup


def algorithmic_attach_chunk(ship: Ship, chunk: Chunk, name: str | None = None) -> bool:
    """Algorithmically attach a chunk template to the current ship at a good corridor seam.
    Tries rotations, prefers corridor-to-corridor connections for network extension.
    Returns True if placed successfully (and auto-defines a sub-chunk).
    """
    if not ship.cells:
        # place at origin
        for (dx, dy), cell in chunk.cells.items():
            ship.add_cell((dx, dy), Cell(cell.type, state=CellState.INTACT, component_kind=cell.component_kind, artifact_kind=cell.artifact_kind))
        if name:
            ship.sub_chunks.append((name, (0, 0), chunk))
        return True

    docks = find_exposed_corridors(ship)
    if not docks:
        docks = [(0, 0)]  # last resort

    variants = [chunk] + [chunk.rotated(t) for t in range(1, 4)]
    ship_corridors = {p for p, c in ship.cells.items() if c.type == CellType.CORRIDOR}

    for variant in variants:
        # prefer corridor ports on the chunk
        port_list = list(variant.ports or [(0, 0)])
        corr_ports = [pt for pt in port_list if variant.cells.get(pt) and variant.cells[pt].type == CellType.CORRIDOR]
        other_ports = [pt for pt in port_list if pt not in corr_ports]
        ordered_ports = corr_ports + other_ports

        for dock in docks:
            for port in ordered_ports:
                # compute absolute positions the chunk would occupy
                offset_x = dock[0] - port[0]
                offset_y = dock[1] - port[1]
                would_overlap = False
                new_cells = {}
                for (dx, dy), cell in variant.cells.items():
                    abs_pos = (offset_x + dx, offset_y + dy)
                    if abs_pos in ship.cells:
                        would_overlap = True
                        break
                    new_cells[abs_pos] = Cell(
                        cell.type,
                        state=CellState.INTACT,
                        component_kind=cell.component_kind,
                        artifact_kind=cell.artifact_kind,
                    )
                if would_overlap:
                    continue

                # place them
                for apos, ncell in new_cells.items():
                    ship.add_cell(apos, ncell)

                # auto-define sub-chunk if name given
                if name:
                    # the sub-chunk uses the relative cells from variant, offset is the dock relative to chunk port?
                    # for simplicity, record with offset as the min pos or the attach point
                    min_pos = min(new_cells.keys()) if new_cells else dock
                    rel_cells = {}
                    for (dx, dy), cell in variant.cells.items():
                        rel_cells[(dx, dy)] = Cell(
                            cell.type, state=CellState.INTACT,
                            component_kind=cell.component_kind, artifact_kind=cell.artifact_kind
                        )
                    sub_ports = list(variant.ports or [(0, 0)])
                    sub_chunk = Chunk(name=name, cells=rel_cells, ports=sub_ports)
                    ship.sub_chunks.append((name, min_pos, sub_chunk))

                return True
    # Fallback: just place the chunk to the right of current bbox, no perfect seam
    if ship.cells:
        xs = [p[0] for p in ship.cells]
        ys = [p[1] for p in ship.cells]
        max_x = max(xs)
        min_y = min(ys)
        offset_x = max_x + 2
        offset_y = min_y
        new_cells = {}
        for (dx, dy), cell in chunk.cells.items():
            abs_pos = (offset_x + dx, offset_y + dy)
            if abs_pos in ship.cells:
                return False  # rare
            new_cells[abs_pos] = Cell(
                cell.type, state=CellState.INTACT,
                component_kind=cell.component_kind, artifact_kind=cell.artifact_kind
            )
        for apos, ncell in new_cells.items():
            ship.add_cell(apos, ncell)
        if name:
            rel_cells = { (dx,dy): Cell(cell.type, state=CellState.INTACT, component_kind=cell.component_kind, artifact_kind=cell.artifact_kind)
                          for (dx,dy), cell in chunk.cells.items() }
            sub_chunk = Chunk(name=name, cells=rel_cells, ports=chunk.ports or [(0,0)])
            ship.sub_chunks.append((name, (offset_x, offset_y), sub_chunk))
        return True
    return False


def algorithmic_build_spine(ship: Ship, length: int = 5, direction: str = "right") -> None:
    """Algorithmically lay down a corridor spine from the core (or current max extent)."""
    if not ship.cells:
        ship.add_cell(ship.core, Cell(CellType.CORRIDOR))
    cx, cy = ship.core
    dirs = {"right": (1, 0), "left": (-1, 0), "up": (0, -1), "down": (0, 1)}
    dx, dy = dirs.get(direction, (1, 0))
    x, y = cx, cy
    for i in range(length):
        x += dx
        y += dy
        if (x, y) not in ship.cells:
            ship.add_cell((x, y), Cell(CellType.CORRIDOR))
    # occasional branch
    if length > 3:
        bx, by = x, y
        ship.add_cell((bx + dy, by + dx), Cell(CellType.CORRIDOR))  # perpendicular stub


def algorithmic_generate_ship(ship: Ship, style: str = "raider") -> None:
    """Full algorithmic ship generation. Clears current and builds a varied opposing ship
    using the chunk factories + random attachments. Auto populates good sub-chunks.
    Styles: raider, tech, felonia, mixed.
    """
    # clear
    ship.cells.clear()
    ship.sub_chunks.clear()
    ship.core = (0, 0)
    ship.name = f"Algo {style.title()} Ship"
    ship.meta = ship.meta or {}
    ship.meta.update({"description": f"Algorithmically generated {style} opposing ship", "intended_faction": style, "difficulty": 2, "ai_profile": "opportunistic" if style != "tech" else "methodical"})

    # start with core + basic spine
    ship.add_cell((0, 0), Cell(CellType.CORRIDOR))
    ship.add_cell((1, 0), Cell(CellType.CORRIDOR))
    ship.add_cell((0, 1), Cell(CellType.CORRIDOR))
    algorithmic_build_spine(ship, length=4, direction="right")

    # pick pods based on style
    pods = []
    if style in ("raider", "mixed"):
        pods.extend([make_gun_pod, make_armor_plate, make_engine_nacelle])
    if style in ("tech", "mixed"):
        pods.extend([make_shield_bay, make_artifact_bay])
    if style in ("felonia", "mixed"):
        pods.extend([make_gun_pod, make_armor_plate])
    if not pods:
        pods = [make_gun_pod, make_armor_plate, make_engine_nacelle, make_shield_bay]

    random.shuffle(pods)
    for i, maker in enumerate(pods[:4]):
        chunk = maker(f"algo_{i}")
        name = chunk.name
        if algorithmic_attach_chunk(ship, chunk, name):
            pass
        else:
            # fallback direct place if attach fails
            for (dx, dy), cell in chunk.cells.items():
                ship.add_cell((dx + 5 + i*2, dy), Cell(cell.type, state=CellState.INTACT,
                    component_kind=cell.component_kind, artifact_kind=cell.artifact_kind))
            # still define a sub
            rel = { (dx,dy): Cell(cell.type, state=CellState.INTACT, component_kind=cell.component_kind, artifact_kind=cell.artifact_kind) for (dx,dy),cell in chunk.cells.items() }
            sub = Chunk(name=name, cells=rel, ports=chunk.ports or [(0,0)])
            ship.sub_chunks.append((name, (5+i*2, 0), sub))

    # ensure core is sensible
    if ship.core not in ship.cells:
        ship.core = next(iter(ship.cells))


def builder_loop():
    console.rule("[bold cyan]SPACE DERELICT — DEV SHIP BUILDER[/bold cyan]")
    console.print(
        "Create interesting opposing ships by hand. Good layouts + named sub-chunks = "
        "fun capture vs shatter decisions for the player.\n"
        "Saved ships are occasionally picked by the sector generator for real enemy variety."
    )
    console.print("Type [bold]help[/bold] for commands. [bold]quit[/bold] to exit.\n")
    console.print("[bold yellow]NEW: Algorithmic build buttons for speed![/bold yellow]")
    console.print("  Try:  algo-generate mixed")
    console.print("        build-spine 5 right")
    console.print("        auto-add-pod shield")
    console.print("        random-build")
    console.print("        help   (for full list + details)\n")

    ship: Ship = Ship(name="New Dev Ship", core=(0, 0))
    ship.meta = {"description": "Hand-crafted or algo dev ship for enemy variety", "intended_faction": "mixed", "difficulty": 2, "ai_profile": "opportunistic"}
    # Algorithmic start for speed -- use the build buttons to iterate fast!
    algorithmic_generate_ship(ship, style="mixed")
    console.print("[dim](Started with algo-generated mixed ship. Use the commands above to tweak or reroll. Try 'show-meta' or 'set-meta'.)[/dim]")

    while True:
        console.print(render_builder(ship, title=ship.name))
        meta_str = ""
        if ship.meta:
            meta_str = f" | meta: {ship.meta.get('intended_faction', '?')}/{ship.meta.get('difficulty', '?')} {ship.meta.get('ai_profile', '')}"
        console.print(f"[dim]Core: {ship.core} | cells: {len(ship.cells)} | active corrs: {len(ship.get_active_corridors())} | sub-chunks defined: {len(ship.sub_chunks)}{meta_str}[/dim]")

        cmd = Prompt.ask(">", default="help").strip()
        if not cmd:
            continue

        parts = cmd.split()
        verb = parts[0].lower()

        if verb in ("quit", "q", "exit"):
            console.print("Exiting builder. Use the saved ships via get_random_dev_ship() or load manually.")
            break

        elif verb in ("help", "h", "?"):
            console.print(
                "place corridor 0,0\n"
                "place component gun 2,1   |  place-comp laser 3,0\n"
                "place artifact volatile 1,1  |  place-art booster 0,2\n"
                "remove 1,1\n"
                "set-core 0,0\n"
                "define-chunk port_gun 0,0 3,2     (rect from top-left)\n"
                "list-chunks | remove-chunk port_gun\n"
                "list-kinds | validate | show | save my_cool_raider | load my_cool_raider\n"
                "new | test | quit | set-meta description '...' | show-meta | preview-salvage | simulate 4\n"
                "\n"
                "=== Algorithmic build buttons (speed for devs) ===\n"
                "build-spine [len] [dir]     -- auto lay corridors (right/left/up/down)\n"
                "auto-add-pod [gun|armor|...] -- algorithmically attach a pod using smart seams\n"
                "algo-generate [raider|tech|mixed] -- full procedural ship (spine + pods + auto subs)\n"
                "random-build               -- alias for algo-generate mixed\n"
                "Note: 'scatter' (double random comp shots), 'widebeam' (doubles beam to hit target+right), 'bypass' (comps active w/o corridor), 'distributor' (T: shares powers network-wide to connected comps)\n"
        "Meta: use set-meta description '...' | intended_faction raider | difficulty 3 | ai_profile aggressive | tags 'volatile,high-spectacle' | notes '...' "
            )

        elif verb == "list-kinds":
            print_kinds()

        elif verb == "show":
            console.print(render_builder(ship, title=ship.name))

        elif verb in ("place", "p"):
            if len(parts) < 3:
                console.print("[red]Usage: place <corridor|component|artifact> <x,y>  or place <kind> <x,y>[/red]")
                continue
            if parts[1].lower() == "corridor":
                pos = parse_pos(parts[2])
                if pos:
                    ship.add_cell(pos, Cell(CellType.CORRIDOR))
                    console.print(f"[green]Placed corridor at {pos}[/green]")
                else:
                    console.print("[red]Bad pos[/red]")
            elif parts[1].lower() in ("component", "comp", "c"):
                if len(parts) < 4:
                    console.print("[red]place component <kind> x,y[/red]")
                    continue
                kind = parts[2].lower()
                pos = parse_pos(parts[3])
                if pos and kind in COMPONENT_KINDS:
                    ship.add_cell(pos, Cell(CellType.COMPONENT, component_kind=kind))
                    console.print(f"[green]Placed component {kind} at {pos}[/green]")
                else:
                    console.print("[red]Unknown component kind or bad pos. Use list-kinds.[/red]")
            elif parts[1].lower() in ("artifact", "art", "a"):
                if len(parts) < 4:
                    console.print("[red]place artifact <kind> x,y[/red]")
                    continue
                kind = parts[2].lower()
                pos = parse_pos(parts[3])
                if pos and kind in ARTIFACT_KINDS:
                    ship.add_cell(pos, Cell(CellType.ARTIFACT, artifact_kind=kind))
                    console.print(f"[green]Placed artifact {kind} at {pos}[/green]")
                else:
                    console.print("[red]Unknown artifact kind or bad pos. Use list-kinds.[/red]")
            else:
                # shorthand place gun 2,3  or place volatile 1,1
                kind = parts[1].lower()
                pos = parse_pos(parts[2]) if len(parts) > 2 else None
                if pos and kind in COMPONENT_KINDS:
                    ship.add_cell(pos, Cell(CellType.COMPONENT, component_kind=kind))
                elif pos and kind in ARTIFACT_KINDS:
                    ship.add_cell(pos, Cell(CellType.ARTIFACT, artifact_kind=kind))
                else:
                    console.print("[red]Unknown kind. Try 'place component gun 2,1' or use list-kinds[/red]")

        elif verb in ("place-comp", "place-component"):
            if len(parts) < 3:
                console.print("[red]place-comp <kind> x,y[/red]")
                continue
            kind = parts[1].lower()
            pos = parse_pos(parts[2])
            if pos and kind in COMPONENT_KINDS:
                ship.add_cell(pos, Cell(CellType.COMPONENT, component_kind=kind))
            else:
                console.print("[red]Bad kind or pos[/red]")

        elif verb in ("place-art", "place-artifact"):
            if len(parts) < 3:
                console.print("[red]place-art <kind> x,y[/red]")
                continue
            kind = parts[1].lower()
            pos = parse_pos(parts[2])
            if pos and kind in ARTIFACT_KINDS:
                ship.add_cell(pos, Cell(CellType.ARTIFACT, artifact_kind=kind))
            else:
                console.print("[red]Bad kind or pos[/red]")

        elif verb == "remove":
            if len(parts) < 2:
                continue
            pos = parse_pos(parts[1])
            if pos and pos in ship.cells:
                del ship.cells[pos]
                console.print(f"[yellow]Removed {pos}[/yellow]")
            # also clean from sub_chunks? for simplicity we leave them (user can re-define)

        elif verb == "set-core":
            if len(parts) < 2:
                continue
            pos = parse_pos(parts[1])
            if pos:
                ship.core = pos
                if pos not in ship.cells:
                    ship.add_cell(pos, Cell(CellType.CORRIDOR))
                console.print(f"[green]Core set to {pos}[/green]")

        elif verb == "define-chunk":
            if len(parts) < 4:
                console.print("[red]define-chunk <name> <x1,y1> <x2,y2>[/red]")
                continue
            name = parts[1]
            p1 = parse_pos(parts[2])
            p2 = parse_pos(parts[3])
            if not p1 or not p2:
                console.print("[red]Bad positions[/red]")
                continue
            x1, y1 = min(p1[0], p2[0]), min(p1[1], p2[1])
            x2, y2 = max(p1[0], p2[0]), max(p1[1], p2[1])
            offset = (x1, y1)
            rel_cells: dict[Tuple[int, int], Cell] = {}
            for ax in range(x1, x2 + 1):
                for ay in range(y1, y2 + 1):
                    apos = (ax, ay)
                    if apos in ship.cells:
                        cell = ship.cells[apos]
                        dx, dy = ax - x1, ay - y1
                        # copy the cell data (new object)
                        if cell.type == CellType.COMPONENT:
                            rel_cells[(dx, dy)] = Cell(cell.type, state=cell.state, component_kind=cell.component_kind)
                        elif cell.type == CellType.ARTIFACT:
                            rel_cells[(dx, dy)] = Cell(cell.type, state=cell.state, artifact_kind=cell.artifact_kind)
                        else:
                            rel_cells[(dx, dy)] = Cell(cell.type, state=cell.state)
            if not rel_cells:
                console.print("[red]No cells in that rect[/red]")
                continue
            # ports = boundary cells that exist
            ports = []
            for (dx, dy) in rel_cells:
                ax, ay = x1 + dx, y1 + dy
                if (ax == x1 or ax == x2 or ay == y1 or ay == y2):
                    ports.append((dx, dy))
            chunk = Chunk(name=name, cells=rel_cells, ports=ports or [(0, 0)])
            # remove any previous with same name
            ship.sub_chunks = [sc for sc in ship.sub_chunks if sc[0] != name]
            ship.sub_chunks.append((name, offset, chunk))
            console.print(f"[green]Defined chunk '{name}' offset {offset} with {len(rel_cells)} cells[/green]")

        elif verb == "list-chunks":
            if not ship.sub_chunks:
                console.print("[dim]No sub-chunks defined yet. Use define-chunk to create salvage sections.[/dim]")
            for sname, off, ch in ship.sub_chunks:
                console.print(f"  {sname} @ {off}  cells={len(ch.cells)}  ports={ch.ports}")

        elif verb == "remove-chunk":
            if len(parts) < 2:
                continue
            name = parts[1]
            before = len(ship.sub_chunks)
            ship.sub_chunks = [sc for sc in ship.sub_chunks if sc[0] != name]
            console.print(f"[yellow]Removed {before - len(ship.sub_chunks)} chunk(s) named {name}[/yellow]")

        elif verb == "validate":
            if ship.core not in ship.cells:
                console.print("[red]Core position has no cell![/red]")
            active = ship.get_active_corridors()
            if not active:
                console.print("[red]No active corridors connected to core![/red]")
            comps = sum(1 for c in ship.cells.values() if c.type == CellType.COMPONENT)
            arts = sum(1 for c in ship.cells.values() if c.type == CellType.ARTIFACT)
            corrs = sum(1 for c in ship.cells.values() if c.type == CellType.CORRIDOR)
            console.print(f"[green]OK-ish: {corrs} corrs, {comps} comps, {arts} artifacts. Active network size: {len(active)}[/green]")
            if ship.sub_chunks:
                console.print(f"[dim]Has {len(ship.sub_chunks)} named sub-chunks for salvage[/dim]")

        elif verb == "save":
            if len(parts) < 2:
                console.print("[red]save <name-without-.json>[/red]")
                continue
            fname = parts[1]
            p = save_ship_to_json(ship, fname)
            console.print(f"[bold green]Saved to {p}[/bold green]")
            console.print("[dim]This ship can now appear as an opposing ship in runs (via get_random_dev_ship).[/dim]")

        elif verb == "load":
            if len(parts) < 2:
                # list available
                ships = list_dev_ships()
                if ships:
                    console.print("Available dev ships:")
                    for s in ships:
                        console.print(f"  {s.stem}")
                else:
                    console.print("[dim]No dev ships yet. Create some and save.[/dim]")
                continue
            fname = parts[1]
            if not fname.endswith(".json"):
                fname += ".json"
            candidate = Path("dev_ships") / fname
            if not candidate.exists():
                candidate = Path(fname)  # allow full path
            if candidate.exists():
                ship = load_ship_from_json(candidate)
                console.print(f"[green]Loaded {ship.name} with {len(ship.cells)} cells and {len(ship.sub_chunks)} sub-chunks[/green]")
            else:
                console.print(f"[red]Not found: {candidate}[/red]")

        elif verb == "new":
            ship = Ship(name="New Dev Ship", core=(0, 0))
            ship.add_cell((0, 0), Cell(CellType.CORRIDOR))
            ship.add_cell((1, 0), Cell(CellType.CORRIDOR))
            ship.add_cell((0, 1), Cell(CellType.CORRIDOR))
            console.print("[yellow]Started fresh minimal ship.[/yellow]")

        elif verb in ("set-meta", "meta"):
            if len(parts) < 3:
                console.print("[red]set-meta <key> <value...>  (e.g. set-meta description 'A chaotic raider with volatile risks') or set-meta difficulty 3[/red]")
                continue
            key = parts[1].lower()
            value = " ".join(parts[2:])
            if key in ("difficulty",):
                try:
                    value = int(value)
                except:
                    pass
            if key in ("tags",) and isinstance(value, str):
                value = [t.strip() for t in value.split(",") if t.strip()]
            ship.meta[key] = value
            console.print(f"[green]Set meta.{key} = {value}[/green]")

        elif verb in ("show-meta", "meta-show"):
            if ship.meta:
                console.print(Panel(str(ship.meta), title="Ship Meta"))
            else:
                console.print("[dim]No meta set yet. Use set-meta description '...' etc.[/dim]")

        elif verb == "test":
            active = ship.get_active_corridors()
            threats = []
            for pos, c in ship.cells.items():
                if c.type == CellType.COMPONENT and ship.is_component_active(pos):
                    k = (c.component_kind or "").lower()
                    if "gun" in k or "laser" in k:
                        threats.append((pos, c.component_kind))
            console.print(f"Active corridors: {len(active)}")
            console.print(f"Weapon threats: {threats}")
            console.print(f"Integrity: {ship.get_network_integrity():.0%}")

        elif verb in ("preview-salvage", "salvage-preview", "salvage"):
            if not ship.sub_chunks:
                console.print("[red]No sub-chunks defined. Use define-chunk first for meaningful salvage preview.[/red]")
                continue
            console.print("[bold]Salvage preview (current damage states):[/bold]")
            for sname, off, ch in ship.sub_chunks:
                live = sum(1 for c in ch.cells.values() if c.state != CellState.DESTROYED)
                total = len(ch.cells)
                kinds = {}
                for c in ch.cells.values():
                    if c.type == CellType.COMPONENT:
                        k = c.component_kind or "?"
                        kinds[k] = kinds.get(k, 0) + 1
                    elif c.type == CellType.ARTIFACT:
                        k = c.artifact_kind or "?"
                        kinds[k] = kinds.get(k, 0) + 1
                console.print(f"  {sname} @ {off}: {live}/{total} live cells | {kinds}")
            console.print("[dim]In real post-combat these would be the exact options (only non-destroyed cells).[/dim]")

        elif verb in ("simulate", "test-fight", "fight"):
            turns = 3
            if len(parts) > 1:
                try:
                    turns = int(parts[1])
                except:
                    pass
            console.print(f"[bold]Simulating {turns} turns of combat vs basic player starter...[/bold]")
            try:
                player = make_starter_player_ship("basic")
                from space_derelict.model import resolve_combat_turn, DamageType
                for t in range(turns):
                    # Player picks a random active threat on enemy and damages it
                    e_targets = [p for p, c in ship.cells.items()
                                 if c.type in (CellType.COMPONENT, CellType.ARTIFACT)
                                 and getattr(ship, 'is_component_active', lambda pp: True)(p)]
                    if not e_targets:
                        e_targets = list(ship.cells.keys())
                    if e_targets:
                        et = random.choice(e_targets)
                        dt = random.choice([DamageType.KINETIC, DamageType.ION, DamageType.BREACH, DamageType.FIRE])
                        plogs = ship.apply_damage(dt, et)
                        for l in plogs[:1]:
                            console.print(f"  [Player] {l}")
                    # Enemy turn (retaliation + fire spread + repairs)
                    rlogs = resolve_combat_turn(ship, player)
                    for l in rlogs[:2]:
                        if any(x in l for x in ["ENEMY", "Fire", "RETURNS", "REPAIRED", "NANITE"]):
                            console.print(f"  [Turn {t+1}] {l}")
                console.print(render_builder(ship, title="After sim (note damage states)"))
                # Show graft bonus path (the new diversity pieces on *player* would have pumped this)
                try:
                    from space_derelict.model import apply_player_graft_bonuses, Resources
                    test_res = Resources(12, 4, 15)
                    boosted, blogs = apply_player_graft_bonuses(player, test_res, rlogs)
                    if blogs:
                        console.print("[cyan]Graft-bonus sim (what your attached pieces would have added):[/cyan]")
                        for bl in blogs[:3]:
                            console.print(f"  {bl}")
                    console.print(f"[dim]Boosted res would be: {boosted}[/dim]")
                except Exception as _ex:
                    pass
                console.print("[dim]Now use 'preview-salvage' to see what the player would choose from.[/dim]")
            except Exception as ex:
                console.print(f"[red]Sim failed: {ex}[/red]")

        # --- Algorithmic "build button" commands ---
        elif verb in ("build-spine", "spine", "auto-spine"):
            length = 5
            direction = "right"
            if len(parts) > 1:
                try:
                    length = int(parts[1])
                except:
                    direction = parts[1]
            if len(parts) > 2:
                direction = parts[2]
            algorithmic_build_spine(ship, length=length, direction=direction)
            console.print(f"[green]Built algorithmic spine of length {length} {direction}[/green]")

        elif verb in ("auto-add-pod", "add-pod", "stamp-pod"):
            pod_type = parts[1].lower() if len(parts) > 1 else "gun"
            makers = {
                "gun": make_gun_pod,
                "laser": lambda n="laser_pod": make_gun_pod(n),  # re-use for variety
                "armor": make_armor_plate,
                "engine": make_engine_nacelle,
                "shield": make_shield_bay,
                "artifact": make_artifact_bay,
                "spine": make_corridor_spine_chunk,
                "broadcast": make_broadcast_pod,
                "harvester": make_harvester_claw,
                "incubator": make_dark_incubator,
                "dark": make_dark_incubator,
                "scatter": make_scattergun_pod,
                "beam": make_beam_lancer,
                "lancer": make_beam_lancer,
            }
            maker = makers.get(pod_type, make_gun_pod)
            chunk = maker(f"auto_{pod_type}")
            if algorithmic_attach_chunk(ship, chunk, chunk.name):
                console.print(f"[green]Auto-attached {chunk.name} via algorithmic seam[/green]")
            else:
                console.print("[yellow]Could not find good attachment, placed loose[/yellow]")

        elif verb in ("algo-generate", "random-build", "auto-ship", "generate"):
            style = parts[1].lower() if len(parts) > 1 else "mixed"
            algorithmic_generate_ship(ship, style=style)
            console.print(f"[bold green]Algorithmically generated {style} ship with {len(ship.sub_chunks)} auto sub-chunks[/bold green]")

        else:
            console.print("[red]Unknown command. Type help.[/red]")


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] in ("--help", "-h", "help"):
        print(__doc__)
        print("\nAlso supports:")
        print("  python dev_ship_builder.py --demo   # non-interactive demo of algorithmic generation")
        sys.exit(0)
    if len(sys.argv) > 1 and sys.argv[1] == "--demo":
        console.rule("[bold cyan]DEV SHIP BUILDER — ALGORITHMIC DEMO[/bold cyan]")
        s = Ship(name="Demo Algo Ship", core=(0, 0))
        s.meta = {"description": "Demo of algorithmic dev ship generation", "intended_faction": "mixed", "difficulty": 2}
        algorithmic_generate_ship(s, style="mixed")
        console.print(render_builder(s, title=s.name))
        console.print(f"[green]Generated: {len(s.cells)} cells, {len(s.get_active_corridors())} active corrs, {len(s.sub_chunks)} named sub-chunks[/green]")
        console.print("[dim]In the real builder these would be editable with manual commands too.[/dim]")
        # Also demo a couple buttons
        algorithmic_build_spine(s, length=3, direction="down")
        pod = make_shield_bay("demo_shield")
        algorithmic_attach_chunk(s, pod, "demo_shield_pod")
        console.print(render_builder(s, title="After build-spine + auto-add-pod shield"))
        console.print("[bold]To use interactively (the real builder):[/bold] python dev_ship_builder.py")
        console.print("[dim]  (Tip: make your terminal wide for full grids/legends. Inside type 'help' first.)")
        console.print("[dim]Inside type: build-spine, auto-add-pod, algo-generate, help, save, quit, etc.[/dim]")
        sys.exit(0)
    builder_loop()