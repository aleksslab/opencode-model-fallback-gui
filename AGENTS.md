# Agent notes

This repository is an OpenCode Desktop GUI plugin. Read this before changing the
fallback engine, the settings page, or the build.

## Layout

- `index.js` — server-side plugin entry. It registers nothing; all behavior runs
  in the desktop renderer.
- `src/gui.tsx` — the whole plugin: `Plugin.define`, the persisted store, the
  settings page, i18n, and the fallback engine.
- `dist/gui-experimental.cjs` — the built CJS bundle. `package.json` maps
  `./gui-experimental` to this file, so it must be rebuilt and committed with
  every source change.
- `test/engine.mjs` — behavioral tests for the engine, run without the desktop
  app.
- `test/prepare.mjs` — rewrites the bundle's `@opencode/plugin/gui` require to
  the installed package so the tests can load it outside the app.

## Runtime model

The app discovers the plugin through `package.json` and loads the GUI bundle with
`new Function("require", "module", "exports", code)`. Externals are resolved from
the app's own module map. The bundle may only require:

- `solid-js`
- `solid-js/web`
- `effect`
- `@opencode/plugin/gui`

Adding any other runtime import breaks loading in the app.

Because the app supplies all four modules, the package has no runtime
`dependencies`: `@opencode/plugin`, `effect`, `solid-js`, `vite` and
`vite-plugin-solid` are `devDependencies` used only by the build and the tests.
Do not move them back into `dependencies`: at runtime they resolve from the
app's module map, and listing them as production dependencies made every Git
install download the whole OpenCode SDK (hundreds of packages) for nothing.

The plugin is tested on desktop **2.2.5** and **2.2.6**. The GUI API is
experimental and may change between releases, so treat 2.2.5 as the known-good
baseline rather than a hard cutoff: on older 2.2.x builds the engine usually
still switches models, but the header badge or `ctx.dialogs.confirm` can be
missing. `src/gui.tsx` therefore checks `ui.SettingsLayout`,
`ui.SettingsSection` and `ui.SettingsRow` at setup time and falls back to the
inline-styled cards, guards `ctx.dialogs.confirm` / `alert`, and wraps the
`session.header` slot registration in `try/catch`. Keep those fallbacks working.

This file is for agents working inside the repository. It is not installation
documentation: an agent that runs `opencode plugin add` on another machine never
opens it. Install guidance, including a ready-made prompt, lives in `README.md`.

## Persisted config

`Plugin.define({ stores: { config: Store.global(ConfigSchema, DEFAULTS) } })`
stores values in the app's local storage under `plugin.local-model-fallback.config`.

- The plugin id comes from `index.js` (`id: "local-model-fallback"`), not from the
  npm package name. Keep it stable: renaming the package must not change the id,
  or every user loses the settings stored under `plugin.<id>.config`.
- `DEFAULTS.models`, `DEFAULTS.patterns` and `DEFAULTS.confirmModels` **must stay
  empty**. They are what a new installation and a published checkout see;
  personal providers must never be committed.
- `confirmModels` holds chain entries that need a confirmation before switching
  (paid models). It is a string list because the setting is edited as rows; keep
  it in sync when a row is edited or deleted.
- Numeric settings are strings (`maxAttempts`, `cooldownSeconds`,
  `timeoutSeconds`) because the UI edits them as text. Parse with
  `int(value, fallback)`.
- Treat schema changes as additive. Renaming or removing a key breaks existing
  installations.

## Settings UI

- Chain rows are `Ui.SettingsRow`s. The host lays out `settings-row-control` with
  `align-items: stretch`, and `IconButton`s have a fixed 24 px height, so they
  otherwise sit at the top of a 28 px input. Wrap every icon button in a row in
  `Center` (`display: flex; align-items: center; align-self: center`); `fieldStyle`
  carries `align-self: center` for the same reason. Keep both when adding rows.
- The picker uses `ctx.dialogs.select`. It reads the live catalog through
  `catalogFor(pickSource())`, groups options by provider, and writes the canonical
  `provider/model-id`, never the typed text. Without `ctx.dialogs.select` the
  picker buttons are hidden and manual input stays; picking must never be
  required.
- A picked model is marked **Ask first** when `isPaidModel()` finds a positive
  `cost` (an object or an array of tiers). When the catalog reports no price,
  marking is a silent no-op: do not guess.
- `addCurrentModel` only appends `composer.model()` to the chain; it must not
  switch the session or touch `lastSetBySession`.

## Error matching

`matchError` prefers the machine-readable shape over the text, because providers
answer in any language:

