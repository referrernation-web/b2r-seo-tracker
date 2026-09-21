# Blazer2Role SEO/AEO tracker

Static GitHub Pages app using the existing Supabase `tracker` table. The v6 workspace
is a UI extension: no framework migration, database migration, RLS change, or new login.

## Files
- `index.html`: existing connection, seed plan, clients, and legacy reports/help.
- `workspace.js`: task list, detail forms, named views, CSV preview, save protection.
- `workspace.css`: responsive workspace styling.
- `workspace.test.js`: isolated regression checks with a mocked Supabase transport.

## Check before publishing
```sh
node --check workspace.js
node check.js
node workspace.test.js
git diff --check
```

Serve this directory with a static HTTP server and open `/?demo=1` for an isolated
interface preview. It uses example planning records in memory and never creates a
Supabase client. Reloading discards preview edits. Preview preferences are separate.

## Daily use
1. Connect using the existing shared connection policy. No additional login is added.
2. Select a client and use My work, Content library, Technical tasks, or Article ideas.
3. Filter using All tasks, Assigned to me, Needs review, Blocked, Unassigned, Archived.
4. Open a task, edit details, and choose Save changes. The header confirms server saves.
5. Archive/restore through Record actions; this release does not permanently delete tasks.
6. Import metrics through a preview, then provide the actual reporting date range.

The display name is self-reported, not authentication. Invite links keep the existing
connection behavior; task links contain only client/type/record identifiers, not keys.

## Data safety and limitations
- Record extensions are stored in the existing JSON; unknown saved fields are preserved.
- Updates compare the loaded `updated_at` value before writing. Conflicts are shown,
  never resolved by silently overwriting another session. Download pending changes
  before intentionally reloading a conflicting workspace.
- Pending edits are held in memory. Keep the tab open after a failed save or download
  the recovery JSON. This is not an offline-first durable store or automatic merge engine.
- Refresh all existing team tabs after deployment. Old cached clients do not have
  the new conflict checks and do not understand the new review/archive controls.
- Import matching uses a unique nonempty URL path within the selected client's records.
  Confirm you exported the correct site's Pages report. Duplicate paths/invalid rows
  must be fixed before applying; unmatched or ambiguous records remain unchanged.
- Reporting and Help retain legacy content; SEO strategy corrections are a separate task.
- Custom named views, bulk edits, calendar/board views, and automatic integrations remain deferred.

## Deployment
GitHub Pages is configured for `main` at `/`. Push a tested commit, wait for the Pages
build, then verify both the HTML and `workspace.js`/`workspace.css` on the live URL.
Production records are not reset or seeded by deployment. A first connection to a
missing client row retains the original app's initialization behavior.

## Verification scope
Node regression tests exercise import validation, state preservation, filters, due dates,
conflict detection, offline/retry, and sequential queued saves. Browser checks use demo
data, not production writes. Supabase live save round-trips require the existing user's
connected browser session and are not implied by a successful Pages deployment.
