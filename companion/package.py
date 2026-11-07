"""Build the download from an explicit source allowlist; never include workspaces."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

source = Path(__file__).resolve().parent
target = source.parent / 'dist' / 'download' / 'mokel-companion.zip'
with ZipFile(target, 'w', ZIP_DEFLATED) as archive:
    for name in ('companion.mjs', 'execution-store.mjs', 'initialization.mjs', 'powershell.mjs', 'Start Mokel R1 Companion.bat', 'Start-Companion.ps1', 'README.md'):
        archive.write(source / name, name)
print('Companion package built (source and launchers only).')
