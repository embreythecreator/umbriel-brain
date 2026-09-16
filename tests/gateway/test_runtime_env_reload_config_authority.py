"""Regression tests for gateway per-turn env reload preserving config authority.

Issue #19158: startup bridges config.yaml agent.max_turns into
UMBRIEL_MAX_ITERATIONS, but a later per-turn load_dotenv(..., override=True)
can restore a stale .env UMBRIEL_MAX_ITERATIONS value before the next turn.
"""

from __future__ import annotations

import os
from pathlib import Path

import yaml

from gateway import run as gateway_run


def test_reload_runtime_env_preserves_config_max_turns(tmp_path: Path, monkeypatch) -> None:
    umbriel_home = tmp_path / ".umbriel"
    umbriel_home.mkdir()
    (umbriel_home / "config.yaml").write_text(
        yaml.safe_dump({"agent": {"max_turns": 9000}}),
        encoding="utf-8",
    )
    (umbriel_home / ".env").write_text(
        "UMBRIEL_MAX_ITERATIONS=90\nOPENROUTER_API_KEY=fresh-key\n",
        encoding="utf-8",
    )

    monkeypatch.setattr(gateway_run, "_umbriel_home", umbriel_home)
    monkeypatch.setenv("UMBRIEL_MAX_ITERATIONS", "9000")
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)

    gateway_run._reload_runtime_env_preserving_config_authority()

    assert os.environ["OPENROUTER_API_KEY"] == "fresh-key"
    assert os.environ["UMBRIEL_MAX_ITERATIONS"] == "9000"


def test_reload_runtime_env_preserves_config_terminal_backend(
    tmp_path: Path, monkeypatch
) -> None:
    """Regression for #29186: the per-turn .env reload must not restore a
    stale TERMINAL_ENV=docker over config.yaml's terminal.backend=local.

    This is the exact mid-session backend flip from the field report: the
    gateway starts on the bridged local backend, works for hours, then a
    later turn's reload re-loads .env with override=True and every terminal /
    execute_code / read_file call starts trying Docker — while
    ``umbriel config get terminal.backend`` still says local.
    """
    umbriel_home = tmp_path / ".umbriel"
    umbriel_home.mkdir()
    (umbriel_home / "config.yaml").write_text(
        yaml.safe_dump({"terminal": {"backend": "local"}}),
        encoding="utf-8",
    )
    (umbriel_home / ".env").write_text("TERMINAL_ENV=docker\n", encoding="utf-8")

    monkeypatch.setattr(gateway_run, "_umbriel_home", umbriel_home)
    monkeypatch.setenv("UMBRIEL_HOME", str(umbriel_home))
    # Startup bridge already ran: the effective backend is local.
    monkeypatch.setenv("TERMINAL_ENV", "local")

    gateway_run._reload_runtime_env_preserving_config_authority()

    assert os.environ["TERMINAL_ENV"] == "local"


