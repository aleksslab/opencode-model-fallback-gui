# OpenCode Model Fallback (GUI plugin)

A GUI plugin for OpenCode Desktop that keeps an answer going when the active
model fails.

When a request fails with a matching error, the plugin switches the session to the
next model from your fallback chain, optionally sends a short resume prompt, and
shows a toast. Everything is configured in the app's settings UI — no hand-edited
config file.

## Features

- **Automatic model switching** on the error's machine-readable shape (HTTP status
  and error type), regular-expression error patterns, or any error.
- **Ordered fallback chain** that wraps around and skips models in cooldown.
- **Case-insensitive matching** that resolves entries to the provider ids the app
  actually uses. An entry no connected provider offers is skipped and reported
  instead of failing silently.
- **First-token timeout**: if a model produces nothing within a configurable
  window, the execution is interrupted and the next model is tried.
- **Auto-resume** with a configurable prompt (`Continue` by default).
- **Paid-model guard**: mark any chain entry with **Ask first**. Before switching
  to it, the plugin interrupts the running turn and asks for confirmation. If you
  decline, it keeps looking for the next unmarked (free) model instead.
- **Model picker**: the magnifier in each chain row opens a searchable list of
  every model the connected providers offer, grouped by provider. Picking one
  writes the canonical `provider/model-id` and marks the row **Ask first**
  automatically when the catalog reports a price. **Add current model** appends
  whatever the open session is sending with. Manual typing stays available for
  models from disconnected providers.
- **Header badge** showing the last automatic switch: which model failed, which
  one took over, the reason, and when. It clears when you pick a model yourself.
  A click on it either opens the side panel with today's switch log or shows the
  last switch in a window, as set in **Header button click**.
- **Toasts** for switches and for exhausted chains.
- **Localized settings** (English and Russian) with an adaptive layout for newer
  and older desktop builds.

## Requirements

- OpenCode Desktop **2.2.5 or newer** (V2 GUI plugins and the
  `gui-experimental` package export). Tested on 2.2.5 and 2.2.6.
- At least two models already configured and connected in OpenCode.
- [Bun](https://bun.sh) and [Vite](https://vite.dev) only if you build from source.

The GUI plugin API is marked experimental and may change between desktop
releases. On older 2.2.x builds the plugin normally still switches models, but
the header badge or the paid-model confirmation can be missing. On a build
without `ctx.dialogs.confirm`, models marked **Ask first** are skipped instead of
switched silently. Without `ctx.dialogs.select`, the model picker is hidden and
chain entries are typed by hand.

## Install

This is a GUI plugin, so OpenCode Desktop reads it from the **global**
`opencode.json(c)` only — a project-level config will not show the settings
page. The plugin id is always `local-model-fallback`, however it is installed,
so your saved settings survive a switch between the methods below.

### From GitHub (recommended)

```sh
opencode plugin add github:aleksslab/opencode-model-fallback-gui
```

Or add the package to `plugins` in the global `opencode.json(c)`:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["github:aleksslab/opencode-model-fallback-gui"]
}
```

Pin a tag or a commit when you need a stable snapshot:

```jsonc
"plugins": ["github:aleksslab/opencode-model-fallback-gui#v2.2.0"]
```

Updates are not applied silently to unpinned Git packages; run
`opencode plugin update` to replace the installed copy. The package is not
published to npm.

### Let an agent install it

An agent that installs the plugin from outside this repository never sees
`AGENTS.md`, and the plugin ships with an empty chain. Give it this task
instead of "connect my plugin":

> Install the OpenCode plugin `github:aleksslab/opencode-model-fallback-gui#v2.2.0`
> with `opencode plugin add` into the **global** `~/.config/opencode/opencode.json(c)`.
> Never put it in a project config, and do not change any other key there.
> Then run `opencode plugin list`, show me the lines you changed, and remind me to
> restart OpenCode Desktop. Leave the fallback chain empty: I will fill it in
> **Settings → Model fallback** myself.

If `opencode` is not on the PATH, add the entry to the global config by hand
(the snippet above) instead; the app installs and loads it on the next start.

### From a local checkout

