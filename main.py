"""Space Derelict — playable prototype (terminal + rich).

Vertical slice now includes:
- 6 damage types, corridor network, active components, capture quality
- Named chunks with roles (gun_pod includes scatter/widebeam/bypass artifacts: scatter=double random comp shots, widebeam=double beam to +right, bypass=no corridor needed; + distributor shares artifact powers to all connected comps)
- Logical multi-chunk salvage choices carrying combat states
- Auto-graft that prefers real corridor-to-corridor network extension
- Scrap + feast economy, hub repairs + meta feast->scrap processing
- Retaliation (differentiated by gun/laser), shields (gating), fire spread, power overload cascades in combat phase
- 3-fight run loop with death check and growing ship

The --demo runs a full short roguelite run. Interactive lets you make the capture/shatter/graft decisions yourself.

Run: python main.py   or with --demo
This is still rich text grids. Graphics later once the mechanics feel right to playtest.
"""

from __future__ import annotations

import argparse
import sys
import random
import json
from pathlib import Path
from typing import List, Tuple, Optional, Set

# Set up automatic log capture early (terminal version: also echo INFO+ to console).
# All errors get full tracebacks written to logs/space_derelict.log (rotating) + crash reports.
try:
    from space_derelict.logging_setup import setup_logging, install_excepthook, shutdown_logging
    setup_logging(console=True)  # rich terminal benefits from seeing INFO logs too
    install_excepthook()
except Exception as _log_err:
    print(f"[warn] logging setup failed early: {_log_err}", file=sys.stderr)

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text
from rich import box

# Make sure we can import even if run from weird cwd
sys.path.insert(0, ".")

