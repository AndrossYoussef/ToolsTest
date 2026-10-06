# ☁ Cloud Team Sync — Setup Guide
### for Talabat Images Finder (ToolsTest)

The tool now has a **☁ Cloud team sync** panel inside **step 3 → “Categories & Data”**.
Once connected, every user works on the **same shared memory** automatically:

- Custom categories (with their keywords)
- Dictionary / search aliases
- Manual image categories + manual item categories
- Priority rules
- Learned matches
- Library picks

No more CSV export/import. Images never leave anyone's device — only the settings memory above syncs.

---

## Which backend should I pick?

| | 🔥 Firebase (recommended) | 🐙 GitHub file | 🔗 REST endpoint |
|---|---|---|---|
| Real-time | ✅ live (~1 s) | poll (5–60 s + GitHub cache) | poll (5–60 s) |
| Accounts needed | 1 free Google account (one-time, by admin) | none — uses your existing GitHub repo | any JSON store you like |
| Where data lives | Firebase (Google) | `shared-settings.json` inside your repo | the endpoint |
| Readers need | just the team link | nothing (public repo) | just the team link |
| Writers need | just the team link | a fine-grained GitHub token (once per editor) | the team link |
| Best for | teams that want instant sync | teams that want data in their own repo | custom setups |

---

## 🔥 Option A — Firebase Realtime Database (recommended, ~5 minutes, one time)

1. Go to **console.firebase.google.com** → **Add project** (e.g. `talabat-tools`) → Create.
2. In the project: **Build → Realtime Database → Create Database** → choose a location → **Start in test mode**.
3. **⚙ Project settings → Your apps → Web ( `</>` )** → register the app → copy the whole `firebaseConfig` object.
4. In the tool: open **Categories & Data → ☁ Cloud team sync → 🔥 Firebase**, paste the config, keep the workspace name (e.g. `default` or `talabat-team`), click **🔗 Connect**.
5. Click **🔗 Copy team link** and send it to your teammates. They open the link — done. Everything they do syncs to everyone within about a second while the page is open.

**Notes**
- The free Spark plan is more than enough (settings data is tiny).
- Test-mode rules stay open for 30 days. After that, in **Realtime Database → Rules** put:
  ```json
  { "rules": { ".read": true, ".write": true } }
  ```
  and click Publish. (For better privacy: enable **Authentication → Sign-in method → Anonymous**, then require `"auth != null"` in the rules — the tool signs in anonymously automatically.)
- Keep the workspace name hard to guess if you want the workspace private-ish.

## 🐙 Option B — GitHub file (no new accounts, data lives in your repo)

The shared settings are stored as **`shared-settings.json`** in a repo you choose (default: the same `ToolsTest` repo the tool is hosted from).

1. **Readers need nothing** — reading a public repo file works out of the box.
2. **Each editor** creates a fine-grained token once:
   GitHub → Settings → Developer settings → **Fine-grained personal access tokens** → Generate new token →
   *Repository access:* only the ToolsTest repo → *Permissions:* **Contents: Read and write** → paste it into the token field in the panel.
3. Connect, then **Copy team link** and share it (the link carries the repo/path, never the token).
4. Every publish creates a small commit (“cloud-sync: update shared team settings”) — you get a full change history for free.

*Note: GitHub caches raw files for a few minutes, so other devices pick changes up within the poll interval (5–60 s) or on their next page load.*

## 🔗 Option C — Any REST JSON endpoint

Anything that answers `GET` with the JSON document and stores a `PUT` body works:
a jsonblob-style bin, a 20-line Cloudflare Worker, or your own API. Paste the URL, connect, share the team link.

---

## How syncing behaves

- **Local-first**: your browser storage (localStorage/IndexedDB) is always the working copy; the cloud is a synced replica. No internet → keep working, it retries automatically when back online.
- **Smart merge**: two people categorizing *different* items at the same time — both survive. Same key edited by two people → last writer wins. Deletions propagate.
- **Manual controls**: 🔄 Sync now · ⬇ Reset this device from cloud · ⬆ Overwrite cloud with this device (use this right after importing a memory CSV on the “master” machine, for example).
- **Migration**: the CSV export/import still exists as a backup. A CSV import on one connected machine syncs to everyone automatically.
- The old CSV round-trip is still there, so nothing about your current workflow breaks.

## Deploying the update

1. Replace `index.html` in the `ToolsTest` repo with the new one (commit → push).
2. Hard-refresh the page once (Ctrl/Cmd+Shift+R). The tool's service worker will offer an “Update now” toast to other users automatically on their next visit.

## FAQ

- **Is it safe?** The panel shares only settings/dictionary/learned data — never images, never menu files. The GitHub token is stored only in your own browser and never leaves it.
- **Someone made a mess of the categories!** Fix them on any device (changes sync), or restore by using ⬆ Overwrite cloud from a good machine.
- **Multiple teams / branches?** Use different workspace names (Firebase) or different file paths (GitHub) per team.
