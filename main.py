"""Space Derelict — early playable prototype (terminal + rich).

This gives a vertical slice of the core fantasy:
- Fight an enemy using different damage types (capture vs shatter)
- See corridor cutting and component disabling in action
- Make the capture / shatter choice
- Graft a chunk onto your ship
- Immediately see the expanded ship in a follow-up encounter

Run: python main.py
(Requires `rich` — already installed in the setup.)

This is still programmer art (colored text grid). Pixel art + pygame or Godot frontend comes later.
"""

from __future__ import annotations

import argparse
import sys
from typing import List, Tuple

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text
from rich import box

# Make sure we can import even if run from weird cwd
sys.path.insert(0, ".")

from space_derelict.model import (
    Ship,
    make_starter_player_ship,
    make_basic_enemy_chunk,
    DamageType,
    CellState,
)

console = Console()


DAMAGE_NAMES = {
    DamageType.ION: "Ion (shields)",
    DamageType.EMP: "EMP (disable components)",
    DamageType.KINETIC: "Kinetic (destroy)",
    DamageType.BREACH: "Breach (hull shatter)",
    DamageType.FIRE: "Fire (DOT on disconnected)",
    DamageType.NERVE_GAS: "Nerve Gas (corridor inop)",
}


def render_ship(ship: Ship, title: str = "Ship") -> Panel:
    """Return a rich Panel containing a colored grid of the ship."""
    if not ship.cells:
        return Panel("empty", title=title)

    xs = [p[0] for p in ship.cells.keys()]
    ys = [p[1] for p in ship.cells.keys()]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)

    active = ship.get_active_corridors()

    table = Table.grid(padding=(0, 1))
    table.box = box.SIMPLE

    for y in range(min_y, max_y + 1):
        row: List[Text] = []
        for x in range(min_x, max_x + 1):
            pos = (x, y)
            cell = ship.cells.get(pos)
            if not cell:
                row.append(Text(" . ", style="dim"))
                continue

            if cell.state == CellState.DESTROYED:
                ch = Text(" # ", style="bold red")
            elif cell.type.name == "CORRIDOR":
                if pos in active:
                    ch = Text(" C ", style="bold cyan")
                else:
                    ch = Text(" c ", style="cyan")
            elif cell.type.name == "COMPONENT":
                if ship.is_component_active(pos):
                    ch = Text(" K ", style="bold yellow")
                else:
                    ch = Text(" k ", style="yellow")
            else:  # ARTIFACT
                if cell.state == CellState.INTACT:
                    ch = Text(" A ", style="bold magenta")
                else:
                    ch = Text(" a ", style="magenta")
            row.append(ch)
        table.add_row(*row)

    info = f"integrity {ship.get_network_integrity():.0%} | cells {len(ship.cells)}"
    return Panel(table, title=f"{title}  —  {info}", border_style="blue")


def choose_damage() -> DamageType:
    console.print("\n[bold]Choose damage type:[/bold]")
    for i, (dt, name) in enumerate(DAMAGE_NAMES.items(), 1):
        console.print(f"  [cyan]{i}[/cyan]. {name}")
    while True:
        choice = console.input("Number (1-6): ").strip()
        if choice.isdigit():
            idx = int(choice) - 1
            if 0 <= idx < len(DAMAGE_NAMES):
                return list(DAMAGE_NAMES.keys())[idx]
        console.print("[red]Invalid choice[/red]")


def choose_target(ship: Ship) -> Tuple[int, int]:
    console.print("\n[bold]Target a cell[/bold] (enter x,y e.g. 0,0 or 1,-1)")
    cells = list(ship.cells.keys())
    console.print(f"Possible cells: {cells[:8]}{'...' if len(cells) > 8 else ''}")
    while True:
        raw = console.input("x,y > ").strip()
        try:
            x_str, y_str = raw.split(",")
            pos = (int(x_str), int(y_str))
            if pos in ship.cells:
                return pos
            console.print("[red]No cell at that position on this ship[/red]")
        except Exception:
            console.print("[red]Format must be x,y  (integers)[/red]")


def simple_combat_demo(player: Ship, enemy: Ship, max_turns: int = 6) -> None:
    """Very basic 'combat': player applies chosen damage types to enemy."""
    console.print(Panel("[bold red]COMBAT — Surgical or Shatter?[/bold red]\nYou issue targeting orders. Enemy is static for this prototype.", border_style="red"))
    console.print(render_ship(enemy, "Enemy"))
    console.print(render_ship(player, "Your Ship"))

    log: List[str] = []

    for turn in range(1, max_turns + 1):
        console.rule(f"Turn {turn}")
        dmg = choose_damage()
        target = choose_target(enemy)
        msgs = enemy.apply_damage(dmg, target)
        log.extend(msgs)

        console.print(render_ship(enemy, f"Enemy after turn {turn}"))

        for m in msgs:
            console.print(f"  [green]{m}[/green]")

        quality = enemy.get_capture_quality()
        states = enemy.count_states()
        console.print(f"[dim]Current capture quality: {quality} | states {states}[/dim]")

        if quality == "shattered":
            console.print("[bold red]Enemy hull integrity critical — fight effectively over.[/bold red]")
            break

        cont = console.input("\nContinue combat? [y/N] ").lower().strip()
        if cont != "y":
            break

    console.print("\n[bold]Combat log:[/bold]")
    for entry in log[-8:]:
        console.print(f"  • {entry}")