1. `isUserAbort` (error type or name containing `abort`/`cancel`, or status
   `499`) returns no match - a cancellation is never a provider failure.
2. A `provider.*` error type (and every type in `RETRY_ERROR_TYPES`) switches,
   with or without a status.
3. Any status `>= 400` switches, except `NON_RETRY_STATUSES` (`400`, `413`, `414`,
   `415`, `422`, `499`). Those are caused by the request itself; switching would
   cool healthy models, so they need an explicit code in `retryCodes` or a
   pattern.
4. `BUILTIN_PATTERNS`, then the user's `patterns`, are the last resort for errors
   that carry neither a status nor a known type. Do not add a pattern for
   something a status or type already covers.
5. `fallbackOnAnyError` matches whatever is left.

## Event contract (desktop 2.2.5)

The engine subscribes to `ctx.servers.get("sidecar")?.data` inside `createKeyed`,
so subscriptions follow a restarted sidecar.

| Event | Payload used |
| --- | --- |
| `session.execution.started` | `data.sessionID` — records the execution's model and arms the first-token timeout |
| `session.execution.failed` | `data.sessionID`, `data.error` — primary fallback trigger |
| `session.retry.scheduled` | `data.sessionID`, `data.error`, `data.assistantMessageID` — one switch per execution, deduped by message id |
| `session.execution.succeeded` | `data.sessionID` — clears per-turn attempts, execution state and handled retries |
| `session.model.selected` | `data.sessionID`, `data.model { id, providerID }` |
| `session.text.started`, `session.reasoning.started`, `session.step.started`, `session.tool.called`, `permission.asked`, `session.execution.interrupted`, `session.idle` | cancel the timeout |

`data.on(type, handler)` returns an unsubscribe function; wrap it in
`onCleanup`.

`session.execution.failed` and `session.retry.scheduled` can both fire for one
failure, and the retry event can repeat while the server retries. Both are
attributed to the model recorded at `session.execution.started`, never to the
composer's current model. Each execution causes at most one switch: the final
failure of an already-switched execution resumes on the newly selected model
instead of walking the chain again. `assistantMessageID` from
`session.retry.scheduled` is kept in `handledRetries` so a late retry from an old
execution cannot switch after a new execution started.

Failures are handled for every live session, not only the one routed in the app
window: a background chat keeps failing over on the server instead of sitting dead
until the user returns. The composer is only mirrored for the routed session. A
model marked in `confirmModels` is skipped (never confirmed) outside the routed
session, so no dialog interrupts an unseen chat. The timeout uses one timer at a
time.

## Switching

`switchTo` does all of the following:

1. Resets per-turn attempts if the user changed the model since the last switch.
2. Enforces `maxAttempts`.
3. Orders the chain after the current model, wrapping around. Matching uses
   `entryMatches`, which is case-insensitive and tolerates provider-prefixed
   model ids.
4. Resolves each entry against the live catalog
   (`server.data.location.model.list()` / `provider.list()`, syncing once if
   empty) via `catalogFor` / `resolveEntry`.
5. Drops entries in cooldown or equal to the current model.
6. For a target marked in `confirmModels`, interrupts the execution (to stop a
   pending retry) and asks with `ctx.dialogs.confirm`, then on decline skips every
   other marked target in that attempt. Without `ctx.dialogs.confirm`, marked
   targets are skipped safely. Outside the routed session the dialog is not shown:
   the marked target is skipped instead.
7. Calls `client.session.switchModel({ sessionID, model: { id, providerID } })`
   on the server and then mirrors the choice in `composer.setModel` when the
   session is routed. The composer call alone only changes the UI: a prompt sent
   before the server knows the new model runs the old one.
8. Interrupts the running execution and sends the resume prompt when requested.
   A confirmation already interrupted it, so an approved switch resumes even if
   the caller did not ask for a prompt.
9. Records the canonical model key in `lastSetBySession`, updates the header
   badge, and notifies.

Invariants:

- Failures belong to the model the execution started on
  (`executionBySession`), not to the composer's current model. The composer may
  already show a different model because of an earlier switch.
- One execution causes at most one switch. Later failures of that execution are
  stale: they must not cool the newly selected model or walk the chain again.
  If auto-resume is on, the final failure resumes on the selected model.
- `handledRetries` is keyed by `session.retry.scheduled`'s
  `assistantMessageID`, so retries that arrive after a new execution started do
  not switch again.
- Bookkeeping keys (`cooldownUntilByModel`, `lastSetBySession`) are produced by
  `modelKey`, which lowercases provider and model ids. Never key them by a raw
  chain entry.
