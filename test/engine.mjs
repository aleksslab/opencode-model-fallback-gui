import { createRoot } from "solid-js"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const gui = require("./.bundle.cjs")
const def = gui.default

const events = new Map()
const data = {
  on(type, fn) {
    const list = events.get(type) ?? []
    list.push(fn)
    events.set(type, list)
    return () => {
      const current = events.get(type) ?? []
      events.set(type, current.filter((item) => item !== fn))
    }
  },
}

const setModelCalls = []
const promptCalls = []
const toasts = []
const registered = []
const confirmCalls = []
const alerts = []

let confirmAnswer = true
let interruptCalls = 0

let model = { providerID: "opencode", modelID: "opencode-default" }

const composer = {
  model: () => model,
  setModel(next) {
    setModelCalls.push(`${next.providerID}/${next.modelID}`)
    model = { providerID: next.providerID, modelID: next.modelID }
    return true
  },
}

const dialogs = {
  async confirm(options) {
    confirmCalls.push(options)
    return typeof confirmAnswer === "function" ? confirmAnswer(options) : confirmAnswer
  },
  async alert(options) {
    alerts.push(options)
  },
}

const session = {
  id: "ses_test",
  key: "sidecar\nses_test",
  pending: false,
  server: {
    id: "sidecar",
    client: {
      session: {
        async switchModel() {},
        async interrupt() {
          interruptCalls++
          return { interrupted: true }
        },
        async prompt(input) {
          promptCalls.push(input)
          return {}
        },
      },
    },
  },
}

let config = { ...def.stores.config.initial }

const ctx = {
  id: "local-model-fallback",
  signal: new AbortController().signal,
  ui: {},
  stores: {
    config: {
      get value() {
        return config
      },
      update(fn) {
        fn(config)
      },
      set(next) {
        config = next
      },
    },
  },
  sessions: { current: () => session, list: () => [session] },
  screen: { current: () => ({ composer }) },
  servers: { get: (id) => (id === "sidecar" ? { data } : undefined), list: () => ["sidecar"] },
  toast: { show: (input) => (toasts.push(input), { dismiss() {} }) },
  dialogs,
  add: (registry, item) => registered.push({ registry, item }),
  t: (key, params) => {
    const text = def.i18n.en[key] ?? key
    if (!params) return text
    return text.replace(/\{\{(\w+)\}\}/g, (_, name) => String(params[name] ?? ""))
  },
}

const emit = (type, payload) => {
  for (const handler of events.get(type) ?? []) handler(payload)
}
const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

let failures = 0
const check = (label, condition, extra = "") => {
  console.log(`${condition ? "PASS" : "FAIL"}: ${label}${condition ? "" : ` ${extra}`}`)
  if (!condition) failures++
}

let dispose
createRoot((close) => {
  dispose = close
  def.setup(ctx)
})

// Defaults must be empty (no personal providers shipped).
check("published defaults have no models", def.stores.config.initial.models.length === 0)
check("published defaults have no patterns", def.stores.config.initial.patterns.length === 0)
check("published defaults confirm no models", def.stores.config.initial.confirmModels.length === 0)
check("settings page and header badge registered", registered.length === 2, JSON.stringify(registered.map((entry) => entry.registry)))

// A configured chain still works.
config.models = ["ProviderA/model-a", "ProviderB/model-b", "ProviderC/model-c"]

const started = (sessionID = session.id) => emit("session.execution.started", { data: { sessionID } })
const failed = (status, message, extra = {}) =>
  emit("session.execution.failed", { data: { sessionID: session.id, error: { status, message, ...extra } } })

started()
failed(429, "rate limit exceeded")
await tick()
check("failure switches to head of chain", setModelCalls[0] === "ProviderA/model-a")
check("resume prompt sent", promptCalls.length === 1 && promptCalls[0].text === "Continue")

// The auto-resume starts a new execution on the model just selected.
started()
failed(500, "upstream connect error")
await tick()
check("second failure switches to next model", setModelCalls[1] === "ProviderB/model-b", JSON.stringify(setModelCalls))

const beforeRetry = setModelCalls.length
emit("session.retry.scheduled", {
  data: { sessionID: "ses_test", assistantMessageID: "msg_same", error: { status: 500, message: "upstream connect error" } },
})
await tick()
check("retry.scheduled for the same execution is deduped", setModelCalls.length === beforeRetry)

const beforeIgnore = setModelCalls.length
started()
failed(undefined, "user aborted the tool call")
await tick()
check("unrelated error ignored", setModelCalls.length === beforeIgnore)

