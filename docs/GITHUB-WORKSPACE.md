# Direct GitHub workspaces

Use my PC → Connect to GitHub workspace opens a separate setup page, preserving the current chat. Local workspace setup remains available through the other button.

## One-time app registration

1. Visit https://github.com/settings/applications/new as the app owner.
2. Name: Mokel R1. For local development set Homepage URL to `http://localhost:4173/` and Authorization callback URL to `http://localhost:4173/github-workspace.html`. The device flow does not use that callback.
3. Register the app. Enable Device Flow in the app settings.
4. Enter the public Client ID in Mokel's GitHub setup page. No client secret is needed. For public distribution, use the product's real homepage and register an app owned by the project maintainer.
5. Continue with GitHub, open the verification link, enter the displayed code and review GitHub's authorization. Return to Mokel, select a repository and branch, then Connect workspace.

GitHub OAuth's `repo` scope is broad: GitHub's authorization may cover all accessible repositories, including private ones. Mokel executes actions only against the user-selected repository and branch. This local single-user app stores the access token encrypted with its existing settings encryption. A hosted multi-user deployment needs per-user credentials/session ownership; this implementation must not be deployed as a shared credential store.

## Execution

File tools reuse the existing approval and per-chat workspace checks. Read revisions are GitHub blob SHAs; updates and deletions supply the expected SHA. Every mutation creates one commit. No automatic push to another branch, force push, merge, shell commands, local computer actions, or builds are supported. Empty directories are represented by `.gitkeep`. Regular UTF-8 files are limited to 100 KB. Branch rules are enforced by GitHub.

An encrypted execution receipt is persisted before each write. Exact retries return confirmed results; interrupted/uncertain writes cannot automatically execute again. Inspect the repository before proposing a fresh action after uncertainty.

Disconnect account removes Mokel's stored token. To revoke the GitHub grant itself, use GitHub Settings → Applications → Authorized OAuth Apps. Existing workspace actions fail once disconnected. GitHub initialization snapshots, local recovery copies and folder picking are not implemented for remote workspaces.

References: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps and https://docs.github.com/en/rest/repos/contents
