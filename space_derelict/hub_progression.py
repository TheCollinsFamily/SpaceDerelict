"""Hub Progression — Mechanical systems for the Graftyard City.

Defines:
- FEAST_TREE: Tiered permanent upgrades bought with Feast
- RATINGS_UPGRADES: Permanent upgrades bought with Ratings (Lounge)
- DISTRICT_GATES: Requirements to unlock/expand city districts
- HubCooldowns: Per-visit action cooldown tracker (buttons fire once per hub visit)
- apply_launch_bonuses(): Applies all earned permanent bonuses when starting a season
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any


# ─── Feast Tree (3 tiers, sequential unlock) ─────────────────────────────────
# Each tier costs Feast and grants a permanent bonus applied at run launch.

@dataclass
class FeastTreeNode:
    id: str
    tier: int
    name: str
    desc: str
    cost_feast: int
    effect: Dict[str, Any]  # e.g. {"starting_feast": 3}, {"starting_scrap": 5}, {"free_repairs": 1}
    requires: Optional[str] = None  # id of prerequisite node


FEAST_TREE: List[FeastTreeNode] = [
    FeastTreeNode(
        id="feast_tree_1",
        tier=1,
        name="Vat Affinity I",
        desc="+3 starting feast every run. The vats remember the taste.",
        cost_feast=20,
        effect={"starting_feast": 3},
        requires=None,
    ),
    FeastTreeNode(
        id="feast_tree_2",
        tier=2,
        name="Feast Processing II",
        desc="+10% feast from all loot + extra starting corridor. Better biomass extraction.",
        cost_feast=50,
        effect={"feast_loot_mult": 0.10, "starting_extra_corridors": 1},
        requires="feast_tree_1",
    ),
    FeastTreeNode(
        id="feast_tree_3",
        tier=3,
        name="Advanced Vat III",
        desc="Free 1 repair at run start + chance of starting artifact. The vats are hungry and generous.",
        cost_feast=80,
        effect={"free_repairs": 1, "starting_artifact_chance": 0.35},
        requires="feast_tree_2",
    ),
]

FEAST_TREE_BY_ID = {node.id: node for node in FEAST_TREE}


# ─── Ratings Upgrades (Lounge permanent purchases) ───────────────────────────
# These are big-ticket permanent unlocks from the Producers' Lounge.
# Each can only be purchased once. Persisted in unlocks set.

@dataclass
class RatingsUpgrade:
    id: str
    name: str
    desc: str
    cost_ratings: int
    effect: Dict[str, Any]
    requires_season: int = 1  # minimum season to appear
    requires_unlock: Optional[str] = None  # prerequisite unlock id


RATINGS_UPGRADES: List[RatingsUpgrade] = [
    RatingsUpgrade(
        id="vat_v2",
        name="Vat v2",
        desc="+2 free repairs + 1 starting feast at run start.",
        cost_ratings=40,
        effect={"free_repairs": 2, "starting_feast": 1},
    ),
    RatingsUpgrade(
        id="hype_contract",
        name="Hype Contract",
        desc="+25% bonus Ratings earned per run. The audience multiplier is permanent.",
        cost_ratings=60,
        effect={"ratings_mult": 0.25},
    ),
    RatingsUpgrade(
        id="exotic_pool",
        name="Exotic Salvage Pool",
        desc="Risky nodes have more advanced artifacts. Bigger rewards for bravery.",
        cost_ratings=80,
        effect={"exotic_artifacts": True},
    ),
    RatingsUpgrade(
        id="starting_scrap",
        name="Sponsor Deal",
        desc="+4 starting scrap every run. Sponsors believe in your carnage.",
        cost_ratings=30,
        effect={"starting_scrap": 4},
    ),
    RatingsUpgrade(
        id="district_entertainment",
        name="Entertainment District",
        desc="+10% ratings from all sectors. The pits are expanded.",
        cost_ratings=100,
        effect={"sector_ratings_mult": 0.10},
        requires_season=2,
    ),
    RatingsUpgrade(
        id="starting_laser_pod",
        name="Prototype Laser Pod",
        desc="Future runs start with an extra laser component. Military-grade sponsorship.",
        cost_ratings=70,
        effect={"starting_component": "laser"},
    ),
    RatingsUpgrade(
        id="premium_contracts",
        name="Premium Contract Slots",
        desc="Unlock premium contracts with bigger payouts. Producers' inner circle.",
        cost_ratings=90,
        effect={"premium_contracts": True},
        requires_season=2,
    ),
    RatingsUpgrade(
        id="entertainment_expanded",
        name="Expanded Entertainment Pits",
        desc="New options in Entertainment: Rivalries, Challenges, Premium Replays. City evolves.",
        cost_ratings=120,
        effect={"entertainment_expanded": True},
        requires_season=1,
    ),
]

RATINGS_UPGRADES_BY_ID = {u.id: u for u in RATINGS_UPGRADES}


# ─── District Gates ──────────────────────────────────────────────────────────
# Some districts require minimum ratings or unlocks to access.

DISTRICT_GATES: Dict[str, Dict[str, Any]] = {
    "lounge": {"min_ratings": 40, "desc": "Need 40+ Ratings (infamy) to enter the Producers' Lounge."},
    "entertainment": {},  # always open, but expanded content gated by "entertainment_expanded"
    "feast": {},  # always open
    "market": {},  # always open
    "vats": {},  # always open
    "contracts": {},  # always open
    "plaza": {},  # always open
}


# ─── Hub Cooldowns ───────────────────────────────────────────────────────────
# Tracks which actions have been used THIS hub visit.
# Reset when player enters the hub (on_enter) or launches a new season.

class HubCooldowns:
    """Per-hub-visit action cooldown tracker.
    Actions can only fire once per visit unless explicitly repeatable."""

    def __init__(self):
        self._used: set = set()

    def reset(self):
        """Reset all cooldowns (new hub visit)."""
        self._used.clear()

    def is_available(self, action_id: str) -> bool:
        return action_id not in self._used

    def use(self, action_id: str):
        self._used.add(action_id)

    def get_used(self) -> set:
        return set(self._used)


# ─── Launch Bonus Calculation ────────────────────────────────────────────────
# Aggregates all permanent bonuses from feast tree + ratings upgrades + career
# and returns a dict of effects to apply when starting a new season.

def calculate_launch_bonuses(unlocks: set) -> Dict[str, Any]:
    """Given the player's unlocks set, compute aggregate bonuses for run start.
    
    Returns dict like:
        {
            "starting_feast": 4,
            "starting_scrap": 4,
            "free_repairs": 3,
            "feast_loot_mult": 0.10,
            "ratings_mult": 0.25,
            "starting_extra_corridors": 1,
            "starting_artifact_chance": 0.35,
            "starting_component": "laser",
            "exotic_artifacts": True,
            "sector_ratings_mult": 0.10,
            "entertainment_expanded": True,
            "premium_contracts": True,
        }
    """
    bonuses: Dict[str, Any] = {}

    # Feast tree bonuses
    for node in FEAST_TREE:
        if node.id in unlocks:
            for key, val in node.effect.items():
                if isinstance(val, (int, float)):
                    bonuses[key] = bonuses.get(key, 0) + val
                else:
                    bonuses[key] = val

    # Ratings upgrades bonuses
    for upgrade in RATINGS_UPGRADES:
        if upgrade.id in unlocks:
            for key, val in upgrade.effect.items():
                if isinstance(val, (int, float)):
                    bonuses[key] = bonuses.get(key, 0) + val
                else:
                    bonuses[key] = val

    return bonuses


def get_feast_tree_status(unlocks: set) -> List[Dict[str, Any]]:
    """Return feast tree nodes with their unlock status for UI display."""
    result = []
    for node in FEAST_TREE:
        prereq_met = node.requires is None or node.requires in unlocks
        is_unlocked = node.id in unlocks
        is_next = prereq_met and not is_unlocked
        result.append({
            "node": node,
            "unlocked": is_unlocked,
            "available": is_next,
            "prereq_met": prereq_met,
        })
    return result


def get_available_ratings_upgrades(unlocks: set, season: int = 1) -> List[RatingsUpgrade]:
    """Return ratings upgrades available for purchase (not yet owned, prerequisites met)."""
    available = []
    for u in RATINGS_UPGRADES:
        if u.id in unlocks:
            continue
        if u.requires_season > season:
            continue
        if u.requires_unlock and u.requires_unlock not in unlocks:
            continue
        available.append(u)
    return available


def can_enter_district(district_id: str, ratings: int, unlocks: set) -> tuple[bool, str]:
    """Check if player meets requirements to enter a district.
    Returns (allowed, reason_if_blocked)."""
    gate = DISTRICT_GATES.get(district_id, {})
    min_r = gate.get("min_ratings", 0)
    if ratings < min_r:
        return False, gate.get("desc", f"Need {min_r}+ Ratings.")
    req_unlock = gate.get("requires_unlock")
    if req_unlock and req_unlock not in unlocks:
        return False, f"Requires: {req_unlock}"
    return True, ""


# ─── Run-Only Morale Upgrade Tree (in-run only, from captures) ──────────────
# Shared so terminal (main.py) and graphical (game.py) have parity.
# Effects: temp cells added to ship (medical for repairs in resolve, etc) or run multipliers.
# Prereqs on keys. Lasts only current playthrough/season.

@dataclass
class RunMoraleUpgrade:
    code: str
    desc: str
    cost: int
    key: str
    comp_kind: Optional[str]
    art_kind: Optional[str]
    requires: set[str] = field(default_factory=set)


RUN_MORALE_UPGRADES: List[RunMoraleUpgrade] = [
    RunMoraleUpgrade("M1", "Temporary Medical Bay (15 morale) - add medical comp for in-combat self-repair", 15, "med_bay", "medical", None, set()),
    RunMoraleUpgrade("M2", "Advanced Medical (30 morale, req M1) - add extra medical (stacks for more repairs)", 30, "adv_med", "medical", None, {"med_bay"}),
    RunMoraleUpgrade("N1", "Nanite Infestation (25 morale, requires M1) - add nanite artifact", 25, "nanite_inf", None, "nanite", {"med_bay"}),
    RunMoraleUpgrade("S1", "Emergency Shield Capacitor (12 morale) - add shield comp (player protection)", 12, "shield_cap", "shield", None, set()),
    RunMoraleUpgrade("B1", "Booster Field Emitter (18 morale) - add booster artifact (ion/emp resist)", 18, "booster_fld", None, "booster", set()),
    RunMoraleUpgrade("D1", "Distributor Protocol (22 morale, req booster) - add distributor to share player artifacts", 22, "distrib", None, "distributor", {"booster_fld"}),
    RunMoraleUpgrade("C1", "Capture Interrogation Kit (10 morale) - +5 morale from future captures this run", 10, "cap_kit", None, None, set()),
    RunMoraleUpgrade("G1", "Capture Guru (12 morale, req C1) - +0.2x to all future morale gains this run", 12, "guru", None, None, {"cap_kit"}),
    RunMoraleUpgrade("P1", "Pathfinder Instinct (15 morale) - reduce backtrack cost by 5 for rest of run", 15, "pathfinder", None, None, set()),
    RunMoraleUpgrade("R1", "Crowd Pleaser (20 morale) - +0.2 to ratings_mult for rest of run (brutality bonus)", 20, "crowd", None, None, set()),
    RunMoraleUpgrade("V1", "Volatile Tamer (16 morale) - add dampener artifact (reduce fire risk on your ship)", 16, "tamer", None, "dampener", set()),
]

RUN_MORALE_UPGRADES_BY_KEY = {u.key: u for u in RUN_MORALE_UPGRADES}


def get_available_run_morale_upgrades(run_upgrades: set[str], current_morale: int) -> List[RunMoraleUpgrade]:
    """Return upgrades the player can afford and whose prereqs are met (not yet owned)."""
    avail = []
    for u in RUN_MORALE_UPGRADES:
        if u.key in run_upgrades:
            continue
        if current_morale >= u.cost and u.requires.issubset(run_upgrades):
            avail.append(u)
    return avail


def get_run_upgrade_prereq_str(u: RunMoraleUpgrade) -> str:
    if not u.requires:
        return "-"
    return ", ".join(u.requires)
