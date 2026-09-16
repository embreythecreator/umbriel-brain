"""Resolve UMBRIEL_HOME for standalone skill scripts.

Skill scripts may run outside the Umbriel process (system Python, nix env,
CI) where ``umbriel_constants`` is not importable.  This module provides the
same ``get_umbriel_home()`` contract without requiring it on ``sys.path``.

When ``umbriel_constants`` IS available it is used directly so profile
resolution and any future enhancements are picked up automatically.
"""

from __future__ import annotations

import os
from pathlib import Path

try:
    from umbriel_constants import get_umbriel_home as get_umbriel_home
except (ModuleNotFoundError, ImportError):

    def get_umbriel_home() -> Path:
        """Return the Umbriel home directory (default: ``~/.umbriel``)."""
        val = os.environ.get("UMBRIEL_HOME", "").strip()
        return Path(val) if val else Path.home() / ".umbriel"