- `cooldownUntilByModel` stores an expiry timestamp. A provider `retryAfterMs`
  extends the cooldown beyond `cooldownSeconds`, capped at 24 hours.
- A timeout passes `cool: false`. A slow model is not a failed model; cooling it
  made the only healthy model look unavailable right after the timeout.
- `session.model.selected` cancels the first-token watchdog, otherwise a manual
  model change could still be interrupted by the old timer.
- An entry that resolves to no connected provider must be reported to the user
  (`unresolvedBody`), not silently ignored. The old behavior made a typo or a
  removed provider look like "provider switching is broken".
- Provider and model ids from the catalog win over the ids typed in settings.
  `composer.setModel` is case-sensitive and rejects unknown ids.
- A failed `setModel`, `switchModel`, `interrupt` or `prompt` must not throw out
  of the event handler.
- A declined paid switch sets `execution.stopped`, so late failures and retries
  of that execution cannot walk the chain again. One decline skips all remaining
  marked targets in that attempt; unmarked targets are still tried.
- A confirmation interrupts before the dialog and sets `execution.resumed`, so
  the old model cannot resume itself while the dialog waits. An approved switch
  sends the resume prompt even on the `session.retry.scheduled` path.
- The header badge (`session.header` slot) is per session and in memory. A manual
  `session.model.selected` for a different model clears it; the automatic
  `session.model.selected` emitted by the switch itself must not. Its
  registration is guarded: a build without this slot logs
  `header badge unavailable` and keeps the engine running.
- Never switch to a marked model without a confirmation. On a build without
  `ctx.dialogs.confirm`, skip marked targets instead of spending silently.

## Tests

```sh
bun install
bun run build
bun run test
```

The engine tests cover chained switches, resume prompts, dedupe, unrelated
errors, empty chains, case-insensitive canonical resolution, chain order,
cooldown after wrap, reporting of unresolved entries, first-token timeouts,
stale failures after a switch, late retries from an old execution,
`retryAfterMs` cooldowns, per-minute throttling reported as HTTP 403,
language-independent matching (a Chinese rate-limit message, a type without a
status), request-shape errors that must not cool models, user aborts, background
chats that keep failing over without touching the visible composer, paid-model
confirmation (approve, decline then free, decline all, late failures/retries
after stopping, no dialog from a background chat) and the safe fallback when
`Dialogs.confirm` is unavailable.

To check the settings page without a desktop app, render it under a DOM shim
(happy-dom) and stub `ui` as `{ Button, IconButton, Switch, TextInput }`; this is
the 2.2.5 shape. The published tests do not require a DOM.

## Debugging

- App logs: `%APPDATA%\ai.opencode.desktop\logs\<timestamp>\renderer.log`
  (macOS: `~/Library/Application Support/ai.opencode.desktop/logs/...`).
- Plugin failures appear as `[plugin] local-model-fallback ...`.
- Switches, timeouts, skipped entries and give-up reasons are logged with the
  `[Fallback]` prefix in `renderer.log`.
- The settings page is registered under the id `local-model-fallback`; the
  renderer remembers it as `settings?tab=local-model-fallback`.
- Direct sidecar HTTP calls return `401` without the app's credentials; prefer
  the plugin API over poking the server from a script.

## Publishing checklist

1. `DEFAULTS` contain no personal models, providers or patterns.
2. No `config.json` or other local state is committed.
3. `bun run build` was run after the last `src/gui.tsx` edit.
4. `bun run test` passes.
5. `node_modules/` and `test/.bundle.cjs` are ignored.
6. `package.json` keeps `dist` and `index.js` in `files`; the package name is
   `opencode-model-fallback-gui`, while the plugin id stays
   `local-model-fallback`.
7. Bump `version`, commit, and tag the release
   (`git tag v2.2.0 && git push --tags`). The plugin is distributed through Git,
   not npm.
8. Git installs (`opencode plugin add github:aleksslab/opencode-model-fallback-gui`)
   use the committed `dist`; rebuild and commit before tagging.
9. The license is **MIT + Commons Clause v1.0** in `LICENSE`, and
   `package.json` refers to it with `"license": "SEE LICENSE IN LICENSE"`. Never
   replace it with plain MIT: the Commons Clause is what forbids selling the
   plugin. Do not describe the project as OSI-approved open source.
10. Write the GitHub release notes in English, using the `## Changes` and
    `## Upgrade` sections. README, `AGENTS.md` and release notes stay English;
    Russian exists only in the plugin's i18n strings and settings UI.
