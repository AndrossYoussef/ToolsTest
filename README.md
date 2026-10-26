# Talabat Images Finder

A single-page tool for matching menu items to a Google Drive image library, categorising,
reviewing, and exporting everything as a ZIP — with a separate **Covers** workspace for the
750 × 300 hero images.

Everything runs in the browser. There is no build step, no framework, and no server code in
this repository.

---

## Files in this repository

| File | Required | What it is |
|---|---|---|
| `index.html` | ✅ **yes** | The whole application — markup, CSS and JavaScript in one file. |
| `sw.js` | ✅ **yes** | Service worker. Gives the app an offline mode and pushes updates to users. |
| `drive-config.js` | ✅ **yes** | Holds the public Apps Script URL for the shared Drive folder. |
| `shared-config.json` | ✅ **yes** | Shared baseline configuration (auto-categorisation on/off, cover types). |
| `manifest-finder.webmanifest` | ✅ **yes** | Makes the app installable as a PWA. |
| `icons/finder-192.png` | ✅ **yes** | PWA icon, 192 × 192. |
| `icons/finder-512.png` | ✅ **yes** | PWA icon, 512 × 512. |
| `icons/finder-maskable-512.png` | ✅ **yes** | Maskable icon, 512 × 512, with the 20 % safe zone. |
| `.nojekyll` | optional | Skips Jekyll processing on GitHub Pages. Harmless, slightly faster deploys. |

> `Code.gs` is **not** part of this repository. It lives in the Apps Script editor
> (Extensions → Apps Script) and is deployed as a web app. Do not upload it here.

---

## Deploying to GitHub Pages

1. Upload every file above, **keeping the `icons/` folder structure**.
2. Repo **Settings → Pages** → Source: *Deploy from a branch* → `main` / `/ (root)`.
3. Open the published URL.
4. **First visit only:** press `Ctrl+Shift+R` (hard refresh) so the old service worker is
   replaced by this one.

The service worker reloads the page once on its very first install — that is expected and
only happens after a deploy that changes `sw.js`.

---

## Publishing an update

1. Replace `index.html`.
2. Bump `VERSION` in `sw.js` (e.g. `finder-v40-…` → `finder-v41-…`).
3. Upload both.

The new worker installs and waits. Users get an **Update** button in the app and choose
when to reload, so an in-progress catalogue session is never wiped silently.

---

## How the two image sources work

| | Menu images | Covers |
|---|---|---|
| Where they come from | `Menu Images Library` Drive folder (8,964 images) | Their own Drive folder, or a local folder you pick |
| How they are told apart | A folder path segment named `covers`/`cover`, or the word `cover`/`غلاف` in the filename | same rule |
| Where they appear | Menu search only | Covers workspace only |
| Export | `Menu-Images.zip` — 810 × 540 | `Menu-Covers.zip` — 750 × 300 |

A cover can never appear in menu-image results, and a misconfigured covers folder is refused
rather than being allowed to empty the image index.

---

## Configuration

`drive-config.js`:

```js
window.IMAGE_FINDER_DRIVE_API_BASE = 'https://script.google.com/macros/s/…/exec';
```

Change this only if you are pointing the app at a different Apps Script deployment.

`shared-config.json` is fetched **network-first** on every online load, so editing it takes
effect without a new build. `drive-config.js` is also served fresh each visit.

---

## Browser support

| Feature | Chrome / Edge desktop | Firefox / Safari |
|---|---|---|
| Drive library, search, review, ZIP | ✅ | ✅ |
| Local folder access (File System Access API) | ✅ | ❌ |
| Offline mode (service worker) | ✅ | ✅ |

Local-folder scanning requires a Chromium-based desktop browser. Everything else works
everywhere.

---

## Data stored in the browser

All state is local. Nothing is uploaded anywhere except reads from the Drive folder.

| Key | Contents |
|---|---|
| `tif_cover_search_v1` | Covers session: text, filter, scope, per-cover decisions |
| `tif_manual_image_categories_v1` | Manual category overrides per image |
| `tif_manual_item_categories_v1` | Manual category overrides per menu item |
| `tif_custom_categories_v1` | User-created categories |
| `tif_auto_cat_v1`, `tif_auto_confirm_v1` | Auto-categorisation settings and rules |
| `tif_learned_v1`, `tif_learned_cats_v1` | Learned keyword → category associations |
| `tif_folder_categories_v1` | Folder → category mapping |
| `tif_library_picks_v1` | Images pinned from the category browser |
| `tif_dictionary_v1` | Custom dictionary entries |
| `tif_cloud_sync_v2` | Optional team-cloud connection settings |

Use **⬇ Backup memory** / **⬆ Restore backup** in the app to move this between machines.
