"""Regression: TTS/setup xAI OAuth must not hijack the active chat provider."""

import json

import yaml


def test_run_xai_oauth_login_from_setup_does_not_hijack_active_provider(
    tmp_path, monkeypatch
):
    """TTS/setup OAuth must save tokens without switching chat inference routing.

    Regression: `_run_xai_oauth_login_from_setup` used to call
    `_update_config_for_provider("xai-oauth")` (and token save flipped
    `active_provider`), so `umbriel setup tts` OAuth login hijacked the main
    chat provider.
    """
    umbriel_home = tmp_path / "umbriel"
    umbriel_home.mkdir(parents=True, exist_ok=True)
    monkeypatch.setenv("UMBRIEL_HOME", str(umbriel_home))

    auth_path = umbriel_home / "auth.json"
    auth_path.write_text(
        json.dumps(
            {
                "version": 1,
                "active_provider": "openrouter",
                "providers": {},
            }
        ),
        encoding="utf-8",
    )
    config_path = umbriel_home / "config.yaml"
    config_path.write_text(
        yaml.safe_dump(
            {
                "model": {
                    "provider": "openrouter",
                    "default": "anthropic/claude-sonnet-4",
                    "base_url": "https://openrouter.ai/api/v1",
                },
                "tts": {"provider": "edge"},
            }
        ),
        encoding="utf-8",
    )

    monkeypatch.setattr(
        "umbriel_cli.auth._xai_oauth_device_code_login",
        lambda **kwargs: {
            "tokens": {
                "access_token": "tts-xai-access",
                "refresh_token": "tts-xai-refresh",
                "id_token": "",
                "token_type": "Bearer",
            },
            "discovery": {"token_endpoint": "https://auth.x.ai/oauth2/token"},
            "redirect_uri": "",
            "base_url": "https://api.x.ai/v1",
            "last_refresh": "2026-07-25T12:00:00Z",
        },
    )
    monkeypatch.setattr("umbriel_cli.auth._is_remote_session", lambda: True)

    from umbriel_cli.auth import is_source_suppressed, suppress_credential_source
    from umbriel_cli.setup import _run_xai_oauth_login_from_setup

    suppress_credential_source("xai-oauth", "device_code")
    assert is_source_suppressed("xai-oauth", "device_code") is True

    assert _run_xai_oauth_login_from_setup() is True

    assert is_source_suppressed("xai-oauth", "device_code") is False

    auth = json.loads(auth_path.read_text(encoding="utf-8"))
    assert auth["active_provider"] == "openrouter"
    xai_state = auth["providers"]["xai-oauth"]
    assert xai_state["tokens"]["access_token"] == "tts-xai-access"
    assert xai_state["tokens"]["refresh_token"] == "tts-xai-refresh"

    config = yaml.safe_load(config_path.read_text(encoding="utf-8"))
    assert config["model"]["provider"] == "openrouter"
    assert config["model"]["base_url"] == "https://openrouter.ai/api/v1"
    assert config["model"]["default"] == "anthropic/claude-sonnet-4"
