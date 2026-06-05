"""Centralized logging setup for Space Derelict.

Automatically captures logs (including full tracebacks for errors) to rotating files
under ./logs/ so crashes and issues can be reviewed later without console output.

Usage (early in entry points):
    from space_derelict.logging_setup import setup_logging, install_excepthook, get_logger
    setup_logging(console=should_log_to_console)
    install_excepthook()

Then: logger = get_logger(); logger.info("..."); logger.exception("boom")
"""

from __future__ import annotations

import logging
import sys
import traceback
from datetime import datetime
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Optional

LOG_DIR = Path("logs")
LOG_FILE = LOG_DIR / "space_derelict.log"
CRASH_DIR = LOG_DIR / "crashes"

# Keep a reference so we can close cleanly
_root_logger: Optional[logging.Logger] = None
_file_handler: Optional[RotatingFileHandler] = None


def get_logger(name: str = "space_derelict") -> logging.Logger:
    """Return the package logger (creates root config on first use if needed)."""
    logger = logging.getLogger(name)
    if not logger.handlers and not logging.getLogger().handlers:
        # Lazy auto-setup with safe defaults (file only)
        setup_logging(console=False)
    return logger


def setup_logging(
    level: int = logging.INFO,
    console: bool = True,
    log_file: Optional[Path] = None,
    max_bytes: int = 5 * 1024 * 1024,
    backup_count: int = 5,
) -> logging.Logger:
    """Configure rotating file logs + optional console.

    - Always writes DEBUG and up to rotating log file (good for post-mortem review).
    - Console gets 'level' (INFO default) if console=True (use for terminal frontend).
    - GUI should call with console=False to avoid spam.
    - Safe to call multiple times; reconfigures handlers.
    """
    global _root_logger, _file_handler

    target_log = log_file or LOG_FILE
    target_log.parent.mkdir(parents=True, exist_ok=True)
    CRASH_DIR.mkdir(parents=True, exist_ok=True)

    logger = logging.getLogger("space_derelict")
    logger.setLevel(logging.DEBUG)  # we want everything in the file

    # Remove any prior handlers we added (idempotent reconfig)
    for h in list(logger.handlers):
        logger.removeHandler(h)
        try:
            h.close()
        except Exception:
            pass

    # File: rotating, keeps history across runs, captures full debug + errors
    fh = RotatingFileHandler(
        target_log,
        maxBytes=max_bytes,
        backupCount=backup_count,
        encoding="utf-8",
        delay=False,
    )
    fh.setLevel(logging.DEBUG)
    file_fmt = logging.Formatter(
        "%(asctime)s | %(levelname)-8s | %(name)s:%(lineno)d | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    fh.setFormatter(file_fmt)
    logger.addHandler(fh)
    _file_handler = fh

    # Console (stdout): for interactive terminal sessions
    if console:
        ch = logging.StreamHandler(sys.stdout)
        ch.setLevel(level)
        console_fmt = logging.Formatter(
            "%(asctime)s %(levelname)s %(name)s: %(message)s",
            datefmt="%H:%M:%S",
        )
        ch.setFormatter(console_fmt)
        logger.addHandler(ch)

    # Prevent propagation to root to avoid double logs if root is configured elsewhere
    logger.propagate = False

    _root_logger = logger

    logger.info("=" * 60)
    logger.info("Space Derelict logging started")
    logger.info("Log file: %s", target_log.resolve())
    logger.info("Python: %s | Platform: %s | CWD: %s", sys.version.split()[0], sys.platform, Path.cwd())
    logger.info("=" * 60)

    return logger


def shutdown_logging() -> None:
    """Flush and close handlers cleanly (call on exit)."""
    global _file_handler
    logger = logging.getLogger("space_derelict")
    logger.info("Logging shutdown")
    for h in list(logger.handlers):
        try:
            h.flush()
            h.close()
            logger.removeHandler(h)
        except Exception:
            pass
    if _file_handler:
        _file_handler = None


def install_excepthook() -> None:
    """Install a sys.excepthook that logs full tracebacks + writes dedicated crash reports.

    This ensures even top-level uncaught exceptions (crashes) are captured to logs
    for later review.
    """
    original_hook = sys.excepthook

    def _crash_hook(exctype, value, tb):
        logger = logging.getLogger("space_derelict")
        try:
            logger.critical("UNCAUGHT EXCEPTION - game will terminate", exc_info=(exctype, value, tb))
            # Force flush all handlers so the critical gets to disk even on fast exit
            for h in logger.handlers:
                try:
                    h.flush()
                except Exception:
                    pass
        except Exception:
            # Logging itself failed; fall back to stderr
            print("CRITICAL: logging failed during crash hook", file=sys.stderr)
            traceback.print_exception(exctype, value, tb, file=sys.stderr)

        # Always write a standalone crash report (easy to find and attach)
        crash_file = None
        try:
            CRASH_DIR.mkdir(parents=True, exist_ok=True)
            ts = datetime.now().strftime("%Y%m%d-%H%M%S")
            crash_file = CRASH_DIR / f"crash-{ts}.log"
            with open(crash_file, "w", encoding="utf-8") as f:
                f.write("Space Derelict Crash Report\n")
                f.write(f"Timestamp: {ts}\n")
                f.write(f"Python: {sys.version}\n")
                f.write(f"Platform: {sys.platform}\n")
                f.write(f"CWD: {Path.cwd()}\n")
                f.write("-" * 50 + "\n\n")
                traceback.print_exception(exctype, value, tb, file=f)
                f.flush()
            # Also append a pointer + summary directly to the main log (bypass logger)
            try:
                with open(LOG_FILE, "a", encoding="utf-8") as mainlog:
                    mainlog.write(f"\n[CRASH] {ts} - Full report: {crash_file}\n")
                    # Also dump a short version of the traceback directly
                    import traceback as _tb
                    mainlog.write("".join(_tb.format_exception(exctype, value, tb)))
                    mainlog.write("\n")
                    mainlog.flush()
            except Exception:
                pass
        except Exception as report_err:
            # Last resort - try to write a minimal crash note
            try:
                if crash_file is None:
                    crash_file = LOG_DIR / f"emergency-crash-{datetime.now().strftime('%H%M%S')}.txt"
                with open(crash_file, "w", encoding="utf-8") as f:
                    f.write("EMERGENCY CRASH REPORT (hook had problems)\n")
                    f.write(str(report_err) + "\n\n")
                    traceback.print_exception(exctype, value, tb, file=f)
            except Exception:
                pass
            try:
                print(f"[crash] Failed to write crash report: see stderr", file=sys.stderr)
                traceback.print_exception(exctype, value, tb, file=sys.stderr)
            except Exception:
                pass

        # Call original so console/IDE still sees it during dev
        original_hook(exctype, value, tb)

    sys.excepthook = _crash_hook


def log_exception(msg: str = "Exception caught", exc_info: bool = True) -> None:
    """Convenience: log current exception (use inside except blocks)."""
    logging.getLogger("space_derelict").error(msg, exc_info=exc_info)


# Auto-setup a minimal file-only logger on import if nothing configured yet.
# This ensures that even if an early import blows up before entry-point setup,
# we still get something (rotating file will be created on first write).
if not logging.getLogger("space_derelict").handlers:
    # Do not force console or side effects on plain import; wait for explicit setup.
    # But create the dir so first write succeeds.
    try:
        LOG_DIR.mkdir(exist_ok=True)
        CRASH_DIR.mkdir(exist_ok=True)
    except Exception:
        pass