1. Clone the repository somewhere permanent:

   ```sh
   git clone https://github.com/aleksslab/opencode-model-fallback-gui.git
   ```

   The built bundle is committed, so no build is required. For a private fork,
   use an account with access: SSH or HTTPS with a personal access token.

2. Add the folder to the global `opencode.json(c)`:

   ```jsonc
   {
     "$schema": "https://opencode.ai/config.json",
     "plugins": [
       "file:///C:/Users/you/opencode-model-fallback-gui"
     ]
   }
   ```

   - Windows: `file:///C:/Users/you/opencode-model-fallback-gui`
   - macOS / Linux: `file:///home/you/opencode-model-fallback-gui`
   - An absolute path (`"C:/Users/you/opencode-model-fallback-gui"`) or a
     relative one (`"./opencode-model-fallback-gui"`) also works. Use forward
     slashes.

   The folder must contain this repository's `package.json`, whose
   `./gui-experimental` export points at `dist/gui-experimental.cjs`. Without a
   `package.json`, the app looks for `gui-experimental.cjs` at the folder root.

3. Save the file. OpenCode reloads plugins on save; restart the desktop app if
   the plugin does not appear.

### Finish

4. Open **Settings → Extensions → Plugins** and check that
   `local-model-fallback` is listed and enabled. The switch there turns the GUI
   part off without removing the plugin.

5. Open **Settings → Model fallback**, enable the plugin, and add your chain.

The plugin's server part is a no-op, so installing it adds no CLI tools or
server hooks. Only OpenCode Desktop shows the settings page; the TUI ignores the
GUI part.

## Fallback chain

Each row is a `provider/model-id` entry, tried top to bottom:

```
my-provider/model-a
other-provider/model-b
other-provider/model-c
```

- Matching ignores case, so `My-Provider/model-a` resolves to `my-provider/model-a`.
- Model ids may include a provider prefix (`vendor/model`).
- Entries whose provider or model is not offered by any connected provider are
  skipped. When the chain is exhausted, the toast lists them so you can fix the
  settings.
- The chain wraps around. After the last entry the plugin continues from the
  first, skipping models that failed within the cooldown window.
- If the current model is not in the chain, switching starts from the first
  entry.
- Turn on **Ask first** on a row for models that may charge money. If you decline
  the confirmation, the marked rows are skipped for that attempt and the plugin
  continues to the next unmarked model. If none is left, the turn stops instead
  of switching.

The magnifier on a row opens **Pick a model**: a searchable list of every model
the connected providers offer, grouped by provider, with the canonical
`provider/model-id` under each name. Picking one replaces the row's text with the
catalog id, so it always matches the provider's real casing. If the catalog
reports a price for the picked model, the row is marked **Ask first**
automatically. **Add current model**, next to **Add model**, appends the model the
open session is currently sending prompts with. Manual typing remains available
for models whose provider is disconnected, and the picker is hidden on desktop
builds without `ctx.dialogs.select`.

The **Ask first** mark follows the row when you edit or move it, and is removed
with the row.

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| Enable fallback | on | Master switch. |
| Show notifications | on | Toast on every switch. |
| HTTP status codes | `429, 408, 500, 502, 503, 504, 529` | Extra statuses that always switch. |
| Error message patterns | empty | Case-insensitive regular expressions. |
| Switch on any error | off | Fall back even when nothing matched. |
| Maximum switches | `10` | Models tried per turn before giving up. |
| Cooldown (seconds) | `60` | How long a failed model is skipped. |
| First token timeout (seconds) | `120` | `0` disables the timeout. Long prompts may need more. |
| Auto-resume | on | Send the resume prompt after switching. |
| Resume prompt | `Continue` | Text sent after a switch. |
| Header button click | Open today's log | A click on the header badge opens today's switch log in the side panel, or shows the last switch in a window. |
| Fallback chain | empty | Ordered `provider/model-id` entries. |
| Ask first (per chain row) | off | Confirm before switching to this model; use it for paid models. |

A failure is recognized by its shape before its text. Provider errors
(`provider.rate-limit`, `provider.quota`, `provider.free-limit`, `provider.auth`
and other `provider.*` kinds) and every 4xx/5xx status except `400`, `413`, `414`,
`415`, `422` and `499` switch the model. That makes the behaviour independent of
the language the provider answers in: Russian, Chinese and English messages are
treated the same. The request-shape statuses above are excluded so a malformed
request cannot cool healthy models; list one in **HTTP status codes** to switch on
it anyway.