// Empty chain after reset: must not throw, must notify.
config.models = []
const toastsBefore = toasts.length
started()
failed(503, "service unavailable")
await tick()
check("empty chain does not switch", setModelCalls.length === 2)
check("empty chain notifies", toasts.length > toastsBefore, JSON.stringify(toasts))

// Canonical, case-insensitive provider/model resolution.
const catalog = [
  { providerID: "alpha", modelID: "team/model-one" },
  { providerID: "BetaRouter", modelID: "model-two" },
  { providerID: "BetaRouter", modelID: "model-three" },
  { providerID: "Gamma", modelID: "model-four" },
  { providerID: "Delta", modelID: "model-five" },
  { providerID: "Epsilon", modelID: "model-six" },
  { providerID: "Zeta", modelID: "model-seven" },
]
const providers = [
  { id: "alpha" },
  { id: "BetaRouter" },
  { id: "Gamma" },
  { id: "Delta" },
  { id: "Epsilon" },
  { id: "Zeta" },
]
session.server.id = "sidecar-catalog"
session.location = { projectID: "project", directory: "C:/work" }
session.server.data = {
  location: {
    model: { list: () => catalog, sync: async () => {} },
    provider: { list: () => providers, sync: async () => {} },
  },
}
config.models = [
  "Alpha/team/model-one",
  "Missing/model-x",
  "BetaRouter/model-two",
  "BetaRouter/model-three",
]
model = { providerID: "alpha", modelID: "team/model-one" }

const beforeCanonical = setModelCalls.length
started()
failed(402, "free_request_quota_exhausted")
await tick()
check(
  "case-insensitive entry resolves to canonical provider and skips unknown ones",
  setModelCalls[beforeCanonical] === "BetaRouter/model-two",
  JSON.stringify(setModelCalls),
)

const beforeNext = setModelCalls.length
started()
failed(500, "upstream connect error")
await tick()
check(
  "next failure follows the chain after the resolved model",
  setModelCalls[beforeNext] === "BetaRouter/model-three",
  JSON.stringify(setModelCalls),
)

const beforeWrap = setModelCalls.length
started()
failed(500, "upstream connect error")
await tick()
check("models in cooldown are skipped after the chain wraps", setModelCalls.length === beforeWrap, JSON.stringify(setModelCalls))

config.models = ["Alpha/team/model-one", "BetaRouter/model-two", "BetaRouter/model-three"]
const beforeCooling = toasts.length
started()
failed(500, "upstream connect error")
await tick()
check(
  "cooling-only exhaustion explains the cooldown",
  toasts.length > beforeCooling && toasts.at(-1)?.description === def.i18n.en.coolingBody,
  JSON.stringify(toasts.at(-1)),
)

config.models = ["Missing/model-x"]
const beforeUnresolved = toasts.length
started()
failed(500, "upstream connect error")
await tick()
check(
  "unresolved entries are reported instead of silently ignored",
  toasts.length > beforeUnresolved && String(toasts.at(-1)?.description).includes("Missing/model-x"),
  JSON.stringify(toasts.at(-1)),
)

// A timed-out model must not be put in cooldown: it may just be slow.
session.id = "ses_timeout"
config.models = ["Gamma/model-four", "Delta/model-five"]
config.timeoutSeconds = "1"
config.cooldownSeconds = "60"
config.autoRetry = false
model = { providerID: "Gamma", modelID: "model-four" }

const beforeTimeout = setModelCalls.length
started("ses_timeout")
await new Promise((resolve) => setTimeout(resolve, 1300))
check(
  "first-token timeout switches to the next model",
  setModelCalls[beforeTimeout] === "Delta/model-five",
  JSON.stringify(setModelCalls),
)

const beforeBack = setModelCalls.length
started("ses_timeout")
failed(500, "upstream connect error")
await tick()
check(
  "timed-out model is retried instead of being cooled",
  setModelCalls[beforeBack] === "Gamma/model-four",
  JSON.stringify(setModelCalls),
)

// Picking a model by hand must stop the watchdog armed for the old one.
session.id = "ses_manual"
const beforeManual = setModelCalls.length
started("ses_manual")
emit("session.model.selected", {
  data: { sessionID: "ses_manual", model: { providerID: "Delta", modelID: "model-five" } },
})
await new Promise((resolve) => setTimeout(resolve, 1200))
check("manual model change cancels the watchdog", setModelCalls.length === beforeManual, JSON.stringify(setModelCalls))

