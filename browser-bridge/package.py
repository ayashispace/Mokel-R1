"""Package the same bridge source for Chromium and Firefox development."""
from pathlib import Path
import json
import zipfile

source = Path(__file__).resolve().parent
destination = source.parent / "dist" / "download"
destination.mkdir(parents=True, exist_ok=True)
manifest = json.loads((source / "manifest.json").read_text(encoding="utf-8"))
files = ["popup.html", "popup.js", "connect.html", "connect.js", "bridge.html", "bridge.js", "native-pc.js", "bridge.css", "conversation-url.js", "detect.js", "markdown.js", "images.js", "content.js", "reconnect.js", "wake.js", "README.md"]
for browser in ("chromium", "firefox"):
    config = dict(manifest)
    if browser == "firefox":
        config["permissions"] = [p for p in manifest["permissions"] if p != "debugger"]
        config["background"] = {"scripts": ["conversation-url.js", "reconnect.js"]}
        config["browser_specific_settings"] = {"gecko": {"id": "mokel-bridge@mokel.local", "strict_min_version": "128.0"}}
    with zipfile.ZipFile(destination / f"mokel-bridge-{browser}.zip", "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("manifest.json", json.dumps(config, indent=2))
        for filename in files:
            archive.write(source / filename, filename)
print("Packaged Chromium and Firefox development bridges.")