from space_derelict.model import (
    Ship,
    Chunk,
    Resources,
    Cell,
    make_starter_player_ship,
    make_raider_ship,
    make_gun_pod,
    make_armor_plate,
    make_shield_bay,
    DamageType,
    CellState,
    CellType,
    generate_sector,
    generate_branching_sector,
    get_node_enemy,
    SectorNode,
    resolve_combat_turn,
    get_active_threats,
    apply_player_graft_bonuses,
    execute_player_attack,
    STARTING_FRAMES,
    roll_random_event,
    FACTIONS,
    AGGRESSION_MAX,
    get_faction_aggression,
    gain_faction_aggression,
    get_maxed_factions,
    is_max_aggression,
    get_tube_reveal_text,
    extract_brutal_moments,
)
from space_derelict.hub_progression import (
    RUN_MORALE_UPGRADES, get_available_run_morale_upgrades, get_run_upgrade_prereq_str,
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
                kind = (cell.component_kind or "comp")[:1].upper()
                # Extended: L=laser, M=medical, P=power, O=cargo (avoid C conflict), S=shield, G=gun, E=eng, A=armor
                special = {"L": "L", "M": "M", "P": "P", "O": "O", "S": "S", "G": "G", "E": "E", "A": "A"}
                glyph = special.get(kind, "K")
                tags = ship.get_component_effect_tags(pos)
                if tags:
                    # show effect tag e.g. Gz for gun with scatter, or just use special style
                    display = f"{glyph}{tags[0]}" if len(tags) > 0 else glyph
                    # components with artifact effects get a distinct style (e.g. green tint)
                    style = "bold green" if ship.is_component_active(pos) else "green"
                else:
                    display = glyph
                    style = "bold yellow" if ship.is_component_active(pos) else "dim yellow"
                ch = Text(f" {display} ", style=style)
            else:  # ARTIFACT
                kind = getattr(cell, "artifact_kind", None)
                if kind == "volatile":
                    glyph = "V"
                    style = "bold red" if cell.state == CellState.INTACT else "red"
                elif kind == "dampener":
                    glyph = "D"
                    style = "bold magenta" if cell.state == CellState.INTACT else "magenta"
                elif kind == "booster":
                    glyph = "B"
                    style = "bold cyan" if cell.state == CellState.INTACT else "cyan"
                elif kind == "jammer":
                    glyph = "J"
                    style = "bold yellow" if cell.state == CellState.INTACT else "yellow"
                elif kind == "nanite":
                    glyph = "N"
                    style = "bold green" if cell.state == CellState.INTACT else "green"
                elif kind == "overdrive":
                    glyph = "O"
                    style = "bold red" if cell.state == CellState.INTACT else "red"
                elif kind == "accumulator":
                    glyph = "U"
                    style = "bold magenta" if cell.state == CellState.INTACT else "magenta"
                elif kind == "reactor":
                    glyph = "R"
                    style = "bold red" if cell.state == CellState.INTACT else "red"
                elif kind == "feast_chamber":
                    glyph = "F"
                    style = "bold green" if cell.state == CellState.INTACT else "green"
                elif kind == "scanner":
                    glyph = "S"
                    style = "bold cyan" if cell.state == CellState.INTACT else "cyan"
                elif kind == "pulse":
                    glyph = "X"
                    style = "bold yellow" if cell.state == CellState.INTACT else "yellow"
                elif kind == "scatter":
                    glyph = "Z"
                    style = "bold red" if cell.state == CellState.INTACT else "red"
                elif kind == "widebeam":
                    glyph = "W"
                    style = "bold cyan" if cell.state == CellState.INTACT else "cyan"
                elif kind == "bypass":
                    glyph = "Y"
                    style = "bold green" if cell.state == CellState.INTACT else "green"
                elif kind == "distributor":
                    glyph = "T"
                    style = "bold magenta" if cell.state == CellState.INTACT else "magenta"
                else:
                    glyph = "A"
                    style = "bold magenta" if cell.state == CellState.INTACT else "magenta"
                ch = Text(f" {glyph} ", style=style)
            row.append(ch)
        table.add_row(*row)

    info = f"integrity {ship.get_network_integrity():.0%} | cells {len(ship.cells)}"
    legend = "Legend: C=active corr | c=off | G=gun | L=laser etc (dim/grey=inactive, no corridor power) | Gz/Gw etc = comp with artifact effect (z=scatter,w=widebeam,b=booster,j=jammer etc) | B=booster | J=jammer | ... | #=dead | .=empty"
    return Panel(table, title=f"{title}  —  {info}\n{legend}", border_style="blue")


def render_resources(res: Resources) -> str:
    return f"[yellow]Scrap: {res.scrap}[/yellow]  [magenta]Feast: {res.feast}[/magenta]  [red]Ratings: {res.ratings}[/red]"


META_PATH = Path("space_derelict_meta.json")

def load_meta() -> tuple[Resources, Set[str], dict]:
    """Load persistent city meta: resources (ratings etc for home base), unlocks, and career stats."""
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
            return res, unlocks, career
        except Exception:
            from space_derelict.logging_setup import get_logger
            get_logger().exception("load_meta (terminal): bad meta file, defaults used")
    return Resources(scrap=5, feast=5, ratings=25), set(), {"total_ratings_earned": 0, "seasons_completed": 0, "high_score": 0}

def save_meta(persistent: Resources, unlocks: Set[str], career: dict) -> None:
    """Save the home base meta and career progress for next session."""
    data = {
        "resources": {"scrap": persistent.scrap, "feast": persistent.feast, "ratings": persistent.ratings},
        "unlocks": list(unlocks),
        "career": career,
    }
    META_PATH.write_text(json.dumps(data, indent=2))


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


def simple_combat_demo(player: Ship, enemy: Ship, max_turns: int = 7) -> list[str]:
    """More engaging orders-based combat with shields (model gated), fire spread, differentiated enemy retaliation (laser ION vs gun KINETIC), power overload side effects.
    Sniping specific weapons/power changes what comes back and cascades. Ion first to drop shields."""
    console.print(Panel("[bold red]COMBAT — Surgical or Shatter?[/bold red]\nIssue targeting orders. Enemy weapons (gun/laser) retaliate differently (lasers strip, guns kinetic; scatter=double random comp, widebeam=double beam to +right, bypass=active w/o corridor, distributor=shares powers like scatter/widebeam across all connected). Ion first to drop shields. Sniping power plants cascades disables.", border_style="red"))
    console.print(render_ship(enemy, "Enemy"))
    console.print(render_ship(player, "Your Ship"))

    log: List[str] = []

    for turn in range(1, max_turns + 1):
        console.rule(f"Turn {turn}")
        # Show current state of enemy
        active_weapons = []
        for pos, c in enemy.cells.items():
            if c.type == CellType.COMPONENT and enemy.is_component_active(pos):
                k = (c.component_kind or "").lower()
                if "gun" in k or "laser" in k or "beam" in k or "scattergun" in k or "missile" in k or "flamer" in k:
                    active_weapons.append((pos, c.component_kind))
        shield_level = enemy.get_active_shield_count()
        player_shields = player.get_active_shield_count()
        wlist = ", ".join(f"{k}@{p}" for p,k in active_weapons[:3]) or "none"
        enemy_props = ", ".join(sorted(enemy.get_shield_properties())) or "none"
        player_props = ", ".join(sorted(player.get_shield_properties())) or "none"
        console.print(f"[dim]Enemy weapons: {wlist} | Shields: {shield_level} (props: {enemy_props}) | Your shields: {player_shields} (props: {player_props})[/dim]")

        dmg = choose_damage()

        # Shields are now model-driven via shield comps + Ion/EMP interactions (see DESIGN table)
        if shield_level > 0 and dmg not in (DamageType.ION, DamageType.EMP):
            console.print("[cyan]Shields up — some effects reduced or blocked (e.g. gas).[/cyan]")

        # Beam support (FTL line laser): if player has beam comps or just for fun, allow drawing a path
        use_beam = False
        has_beam = any((c.component_kind or "").lower() == "beam" and c.state == CellState.INTACT and player.is_component_active(p)
                       for p, c in player.cells.items())
        if has_beam or random.random() < 0.15:  # occasionally offer even without for testing
            bm = console.input("  Fire as BEAM (draw line between two points, hits everything in path) ? [y/N] ").lower().strip()
            use_beam = bm == "y"

        if use_beam:
            p1 = choose_target(enemy, prompt="Beam start cell (x,y or click-style): ")
            p2 = choose_target(enemy, prompt="Beam end cell: ")
            msgs = execute_player_attack(player, enemy, dmg, beam=(p1, p2))
            log.extend(msgs)
        else:
            target = choose_target(enemy)
            msgs = execute_player_attack(player, enemy, dmg, target=target)
            log.extend(msgs)

        # Allow multi-order turns for more depth (player can issue 1-2 before time advances)
        extra = console.input("  Issue another order this turn before resolve? [y/N] ").lower().strip()
        if extra == "y":
            dmg2 = choose_damage()
            # repeat beam choice logic for extra order (simplified)
            use_beam2 = False
            if any((c.component_kind or "").lower() == "beam" and c.state == CellState.INTACT and player.is_component_active(p)
                   for p, c in player.cells.items()):
                bm2 = console.input("    Extra as BEAM line? [y/N] ").lower().strip()
                use_beam2 = bm2 == "y"
            if use_beam2:
                bp1 = choose_target(enemy, prompt="Extra beam start: ")
                bp2 = choose_target(enemy, prompt="Extra beam end: ")
                msgs2 = execute_player_attack(player, enemy, dmg2, beam=(bp1, bp2))
            else:
                tgt2 = choose_target(enemy)
                msgs2 = execute_player_attack(player, enemy, dmg2, target=tgt2)
            log.extend(msgs2)
            for m in msgs2:
                console.print(f"  [green]{m}[/green]")

        # Resolve environmental + retaliation
        resolve_msgs = resolve_combat_turn(enemy, player)
        log.extend(resolve_msgs)

        console.print(render_ship(enemy, f"Enemy after turn {turn}"))
        console.print(render_ship(player, "Your Ship (after retaliation)"))

        for m in msgs + resolve_msgs:
            console.print(f"  [green]{m}[/green]")

        quality = enemy.get_capture_quality()
        states = enemy.count_states()
        net = enemy.get_network_integrity()
        shield_level = enemy.get_active_shield_count()
        player_shields = player.get_active_shield_count()
        enemy_props = ", ".join(sorted(enemy.get_shield_properties())) or "none"
        player_props = ", ".join(sorted(player.get_shield_properties())) or "none"
        console.print(f"[dim]Quality: {quality} | net {net:.0%} | states {states} | enemy shields={shield_level} (props:{enemy_props}) | your shields={player_shields} (props:{player_props})[/dim]")

        # Auto end conditions for better flow
        if quality == "shattered" or net < 0.2 or states["disabled"] + states["destroyed"] > len(enemy.cells) * 0.7:
            console.print("[bold red]Enemy combat ineffective — fight over.[/bold red]")
            break

        cont = console.input("\nContinue combat? [y/N] ").lower().strip()
        if cont != "y":
            break

    console.print("\n[bold]Combat log (last entries):[/bold]")
    for entry in log[-10:]:
        console.print(f"  • {entry}")
    return log


def post_combat_phase(player: Ship, enemy: Ship, res: Resources, auto_choice: Optional[str] = None,
                       sector_mult: float = 1.0, morale_mult: float = 1.0,
                       combat_log: list | None = None) -> Resources:
    """Present capture quality, multiple chunk options (or scrap-only), perform chosen graft if any,
    award differentiated loot, return updated resources.
    sector_mult and morale_mult scale the ratings awarded (from node + current crew morale).
    If auto_choice provided (e.g. "1" or "s"), use it instead of prompting (for --demo)."""
    console.rule("POST-COMBAT — Capture / Shatter Decision")
    quality = enemy.get_capture_quality()
    states = enemy.count_states()
    loot = enemy.compute_loot()
    console.print(f"Enemy ended as: [bold]{quality}[/bold]  {states}")
    console.print(f"Base loot from this fight: {render_resources(loot)}")

    # Game show Ratings (infamy/spectacle points) - the inhabitants back home watch the "entertainment".
    # More brutal/shatter-heavy = more points for boosting the home base between runs.
    # (Even if it gives you worse grafts in-run, the audience loves the carnage.)
    # sector_mult (from node) and morale_mult (from crew "lame" factor on backtracks) are applied here.
    cl = combat_log or []
    base_ratings = enemy.calculate_ratings(quality, cl)
    effective = max(0, int(base_ratings * max(0.1, sector_mult) * max(0.1, morale_mult)))
    res.ratings += effective
    mult_note = ""
    if sector_mult != 1.0 or morale_mult != 1.0:
        mult_note = f" (x{sector_mult:.2f} sector"
        if morale_mult != 1.0:
            mult_note += f", x{morale_mult:.2f} morale"
        mult_note += ")"
    # Graft diversity: the pieces you brought *into* this fight (not the ones you are choosing now) pump or penalize the payout
    cl = combat_log or []
    res, graft_logs = apply_player_graft_bonuses(player, res, cl)
    for gl in graft_logs:
        console.print(f"[cyan]{gl}[/cyan]")
        log.append(gl)
    if quality == "shattered":
        console.print(f"[bold red]THE AUDIENCE IS GOING WILD! +{effective} RATINGS for the total overkill and destruction.{mult_note}[/bold red]")
    elif quality == "messy":
        console.print(f"[red]Solid carnage. +{effective} RATINGS. The producers are pleased.{mult_note}[/red]")
    else:
        console.print(f"[dim]+{effective} RATINGS. A bit surgical for the bloodthirsty crowd, but still entertaining.{mult_note}[/dim]")

    # Monster tone / narrative flavor (rim predator aesthetic)
    if quality == "clean_capture":
        console.print("[italic]The hulk's corridors fall silent. You feel their terror as the claw seals... feast for the vats.[/italic]")
    elif quality == "shattered":
        console.print("[italic red]Overkill. The wreck is slag and screams. Good for scrap, thin for meat.[/italic red]")
    else:
        console.print("[italic dim]Mixed. Some will live to regret meeting your franken ship. Most won't.[/italic dim]")

    options: List[Chunk] = enemy.generate_salvage_options(max_options=5)
    console.print(f"\n[bold]Salvage options ({len(options)} chunks extracted from hulk):[/bold]")
    console.print("[dim](Only surviving (non-destroyed) cells from each section are offered. If you broke the hull or a component during combat, those slots are lost — you get no additional space and don't receive the broken components when grafting.)[/dim]")
    for i, ch in enumerate(options, 1):
        ch_states = {"intact":0,"disabled":0}
        for c in ch.cells.values():
            if c.state == CellState.INTACT: ch_states["intact"] += 1
            elif c.state == CellState.DISABLED: ch_states["disabled"] += 1
        console.print(f"  [cyan]{i}[/cyan]. {ch.name} ({len(ch.cells)} cells) states {ch_states}")

    console.print("\n[bold]Choose:[/bold]")
    for i in range(1, len(options)+1):
        console.print(f"  {i}. Graft option {i} (adds the surviving parts of that section — broken hull/components are already lost)")
    console.print("  s. Forfeit grafting — claim the scrap (no new ship parts)")

    while True:
        if auto_choice is not None:
            choice = auto_choice.strip().lower()
            console.print(f"[dim](auto) {choice}[/dim]")
        else:
            choice = console.input("Choice (1-{}, s): ".format(len(options))).strip().lower()
        if choice == "s":
            # Shatter/scrap route: award loot (high scrap if shattered)
            extra = Resources(loot.scrap // 2, 0, 0) if quality == "shattered" else Resources(0, 0, 0)
            res += (loot + extra)
            console.print(f"[yellow]You claimed the scrap route. +{extra.scrap} bonus scrap. No graft.[/yellow]")
            break
        if choice.isdigit():
            idx = int(choice) - 1
            if 0 <= idx < len(options):
                chosen = options[idx]
                console.print(f"Attempting to graft {chosen.name}...")
                if auto_choice is None:
                    use_manual = console.input("  Manual placement (m) or smart auto-attach (a)? ").strip().lower() == "m"
                else:
                    use_manual = False
                if use_manual:
                    cands = player.get_valid_attach_positions(chosen)
                    if not cands:
                        console.print("[yellow]No good manual positions; falling back to auto.[/yellow]")
                        ok, glogs = player.try_auto_graft(chosen)
                    else:
                        console.print("Possible attachments (port-matched docks on your ship):")
                        for ii, (apos, cport, v) in enumerate(cands[:5], 1):
                            print(f"  {ii}. ship@{apos} using chunk port {cport} (rot {v})")
                        sel = console.input("Choose attach # (or 0 for auto): ").strip()
                        try:
                            si = int(sel)
                            if si == 0 or si > len(cands):
                                ok, glogs = player.try_auto_graft(chosen)
                            else:
                                apos, cport, v = cands[si-1]
                                ok, glogs = player.graft_chunk(v, attach_at=apos, chunk_port=cport)
                        except:
                            ok, glogs = player.try_auto_graft(chosen)
                else:
                    ok, glogs = player.try_auto_graft(chosen)
                if ok:
                    for l in glogs:
                        console.print(f"  [green]{l}[/green]")
                else:
                    for l in glogs:
                        console.print(f"  [yellow]{l}[/yellow]")
                # Still award the combat loot (capture attempt happened)
                res += loot
                break
        console.print("[red]Invalid choice[/red]")
        if auto_choice is not None:
            # Fallback in auto: pick first option
            choice = "1"
            continue

    console.print(f"\nResources now: {render_resources(res)}")
    console.print(render_ship(player, "Your Ship after post-combat"))
    return res


def _add_run_upgrade(player: Ship, comp_kind: Optional[str] = None, art_kind: Optional[str] = None) -> bool:
    """Attempt to attach a run-only morale upgrade cell adjacent to an intact corridor.
    Used for the in-run upgrade tree (lasts only this playthrough).
    """
    if not player.cells:
        return False
    active = player.get_active_corridors()
    if not active:
        active = {p for p, c in player.cells.items() if c.type == CellType.CORRIDOR and c.state == CellState.INTACT}
    if not active:
        return False
    for base in sorted(active):
        for dx, dy in [(1,0), (-1,0), (0,1), (0,-1)]:
            pos = (base[0] + dx, base[1] + dy)
            if pos not in player.cells:
                if comp_kind:
                    player.add_cell(pos, Cell(CellType.COMPONENT, component_kind=comp_kind))
                elif art_kind:
                    player.add_cell(pos, Cell(CellType.ARTIFACT, artifact_kind=art_kind))
                return True
    # fallback: any adjacent free spot
    xs = [p[0] for p in player.cells]
    ys = [p[1] for p in player.cells]
    for xx in range(min(xs)-1, max(xs)+2):
        for yy in range(min(ys)-1, max(ys)+2):
            pos = (xx, yy)
            if pos not in player.cells:
                if comp_kind:
                    player.add_cell(pos, Cell(CellType.COMPONENT, component_kind=comp_kind))
                elif art_kind:
                    player.add_cell(pos, Cell(CellType.ARTIFACT, artifact_kind=art_kind))
                return True
    return False


def do_hub(player: Ship, res: Resources, morale: int, run_upgrades: set[str]) -> tuple[Resources, int]:
    """Basic hub / graftyard between fights in a run.
    Includes repair with scrap, feast processing (meta), and the run-only morale upgrade TREE.
    Upgrades last only this run (add temp cells to player ship or bonuses).
    Morale gained from live captures (disabling), lost on map backtracks.
    """
    console.rule("HUB — Graftyard & Resources")
    console.print(f"Current: {render_resources(res)}  |  Ship cells: {len(player.cells)}  integrity: {player.get_network_integrity():.0%}  |  Morale: {morale} | Backtrack cost: {run_backtrack_cost}")
    if run_upgrades:
        console.print("[dim]Active run-only upgrades: " + ", ".join(sorted(run_upgrades)) + "[/dim]")

    while True:
        console.print("\n[bold]Hub options:[/bold]")
        console.print("  1. View current ship")
        states = player.count_states()
        disabled = states["disabled"]
        repair_cost = disabled * 2
        can_repair = res.scrap >= repair_cost and disabled > 0
        console.print(f"  2. Repair all disabled ({disabled}) — costs {repair_cost} scrap" + (" [dim](affordable)[/dim]" if can_repair else " [red](need more scrap)[/red]"))
        can_feast = res.feast >= 8
        console.print(f"  3. Feast on captives (spend 8 feast for +6 scrap 'biomass processing') " + ("[dim](available)[/dim]" if can_feast else "[red](need more feast)[/red]"))
        console.print("  4. Research (spend 15 feast to 'unlock' shield_bay template for future grafts +5 scrap now)")
        console.print("  5. Launch to next fight")
        console.print("  6. (debug) Add test scrap/feast")

        # --- Run-only morale upgrade tree (lasts this run only) ---
        # Now uses shared defs from hub_progression for parity with graphical.
        avail_up = get_available_run_morale_upgrades(run_upgrades, morale)
        if avail_up:
            console.print("[bold magenta]Run-Only Morale Upgrade Tree (this run only; prereqs apply):[/bold magenta]")
            table = Table(title="Available Run-Only Upgrades")
            table.add_column("Code", style="cyan", justify="center")
            table.add_column("Effect", style="white")
            table.add_column("Cost", style="magenta", justify="right")
            table.add_column("Prereq", style="dim")
            for u in avail_up:
                prereq_str = get_run_upgrade_prereq_str(u)
                table.add_row(u.code, u.desc, str(u.cost), prereq_str)
            console.print(table)
            uchoice = console.input("Purchase upgrade code (or none)? ").strip().upper()
            for u in avail_up:
                if uchoice == u.code:
                    morale -= u.cost
                    run_upgrades.add(u.key)
                    if u.key == "pathfinder":
                        run_backtrack_cost = max(5, run_backtrack_cost - 5)
                        console.print(f"[green]Backtrack cost reduced to {run_backtrack_cost} for run[/green]")
                    elif u.key == "crowd":
                        run_ratings_mult += 0.2
                        console.print("[green]+0.2 ratings_mult for rest of run (crowd loves it)[/green]")
                    elif u.key == "guru":
                        run_morale_gain_mult += 0.2
                        console.print("[green]Future morale gains +20% for run[/green]")
                    if u.comp_kind or u.art_kind:
                        if _add_run_upgrade(player, u.comp_kind, u.art_kind):
                            console.print(f"[green]Upgrade installed: {u.desc}[/green]")
                            console.print(render_ship(player, "Ship after run-only upgrade"))
                        else:
                            console.print("[yellow]No attach spot found (morale still spent).[/yellow]")
                    else:
                        if u.key not in ("pathfinder", "crowd", "guru"):
                            console.print(f"[green]Upgrade trained: {u.desc} (will boost future morale gains)[/green]")
                    break

        choice = console.input("Choice: ").strip()

        if choice == "1":
            console.print(render_ship(player, "Your Ship"))
        elif choice == "2":
            if disabled == 0:
                console.print("[dim]Nothing to repair.[/dim]")
            elif not can_repair:
                console.print(f"[red]Not enough scrap. Have {res.scrap}, need {repair_cost}.[/red]")
            else:
                repaired, cost = player.repair_all_disabled(cost_per=2)
                res.scrap -= cost
                console.print(f"[green]Repaired {repaired} cells for {cost} scrap.[/green]  Now: {render_resources(res)}")
                console.print(render_ship(player, "Ship after repairs"))
        elif choice == "3":
            if not can_feast:
                console.print("[red]Not enough feast.[/red]")
            else:
                res.feast -= 8
                res.scrap += 6
                console.print("[magenta]You processed the captives through the vats. +6 scrap, -8 feast.[/magenta]")
                console.print(f"Now: {render_resources(res)}")
        elif choice == "4":
            if res.feast < 15:
                console.print("[red]Need 15 feast for research.[/red]")
            else:
                res.feast -= 15
                res.scrap += 5
                console.print("[cyan]Research complete: shield_bay template 'unlocked' for future grafts (simulated). +5 scrap bonus.[/cyan]")
                console.print(f"Now: {render_resources(res)}")
        elif choice == "5":
            console.print("[cyan]Launching...[/cyan]")
            break
        elif choice == "6":
            res.scrap += 10
            res.feast += 3
            console.print(f"Debug added. Now {render_resources(res)}")
        else:
            console.print("[red]Invalid[/red]")
    return res, morale


def run_scripted_demo():
    """Non-interactive 3-fight 'run' demo exercising economy, named chunks, connectivity grafts,
    volatile artifacts, retaliation in combat sim, hub meta spends, and a run summary.
    This is the closest the terminal prototype gets to a testable roguelite loop."""
    console.rule("[bold cyan]SPACE DERELICT — scripted 3-fight RUN demo[/bold cyan]")
    player = make_starter_player_ship("basic")
    res = Resources(scrap=3, feast=0, ratings=0)  # tiny starting biomass
    run_log = []
    console.print(render_ship(player, "Starting Derelict"))
    console.print(f"Resources: {render_resources(res)}  (run start)")

    # Scripted demo now uses branching generator + shows morale/backtrack flavor (even if traversal is mostly linear for stability)
    unlocks = set()
    sector_nodes, _ = generate_branching_sector(num_encounters=3, unlocks=unlocks, seed=42, genocide_target=None)
    demo_morale = 68
    demo_upgrades: set[str] = set()  # run-only for demo sim
    for fight_num in range(1, 4):
        node = sector_nodes[min(fight_num-1, len(sector_nodes)-1)]
        console.rule(f"ENCOUNTER {fight_num} / {node.name}  [Faction: {node.enemy_faction}]")
        console.print(f"[dim]{node.description} | Risk: {node.risk_notes}[/dim]")
        if fight_num == 2:
            demo_morale -= 22  # simulate one backtrack for demo
            console.print(f"[yellow](Demo backtrack) Cost 22 morale for repositioning to missed branch. Clones: 'lame... we're supposed to be pushing forward.'[/yellow]")
        console.print(f"[cyan]Demo crew morale: {demo_morale}  ({'hyped' if demo_morale > 50 else 'lame energy'})[/cyan]")

        enemy = get_node_enemy(node, fight_num, unlocks)
        for _ in range(max(0, node.difficulty - 1)):
            poss = list(enemy.cells.keys())
            if poss:
                enemy.apply_damage(DamageType.KINETIC, random.choice(poss))
        console.print(render_ship(enemy, f"Enemy {fight_num} [{node.enemy_faction}]"))
        # Scripted combat actions (mix of capture and risky plays)
        if fight_num == 1:
            seq = [(DamageType.ION, (1,0)), (DamageType.EMP, (0,0)), (DamageType.NERVE_GAS, (2,0)), (DamageType.KINETIC, (3,0))]
            auto_post = "1"  # take the gun_pod
        elif fight_num == 2:
            seq = [(DamageType.EMP, (0,0)), (DamageType.BREACH, (0,1)), (DamageType.FIRE, (1,1))]  # risk the volatile bay
            auto_post = "2"  # deliberately take mid_armor or whatever order
        else:
            seq = [(DamageType.KINETIC, (0,0)), (DamageType.BREACH, (3,0)), (DamageType.FIRE, (1,0))]  # shatter for scrap
            auto_post = "s"

        for dmg, tgt in seq:
            if tgt in enemy.cells:
                m = enemy.apply_damage(dmg, tgt)
                console.print(f"[dim]  {dmg.name}@{tgt}: {m}[/dim]")

        console.print(render_ship(enemy, f"After orders on {fight_num}"))
        q = enemy.get_capture_quality()
        console.print(f"Quality: {q}  loot: {render_resources(enemy.compute_loot())}")

        # Post + award
        res = post_combat_phase(player, enemy, res, auto_choice=auto_post, combat_log=[])  # scripted has no full combat log list here

        # Accumulate demo_morale from live captures (disabling)
        q = enemy.get_capture_quality()
        st = enemy.count_states()
        cg = st["disabled"] * 2 + (8 if q == "clean_capture" else 4 if q == "decent" else 0)
        if "cap_kit" in demo_upgrades:
            cg += 5
        if cg > 0:
            demo_morale = min(150, demo_morale + cg)
            print(f"  +{cg} morale from disabling/capturing crew alive.")

        # Check death
        if player.get_network_integrity() < 0.15 or (0,0) not in player.get_active_corridors():
            console.print("[bold red]CORE OFFLINE — your derelict is lost.[/bold red]")
            tube_text = get_tube_reveal_text(
                season=1,  # demo
                run_ratings=res.ratings,
                fights_completed=fight_num,
                total_career_ratings=0,
                brutality=0,
                deaths_this_career=0,
            )
            console.print(Panel(f"[italic]{tube_text}[/italic]", title="TUBE REVEAL", border_style="red"))
            run_log.append(f"Fight {fight_num}: DEATH (network collapsed) - tube reveal triggered")
            break

        # Hub (scripted choices)
        console.print("\n[dim](Hub actions: repair if possible + optional feast->scrap conversion)[/dim]")
        dst = player.count_states()["disabled"]
        rc = dst * 2
        if dst > 0 and res.scrap >= rc:
            rpd, cst = player.repair_all_disabled()
            res.scrap -= cst
            console.print(f"  Repaired {rpd} for {cst} scrap.")
        if res.feast >= 8:
            res.feast -= 8
            res.scrap += 6
            console.print("[magenta]  The vats churn. You process the last of the captives into useful biomass. +6 scrap. (They are you, now.)[/magenta]")
        if res.feast >= 15 and fight_num == 2:  # demo one research
            res.feast -= 15
            res.scrap += 5
            console.print("[cyan]  Research: shield_bay 'unlocked' for future (sim). +5 scrap.[/cyan]")
        # demo morale tree spend (run only)
        if demo_morale >= 15 and "med" not in demo_upgrades:
            demo_morale -= 15
            demo_upgrades.add("med")
            mx = max([p[0] for p in player.cells] or [0])
            player.add_cell((mx + 1, 0), Cell(CellType.COMPONENT, component_kind="medical"))
            print("  (demo) Spent 15 morale on temp medical bay (self-repair this run).")
        if demo_morale >= 12 and "sh" not in demo_upgrades:
            demo_morale -= 12
            demo_upgrades.add("sh")
            mx = max([p[0] for p in player.cells] or [0])
            player.add_cell((mx + 2, 0), Cell(CellType.COMPONENT, component_kind="shield"))
            print("  (demo) Spent 12 morale on temp shield (run only).")
        console.print(f"  Post-hub: {render_resources(res)}  ship cells={len(player.cells)} int={player.get_network_integrity():.0%} morale={demo_morale}")
        run_log.append(f"Fight {fight_num}: +loot, graft or scrap, hubbed -> {res.scrap}s/{res.feast}f , size {len(player.cells)}")

    console.rule("RUN COMPLETE")
    console.print(render_ship(player, "Final Ship"))
    console.print(f"Final resources: {render_resources(res)}")
    for entry in run_log:
        console.print(f"  • {entry}")
    console.print(
        "\n[bold]This run demonstrated:[/bold] named chunk choices (gun/armor/volatile), corridor-extending grafts, "
        "volatile risk, retaliation/fire in combat, hub meta spend (feast for scrap), resource growth, and death check.\n"
        "Ratings earned this run (for home base): " + str(res.ratings) + " (more brutal = more points for city upgrades between playthroughs)."
    )

    # Quick simulated "city" between seasons for the demo
    if res.ratings >= 25:
        print("\n[CITY SIM] Spent some Ratings on Vat upgrade and hype for the next playthrough (meta boost between runs).")
        print("The game show meta is fully live: brutality feeds the home base.")
    if res.ratings >= 40:
        print("[CITY SIM] Also unlocked some Feast Tree tiers from accumulated feast - better starts next season.")

    console.print("[dim]Sector map now has real nodes (including Techopuritan crusade zones to avoid or risk for high ratings). Different nodes change enemy difficulty and entertainment value. City has Ratings spends + Feast Tree with actual gameplay effects. Save/load + 'Retire' for persistent career summary across sessions.[/dim]")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--demo", action="store_true", help="Run non-interactive scripted loop (for testing/harness)")
    args = parser.parse_args()

    if args.demo:
        run_scripted_demo()
        return

    # Interactive path: persistent home base (Graftyard City) for boosting between full playthroughs using Ratings.
    # Ratings are earned primarily through brutality (shatter, Fire/Breach spam, triggering explosions, high destroyed counts).
    # The more the audience (the inhabitants watching the "game show") loves the carnage, the more points for home base upgrades.
    # This makes brutal play rewarding for long-term power even if it gives crappy in-run grafts.
    console.clear()
    console.rule("[bold cyan]SPACE DERELICT[/bold cyan] — prototype")
    console.print(
        "Roguelite FTL + Space Hulk grafting. Corridor networks, damage types that matter, capture vs shatter economy.\n"
        "The home base is now a full persistent city hub. Earn Ratings from brutal, spectacular runs to upgrade between playthroughs.\n"
        "Tip: run with --demo for a non-interactive full loop."
    )

    # Persistent meta across playthroughs - now loaded from disk for real career persistence
    persistent, unlocks, career = load_meta()

    def play_one_full_run(bonus_scrap: int = 0, bonus_feast: int = 0, current_unlocks: set[str] | None = None, genocide_target: str | None = None) -> Resources:
        """One full multi-encounter run. Returns the res with .ratings earned during it (brutality points)."""
        nonlocal unlocks
        if current_unlocks is None:
            current_unlocks = set()
        # Core meta: starting frame chosen at the city (different vat bodies)
        starting_frame = "basic"
        if isinstance(current_unlocks, dict) and "starting_frame" in current_unlocks:
            starting_frame = current_unlocks["starting_frame"]
        elif isinstance(current_unlocks, (set, list)) and "starting_frame" in current_unlocks:
            starting_frame = "predator"  # legacy support
        player = make_starter_player_ship(starting_frame)
        if "feast_tree_2" in current_unlocks:
            # better clone: extra corridor and component
            player.add_cell((2, 0), Cell(CellType.CORRIDOR))
            player.add_cell((3, 0), Cell(CellType.COMPONENT, component_kind="gun"))
        if "feast_tree_3" in current_unlocks:
            player.add_cell((0, -2), Cell(CellType.ARTIFACT, artifact_kind="feast_chamber"))
        if "starting_laser_pod" in current_unlocks:
            player.add_cell((4, 0), Cell(CellType.COMPONENT, component_kind="laser"))
        # Market purchases from Graft Market (scrap trades for specific components/artifacts) now carry to the run
        market_addons = current_unlocks.get("market_addons", []) if isinstance(current_unlocks, dict) else []
        for addon in market_addons:
            xs = [p[0] for p in player.cells] or [0]
            bx = max(xs) + 2
            player.add_cell((bx, 0), Cell(CellType.CORRIDOR))
            if addon.get("type") == "component":
                player.add_cell((bx + 1, 0), Cell(CellType.COMPONENT, component_kind=addon.get("kind")))
            elif addon.get("type") == "artifact":
                player.add_cell((bx + 1, 0), Cell(CellType.ARTIFACT, artifact_kind=addon.get("kind")))
            console.print(f"[MARKET] Fitted purchased {addon.get('kind')} from the Graft Market stock.")
        res = Resources(scrap=2 + bonus_scrap, feast=0 + bonus_feast, ratings=0)

        # End game tie-in: genocide veteran bonus (from previous completed extinctions)
        veteran = current_unlocks.get("genocide_veteran", 0) if isinstance(current_unlocks, dict) else 0
        if veteran > 0:
            bonus = 25 * veteran
            res.ratings += bonus
            console.print(f"[LAUNCH] Genocide Veteran bonus: +{bonus} starting Ratings from past purges. The audience expects more.")
        run_log = []
        console.print(render_ship(player, "Your starting Derelict (with home base bonuses)"))
        console.print(f"Run resources: {render_resources(res)}")
        if "vat_v2" in current_unlocks:
            console.print("[dim]Vat v2 active: free repairs applied at run start (simulated in city bonuses).[/dim]")
        if "feast_tree_3" in current_unlocks:
            console.print("[dim]Advanced Vat: extra starting artifact chamber for feast synergy.[/dim]")

        # Branching FTL-style star map (real forks, no chasing patrol meter from behind).
        # Moral points (morale) accumulated via capturing enemy crew alive (by disabling the ship -> high disabled count in post).
        # Lose morale on backwards map moves (choice code deducts run_backtrack_cost).
        # Spend in do_hub on the run-only upgrade TREE (lasts this run only; prereqs, adds temp cells like medical/shield/nanite/booster or bonuses).
        # Low morale -> morale_mult penalty to ratings (lame backtrack energy for audience).
        # Base start boosted by city unlocks; main gains from in-run captures (not the meta feast).
        num_fights = 3 + (1 if "district_entertainment" in current_unlocks or "extended_contract" in current_unlocks else 0)
        sector_nodes, connections = generate_branching_sector(num_encounters=num_fights, unlocks=current_unlocks, genocide_target=genocide_target)
        current = 0
        visited: set[int] = set()
        fights_done = 0
        # Morale starts decent; city feast tree / vat can boost it (simulated here via unlocks)
        morale = 65
        if "feast_tree_2" in current_unlocks:
            morale += 15
        if "feast_tree_3" in current_unlocks:
            morale += 15
        if "vat_v2" in current_unlocks:
            morale += 10
        run_backtrack_cost = 25
        run_upgrades: set[str] = set()  # run-only morale tree (upgrades last only this run; purchased in do_hub)
        run_backtrack_cost = 25
        run_morale_gain_mult = 1.0
        run_ratings_mult = 0.0

        def _morale_status(m: int) -> str:
            if m >= 90:
                return "Crew morale is sky high — clones are hyped for the show."
            elif m >= 60:
                return "Clones are into it (standard game-mode energy)."
            elif m >= 35:
                return "Clones are starting to call this run 'mid'."
            else:
                return "Low morale — clones think all the backtracking is lame and are phoning it in."

        while fights_done < num_fights:
            node = sector_nodes[current]
            is_new = current not in visited

            if is_new:
                console.rule(f"ENCOUNTER {fights_done + 1} / SECTOR: {node.name}  [Faction: {node.enemy_faction}]")
                console.print(f"[dim]{node.description}[/dim]")
                if node.risk_notes:
                    console.print(f"[yellow]Risk: {node.risk_notes}[/yellow]")
                console.print(f"[cyan]Crew Morale: {morale} — {_morale_status(morale)}[/cyan]")

                # Pre-damage based on node (kept)
                enemy = get_node_enemy(node, fights_done + 1, current_unlocks)
                if node.difficulty > 1:
                    poss = list(enemy.cells.keys())
                    for _ in range(max(0, node.difficulty - 1)):
                        if poss:
                            enemy.apply_damage(DamageType.KINETIC, random.choice(poss))

                console.print(render_ship(enemy, f"Enemy Contact - {node.name} [{node.enemy_faction}]"))
                combat_log_this_fight = simple_combat_demo(player, enemy, max_turns=5 + node.difficulty)

                # Snapshot feast before so we can feed morale from "eating captives"
                feast_before = res.feast
                # Compute morale factor for this fight (low morale = lame backtrack energy = less ratings)
                morale_factor = 1.0
                if morale < 30:
                    morale_factor = 0.55
                elif morale < 55:
                    morale_factor = 0.8
                elif morale < 75:
                    morale_factor = 0.92

                sector_m = node.ratings_mult + run_ratings_mult
                res = post_combat_phase(player, enemy, res, sector_mult=sector_m, morale_mult=morale_factor, combat_log=combat_log_this_fight)

                # Random faction stop event (en route)
                if random.random() < 0.28:
                    fac = node.enemy_faction
                    ctx = {
                        "faction": fac,
                        "difficulty": node.difficulty,
                        "location": "run",
                        "aggression_level": get_faction_aggression(career, fac),
                        "genocide_target": genocide_target,
                    }
                    ev = roll_random_event(ctx)
                    console.rule(f"EN ROUTE — {ev['title']}")
                    console.print(ev['desc'])
                    for i, o in enumerate(ev.get("options", []), 1):
                        print(f"  {i}. {o['text']}")
                    num_opts = len(ev.get("options", []))
                    ch = console.input(f"Choice (1-{num_opts}): ").strip()
                    try:
                        idx = int(ch) - 1
                        opt = ev["options"][max(0, min(idx, num_opts-1))]
                    except:
                        opt = ev["options"][0]
                    eff = opt.get("effect", {})
                    if eff.get("type") == "positive":
                        if "scrap" in eff: res.scrap += eff["scrap"]
                        if "feast" in eff: res.feast += eff["feast"]
                        if "morale" in eff: morale = min(200, morale + eff.get("morale", 0))
                        print("[green]You took the deal.[/green]")
                    elif eff.get("type") == "betray":
                        if "ratings" in eff:
                            res.ratings += eff["ratings"]
                            print(f"[red]Home base loved it. +{eff['ratings']} RATINGS[/red]")
                        if "morale_penalty" in eff:
                            morale = max(0, morale + eff["morale_penalty"])
                            print(f"[yellow]Morale hit: {eff['morale_penalty']}[/yellow]")
                        if eff.get("backfire"):
                            morale = max(0, morale + eff.get("morale_penalty", -15))
                            print(ev.get("desc", "They turned it around."))
                            if "dark_fact" in ev:
                                print("[dim]" + ev.get("dark_fact", "") + "[/dim]")
                        print("[red]You chose cruelty for the show.[/red]")
                    elif eff.get("type") == "risky":
                        print("[yellow]You took a risky path.[/yellow]")
                    else:
                        print("You moved on.")
                    if "cruel_note" in eff:
                        print(f"[italic]{eff['cruel_note']}[/italic]")

                    # Apply aggression gain for betrayals (core of the new home rep / genocide system)
                    if eff.get("type") == "betray" and ev.get("faction") in ["felonia", "confederacy", "pop_fiz", "techopuritan"]:
                        fac = ev.get("faction")
                        newl = gain_faction_aggression(career, fac, 1)
                        print(f"[HOME REP] Aggression with {fac} now {newl}/5.")
                        if newl >= 5:
                            print(f"[HOME] MAX with {fac}! Declare genocide focus on next city visit for special run.")

                # Accumulate morale via capturing enemy crew alive (disabling the ship, not shattering).
                # (Feast from intact is still for meta city tree; morale is run-only for upgrades + backtrack/lame.)
                feast_gained = res.feast - feast_before
                if feast_gained > 0:
                    console.print(f"[dim]+{feast_gained} feast from intact sections (meta for city).[/dim]")
                q = enemy.get_capture_quality()
                st = enemy.count_states()
                base_cap = st["disabled"] * 2
                if q == "clean_capture":
                    base_cap += 8
                elif q == "decent":
                    base_cap += 4
                cap_gain = int(base_cap * run_morale_gain_mult)
                if "cap_kit" in run_upgrades:
                    cap_gain += 5
                    console.print("[dim](+5 from cap kit upgrade)[/dim]")
                if cap_gain > 0:
                    morale = min(200, morale + cap_gain)
                    console.print(f"[magenta]+{cap_gain} morale from capturing {st['disabled']} crew alive (disabling ship).[/magenta]")

                visited.add(current)
                fights_done += 1

                if player.get_network_integrity() < 0.15 or (0,0) not in player.get_active_corridors():
                    console.print("[bold red]CORE OFFLINE — your derelict is lost.[/bold red]")
                    tube_text = get_tube_reveal_text(
                        season=season,
                        run_ratings=res.ratings,
                        fights_completed=fights_done,
                        total_career_ratings=career.get("total_ratings_earned", 0),
                        brutality=0,
                        deaths_this_career=career.get("deaths", 0),
                    )
                    console.print(Panel(f"[italic]{tube_text}[/italic]", title="TUBE REVEAL", border_style="red"))
                    run_log.append(f"Fight {fights_done}: DIED (core lost) - tube reveal")
                    # increment deaths for future variations
                    if not isinstance(career, dict):
                        career = {}
                    career["deaths"] = career.get("deaths", 0) + 1
                    break

                res, morale = do_hub(player, res, morale, run_upgrades)
                run_log.append(f"Fight {fights_done}: survived @ node {current} ({node.name}), res={res.scrap}s/{res.feast}f, morale={morale}, size={len(player.cells)}")
            else:
                # Repositioning to already-visited node (no new fight)
                console.print(f"[dim]Repositioned to {node.name} (already cleared). Morale: {morale}.[/dim]")

            if fights_done >= num_fights:
                break

            # === Map choice / movement ===
            # From current: direct forward children (new ones are free advances)
            # Plus backtrack/reposition options to any visited fork that still has untaken branches (costs morale)
            console.print(f"[bold]Map position: {node.name} (node {current}) [Faction: {node.enemy_faction}]  |  Morale {morale} — {_morale_status(morale)} | Backtrack cost: {run_backtrack_cost}[/bold]")
            # Tiny viz of the map state (visited vs not)
            viz = []
            for i, n in enumerate(sector_nodes):
                sym = "▶" if i == current else ("✓" if i in visited else "○")
                viz.append(f"{sym}{i}")
            console.print("[dim]Map: " + "—".join(viz) + "  (▶=you, ✓=done, ○=unvisited)[/dim]")

            options: list[tuple[str, int, int, str]] = []  # (label, target_idx, cost, desc)
            opt_num = 1

            # Direct from current (natural forward / local moves)
            for neigh in connections.get(current, []):
                cost = 0 if neigh not in visited else run_backtrack_cost
                nnode = sector_nodes[neigh]
                label = f"{opt_num}. {'Advance to' if neigh not in visited else 'Revisit'} {nnode.name}"
                desc = f"diff {nnode.difficulty}  x{nnode.ratings_mult} ratings"
                if cost > 0:
                    desc += f"  (costs {cost} morale — clones will think this is lame)"
                options.append((label, neigh, cost, desc))
                opt_num += 1

            # Backtrack / reposition to any visited node that still has unexplored outgoing branches
            # This is the key "choice around moving back"
            back_forks: list[tuple[int, int]] = []
            for v in sorted(visited):
                for child in connections.get(v, []):
                    if child not in visited:
                        back_forks.append((v, child))
                        break  # one representative per fork point is enough
            if back_forks:
                console.print("[bold yellow]Backtrack options (pay morale to reach a missed branch — clones hate this):[/bold yellow]")
                for vidx, child in back_forks:
                    vname = sector_nodes[vidx].name
                    cname = sector_nodes[child].name
                    label = f"{opt_num}. Back to {vname} (to take branch toward {cname})"
                    desc = f"costs {run_backtrack_cost} morale (lame factor for future ratings)"
                    options.append((label, vidx, run_backtrack_cost, desc))
                    opt_num += 1

            if not options:
                # No moves left — force end even if under target (rare)
                break

            for label, _, _, desc in options:
                print(f"  {label}  —  {desc}")

            choice = console.input("Choose: ").strip()
            try:
                cidx = int(choice) - 1
                if 0 <= cidx < len(options):
                    _, target, cost, _ = options[cidx]
                    if cost > 0:
                        morale = max(0, morale - cost)
                        console.print(f"[yellow]Backtracking/repositioning costs {cost} morale. Clones: 'Dude... that's so lame. We're supposed to push the frontier.'[/yellow]")
                        # Track for contract eval parity (GUI path is primary for full contracts)
                        if 'season_stats' not in locals() or season_stats is None:
                            season_stats = {"backtracks": 0}
                        season_stats["backtracks"] = season_stats.get("backtracks", 0) + 1
                    current = target
                else:
                    # default: take first (usually safest forward)
                    current = options[0][1]
            except Exception:
                current = options[0][1]

        console.rule("RUN COMPLETE - Back at the Graftyard")
        console.print(render_ship(player, "Your Ship after the run"))
        console.print(f"Run final: {render_resources(res)}")
        console.print(f"Final crew morale: {morale}")
        console.print(f"Run-only upgrades this run: {sorted(run_upgrades) or 'none'}")
        for entry in run_log:
            console.print(f"  • {entry}")
        console.print("[dim]Branching sector navigated. Morale from live captures (disable=crew alive); spend on run-only tree in hub (temp upgrades last this run only); lose on backtracks; low morale = ratings penalty.[/dim]")
        # Sector consequence: surviving Techopuritan gives permanent unlock for better future tech
        if not any("DIED" in entry for entry in run_log) and any("Techopuritan" in entry for entry in run_log):
            if "tech_survivor" not in unlocks:
                unlocks.add("tech_survivor")
                console.print("[cyan]Surviving the Crusade Zone unlocked 'Tech Hunter' status: future Tech encounters yield exotic artifacts more often.[/cyan]")
        return res

    season_contracts: list = []  # Contracts accepted at the home base stage for the upcoming season (drives meta + story drip via horrific televised acts)
    genocide_target: str | None = None  # Set when player has max aggression with 1+ factions and declares at city start (Contracts/Plaza). Makes that race the "last one" this run with special events, bias, and victory bonus.

    while True:
        console.rule("[bold cyan]GRAFTYARD CITY - HOME BASE (boost between playthroughs)[/bold cyan]")
        console.print("The inhabitants watch every run like a brutal game show. The more savage and spectacular you are,")
        console.print("the higher your Ratings — which you spend here to make your operation stronger for the next season.")
        console.print("[dim]Runs use branching star map. Moral points (morale) from live captures (disable for crew alive); spend on run-only upgrade tree in hub (lasts this run); lose on backtracks; low morale penalizes ratings (lame).[/dim]")
        console.print(f"Current standing: {render_resources(persistent)}")
        console.print(f"Unlocked upgrades: {sorted(unlocks) if unlocks else '(basic operation)'}")
        # Fleshed "view bonuses" summary (always visible in city for clarity)
        try:
            from space_derelict.hub_progression import calculate_launch_bonuses
            bons = calculate_launch_bonuses(unlocks if isinstance(unlocks, (set, dict)) else set())
            if bons:
                bstr = ", ".join(f"{k}={v}" for k, v in sorted(bons.items()) if not k.startswith("entertainment"))
                console.print(f"[dim]Active launch bonuses: {bstr or 'none yet'}[/dim]")
        except Exception:
            pass
        if 'season_contracts' not in locals() or not season_contracts:
            season_contracts = []  # contracts picked at the stage for this upcoming season (televised horrors)
        if 'genocide_target' not in locals():
            genocide_target = None
        if 'market_addons' not in locals():
            market_addons = []  # bought from Graft Market stock with scrap; applied on launch/play

        # Core meta: current chosen starting frame (chosen at front of run in city)
        current_f = "basic"
        if isinstance(unlocks, dict):
            current_f = unlocks.get("chosen_frame", unlocks.get("starting_frame", "basic"))
        elif "frame_pop_fiz" in unlocks or "frame_volatile" in unlocks:  # rough
            pass
        frame_name = STARTING_FRAMES.get(current_f, {}).get("name", current_f)
        console.print(f"Chosen starting body for next run: {frame_name} (use Vat or frame menu to change/view all)")
        agg = career.get("faction_aggression", {}) if isinstance(career, dict) else {}
        if agg:
            console.print("Faction aggression (home betrayal rep — higher = they fear you, less on-sight, genocide at 5): " + " | ".join(f"{f[:4]}:{agg.get(f,0)}/{5}" for f in ["felonia", "confederacy", "pop_fiz", "techopuritan"]))
            maxed_now = [f for f in ["felonia", "confederacy", "pop_fiz", "techopuritan"] if agg.get(f, 0) >= 5]
            if maxed_now:
                console.print(f"[bold]MAX AGGRESSION with: {', '.join(maxed_now)} — go to Contracts to declare genocide focus for the run![/bold]")

        print("\n[bold]City options:[/bold]")
        print("  1. Spend Ratings on permanent home base upgrades (game show money)")
        print("  2. Spend Feast on the 'Feast Tree' (meta power from good captures)")
        print("  3. Launch a new full run (applies current bonuses/unlocks + sector map)")
        print("  4. View current fame, brutality stats & sector history")
        print("  5. Retire / End Career (see total infamy score and save)")
        print("  6. Quit to main menu / end session (save progress)")
        print("  7. CONTRACT OFFICE — Pick televised horrific acts (contracts) for bonus Ratings + story on return")
        print("     (type 'frames' or 'vat' or 'vats' for Clone Vats: full frame chooser + bond/test/unlock/special actions)")
        print("  8. GRAFT MARKET — Trade scrap from destroyed ships for parts, upgrades, and entertainment value")
        print("     (type 'plaza' or 'square' for Central Plaza: crowd address, big screens, statue, producer networking)")
        print("     (type 'feast' or 'hall' to visit the Feast Hall for processing and parties)")
        print("     (type 'lounge' to visit the Producers' Lounge for high-end deals)")
        choice = console.input("Choice: ").strip()

        if choice == "1":
            print("\n[bold]Ratings Upgrades (permanent for future runs - spend game show points):[/bold]")
            spent = False
            options = []
            if persistent.ratings >= 40 and "vat_v2" not in unlocks:
                options.append(("A", "Vat v2 (40 Ratings): +2 free repairs +1 starting feast at run start", 40, "vat_v2"))
            if persistent.ratings >= 60 and "hype_contract" not in unlocks:
                options.append(("B", "Hype Contract (60 Ratings): +25% bonus Ratings per run", 60, "hype_contract"))
            if persistent.ratings >= 80 and "exotic_pool" not in unlocks:
                options.append(("C", "Exotic Salvage Pool (80 Ratings): Risky nodes have more advanced artifacts", 80, "exotic_pool"))
            if persistent.ratings >= 30 and "starting_scrap" not in unlocks:
                options.append(("D", "Sponsor Deal (30 Ratings): +4 starting scrap every run", 30, "starting_scrap"))
            if persistent.ratings >= 100 and "district_entertainment" not in unlocks:
                options.append(("E", "Entertainment District (100 Ratings): +10% ratings from all sectors", 100, "district_entertainment"))
            if persistent.ratings >= 70 and "starting_laser_pod" not in unlocks:
                options.append(("F", "Prototype Laser Pod (70 Ratings): Future runs start with an extra laser component graft", 70, "starting_laser_pod"))

            # Core meta: different starting ship frames (Vat Templates)
            current_frame = unlocks.get("starting_frame", "basic") if isinstance(unlocks, dict) else "basic"
            frame_order = ["basic", "predator", "siege", "feast_barge", "artifact_host", "volatile", "pop_fiz", "drone_carrier", "overcharge", "symbiote"]
            try:
                idx = frame_order.index(current_frame)
                next_frame = frame_order[min(idx + 1, len(frame_order) - 1)]
            except:
                next_frame = "predator"
            frame_cost = 45 if next_frame in ("predator", "siege") else 60
            frame_name = STARTING_FRAMES.get(next_frame, {}).get("name", next_frame)
            if next_frame not in (unlocks.get("starting_frame") if isinstance(unlocks, dict) else "basic"):
                options.append(("V", f"Vat Template: {frame_name} ({frame_cost} Ratings) - new permanent starting ship", frame_cost, ("starting_frame", next_frame)))

            if not options:
                print("[dim]No more affordable Ratings upgrades. Be more brutal in runs![/dim]")
            else:
                for letter, desc, cost, key in options:
                    print(f"  {letter}. {desc}")
                buy = console.input("Buy which (letter or none)? ").strip().upper()
                for letter, desc, cost, key in options:
                    if buy == letter:
                        persistent.ratings -= cost
                        if isinstance(key, tuple) and key[0] == "starting_frame":
                            if not isinstance(unlocks, dict):
                                unlocks = {}
                            unlocks["starting_frame"] = key[1]
                            print(f"[green]Bought: {desc}[/green]")
                        else:
                            unlocks.add(key)
                            print(f"[green]Bought: {desc}[/green]")
                        spent = True
                        break
            if not spent and options:
                print("[dim]No purchase made.[/dim]")

        elif choice == "2":
            print("\n[bold]Feast Tree (spend Feast from surgical captures for permanent power):[/bold]")
            spent = False
            if persistent.feast >= 20 and "feast_tree_1" not in unlocks:
                print("  A. Vat Affinity I (20 Feast): +3 starting feast every run")
                if console.input("Buy? (y/n): ").lower() == "y":
                    persistent.feast -= 20
                    unlocks.add("feast_tree_1")
                    print("[magenta]Feast Tree I unlocked.[/magenta]")
                    spent = True
            if persistent.feast >= 50 and "feast_tree_2" not in unlocks and "feast_tree_1" in unlocks:
                print("  B. Feast Processing II (50 Feast): +10% feast from all future loot + better clone starting ship")
                if console.input("Buy? (y/n): ").lower() == "y":
                    persistent.feast -= 50
                    unlocks.add("feast_tree_2")
                    print("[magenta]Feast Tree II unlocked. Clones start with extra corridor.[/magenta]")
                    spent = True
            if persistent.feast >= 80 and "feast_tree_3" not in unlocks and "feast_tree_2" in unlocks:
                print("  C. Advanced Vat (80 Feast): Free 1 repair per run start + new starting artifact chance")
                if console.input("Buy? (y/n): ").lower() == "y":
                    persistent.feast -= 80
                    unlocks.add("feast_tree_3")
                    print("[magenta]Feast Tree III unlocked.[/magenta]")
                    spent = True
            if not spent:
                print("[dim]No affordable Feast Tree upgrades (need good captures for more Feast).[/dim]")

        elif choice == "3":
            bonus_scrap = 4 if "starting_scrap" in unlocks else 0
            bonus_feast = 3 if "vat_v2" in unlocks else 0
            if "feast_tree_1" in unlocks:
                bonus_feast += 3
            if "feast_tree_3" in unlocks:
                bonus_feast += 2
            # Pass any market_addons bought with scrap in the city so they get applied to the starting ship (real components/artifacts from the store stock)
            merged_unlocks = dict(unlocks) if isinstance(unlocks, dict) else {"unlocks": list(unlocks) if unlocks else []}
            if market_addons:
                merged_unlocks["market_addons"] = market_addons
            run_res = play_one_full_run(bonus_scrap=bonus_scrap, bonus_feast=bonus_feast, current_unlocks=merged_unlocks, genocide_target=genocide_target)
            market_addons = []  # consumed for this run
            career["seasons_completed"] += 1
            earned_ratings = run_res.ratings
            career["total_ratings_earned"] += earned_ratings
            if "hype_contract" in unlocks:
                earned_ratings = int(earned_ratings * 1.25)
            if "district_entertainment" in unlocks:
                earned_ratings = int(earned_ratings * 1.1)
            persistent.ratings += earned_ratings
            persistent.scrap = max(persistent.scrap, run_res.scrap // 3)
            persistent.feast = max(persistent.feast, run_res.feast // 4)
            console.print(f"\n[bold]Back in the city.[/bold] The audience awarded you {earned_ratings} new Ratings for how brutal and entertaining the run was.")
            if earned_ratings > 30:
                console.print("[italic]The crowd is chanting. The producers are already greenlighting the next season's 'highlights reel'. More carnage expected.[/italic]")
            if earned_ratings > 20 or persistent.feast > 30:
                party = "[bold magenta]FEAST PARTY IN THE GRAFTYARD![/bold] "
                if earned_ratings > 40:
                    party += "The vats overflow with 'donations'. The audience is hooked on your brutality. 'Best season yet!' they cheer."
                else:
                    party += "The crew (survivors) feast on the captured. Even the surgical runs have their fans, but the bloodthirsty crowd wants more shatter next time."
                console.print(party)

            # Evaluate contracts picked at the home base stage (horrific acts the audience demanded, now televised)
            if season_contracts:
                fake_stats = {"factions_defeated": {"felonia": 2, "confederacy": 1}, "shattered_count": 2, "fights": 4, "spectacle_count": 6, "techopuritan_cleared": 1, "avg_destroyed_ratio": 0.7}
                cbonus, cstories = evaluate_contracts(season_contracts, fake_stats, [], career=career)
                if cbonus > 0:
                    persistent.ratings += cbonus
                    console.print(f"[bold red]+{cbonus} BONUS RATINGS from completed contracts![/bold red]")
                    for st in cstories:
                        console.print(f"[italic magenta][TV REPLAY] {st}[/italic magenta]")
                season_contracts = []

            # Genocide victory if declared and enough progress this run (approximated via stats)
            gt = genocide_target
            if gt:
                gprog = fake_stats.get("factions_defeated", {}).get(gt, 0) if "fake_stats" in locals() else 2
                if gprog >= 1:
                    gbonus = 70
                    persistent.ratings += gbonus
                    console.print(f"[bold red][GENOCIDE VICTORY] The last of the {gt} exterminated! Community celebrates the extinction as the season's masterpiece. +{gbonus} RATINGS[/bold red]")
                    if "genocides_completed" not in career or not isinstance(career.get("genocides_completed"), dict):
                        career["genocides_completed"] = {}
                    career["genocides_completed"][gt] = career["genocides_completed"].get(gt, 0) + 1
                    if not isinstance(unlocks, dict):
                        unlocks = {}
                    unlocks["genocide_veteran"] = unlocks.get("genocide_veteran", 0) + 1
                    console.print("[END GAME] Permanent 'Genocide Veteran' status earned -- future runs carry the infamy.")
                genocide_target = None

            console.print(f"Updated standing: {render_resources(persistent)}")
            # auto-save progress after every run
            save_meta(persistent, unlocks, career)

        elif choice == "4":
            districts = []
            if "district_entertainment" in unlocks:
                districts.append("Entertainment District (ratings bonus)")
            if any("feast_tree" in u for u in unlocks):
                districts.append("Feast District (meta power)")
            if "exotic_pool" in unlocks:
                districts.append("Graft District (exotic tech)")
            agg = career.get("faction_aggression", {}) if isinstance(career, dict) else {}
            agg_str = " | ".join(f"{f[:4]}:{agg.get(f,0)}/5" for f in ["felonia","confederacy","pop_fiz","techopuritan"]) if agg else "none"
            gen_str = ""
            gcs = career.get("genocides_completed", {}) if isinstance(career, dict) else {}
            if gcs:
                gen_str = f"Genocides completed: {', '.join(f'{k}:{v}' for k,v in gcs.items())}\n"
            console.print(Panel(
                f"Your current infamy: {persistent.ratings} Ratings\n"
                f"Feast stored: {persistent.feast}\n"
                f"Unlocked: {sorted(unlocks) or 'none'}\n"
                f"Districts: {', '.join(districts) if districts else 'Core Graftyard only'}\n"
                f"Aggression (betrayal rep): {agg_str}\n"
                f"{gen_str}"
                f"Career: {career['seasons_completed']} seasons, {career['total_ratings_earned']} total ratings earned, high score {career['high_score']}\n"
                "Brutality + betrayals of specific races build aggression (they fear you more, home loves it more). Max = declare genocide focus for 'last one' runs + victory celebrations.",
                title="Current Fame & Upgrades", border_style="red"
            ))

        elif choice == "5":
            # Retire: career summary + save
            score = career["total_ratings_earned"] + (persistent.feast * 2) + (len(unlocks) * 10)
            career["high_score"] = max(career.get("high_score", 0), score)
            save_meta(persistent, unlocks, career)
            agg = career.get("faction_aggression", {}) if isinstance(career, dict) else {}
            agg_str = " | ".join(f"{f[:4]}:{agg.get(f,0)}/5" for f in ["felonia","confederacy","pop_fiz","techopuritan"]) if agg else "none"
            gcs = career.get("genocides_completed", {}) if isinstance(career, dict) else {}
            gen_str = f"Genocides: {', '.join(f'{k}:{v}' for k,v in gcs.items())}\n" if gcs else ""
            total_gen = sum(gcs.values()) if gcs else 0

            # Dynamic producers' epilogue for end game
            epilogue = "The producers are satisfied. For now. The audience remembers your name."
            if total_gen >= 3:
                epilogue = "You are a legend of extinction. Whole races erased for the ratings. The audience demands the reunion special -- and more."
            elif total_gen >= 1:
                epilogue = "You ended civilizations on live TV. The home base still cheers your final purges. The show must go on... in infamy."
            elif max(agg.values() or [0]) >= 5:
                epilogue = "Even without completing the full purge, your betrayals made you a monster of infamy. They fear your name across the rim."

            console.print(Panel(
                f"[bold]CAREER SUMMARY - THE PRODUCERS' REPORT[/bold]\n\n"
                f"Total Ratings earned across all seasons: {career['total_ratings_earned']}\n"
                f"Seasons completed: {career['seasons_completed']}\n"
                f"Current standing: {render_resources(persistent)}\n"
                f"Unlocked upgrades: {sorted(unlocks) or 'none'}\n"
                f"Aggression (betrayal rep): {agg_str}\n"
                f"{gen_str}"
                f"Audience score (ratings + 2x feast + 10x unlocks + {total_gen}*100 genocides): {score}\n"
                f"Personal best: {career['high_score']}\n\n"
                f"Brutal Highlights: {' | '.join(extract_brutal_moments(None, {}, persistent.ratings)[:2])}\n\n"
                f"[italic]{epilogue}[/italic]",
                title="END OF CAREER", border_style="red"
            ))
            break
        elif choice == "6":
            save_meta(persistent, unlocks, career)
            console.print("Progress saved to space_derelict_meta.json. Returning to the void between seasons...")
            break

        elif choice == "7":
            # Contracts board — build the "stage" where meta + story drip via demanded atrocities
            print("\n[bold red]PRODUCERS' CONTRACT BOARD — LIVE FROM THE GRAFTYARD[/bold red]")
            print("The audience at home is bored. Give them something spectacular to watch this season.")
            print("Complete the acts during your run → big bonus Ratings + the producers air the 'highlights' when you return.")
            avail = get_available_contracts(unlocks, 1)  # from model
            if not avail:
                print("[dim]No contracts right now. Be more infamous.[/dim]")
                continue
            for i, ct in enumerate(avail, 1):
                print(f"  {i}. {ct.title}  (+{ct.bonus_ratings} Ratings) — {ct.desc}")
            print("Enter numbers separated by space (max 2), or none to clear.")
            raw = console.input("Contracts: ").strip()
            picked = []
            if raw:
                for tok in raw.split():
                    try:
                        idx = int(tok) - 1
                        if 0 <= idx < len(avail):
                            picked.append({"id": avail[idx].id})
                    except:
                        pass
            picked = picked[:2]
            # Store on the run state for this city session (simple for terminal)
            # We'll use a closure var below; for demo we just award flavor immediately + small bonus as "hype"
            if picked:
                print(f"[green]Accepted {len(picked)} contracts for the next run.[/green]")
                for p in picked:
                    for ct in avail:
                        if ct.id == p["id"]:
                            print(f"  - {ct.title}")
                season_contracts = picked[:]
                # Teaser hype (full evaluate happens on return using model logic + simple stats)
                teaser = sum(ct.bonus_ratings for ct in avail if any(p["id"]==ct.id for p in picked)) // 3
                persistent.ratings += max(5, teaser)
                print(f"[yellow]Advance hype from the producers: +{max(5, teaser)} Ratings. Fulfill the acts on air for the rest.[/yellow]")
            else:
                season_contracts = []
                print("[dim]No contracts accepted.[/dim]")

            # Fleshed Contract Office stage actions (after the board picker, for parity with graphical)
            print("\n[bold]Additional Contract Office stage actions:[/bold]")
            print("  t. Check the LIVE AUDIENCE DEMAND Ticker")
            print("  p. Pitch a new atrocity contract idea")
            print("  r. Review prime-time contract replays")
            print("  s. Schmooze / bribe the board for premium slots")
            extra = console.input("Office action (t/p/r/s or none): ").strip().lower()
            if extra == "t":
                brutality = 0  # approx
                gain = 8
                print(f"[CONTRACTS] Ticker shows the crowd is thirsty. +{gain} RATINGS hype.")
                persistent.ratings += gain
            elif extra == "p":
                gain = 18
                print(f"[CONTRACTS] You pitched a fresh horror. The board loved it. +{gain} RATINGS (teaser).")
                persistent.ratings += gain
            elif extra == "r":
                gain = 12
                print(f"[CONTRACTS] Watched archived contract replays. The old atrocities still draw viewers. +{gain} RATINGS.")
                persistent.ratings += gain
            elif extra == "s":
                if persistent.ratings >= 50:
                    persistent.ratings -= 30
                    gain = 40
                    persistent.ratings += gain
                    print(f"[CONTRACTS] Schmoozed the board. Premium contracts unlocked. Net +{gain-30} RATINGS.")
                    if not isinstance(unlocks, dict):
                        unlocks = {}
                    unlocks["premium_contracts"] = True
                else:
                    persistent.ratings += 8
                    print("[CONTRACTS] Small chat with a producer. +8 RATINGS hype.")
            else:
                print("[dim]Back to the board.[/dim]")

            # Genocide declaration (only visible/available if max aggression with 1+ factions via betrayals/contracts)
            # This is the "choose between them at start of run" once you have max rep with one or more.
            maxed = [f for f in ["felonia", "confederacy", "pop_fiz", "techopuritan"] if get_faction_aggression(career, f) >= 5]
            if maxed and not genocide_target:
                print("\n[bold red]GENOCIDE DECLARATION (max aggression achieved with: " + ", ".join(maxed) + ")[/bold red]")
                print("Declare this run's focus: make the chosen race the 'last one'. Special bias, events, and massive home victory if you purge enough.")
                for gi, gf in enumerate(maxed, 1):
                    print(f"  G{gi}. Declare genocide on the {gf}")
                gchoice = console.input("Genocide choice (g1 etc or none): ").strip().lower()
                if gchoice.startswith("g"):
                    try:
                        gidx = int(gchoice[1:]) - 1
                        if 0 <= gidx < len(maxed):
                            genocide_target = maxed[gidx]
                            print(f"[CONTRACTS] GENOCIDE DECLARED on the {genocide_target}. They will be the last in this run. The community is already preparing the victory broadcast.")
                    except:
                        pass

        elif choice.lower() in ("frames", "frame", "vat", "vats"):
            print("\n[bold]CLONE VATS — Choose Starting Frame for Next Run (core meta)[/bold]")
            print("Different vat bodies look and play differently (Pop Fiz is chaotic cetacean, Volatile is risky spectacle, etc). Never just bigger.")
            print("Unlock via Ratings spends here or by proving yourself (contracts, brutality). Graphical shows greyed + full preview ship.")
            frame_order = ["basic", "predator", "siege", "feast_barge", "artifact_host", "volatile", "pop_fiz"]
            unlocked_set = set()
            if isinstance(unlocks, dict):
                unlocked_set = set(unlocks.get("unlocked_frames", [])) or {"basic"}
            elif isinstance(unlocks, (set, list)):
                unlocked_set = set(unlocks)
            if not unlocked_set:
                unlocked_set = {"basic"}
            if "basic" not in unlocked_set:
                unlocked_set.add("basic")
            cur_chosen = unlocks.get("chosen_frame", "basic") if isinstance(unlocks, dict) else "basic"
            for i, fid in enumerate(frame_order, 1):
                finfo = STARTING_FRAMES.get(fid, {"name": fid, "desc": ""})
                is_unlocked = fid in unlocked_set or fid == cur_chosen or fid == "basic"
                cost = finfo.get("cost_ratings", 50)
                reqs = finfo.get("requires_contracts", [])
                status = "UNLOCKED" if is_unlocked else f"(LOCKED {cost}R{' req:'+str(reqs) if reqs else ''})"
                marker = "[CURRENT] " if fid == cur_chosen else ""
                print(f"  {i}. {marker}{finfo.get('name', fid)} {status}")
                print(f"      {finfo.get('desc', '')}")
            print("\nVat actions (enter letter or 'bond 3' etc):")
            print("  cN = Choose/confirm frame N as starting body")
            print("  bN = Bond / Memory Dive with frame N (story + frame-flavored effect)")
            print("  tN = Test/Sim the frame N (ratings for spectacle + preview feel)")
            print("  uN = Sponsor/Unlock specific frame N (spend its Ratings cost)")
            print("  sN = Special fast-track / producer clearance for N (high-infamy)")
            vat_in = console.input("Vat action (c3, b1, u4, or just 2 to choose): ").strip().lower()
            try:
                action = vat_in[0] if vat_in else "c"
                num_str = ''.join(ch for ch in vat_in if ch.isdigit())
                num = int(num_str) if num_str else 1
                if 1 <= num <= len(frame_order):
                    fid = frame_order[num-1]
                    finfo = STARTING_FRAMES.get(fid, {})
                    pname = finfo.get("name", fid)
                    if action in ("c", "choose", "1"):
                        if not isinstance(unlocks, dict):
                            unlocks = {}
                        unlocks["chosen_frame"] = fid
                        print(f"[green]Chosen starting frame: {pname} (will be used on next LAUNCH)[/green]")
                    elif action in ("b", "bond", "dive", "2"):
                        if fid == "pop_fiz":
                            print("[VATS] Dove the Pop Fiz reef. The 'joy' is infectious and horrifying (orcas tossing seals for sport). -morale but +RATINGS for the show.")
                            persistent.ratings += 8
                        elif fid == "volatile":
                            print("[VATS] Stabilized volatile. +15 RATINGS. High risk = high entertainment.")
                            persistent.ratings += 15
                        else:
                            print(f"[VATS] Bonded with {pname}. Clones remember. +morale +small RATINGS.")
                            persistent.ratings += 5
                        print("The vats hum. You are what they grow.")
                    elif action in ("t", "test", "sim", "3"):
                        cost = 5
                        if persistent.ratings >= cost:
                            persistent.ratings -= cost
                            gain = 12
                            persistent.ratings += gain
                            print(f"[VATS] Test sim of {pname}. Net +{gain-cost} RATINGS. The body 'performed' for the cameras.")
                        else:
                            print("Need a few ratings for the sim.")
                    elif action in ("u", "unlock", "sponsor", "4"):
                        cost = finfo.get("cost_ratings", 50)
                        if persistent.ratings >= cost:
                            persistent.ratings -= cost
                            if not isinstance(unlocks, dict):
                                unlocks = {}
                            if "unlocked_frames" not in unlocks:
                                unlocks["unlocked_frames"] = []
                            if isinstance(unlocks["unlocked_frames"], list):
                                if fid not in unlocks["unlocked_frames"]:
                                    unlocks["unlocked_frames"].append(fid)
                            unlocks["chosen_frame"] = fid
                            print(f"[green]Sponsors approved {pname}! -{cost} RATINGS. Unlocked and set as current choice.[/green]")
                        else:
                            print(f"Need {cost} Ratings to sponsor this vat template.")
                    elif action in ("s", "special", "fast", "5"):
                        if persistent.ratings >= 30:
                            persistent.ratings -= 20
                            persistent.ratings += 35
                            print(f"[VATS] Producer fast-track for {pname}. Net +15 RATINGS. Special clearance noted.")
                            if not isinstance(unlocks, dict):
                                unlocks = {}
                            unlocks[f"vat_special_{fid}"] = True
                        else:
                            print("Need more infamy (ratings) for a special clearance.")
                    else:
                        print("[dim]Action not recognized, frame choice noted if number given.[/dim]")
                else:
                    print("[dim]Bad number.[/dim]")
            except Exception:
                print("[dim]Vat visit ended without change.[/dim]")

        elif choice == "8" or choice.lower() in ("market", "shop", "graft"):
            print("\n[bold]GRAFT MARKET — Trade scrap from destroyed ships for stocked components and artifacts[/bold]")
            print("The market now carries specific parts and artifacts from the available pool (tied to the diversity of grafts). Buy with scrap earned from your televised destruction.")
            print(f"Current scrap: {persistent.scrap}")
            # Dynamic stock using the real kinds (so shop stocks actual components and artifacts)
            from space_derelict.model import COMPONENT_KINDS, ARTIFACT_KINDS
            comps = [k for k in COMPONENT_KINDS if k not in ("power", "engine")][:5]
            arts = ARTIFACT_KINDS[:4]
            stock = []
            import random as _r
            for k in comps:
                stock.append( (f"{k.title()} Module", 15 + _r.randint(0,10), "component", k, f"Adds {k} component on launch") )
            for k in arts:
                stock.append( (f"{k.title()} Artifact", 20 + _r.randint(0,12), "artifact", k, f"Adds {k} artifact on launch") )
            # classics
            stock.append( ("Broadcast Package", 20, "ratings", None, "+15 ratings") )
            stock.append( ("Feast Processor", 12, "feast", None, "Convert scrap to feast") )
            stock.append( ("Special Black Market", 18, "black", None, "+25 ratings, morale cost") )
            for i, (name, cost, typ, kind, desc) in enumerate(stock, 1):
                print(f"  {i}. {name} ({cost} scrap) — {desc}")
            print("Enter number to buy, or anything else to leave.")
            buy = console.input("Buy: ").strip()
            try:
                idx = int(buy) - 1
                if 0 <= idx < len(stock):
                    name, cost, typ, kind, desc = stock[idx]
                    if persistent.scrap >= cost:
                        persistent.scrap -= cost
                        if typ == "component" or typ == "artifact":
                            market_addons.append({"type": typ, "kind": kind})
                            print(f"[green]Bought {name}. It will be fitted to your ship on launch (uses the real stocked {typ}).[/green]")
                        elif typ == "ratings":
                            persistent.ratings += 15
                            print("[red]Sold your carnage as content. +15 RATINGS.[/red]")
                        elif typ == "feast":
                            persistent.feast += 4
                            print("[magenta]Processed scrap into feast biomass. +4 feast.[/magenta]")
                        elif typ == "black":
                            persistent.ratings += 25
                            print("[red]Bought the 'Special' slot. +25 RATINGS. The audience loved whatever that was, but your clones are uneasy.[/red]")
                        print(f"Remaining scrap: {persistent.scrap}")
                    else:
                        print("[red]Not enough scrap.[/red]")
            except:
                print("[dim]Left the market without buying.[/dim]")

        elif choice.lower() in ("pits", "entertainment", "replay"):
            print("\n[bold]ENTERTAINMENT PITS — Relive the show[/bold]")
            print("The audience pits where your run is replayed and monetized.")
            brutality = 0  # approximate from last run if any
            print(f"Recent brutality highlights available. (In graphical: scales with shatters/spectacle.)")
            print("  1. Watch highlights (+morale, story)")
            print("  2. Bet on your infamy (risk for ratings)")
            print("  3. Pitch content (ratings boost)")
            pit_choice = console.input("Choice: ").strip()
            if pit_choice == "1":
                print("[PITS] The crowd cheers your carnage. +10 morale.")
            elif pit_choice == "2":
                print("[PITS] You bet big and the audience ate it up. +20 RATINGS (but clones uneasy).")
            elif pit_choice == "3":
                print("[PITS] Producers greenlit your pitch. +25 RATINGS. The show goes on.")
            else:
                print("[dim]Left the pits.[/dim]")

        elif choice.lower() in ("feast", "hall", "vats", "biomass"):
            print("\n[bold]FEAST HALL — Process the catch[/bold]")
            print("The hall where biomass becomes the next generation of entertainment.")
            print(f"Current feast: {persistent.feast}")
            print("  1. Process biomass (clone improvements)")
            print("  2. Host party (ratings + story)")
            print("  3. Bond with vats (morale + insight)")
            feast_choice = console.input("Choice: ").strip()
            if feast_choice == "1":
                if persistent.feast >= 15:
                    persistent.feast -= 15
                    persistent.scrap += 5
                    print("[magenta]Processed. Clone line improved. +5 scrap efficiency.[/magenta]")
                else:
                    print("[red]Not enough biomass.[/red]")
            elif feast_choice == "2":
                if persistent.feast >= 10:
                    persistent.feast -= 10
                    gain = 12
                    persistent.ratings += gain
                    print(f"[red]Party hosted. +{gain} RATINGS. The audience feasted.[/red]")
                else:
                    print("[red]Vats too empty for a party.[/red]")
            elif feast_choice == "3":
                print("[magenta]Bonded with the vats. +5 morale. You remember the taste.")
            else:
                print("[dim]Left the hall.[/dim]")

        elif choice.lower() in ("lounge", "producers", "vip", "exec"):
            print("\n[bold]PRODUCERS' LOUNGE — High-infamy deals[/bold]")
            print("The exclusive area for stars. Big spends for permanent power.")
            print(f"Current ratings: {persistent.ratings}")
            print("  1. Premium Vat Upgrade (100 ratings)")
            print("  2. Sponsor Deal (75 ratings)")
            print("  3. Expand Entertainment District (120 ratings)")
            print("  4. Private Executive Screening (50 ratings)")
            lounge_choice = console.input("Choice: ").strip()
            if lounge_choice == "1":
                if persistent.ratings >= 100:
                    persistent.ratings -= 100
                    print("[green]Premium Vat Upgrade. Your frame is enhanced.")
                    if not isinstance(unlocks, dict):
                        unlocks = {}
                    unlocks["premium_vat"] = True
                else:
                    print("[red]Not enough ratings.")
            elif lounge_choice == "2":
                if persistent.ratings >= 75:
                    persistent.ratings -= 75
                    persistent.ratings += 10  # boost
                    print("[green]Sponsor deal signed. Permanent hype.")
                    if not isinstance(unlocks, dict):
                        unlocks = {}
                    unlocks["hype_sponsor"] = True
                else:
                    print("[red]Not enough.")
            elif lounge_choice == "3":
                if persistent.ratings >= 120:
                    persistent.ratings -= 120
                    print("[green]Entertainment District expanded. New pits options.")
                    if not isinstance(unlocks, dict):
                        unlocks = {}
                    unlocks["entertainment_expanded"] = True
                else:
                    print("[red]Not enough.")
            elif lounge_choice == "4":
                if persistent.ratings >= 50:
                    gain = 25 + (season if 'season' in locals() else 1) * 5
                    persistent.ratings += gain - 50
                    print(f"[red]Private screening. +{gain} net ratings. Story advanced.")
                    if 'season' in locals() and season > 1:
                        print("The producers note your veteran status.")
                else:
                    print("[red]Not enough.")
            else:
                print("[dim]Left the lounge.[/dim]")

        elif choice.lower() in ("plaza", "square", "crowd", "center"):
            print("\n[bold]CENTRAL PLAZA — The live heart of the Graftyard stage[/bold]")
            print("Holo-screens, the Predator Colossus, crowds of monsters and sponsors. Everything here is on air.")
            print(f"Current ratings: {persistent.ratings}")
            brutality = 0
            print("  1. Address the Crowd from the Balcony (hype + ratings)")
            print("  2. Watch the Plaza Holo-Screens (replays + story drip)")
            print("  3. Pay Respects at the Predator Colossus (lore + morale or dedication)")
            print("  4. Network with Passing Producers (ratings pitch)")
            pchoice = console.input("Choice: ").strip()
            if pchoice == "1":
                gain = 12
                print(f"[PLAZA] The square erupted for you. +{gain} RATINGS. The audience loves a show.")
            elif pchoice == "2":
                print("[PLAZA] You watched the replays on the giant screens. Strangers cheered your kills. +10 RATINGS.")
                persistent.ratings += 10
            elif pchoice == "3":
                if persistent.ratings > 80:
                    persistent.ratings += 15
                    if not isinstance(unlocks, dict):
                        unlocks = {}
                    unlocks["statue_dedicated"] = True
                    print("[PLAZA] Dedicated a trophy to the Colossus. The legend of you grows. +15 RATINGS.")
                else:
                    print("[PLAZA] The statue's shadow settles your clones. +8 morale feel.")
            elif pchoice == "4":
                if persistent.ratings >= 60:
                    persistent.ratings -= 15
                    gain = 35
                    persistent.ratings += gain
                    print(f"[PLAZA] Producer pitch paid off. Net +{gain-15} RATINGS. They will be watching.")
                else:
                    persistent.ratings += 10
                    print("[PLAZA] Small chat with a junior. +10 RATINGS hype.")
            else:
                print("[dim]Back to the square center.[/dim]")

        else:
            print("[red]Invalid[/red]")


if __name__ == "__main__":
    try:
        main()
    finally:
        try:
            shutdown_logging()
        except Exception:
            pass