A user cancellation (`CancelledError`, `AbortError`, status `499`) never switches.
When an error carries neither a status nor a known type, the built-in message
patterns (rate limit, quota, high demand, overload, timeout, connection and
provider errors) and your own patterns are used as a fallback.

## How it works

The plugin subscribes to the desktop sidecar events:

- `session.execution.started` records the model the execution runs on and arms
  the first-token watchdog.
- Text, reasoning, tool and permission events cancel the watchdog once the model
  is responding.
- `session.execution.failed` and `session.retry.scheduled` select a target from
  the chain and switch the session model on the server, then mirror it in the
  composer. Failures are attributed to the model the execution started on, so a
  switch is not blamed for the old model's errors. One execution causes at most
  one switch; a retry is deduplicated by its assistant message id.
- `session.execution.succeeded` resets the per-turn attempt counters.

Failures from chats that are not on screen are handled too: the model is switched
on the server and the turn is resumed in that chat, so a background session does
not sit dead until you return to it. A model marked **Ask first** is never
confirmed from a background chat; it is skipped, because a dialog raised there
would interrupt a chat you cannot see.

When a provider reports `retryAfterMs`, that model stays out of the chain for
that long (up to 24 hours) even if the configured cooldown is shorter.

A timeout is not treated as a failure: the slow model is switched away from but
not put in cooldown, so the chain can return to it when the other models fail.
Changing the model manually cancels the timeout watchdog.

### Paid models

A chain row with **Ask first** enabled is not switched to silently. The plugin
first interrupts the running execution (or the pending retry) and opens the app's
confirmation dialog naming the failed model, the target and the reason. On
**Switch** it changes the model and resumes the turn. On **Cancel** it skips every
other marked row in the same attempt, switches to the next unmarked model if one
exists, and otherwise stops the turn. Nothing is charged for a declined target.

On an older desktop build without `Dialogs.confirm`, the plugin does not fall
back to silent switching: marked rows are skipped and a toast reports why.

The header badge is per session and in memory. It shows the last automatic
switch until you choose a model yourself or another automatic switch replaces it.
A click on the badge follows **Header button click**: by default it opens the
side panel with the session's switch log for today (who switched to what, when,
and why), and **Fallback log** in the session panel menu opens the same view.
With **Show the last switch** selected, a click opens a small window instead. The
log keeps the newest 60 switches per session; older days stay in memory but are
not listed.

Before switching, chain entries are resolved against the app's live model
catalog, so provider ids keep their real casing and model ids keep their real
form. Cooldowns and attempt counters are keyed by the canonical model, which
prevents loops and prevents a model from being retried immediately.

## Privacy

The published defaults contain **no providers, models, patterns or API keys**.
Your chain and patterns are stored locally by the desktop app (under
`plugin.local-model-fallback.config`) and are never written into this repository.
Model switching runs entirely through the connected app; the plugin does not call
provider APIs or read credentials.

## Build

```sh
bun install
bun run build   # writes dist/gui-experimental.cjs
bun run test    # engine tests, no desktop app needed
```

`dist/gui-experimental.cjs` is committed because `package.json` maps
`./gui-experimental` to it. Rebuild and commit it after changing `src/gui.tsx`.

`@opencode/plugin` and `effect` are provided by the desktop app at runtime. The
bundle only requires `solid-js`, `solid-js/web`, `effect` and
`@opencode/plugin/gui`.

## Project layout

```
index.js                  server-side entry (registers nothing)
src/gui.tsx               settings page, fallback engine, i18n
dist/gui-experimental.cjs built CJS bundle loaded by the app
test/                     engine tests and bundle preparation
vite.config.ts            GUI bundle build
```

## License

MIT with the [Commons Clause](https://commonsclause.com/) License Condition
v1.0. See [LICENSE](LICENSE).

This is **source-available**, not an OSI-approved open-source license. You may
use, copy, modify, and redistribute the plugin, including inside a company, but
you may not **sell** it or a product or service whose value derives
substantially from it.

The Commons Clause only removes the right to sell; the rest of the MIT terms,
including the warranty disclaimer, still apply.