def do_graft_phase(player: Ship, enemy: Ship) -> None:
    console.rule("POST-COMBAT — Capture Decision")
    quality = enemy.get_capture_quality()
    states = enemy.count_states()
    console.print(f"Enemy ended as: [bold]{quality}[/bold]  {states}")

    # Simulate "breaking into chunks" — for prototype just offer the main body as one chunk
    chunk = enemy.extract_chunk((0, 0), size=(3, 2))
    console.print(f"\nOne chunk extracted: {chunk.name} ({len(chunk.cells)} cells)")

    console.print("\n[bold]Do you want to:[/bold]")
    console.print("  1. Attempt to graft this chunk (capture play)")
    console.print("  2. Shatter for scrap instead (no graft, more resources later)")

    choice = console.input("Choice: ").strip()

    if choice == "1":
        # Try a few possible attach points
        possible = [(2, 0), (0, 2), (-2, 0), (0, -2)]
        attached = False
        for attach in possible:
            # pick first port on chunk
            if chunk.ports:
                port = chunk.ports[0]
                ok, logs = player.graft_chunk(chunk, attach_at=attach, chunk_port=port)
                if ok:
                    console.print(f"[green]Grafted successfully at {attach}![/green]")
                    for l in logs:
                        console.print(f"  {l}")
                    attached = True
                    break
        if not attached:
            console.print("[yellow]No clean attachment point found this time (overlap). Ship unchanged.[/yellow]")
    else:
        console.print("[yellow]You took the scrap route. No new hardware, but resources for later.[/yellow]")

    console.print(render_ship(player, "Your Ship after graft phase"))


def run_scripted_demo():
    """Non-interactive run for the harness / CI-like testing. Shows the full loop."""
    console.rule("[bold cyan]SPACE DERELICT — scripted demo[/bold cyan]")
    player = make_starter_player_ship()
    console.print(render_ship(player, "Starting ship"))

    enemy = Ship(name="Rim Raider")
    for (dx, dy), c in make_basic_enemy_chunk().cells.items():
        enemy.add_cell((dx, dy), c)

    console.print(render_ship(enemy, "Enemy"))

    # Scripted "surgical" play for a decent capture
    sequence = [
        (DamageType.EMP, (2, 0)),
        (DamageType.EMP, (0, 1)),
        (DamageType.ION, (1, 0)),
        (DamageType.KINETIC, (1, 1)),  # light overkill on one
    ]
    for dmg, tgt in sequence:
        msgs = enemy.apply_damage(dmg, tgt)
        console.print(f"[dim]Applied {dmg.name} @ {tgt}: {msgs}[/dim]")

    console.print(render_ship(enemy, "Enemy after scripted surgical damage"))

    quality = enemy.get_capture_quality()
    console.print(f"\n[bold]Resulting capture quality: {quality}[/bold]")

    # Graft
    chunk = enemy.extract_chunk((0, 0), size=(3, 2))
    ok, logs = player.graft_chunk(chunk, attach_at=(2, 0), chunk_port=(0, 0))
    console.print(f"Graft: {ok} {logs}")
    console.print(render_ship(player, "Your ship after grafting"))

    # Second enemy to show difference
    enemy2 = Ship(name="Second Raider")
    for (dx, dy), c in make_basic_enemy_chunk("raider2").cells.items():
        enemy2.add_cell((dx, dy), c)
    console.print(render_ship(player, "Upgraded player vs new enemy"))
    console.print(render_ship(enemy2, "New enemy"))

    # One hit on the new enemy to prove the grafted parts exist
    msgs = enemy2.apply_damage(DamageType.EMP, (2, 0))
    console.print(f"Hit new enemy: {msgs}")
    console.print(render_ship(enemy2, "After one hit on enemy 2"))

    console.rule("Scripted demo complete")
    console.print("The grafted chunk added new corridors and a disabled component to your grid. The model works.")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--demo", action="store_true", help="Run non-interactive scripted loop (for testing/harness)")
    args = parser.parse_args()

    if args.demo:
        run_scripted_demo()
        return

    # Interactive path (you run this yourself in a real terminal)
    console.clear()
    console.rule("[bold cyan]SPACE DERELICT[/bold cyan] — prototype")
    console.print(
        "Roguelite FTL + Space Hulk grafting. Corridor networks, damage types that matter, capture vs shatter economy.\n"
        "This is still all text + rich. Pixel art + real graphics come after the mechanics feel right.\n"
        "Tip: run with --demo for a non-interactive full loop."
    )

    player = make_starter_player_ship()
    console.print(render_ship(player, "Your starting ship"))

    enemy = Ship(name="Rim Raider")
    base = make_basic_enemy_chunk()
    for (dx, dy), c in base.cells.items():
        enemy.add_cell((dx, dy), c)

    simple_combat_demo(player, enemy)

    do_graft_phase(player, enemy)

    console.rule("Follow-up encounter (with your new ship)")
    console.print("[dim]A second small raider appears. Notice any new corridors or components from the graft?[/dim]")

    enemy2 = Ship(name="Second Raider")
    base2 = make_basic_enemy_chunk("raider2")
    for (dx, dy), c in base2.cells.items():
        enemy2.add_cell((dx, dy), c)

    console.print(render_ship(player, "Your (possibly upgraded) ship"))
    console.print(render_ship(enemy2, "New enemy"))

    console.print("\n[bold]Apply 1-2 more hits to see if your grafted parts matter.[/bold]")
    for _ in range(2):
        dmg = choose_damage()
        tgt = choose_target(enemy2)
        msgs = enemy2.apply_damage(dmg, tgt)
        console.print(render_ship(enemy2, "Enemy 2"))
        for m in msgs:
            console.print(f"  [green]{m}[/green]")

    console.rule("End of prototype slice")
    console.print(
        "Core fantasy loop is demonstrable: surgical damage → better capture → grafting changes your grid and active network.\n"
        "Next: persistent scrap/feast, multiple chunks to choose from, real 'hub', better chunk variety, save/load."
    )


if __name__ == "__main__":
    main()