// A repeated failure event from an execution that already switched must not
// blame the newly selected model and walk the chain again.
session.id = "ses_stale"
config.models = ["Epsilon/model-six", "Zeta/model-seven"]
config.cooldownSeconds = "0"
model = { providerID: "Epsilon", modelID: "model-six" }
started("ses_stale")
const beforeFirstSwitch = setModelCalls.length
failed(429, "rate limit exceeded")
await tick()
check(
  "first failure of the execution switches",
  setModelCalls[beforeFirstSwitch] === "Zeta/model-seven",
  JSON.stringify(setModelCalls),
)
const beforeStale = setModelCalls.length
failed(429, "rate limit exceeded")
await tick()
check("stale failure after a switch does not switch again", setModelCalls.length === beforeStale, JSON.stringify(setModelCalls))

// A retry scheduled for an execution that already switched must be ignored, even
// after a new execution started and reset the per-execution state.
session.id = "ses_retry"
model = { providerID: "Epsilon", modelID: "model-six" }
started("ses_retry")
const beforeRetrySwitch = setModelCalls.length
emit("session.retry.scheduled", {
  data: { sessionID: "ses_retry", assistantMessageID: "msg_a", attempt: 1, error: { status: 500, message: "upstream" } },
})
await tick()
check(
  "retry.scheduled switches once",
  setModelCalls[beforeRetrySwitch] === "Zeta/model-seven",
  JSON.stringify(setModelCalls),
)

started("ses_retry")
const beforeLateRetry = setModelCalls.length
emit("session.retry.scheduled", {
  data: { sessionID: "ses_retry", assistantMessageID: "msg_a", attempt: 2, error: { status: 500, message: "upstream" } },
})
await tick()
check("late retry for the old execution is ignored", setModelCalls.length === beforeLateRetry, JSON.stringify(setModelCalls))

const beforeNewRetry = setModelCalls.length
emit("session.retry.scheduled", {
  data: { sessionID: "ses_retry", assistantMessageID: "msg_b", attempt: 1, error: { status: 500, message: "upstream" } },
})
await tick()
check(
  "a retry from the new execution still switches",
  setModelCalls[beforeNewRetry] === "Epsilon/model-six",
  JSON.stringify(setModelCalls),
)

// A provider retry hint longer than the configured cooldown must keep the model
// out of the chain for that long.
session.id = "ses_retry_after"
config.models = ["Epsilon/model-six", "Zeta/model-seven"]
config.cooldownSeconds = "0"
model = { providerID: "Epsilon", modelID: "model-six" }
started("ses_retry_after")
const beforeRetryAfterSwitch = setModelCalls.length
failed(429, "rate limit exceeded", { retryAfterMs: 3_600_000 })
await tick()
check(
  "retryAfterMs failure switches to the next model",
  setModelCalls[beforeRetryAfterSwitch] === "Zeta/model-seven",
  JSON.stringify(setModelCalls),
)
const beforeRetryAfter = setModelCalls.length
started("ses_retry_after")
failed(500, "upstream connect error")
await tick()
check(
  "retryAfterMs extends the cooldown beyond the configured seconds",
  setModelCalls.length === beforeRetryAfter,
  JSON.stringify(setModelCalls),
)

// Confirming a switch to a model the user marked as paid. Fresh models keep the
// cooldowns from the earlier cases out of these checks.
catalog.push(
  { providerID: "Omega", modelID: "model-free-a" },
  { providerID: "Omega", modelID: "model-paid" },
  { providerID: "Omega", modelID: "model-free-b" },
)
providers.push({ id: "Omega" })
session.server.id = "sidecar-confirm"

config.cooldownSeconds = "0"
config.timeoutSeconds = "0"
config.autoRetry = true
config.maxAttempts = "10"

session.id = "ses_confirm_yes"
config.models = ["Omega/model-free-a", "Omega/model-paid"]
config.confirmModels = ["Omega/model-paid"]
model = { providerID: "Delta", modelID: "model-five" }
confirmCalls.length = 0
confirmAnswer = true
const yesInterrupts = interruptCalls

started("ses_confirm_yes")
let beforeConfirm = setModelCalls.length
failed(429, "rate limit exceeded")
await tick()
check(
  "an unmarked target switches without confirmation",
  setModelCalls[beforeConfirm] === "Omega/model-free-a" && confirmCalls.length === 0,
  JSON.stringify({ calls: setModelCalls, confirms: confirmCalls.length }),
)

