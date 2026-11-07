# Mokel R1

Mokel R1 brings AI provider APIs and supported AI chat websites into a project workspace. This repository contains the web application source, the Browser Bridge extension, and the optional Windows companion.

## Run locally

Requirements: Node.js 22.13 or newer. For document attachment extraction, install the packages in `requirements.txt` into Python and set `MOKEL_PYTHON` to that interpreter. Start the app with `npm start` or `Start Mokel R1.bat`; then open `http://127.0.0.1:4173`.

The app is a local single-user service. It stores encrypted provider settings under `data/` and binds to loopback by default. Do not expose it directly as a multi-user public service: user isolation, persistent shared storage, deployment secrets, and operational controls need to be added first. A GitHub source upload does not itself deploy the service.

## Main components

- `server.mjs`: local HTTP application server and API routes.
- `dist/`: Mokel R1 web interface and downloadable bridge/companion packages.
- `lib/`: provider, Agent Mode, workspace, and support modules.
- `browser-bridge/`: browser extension used to connect supported AI chat tabs.
- `companion/`: optional Windows companion for local workspace actions.
- `tests/`: automated regression tests.
- `docs/GITHUB-WORKSPACE.md`: GitHub workspace behavior and setup notes.

## Modes and workspaces

API Mode uses provider keys configured by the user. Agent Mode connects supported websites in a browser tab; compatibility depends on the site's policies and controls. A local workspace uses the optional companion and approval flow. GitHub workspaces edit repository files through GitHub and do not run commands on the user's PC.

## Privacy and safety

Do not publish `data/`, local logs, backups, companion workspace files, pairing tokens, or recovery receipts. Provider keys and local session state are user data. The companion runs using the Windows account's permissions; workspace scoping does not sandbox arbitrary PowerShell commands.

## License

Copyright © Ayashi Space. All rights reserved. A license file will be added before public source licensing is offered.
