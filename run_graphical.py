"""Launch the graphical game for Space Derelict.

Full game with menus, combat targeting, salvage choices, sector map, and city hub.
Uses pygame + pygame_gui for UI. All game logic from space_derelict.model.

Run: python run_graphical.py
     python run_graphical.py --old   (for the old static ship viewer)
"""

import sys
from pathlib import Path

# Set up automatic log capture *before* importing game code.
# GUI: file only (no console spam). Errors + tracebacks go to logs/space_derelict.log
# and logs/crashes/crash-*.log for easy post-crash review.
try:
    from space_derelict.logging_setup import setup_logging, install_excepthook, shutdown_logging
    setup_logging(console=False)
    install_excepthook()
except Exception as _log_err:
    print(f"[warn] logging setup failed early: {_log_err}", file=sys.stderr)

if __name__ == "__main__":
    if "--old" in sys.argv:
        from space_derelict.graphics import simple_graphical_demo
        simple_graphical_demo()
    else:
        from space_derelict.game import run_game
        try:
            run_game()
        finally:
            try:
                shutdown_logging()
            except Exception:
                pass
