# OpenCode Model Fallback (GUI plugin)

A GUI plugin for OpenCode Desktop that keeps an answer going when the active
model fails.

When a request fails with a matching error, the plugin switches the session to the
next model from your fallback chain, optionally sends a short resume prompt, and
shows a toast. Everything is configured in the app's settings UI — no hand-edited
config file.

## Features

- **Automatic model switching** on HTTP status codes, regular-expression error
  patterns, or any error.
- **Ordered fallback chain** that wraps around and skips models in cooldown.
- **Case-insensitive matching** that resolves entries to the provider ids the app
  actually uses. An entry no connected provider offers is skipped and reported
  instead of failing silently.
- **First-token timeout**: if a model produces nothing within a configurable
  window, the execution is interrupted and the next model is tried.
- **Auto-resume** with a configurable prompt (`Continue` by default).
- **Toasts** for switches and for exhausted chains.
- **Localized settings** (English and Russian) with an adaptive layout for newer
  and older desktop builds.

## Requirements

- OpenCode Desktop **2.2.5 or newer** (V2 GUI plugins and the
  `gui-experimental` package export).
- At least two models already configured and connected in OpenCode.
- [Bun](https://bun.sh) and [Vite](https://vite.dev) only if you build from source.

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
"plugins": ["github:aleksslab/opencode-model-fallback-gui#v2.0.1"]
```

Updates are not applied silently to unpinned Git packages; run
`opencode plugin update` to replace the installed copy. The package is not
published to npm.

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

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| Enable fallback | on | Master switch. |
| Show notifications | on | Toast on every switch. |
| HTTP status codes | `429, 408, 500, 502, 503, 504, 529` | Comma or space separated. |
| Error message patterns | empty | Case-insensitive regular expressions. |
| Switch on any error | off | Fall back even when nothing matched. |
| Maximum switches | `10` | Models tried per turn before giving up. |
| Cooldown (seconds) | `60` | How long a failed model is skipped. |
| First token timeout (seconds) | `120` | `0` disables the timeout. Long prompts may need more. |
| Auto-resume | on | Send the resume prompt after switching. |
| Resume prompt | `Continue` | Text sent after a switch. |
| Fallback chain | empty | Ordered `provider/model-id` entries. |

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

When a provider reports `retryAfterMs`, that model stays out of the chain for
that long (up to 24 hours) even if the configured cooldown is shorter.

A timeout is not treated as a failure: the slow model is switched away from but
not put in cooldown, so the chain can return to it when the other models fail.
Changing the model manually cancels the timeout watchdog.

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
