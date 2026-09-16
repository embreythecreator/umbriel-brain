from pathlib import Path


def test_windows_native_install_path_docs_match_installer() -> None:
    doc = Path("website/docs/user-guide/windows-native.md").read_text()
    install = Path("scripts/install.ps1").read_text()

    # The launchers live in the managed binary dir OUTSIDE the git checkout
    # (UMBRIEL_HOME\bin, next to the managed uv) — NOT the whole venv\Scripts
    # (which would shadow the user's python, #83797) and NOT a dir inside
    # the checkout (which `umbriel update`'s autostash swept off disk).
    assert "%LOCALAPPDATA%\\umbriel\\bin" in doc
    assert (
        "Get-Command umbriel        # should print "
        "C:\\Users\\<you>\\AppData\\Local\\umbriel\\bin\\umbriel.exe"
    ) in doc
    # Installer exposes $UmbrielHome\bin, and must copy the launchers into it.
    assert '$umbrielBin = "$UmbrielHome\\bin"' in install
    assert "umbriel.exe" in install and "umbriel-acp.exe" in install
    # Guard against regressions to either legacy layout.
    assert '$umbrielBin = "$InstallDir\\venv\\Scripts"' not in install
    assert '$umbrielBin = "$InstallDir\\bin"' not in install
