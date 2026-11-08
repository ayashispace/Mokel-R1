# Hosted preview on Render

The root `render.yaml` defines one free Node web service. It binds to Render's assigned port on `0.0.0.0`, reports health at `/healthz`, and builds the Python attachment processor into a local virtual environment.

## Limitations of this preview

- Each browser receives its own random session cookie. Provider keys, GitHub tokens, chats, saved connections, approval state, and website pairings are held in that process's memory. They are not shared between visitors.
- A process restart, deploy, or free-service sleep clears that session. Ask users to export their workspace ZIP before leaving the page and import it again after a restart. Keep the backup password safe.
- Render's free web services can sleep when idle. The first request after sleep can take time to wake the app.
- A hosted container cannot reach `127.0.0.1` on a visitor's computer. Local-PC requests are relayed through the updated Browser Bridge in an open Mokel tab to the updated companion on that computer. Both updates are required; the companion remains loopback-only and the normal approvals still apply. GitHub workspaces still need a per-user GitHub authorization and the public OAuth Client ID configured in Mokel.
- The public hosted build should be treated as a preview, not a durable multi-user service. Before a production launch, add persistent per-user storage, account/session recovery, rate limits, abuse controls, monitoring, and a secure remote companion channel if hosted local-PC access is required.

## Deploy

1. Push the reviewed source and `render.yaml` to the connected Git repository.
2. In Render, create a Blueprint from that repository and select the root `render.yaml`.
3. Review the planned free web service before applying it. No database or paid resource is defined in this Blueprint.
4. After the first deploy, open the service URL and confirm `/healthz` returns `{"ok":true}`.

Automatic deploys are disabled in the Blueprint so later Git pushes do not publish without review.
