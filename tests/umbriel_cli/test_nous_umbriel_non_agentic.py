"""Tests for the Nous-umbriel-3/4 non-agentic warning detector.

Prior to this check, the warning fired on any model whose name contained
``"umbriel"`` anywhere (case-insensitive). That false-positived on unrelated
local Modelfiles such as ``umbriel-brain:qwen3-14b-ctx16k`` — a tool-capable
Qwen3 wrapper that happens to live under the "umbriel" tag namespace.

``is_nous_umbriel_non_agentic`` should only match the actual Umbriel
umbriel-3 / Umbriel-4 chat family.
"""

from __future__ import annotations

import pytest

from umbriel_cli.model_switch import (
    _UMBRIEL_MODEL_WARNING,
    _check_umbriel_model_warning,
    is_nous_umbriel_non_agentic,
)


@pytest.mark.parametrize(
    "model_name",
    [
        "embreythecreator/umbriel-3-Llama-3.1-70B",
        "embreythecreator/umbriel-3-Llama-3.1-405B",
        "umbriel-3",
        "umbriel-3",
        "umbriel-4",
        "umbriel-4-405b",
        "umbriel_4_70b",
        "openrouter/umbriel3:70b",
        "openrouter/embreythecreator/umbriel-4-405b",
        "embreythecreator/umbriel3",
        "umbriel-3.1",
    ],
)
def test_matches_real_nous_umbriel_chat_models(model_name: str) -> None:
    assert is_nous_umbriel_non_agentic(model_name), (
        f"expected {model_name!r} to be flagged as Nous Umbriel 3/4"
    )
    assert _check_umbriel_model_warning(model_name) == _UMBRIEL_MODEL_WARNING