beforeConfirm = setModelCalls.length
const yesPrompts = promptCalls.length
started("ses_confirm_yes")
failed(429, "rate limit exceeded")
await tick()
check(
  "confirming a marked paid model switches and resumes",
  setModelCalls[beforeConfirm] === "Omega/model-paid" &&
    confirmCalls.length === 1 &&
    promptCalls.length === yesPrompts + 1 &&
    interruptCalls > yesInterrupts,
  JSON.stringify({ calls: setModelCalls, confirms: confirmCalls.length, prompts: promptCalls.length }),
)
check(
  "the confirmation names both models and the reason",
  confirmCalls[0]?.title === def.i18n.en.confirmTitle &&
    String(confirmCalls[0]?.description).includes("Omega/model-free-a") &&
    String(confirmCalls[0]?.description).includes("Omega/model-paid") &&
    String(confirmCalls[0]?.description).includes("HTTP 429"),
  JSON.stringify(confirmCalls[0]),
)

// Declining keeps looking for an unmarked (free) model.
session.id = "ses_confirm_decline_free"
config.models = ["Omega/model-free-a", "Omega/model-paid", "Omega/model-free-b"]
config.confirmModels = ["Omega/model-paid"]
model = { providerID: "Delta", modelID: "model-five" }
confirmCalls.length = 0
confirmAnswer = false

started("ses_confirm_decline_free")
failed(429, "rate limit exceeded")
await tick()
const beforeDecline = setModelCalls.length
started("ses_confirm_decline_free")
failed(429, "rate limit exceeded")
await tick()
check(
  "declining a paid model continues to the next free model",
  setModelCalls[beforeDecline] === "Omega/model-free-b" &&
    confirmCalls.length === 1 &&
    !setModelCalls.slice(beforeDecline).includes("Omega/model-paid"),
  JSON.stringify({ calls: setModelCalls, confirms: confirmCalls.length }),
)

// Declining once skips the rest of the marked models in the same attempt, and
// the execution stays stopped against late failures and retries.
session.id = "ses_confirm_decline_all"
config.models = ["Omega/model-free-a", "Omega/model-paid"]
config.confirmModels = ["Omega/model-free-a", "Omega/model-paid"]
model = { providerID: "Delta", modelID: "model-five" }
confirmCalls.length = 0
confirmAnswer = false
const allBefore = setModelCalls.length
const allToasts = toasts.length

started("ses_confirm_decline_all")
failed(429, "rate limit exceeded")
await tick()
check(
  "declining skips every remaining marked model after one prompt",
  setModelCalls.length === allBefore && confirmCalls.length === 1,
  JSON.stringify({ calls: setModelCalls, confirms: confirmCalls.length }),
)
check(
  "declining explains that paid models were skipped",
  toasts.length > allToasts && toasts.at(-1)?.description === def.i18n.en.declinedBody,
  JSON.stringify(toasts.at(-1)),
)

const stoppedBefore = setModelCalls.length
failed(429, "rate limit exceeded")
await tick()
check("a late failure after declining does not switch", setModelCalls.length === stoppedBefore, JSON.stringify(setModelCalls))

emit("session.retry.scheduled", {
  data: {
    sessionID: "ses_confirm_decline_all",
    assistantMessageID: "msg_declined",
    attempt: 1,
    error: { status: 500, message: "upstream" },
  },
})
await tick()
check("a retry after declining does not switch", setModelCalls.length === stoppedBefore, JSON.stringify(setModelCalls))

// An app build without `Dialogs.confirm` must never spend silently: marked
// models are skipped, free ones still work.
session.id = "ses_confirm_unavailable"
config.models = ["Omega/model-free-a", "Omega/model-paid"]
config.confirmModels = ["Omega/model-free-a"]
model = { providerID: "Delta", modelID: "model-five" }
confirmCalls.length = 0
const savedDialogs = ctx.dialogs
ctx.dialogs = {}
const unavailableBefore = setModelCalls.length

started("ses_confirm_unavailable")
failed(429, "rate limit exceeded")
await tick()
ctx.dialogs = savedDialogs
check(
  "without a confirm dialog, marked models are skipped and free ones still switch",
  setModelCalls[unavailableBefore] === "Omega/model-paid" &&
    toasts.at(-1)?.description === def.i18n.en.switchedBody.replace("{{model}}", "Omega/model-paid").replace("{{reason}}", "HTTP 429"),
  JSON.stringify({ calls: setModelCalls, toasts: toasts.at(-1) }),
)
confirmAnswer = true

dispose()
console.log(failures === 0 ? "ALL PASS" : `${failures} FAILED`)
process.exit(failures === 0 ? 0 : 1)
