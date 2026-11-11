import { Index, Show, createSignal, onCleanup } from "solid-js"
import { Schema } from "effect"
import { Plugin, Store, SettingsPage, Slot, Panel, MenuItem, createKeyed } from "@opencode/plugin/gui"

/* ------------------------------------------------------------------------- */
/* Config                                                                     */
/* ------------------------------------------------------------------------- */

const DEFAULTS = {
  enabled: true,
  notifyOnFallback: true,
  autoRetry: true,
  fallbackOnAnyError: false,
  retryCodes: "429, 408, 500, 502, 503, 504, 529",
  patterns: [],
  maxAttempts: "10",
  cooldownSeconds: "60",
  timeoutSeconds: "120",
  triggerText: "Continue",
  models: [],
  confirmModels: [],
  clickAction: "log" as ClickAction,
}

/** What a click on the header badge does: show the last switch or open today's log. */
type ClickAction = "last" | "log"

type Config = {
  enabled: boolean
  notifyOnFallback: boolean
  autoRetry: boolean
  fallbackOnAnyError: boolean
  retryCodes: string
  patterns: string[]
  maxAttempts: string
  cooldownSeconds: string
  timeoutSeconds: string
  triggerText: string
  models: string[]
  /** Chain entries that require a confirmation before switching to them. */
  confirmModels: string[]
  clickAction: ClickAction
}

const ConfigSchema = Schema.Struct({
  enabled: Schema.Boolean,
  notifyOnFallback: Schema.Boolean,
  autoRetry: Schema.Boolean,
  fallbackOnAnyError: Schema.Boolean,
  retryCodes: Schema.String,
  patterns: Schema.Array(Schema.String),
  maxAttempts: Schema.String,
  cooldownSeconds: Schema.String,
  timeoutSeconds: Schema.String,
  triggerText: Schema.String,
  models: Schema.Array(Schema.String),
  confirmModels: Schema.Array(Schema.String),
  clickAction: Schema.Union([Schema.Literal("last"), Schema.Literal("log")]),
})

const definition = Plugin.define({
  // Stored as plugin.<id>.config in the app's own storage, loaded before setup.
  stores: {
    config: Store.global(ConfigSchema, DEFAULTS),
  },
  i18n: {
    en: {
      title: "Model fallback",
      description:
        "When the active model fails or stops responding, switch the session to the next model in the chain.",
      sectionGeneral: "General",
      sectionTriggers: "When to switch",
      sectionLimits: "Limits",
      sectionChain: "Fallback chain",
      sectionResume: "Resume",
      enabled: "Enable fallback",
      enabledDescription: "Turn automatic model switching on or off.",
      notify: "Show notifications",
      notifyDescription: "Show a toast whenever a model is switched.",
      codes: "HTTP status codes",
      codesDescription:
        "Comma or space separated. These statuses always trigger a switch. Provider errors and other 4xx/5xx switch by default, except 400, 413, 414, 415, 422 and 499.",
      patterns: "Error message patterns",
      patternsDescription: "Case-insensitive regular expressions matched against the error message.",
      patternN: "Pattern {{n}}",
      addPattern: "Add pattern",
      anyError: "Switch on any error",
      anyErrorDescription: "Switch even when the error is not matched by a status code or pattern.",
      maxAttempts: "Maximum switches",
      maxAttemptsDescription: "How many models may be tried in one turn before giving up.",
      cooldown: "Cooldown (seconds)",
      cooldownDescription: "A model that just failed is skipped for this long.",
      timeout: "First token timeout (seconds)",
      timeoutDescription: "Switch when a model produces nothing within this time. 0 disables it. Long prompts may need more than 30 seconds.",
      triggerText: "Resume prompt",
      triggerTextDescription: "Text sent to the session after switching, when auto-resume is on.",
      autoRetry: "Auto-resume",
      autoRetryDescription: "Send the resume prompt after switching so the answer continues.",
      modelsDescription:
        "Tried top to bottom. Each entry is provider/model-id. Case is ignored, and entries no connected provider offers are skipped. Turn on \"Ask first\" for paid models. The search button picks a model from the catalog.",
      modelN: "Model {{n}}",
      addModel: "Add model",
      pickModel: "Pick a model",
      pickModelTitle: "Choose a model",
      pickModelPlaceholder: "Search models",
      pickModelEmpty: "The model catalog is empty. Connect a provider or type the id manually.",
      pickModelUnavailable: "Picking models is unavailable in this OpenCode version.",
      modelPaid: "paid",
      addCurrent: "Add current model",
      currentMissing: "No model is selected in the current session.",
      alreadyInChain: "That model is already in the chain.",
      markedPaid: "Marked as Ask first: the catalog reports a price for this model.",
      confirmShort: "Ask first",
      confirmSwitch: "Ask first",
      confirmSwitchDescription:
        "Show a confirmation before switching to this model. Use it for paid models so a fallback cannot spend money silently.",
      confirmTitle: "Switch to a paid model?",
      confirmBody: "{{from}} failed ({{reason}}). Switch to {{model}}? It may incur charges.",
      confirmAction: "Switch",
      confirmCancel: "Cancel",
      declinedBody: "Paid models were skipped: no free model is left in the chain.",
      confirmUnavailable: "Confirmation is unavailable in this OpenCode version, so paid models were skipped.",
      badge: "Fallback",
      badgeTitle: "Last fallback switch",
      badgeDetails: "From {{from}} to {{to}}. Reason: {{reason}}.",
      badgeAria: "Open the fallback log",
      clickAction: "Header button click",
      clickActionDescription:
        "What the Fallback button in a chat header does: show the last switch in a window or open today's switch log in the side panel.",
      clickLast: "Show the last switch",
      clickLog: "Open today's log",
      logTitle: "Fallback log",
      logEmpty: "No fallback switches today.",
      logClear: "Clear",
      logAttempt: "attempt {{n}}",
      reset: "Reset to defaults",
      moveUp: "Move up",
      moveDown: "Move down",
      remove: "Remove",
      entryEnabled: "Enable fallback",
      entryTrigger: "Error triggers",
      entryChain: "Fallback chain",
      entryLimits: "Limits and timeout",
      entryResume: "Resume prompt",
      switchedTitle: "Model fallback",
      switchedBody: "Switched to {{model}} ({{reason}})",
      exhaustedTitle: "Fallback exhausted",
      exhaustedBody: "No model in the chain is available right now.",
      noChain: "The fallback chain is empty.",
      coolingBody: "Every other model in the chain is cooling down after a failure. Try again shortly.",
      unresolvedBody: "Not offered by any connected provider: {{models}}",
    },
    ru: {
      title: "Переключение моделей",
      description:
        "Когда активная модель падает или перестаёт отвечать, сессия переключается на следующую модель из цепочки.",
      sectionGeneral: "Основные",
      sectionTriggers: "Когда переключать",
      sectionLimits: "Ограничения",
      sectionChain: "Цепочка моделей",
      sectionResume: "Продолжение",
      enabled: "Включить переключение",
      enabledDescription: "Включить или выключить автоматическую смену модели.",
      notify: "Показывать уведомления",
      notifyDescription: "Показывать всплывающее уведомление при каждой смене модели.",
      codes: "HTTP-коды ошибок",
      codesDescription:
        "Через запятую или пробел. Эти коды всегда запускают переключение. Ошибки провайдера и остальные 4xx/5xx переключают по умолчанию, кроме 400, 413, 414, 415, 422 и 499.",
      patterns: "Шаблоны текста ошибок",
      patternsDescription: "Регулярные выражения без учёта регистра, проверяются по тексту ошибки.",
      patternN: "Шаблон {{n}}",
      addPattern: "Добавить шаблон",
      anyError: "Переключать при любой ошибке",
      anyErrorDescription: "Переключать, даже если ошибка не совпала ни с кодом, ни с шаблоном.",
      maxAttempts: "Максимум переключений",
      maxAttemptsDescription: "Сколько моделей можно попробовать за один ход.",
      cooldown: "Кулдаун (секунды)",
      cooldownDescription: "Сколько не использовать модель, которая только что упала.",
      timeout: "Таймаут первого токена (секунды)",
      timeoutDescription: "Переключить, если модель ничего не выдала за это время. 0 — выключено. Длинным промптам может понадобиться больше 30 секунд.",
      triggerText: "Текст продолжения",
      triggerTextDescription: "Что отправить в сессию после переключения, если включено автопродолжение.",
      autoRetry: "Автопродолжение",
      autoRetryDescription: "Отправлять текст продолжения после переключения, чтобы ответ не оборвался.",
      modelsDescription:
        "Пробуются сверху вниз. Формат: provider/model-id. Регистр не важен, недоступные у провайдеров записи пропускаются. Включите «Спрашивать» для платных моделей. Кнопка поиска выбирает модель из каталога.",
      modelN: "Модель {{n}}",
      addModel: "Добавить модель",
      pickModel: "Выбрать модель",
      pickModelTitle: "Выберите модель",
      pickModelPlaceholder: "Поиск моделей",
      pickModelEmpty: "Каталог моделей пуст. Подключите провайдера или введите id вручную.",
      pickModelUnavailable: "Выбор моделей недоступен в этой версии OpenCode.",
      modelPaid: "платная",
      addCurrent: "Добавить текущую",
      currentMissing: "В текущей сессии модель не выбрана.",
      alreadyInChain: "Эта модель уже есть в цепочке.",
      markedPaid: "Отмечено «Спрашивать»: у модели указана цена.",
      confirmShort: "Спрашивать",
      confirmSwitch: "Спрашивать",
      confirmSwitchDescription:
        "Показывать подтверждение перед переключением на эту модель. Используйте для платных моделей, чтобы fallback не тратил деньги молча.",
      confirmTitle: "Переключиться на платную модель?",
      confirmBody: "{{from}} не сработала ({{reason}}). Переключиться на {{model}}? Это может стоить денег.",
      confirmAction: "Переключиться",
      confirmCancel: "Отмена",
      declinedBody: "Платные модели пропущены: бесплатных в цепочке больше нет.",
      confirmUnavailable: "Подтверждение недоступно в этой версии OpenCode, поэтому платные модели пропущены.",
      badge: "Автосмена",
      badgeTitle: "Последнее переключение",
      badgeDetails: "С {{from}} на {{to}}. Причина: {{reason}}.",
      badgeAria: "Открыть журнал переключений",
      clickAction: "Клик по кнопке в хедере",
      clickActionDescription:
        "Что делает кнопка «Автосмена» в хедере чата: показывает последнее переключение в окне или открывает журнал переключений за сегодня в боковой панели.",
      clickLast: "Показать последнее переключение",
      clickLog: "Открыть журнал за сегодня",
      logTitle: "Журнал переключений",
      logEmpty: "Сегодня переключений ещё не было.",
      logClear: "Очистить",
      logAttempt: "попытка {{n}}",
      reset: "Сбросить настройки",
      moveUp: "Выше",
      moveDown: "Ниже",
      remove: "Удалить",
      entryEnabled: "Включение переключения",
      entryTrigger: "Триггеры ошибок",
      entryChain: "Цепочка моделей",
      entryLimits: "Лимиты и таймаут",
      entryResume: "Текст продолжения",
      switchedTitle: "Переключение модели",
      switchedBody: "Включена модель {{model}} ({{reason}})",
      exhaustedTitle: "Модели закончились",
      exhaustedBody: "Ни одна модель из цепочки сейчас недоступна.",
      noChain: "Цепочка моделей пуста.",
      coolingBody: "Все остальные модели цепочки на кулдауне после ошибок. Попробуйте чуть позже.",
      unresolvedBody: "Нет у подключённых провайдеров: {{models}}",
    },
  },
})

/* ------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* ------------------------------------------------------------------------- */

const BUILTIN_PATTERNS = [
  /rate[\s_-]?limit/i,
  /too many requests/i,
  /quota/i,
  /resource exhausted/i,
  /high demand/i,
  /overloaded/i,
  /over capacity/i,
  /capacity is limited/i,
  /per[\s_-]?minute/i,
  /try again (?:later|shortly|in|after)/i,
  /billing/i,
  /insufficient/i,
  /payment required/i,
  /suspended/i,
  /invalid api key/i,
  /api key.*(invalid|expired|missing)/i,
  /unauthorized/i,
  /forbidden/i,
  /model .*(not found|not available|not supported|unavailable)/i,
  /no such model/i,
  /timed? ?out/i,
  /timeout/i,
  /fetch failed/i,
  /network error/i,
  /econn(reset|refused|aborted)/i,
  /socket hang ?up/i,
  /connection.*(reset|refused|closed)/i,
  /bad gateway/i,
  /service unavailable/i,
  /internal server error/i,
  /gateway time-?out/i,
  /upstream/i,
  /api_apicallerror/i,
  /provider returned error/i,
  /provider error/i,
  /invalid_request_error/i,
  /server_error/i,
  /something went wrong/i,
]

function int(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function parseCodes(value: string) {
  return value
    .split(/[^0-9]+/)
    .map((part) => Number.parseInt(part, 10))
    .filter((code) => Number.isFinite(code) && code >= 100 && code <= 599)
}

function compilePatterns(patterns: string[]) {
  return patterns
    .map((pattern) => pattern.trim())
    .filter(Boolean)
    .map((pattern) => {
      try {
        return new RegExp(pattern, "i")
      } catch {
        return undefined
      }
    })
    .filter((regex): regex is RegExp => regex !== undefined)
}

/** Split a chain entry such as "provider/model-id". */
function splitModel(path: string) {
  const trimmed = path.trim()
  const slash = trimmed.indexOf("/")
  if (slash <= 0 || slash === trimmed.length - 1) return undefined
  return { providerID: trimmed.slice(0, slash), modelID: trimmed.slice(slash + 1) }
}

type Model = { providerID: string; modelID: string; name?: string; paid?: boolean }

function modelPath(model: Model) {
  return `${model.providerID}/${model.modelID}`
}

/** Time for the switch log: clock only for today, date and time for older entries. */
function formatLogTime(at: number) {
  const date = new Date(at)
  const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  if (isToday(at)) return time
  return `${date.toLocaleDateString()} ${time}`
}

/** The log keeps today's switches; older ones stay in memory but are not listed. */
function isToday(at: number) {
  const date = new Date(at)
  const now = new Date()
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  )
}

/** Display name for a model, falling back to its id. */
function modelLabel(model: Model) {
  const name = model.name?.trim()
  return name ? name : model.modelID
}

/** Whether the catalog reports a price for this model. */
function isPaidModel(model: any) {
  if (model?.paid === true) return true
  const cost = model?.cost
  if (Array.isArray(cost)) return cost.some((tier) => isPaidModel({ cost: tier }))
  if (!cost || typeof cost !== "object") return false
  const values = [cost.input, cost.output, cost.cache?.read, cost.cache?.write]
  return values.some((value) => typeof value === "number" && value > 0)
}

/** Provider and model ids compare case-insensitively, as providers spell them inconsistently. */
function normalize(value: string) {
  return value.trim().toLowerCase()
}

function modelIdsMatch(a: string, b: string) {
  const left = normalize(a)
  const right = normalize(b)
  return left === right || left.endsWith(`/${right}`) || right.endsWith(`/${left}`)
}

function sameModel(a: Model, b: Model) {
  return normalize(a.providerID) === normalize(b.providerID) && modelIdsMatch(a.modelID, b.modelID)
}

/** Stable key for cooldown and attempt bookkeeping. */
function modelKey(model: Model) {
  return `${normalize(model.providerID)}/${normalize(model.modelID)}`
}

/** Whether switching to this target needs the user's confirmation first. */
function needsConfirmation(entry: string, target: Model, config: Config) {
  if (config.confirmModels.length === 0) return false
  const path = modelPath(target)
  return config.confirmModels.some((value) => {
    const key = value.trim()
    if (!key) return false
    if (normalize(key) === normalize(entry) || normalize(key) === normalize(path)) return true
    const parsed = splitModel(key)
    return parsed ? sameModel(parsed, target) : false
  })
}

/** Match a chain entry against a live model, tolerating case and provider-prefixed model ids. */
function entryMatches(entry: string, model: Model) {
  const parsed = splitModel(entry)
  if (!parsed || normalize(parsed.providerID) !== normalize(model.providerID)) return false
  return modelIdsMatch(parsed.modelID, model.modelID)
}

/**
 * Statuses caused by the request itself. Switching models would only hide a bug
 * and would cool models that are perfectly healthy, so these need an explicit
 * status code or a matching pattern to switch.
 */
const NON_RETRY_STATUSES = new Set([400, 413, 414, 415, 422, 499])

/** Machine-readable error kinds reported by the app; they never depend on the provider's language. */
const RETRY_ERROR_TYPES = new Set([
  "provider.auth",
  "provider.billing",
  "provider.free-limit",
  "provider.network",
  "provider.not-found",
  "provider.overloaded",
  "provider.quota",
  "provider.rate-limit",
  "provider.timeout",
  "provider.unavailable",
])

function errorStatus(error: any): number | undefined {
  const raw = error?.status ?? error?.statusCode
  const status = typeof raw === "string" ? Number(raw) : raw
  return typeof status === "number" && Number.isFinite(status) ? status : undefined
}

/** A user cancellation is not a provider failure and must never switch the model. */
function isUserAbort(error: any) {
  const type = String(error?.type ?? "")
  const name = String(error?.name ?? "")
  if (/abort|cancel/i.test(type) || /abort|cancel/i.test(name)) return true
  return errorStatus(error) === 499
}

function matchError(error: any, config: Config) {
  if (isUserAbort(error)) return undefined

  const status = errorStatus(error)
  const type = String(error?.type ?? "").trim()
  const message = `${error?.message ?? ""} ${error?.response?.body ?? ""}`.trim()

  // Prefer the machine-readable shape over the wording, so throttling reported
  // in Russian, Chinese or broken English is handled exactly like English.
  if (type && (RETRY_ERROR_TYPES.has(type) || type.startsWith("provider."))) {
    return status !== undefined ? `${type} (HTTP ${status})` : type
  }

  if (status !== undefined) {
    if (parseCodes(config.retryCodes).includes(status)) return `HTTP ${status}`
    if (status >= 400 && !NON_RETRY_STATUSES.has(status)) return `HTTP ${status}`
  }

  for (const regex of BUILTIN_PATTERNS) {
    if (message && regex.test(message)) return message.slice(0, 120)
  }

  for (const regex of compilePatterns(config.patterns)) {
    if (message && regex.test(message)) return `/${regex.source}/`
  }

  if (config.fallbackOnAnyError) return message.slice(0, 120) || "error"

  return undefined
}

/* ------------------------------------------------------------------------- */
/* Model catalog                                                              */
/* ------------------------------------------------------------------------- */

type Catalog = { models: Model[]; providers: string[]; available: boolean }

const CATALOG_TTL = 15_000
const catalogCache = new Map<string, { at: number; value: Catalog }>()

function readLocation(server: any, location: any) {
  const store = server?.data?.location
  const models: Model[] = (store?.model?.list?.(location) ?? []).map((model: any) => ({
    providerID: String(model.providerID),
    modelID: String(model.modelID),
    name: typeof model.name === "string" ? model.name : typeof model.title === "string" ? model.title : undefined,
    paid: isPaidModel(model),
  }))
  const providers: string[] = (store?.provider?.list?.(location) ?? []).map((provider: any) => String(provider.id))
  return { models, providers }
}

/** Live catalog of the server, used to turn a chain entry into canonical ids. */
async function catalogFor(server: any, location: any): Promise<Catalog> {
  const cacheKey = String(server?.id ?? "")
  const cached = catalogCache.get(cacheKey)
  if (cached && Date.now() - cached.at < CATALOG_TTL) return cached.value

  let { models, providers } = readLocation(server, location)
  if (models.length === 0 || providers.length === 0) {
    try {
      await server?.data?.location?.model?.sync?.(location)
    } catch {
      // The catalog may already be loading; the app retries on its own.
    }
    try {
      await server?.data?.location?.provider?.sync?.(location)
    } catch {
      // Same as above.
    }
    const next = readLocation(server, location)
    if (next.models.length > 0 || next.providers.length > 0) {
      models = next.models
      providers = next.providers
    }
  }

  const value = { models, providers, available: models.length > 0 || providers.length > 0 }
  catalogCache.set(cacheKey, { at: Date.now(), value })
  return value
}

/**
 * Resolve a chain entry to the ids the provider actually uses. Matching ignores
 * case and provider-prefixed model ids, so configs copied from other tools work.
 */
function resolveEntry(entry: string, catalog: Catalog): Model | undefined {
  const parsed = splitModel(entry)
  if (!parsed) return undefined
  if (!catalog.available) return parsed

  const model = catalog.models.find(
    (candidate) =>
      normalize(candidate.providerID) === normalize(parsed.providerID) &&
      modelIdsMatch(candidate.modelID, parsed.modelID),
  )
  if (model) return model

  // Keep an entry whose provider is connected but whose model the catalog does
  // not list: `setModel` decides whether the provider still accepts it.
  const provider = catalog.providers.find((id) => normalize(id) === normalize(parsed.providerID))
  if (provider) return { providerID: provider, modelID: parsed.modelID }

  return undefined
}

/* ------------------------------------------------------------------------- */
/* Layout                                                                     */
/* ------------------------------------------------------------------------- */

const CARD = {
  border: "1px solid rgba(128, 128, 128, 0.24)",
  "border-radius": "10px",
  overflow: "hidden",
}

const rowStyle = {
  display: "flex",
  "align-items": "center",
  gap: "12px",
  padding: "10px 14px",
  "border-bottom": "1px solid rgba(128, 128, 128, 0.14)",
}

const clusterStyle = {
  display: "flex",
  "align-items": "center",
  gap: "6px",
  "flex-wrap": "wrap",
  "justify-content": "flex-end",
}

const fieldStyle = {
  width: "300px",
  "max-width": "100%",
  // The host row aligns its children to the top; center every control against
  // the tallest one so buttons line up with the input box, not its top edge.
  "align-self": "center",
}

const centerStyle = {
  display: "flex",
  "align-items": "center",
  "align-self": "center",
}

/** Vertical centering wrapper for controls the host lays out top-aligned. */
const Center = (props: any) => <div style={centerStyle}>{props.children}</div>

/* ------------------------------------------------------------------------- */
/* GUI plugin                                                                 */
/* ------------------------------------------------------------------------- */

export default Plugin.define({
  ...definition,

  setup(ctx) {
    const ui = ctx.ui
    const config = () => ctx.stores.config.value
    const log = (...parts: unknown[]) => console.log("[Fallback]", ...parts)

    /* -------- app components that only exist in newer desktop builds -------- */

    const NativeLayout = (ui as any).SettingsLayout
    const NativeSection = (ui as any).SettingsSection
    const NativeRow = (ui as any).SettingsRow

    const Layout = (props: any) => {
      if (NativeLayout) {
        return (
          <NativeLayout title={props.title} description={props.description} actions={props.actions}>
            {props.children}
          </NativeLayout>
        )
      }

      return (
        <div
          style={{
            display: "flex",
            "flex-direction": "column",
            gap: "26px",
            padding: "24px 24px 40px",
            "max-width": "820px",
          }}
        >
          <div style={{ display: "flex", "align-items": "flex-start", gap: "12px" }}>
            <div style={{ flex: "1", "min-width": "0" }}>
              <div style={{ "font-size": "18px", "font-weight": "600" }}>{props.title}</div>
              <div style={{ "font-size": "13px", opacity: 0.65, "margin-top": "4px" }}>{props.description}</div>
            </div>
            {props.actions}
          </div>
          {props.children}
        </div>
      )
    }

    const Section = (props: any) => {
      if (NativeSection) {
        return (
          <NativeSection title={props.title} footer={props.footer}>
            {props.children}
          </NativeSection>
        )
      }

      return (
        <section>
          <div
            style={{
              "font-size": "12px",
              "font-weight": "600",
              "text-transform": "uppercase",
              "letter-spacing": "0.05em",
              opacity: 0.55,
              "margin-bottom": "8px",
            }}
          >
            {props.title}
          </div>
          <div style={CARD}>{props.children}</div>
          {props.footer ? (
            <div style={{ "font-size": "12px", opacity: 0.6, "margin-top": "6px" }}>{props.footer}</div>
          ) : null}
        </section>
      )
    }

    const Row = (props: any) => {
      if (NativeRow) {
        return (
          <NativeRow id={props.id} title={props.title} description={props.description}>
            {props.children}
          </NativeRow>
        )
      }

      return (
        <div data-action={props.id} style={rowStyle}>
          <div style={{ flex: "1", "min-width": "0" }}>
            <div style={{ "font-size": "13px" }}>{props.title}</div>
            {props.description ? (
              <div style={{ "font-size": "12px", opacity: 0.6, "margin-top": "2px" }}>{props.description}</div>
            ) : null}
          </div>
          <div style={clusterStyle}>{props.children}</div>
        </div>
      )
    }

    /* ----------------------------- persisted edits ----------------------------- */

    const edit = (mutate: (draft: Config) => void) => {
      ctx.stores.config.update((draft) => {
        mutate(draft as Config)
      })
    }

    const reset = () => {
      ctx.stores.config.set({
        ...DEFAULTS,
        patterns: [...DEFAULTS.patterns],
        models: [...DEFAULTS.models],
        confirmModels: [...DEFAULTS.confirmModels],
      })
    }

    /** Marks follow the chain entry text, so editing or removing a row also moves its mark. */
    const isConfirmMarked = (entry: string) => {
      const key = normalize(entry)
      return key.length > 0 && config().confirmModels.some((value) => normalize(value) === key)
    }

    const setConfirmMark = (entry: string, marked: boolean) => {
      const key = normalize(entry)
      if (!key) return
      edit((draft) => {
        const index = draft.confirmModels.findIndex((value) => normalize(value) === key)
        if (marked && index === -1) draft.confirmModels.push(entry.trim())
        if (!marked && index !== -1) draft.confirmModels.splice(index, 1)
      })
    }

    /* ------------------------------ model picker ------------------------------ */

    const canPickModels = () => typeof (ctx.dialogs as any)?.select === "function"

    /** The server and location to read the model catalog from. */
    const pickSource = () => {
      const session = ctx.sessions.current()
      if (session?.server) return { server: session.server, location: session.location }
      const server = ctx.servers.get("sidecar")
      return server ? { server, location: undefined } : undefined
    }

    const toast = (description: string, variant: "success" | "error" = "error") => {
      ctx.toast.show({ variant, title: ctx.t("pickModel"), description, duration: 5000 })
    }

    /** Replace a chain row with a model picked from the live catalog. */
    const pickModel = async (index: number) => {
      const select = (ctx.dialogs as any)?.select
      const source = pickSource()
      if (typeof select !== "function" || !source) {
        toast(ctx.t("pickModelUnavailable"))
        return
      }

      const catalog = await catalogFor(source.server, source.location)
      if (!catalog.available || catalog.models.length === 0) {
        toast(ctx.t("pickModelEmpty"))
        return
      }

      const unique = new Map<string, Model>()
      for (const model of catalog.models) unique.set(modelPath(model), model)

      const options = [...unique.values()].map((model) => ({
        title: modelLabel(model),
        description: model.paid ? `${modelPath(model)} · ${ctx.t("modelPaid")}` : modelPath(model),
        group: model.providerID,
        value: modelPath(model),
      }))

      const current = config().models[index]?.trim()
      const picked = await select.call(ctx.dialogs, {
        title: ctx.t("pickModelTitle"),
        placeholder: ctx.t("pickModelPlaceholder"),
        options,
        current: current && options.some((option) => option.value === current) ? current : undefined,
      })
      if (typeof picked !== "string" || !picked) return

      const model = unique.get(picked)
      const before = normalize(config().models[index] ?? "")
      edit((draft) => {
        if (before) {
          const mark = draft.confirmModels.findIndex((entry) => normalize(entry) === before)
          if (mark !== -1) draft.confirmModels.splice(mark, 1)
        }
        draft.models[index] = picked
      })

      if (model?.paid) {
        setConfirmMark(picked, true)
        toast(ctx.t("markedPaid"), "success")
      }
    }

    /** Append the model the routed session is sending prompts with. */
    const addCurrentModel = () => {
      const session = ctx.sessions.current()
      const composer = session ? ctx.screen.current()?.composer : undefined
      const live = composer?.model()
      if (!live) {
        toast(ctx.t("currentMissing"))
        return
      }

      const path = modelPath(live)
      if (config().models.some((entry) => normalize(entry) === normalize(path))) {
        toast(ctx.t("alreadyInChain"), "success")
        return
      }

      edit((draft) => draft.models.push(path))
    }

    /* -------------------------------- settings -------------------------------- */

    /** Two-way choice: a native select when the host has one, a switch otherwise. */
    const Choice = (props: {
      label: string
      value: ClickAction
      onChange: (value: ClickAction) => void
    }) => {
      const NativeSelect = (ui as any).Select
      if (NativeSelect) {
        return (
          <NativeSelect
            label={props.label}
            value={props.value}
            options={[
              { value: "last", label: ctx.t("clickLast") },
              { value: "log", label: ctx.t("clickLog") },
            ]}
            onChange={props.onChange}
          />
        )
      }
      return (
        <ui.Switch
          label={ctx.t("clickLog")}
          checked={props.value === "log"}
          onChange={(checked) => props.onChange(checked ? "log" : "last")}
        />
      )
    }

    const Settings = () => {
      return (
        <Layout
          title={ctx.t("title")}
          description={ctx.t("description")}
          actions={
            <ui.Button icon="reset" onClick={reset}>
              {ctx.t("reset")}
            </ui.Button>
          }
        >
          <Section title={ctx.t("sectionGeneral")}>
            <Row id="enabled" title={ctx.t("enabled")} description={ctx.t("enabledDescription")}>
              <ui.Switch
                label={ctx.t("enabled")}
                hideLabel
                checked={config().enabled}
                onChange={(checked) => edit((draft) => (draft.enabled = checked))}
              />
            </Row>

            <Row id="notify" title={ctx.t("notify")} description={ctx.t("notifyDescription")}>
              <ui.Switch
                label={ctx.t("notify")}
                hideLabel
                checked={config().notifyOnFallback}
                onChange={(checked) => edit((draft) => (draft.notifyOnFallback = checked))}
              />
            </Row>

            <Row id="auto-retry" title={ctx.t("autoRetry")} description={ctx.t("autoRetryDescription")}>
              <ui.Switch
                label={ctx.t("autoRetry")}
                hideLabel
                checked={config().autoRetry}
                onChange={(checked) => edit((draft) => (draft.autoRetry = checked))}
              />
            </Row>

            <Row
              id="click-action"
              title={ctx.t("clickAction")}
              description={ctx.t("clickActionDescription")}
            >
              <div style={{ "min-width": "210px" }}>
                <Choice
                  label={ctx.t("clickAction")}
                  value={config().clickAction}
                  onChange={(value) => edit((draft) => (draft.clickAction = value))}
                />
              </div>
            </Row>
          </Section>

          <Section title={ctx.t("sectionTriggers")}>
            <Row id="codes" title={ctx.t("codes")} description={ctx.t("codesDescription")}>
              <div style={fieldStyle}>
                <ui.TextInput
                  label={ctx.t("codes")}
                  value={config().retryCodes}
                  placeholder="429, 500, 502, 503, 504"
                  onInput={(value) => edit((draft) => (draft.retryCodes = value))}
                />
              </div>
            </Row>

            <Row id="any-error" title={ctx.t("anyError")} description={ctx.t("anyErrorDescription")}>
              <ui.Switch
                label={ctx.t("anyError")}
                hideLabel
                checked={config().fallbackOnAnyError}
                onChange={(checked) => edit((draft) => (draft.fallbackOnAnyError = checked))}
              />
            </Row>

            <Row id="patterns" title={ctx.t("patterns")} description={ctx.t("patternsDescription")}>
              <ui.Button icon="plus" size="small" onClick={() => edit((draft) => draft.patterns.push(""))}>
                {ctx.t("addPattern")}
              </ui.Button>
            </Row>

            <Index each={config().patterns}>
              {(pattern, index) => (
                <Row title={ctx.t("patternN", { n: index + 1 })}>
                  <div style={fieldStyle}>
                    <ui.TextInput
                      label={ctx.t("patternN", { n: index + 1 })}
                      value={pattern()}
                      placeholder="billing\\s+suspended"
                      onInput={(value) =>
                        edit((draft) => {
                          draft.patterns[index] = value
                        })
                      }
                    />
                  </div>
                  <Center>
                    <ui.IconButton
                      icon="trash"
                      label={ctx.t("remove")}
                      onClick={() =>
                        edit((draft) => {
                          draft.patterns.splice(index, 1)
                        })
                      }
                    />
                  </Center>
                </Row>
              )}
            </Index>
          </Section>

          <Section title={ctx.t("sectionLimits")}>
            <Row id="max-attempts" title={ctx.t("maxAttempts")} description={ctx.t("maxAttemptsDescription")}>
              <div style={{ width: "110px" }}>
                <ui.TextInput
                  label={ctx.t("maxAttempts")}
                  value={config().maxAttempts}
                  onInput={(value) => edit((draft) => (draft.maxAttempts = value))}
                />
              </div>
            </Row>

            <Row id="cooldown" title={ctx.t("cooldown")} description={ctx.t("cooldownDescription")}>
              <div style={{ width: "110px" }}>
                <ui.TextInput
                  label={ctx.t("cooldown")}
                  value={config().cooldownSeconds}
                  onInput={(value) => edit((draft) => (draft.cooldownSeconds = value))}
                />
              </div>
            </Row>

            <Row id="timeout" title={ctx.t("timeout")} description={ctx.t("timeoutDescription")}>
              <div style={{ width: "110px" }}>
                <ui.TextInput
                  label={ctx.t("timeout")}
                  value={config().timeoutSeconds}
                  onInput={(value) => edit((draft) => (draft.timeoutSeconds = value))}
                />
              </div>
            </Row>
          </Section>

          <Section title={ctx.t("sectionChain")} footer={<span>{ctx.t("modelsDescription")}</span>}>
            <Index each={config().models}>
              {(model, index) => (
                <Row id={index === 0 ? "models" : undefined} title={ctx.t("modelN", { n: index + 1 })}>
                  <div style={fieldStyle}>
                    <ui.TextInput
                      label={ctx.t("modelN", { n: index + 1 })}
                      value={model()}
                      placeholder="provider/model-id"
                      onInput={(value) =>
                        edit((draft) => {
                          const before = normalize(draft.models[index])
                          if (before) {
                            const mark = draft.confirmModels.findIndex((entry) => normalize(entry) === before)
                            if (mark !== -1) {
                              if (value.trim()) draft.confirmModels[mark] = value.trim()
                              else draft.confirmModels.splice(mark, 1)
                            }
                          }
                          draft.models[index] = value
                        })
                      }
                    />
                  </div>
                  <Show when={canPickModels()}>
                    <Center>
                      <ui.IconButton
                        icon="magnifying-glass"
                        label={ctx.t("pickModel")}
                        onClick={() => void pickModel(index)}
                      />
                    </Center>
                  </Show>
                  <div
                    style={{
                      display: "flex",
                      "align-items": "center",
                      "align-self": "center",
                      gap: "6px",
                      "font-size": "12px",
                      opacity: model().trim() ? 0.8 : 0.4,
                    }}
                  >
                    <span>{ctx.t("confirmShort")}</span>
                    <ui.Switch
                      label={ctx.t("confirmSwitch")}
                      hideLabel
                      checked={isConfirmMarked(model())}
                      disabled={!model().trim()}
                      onChange={(checked) => setConfirmMark(model(), checked)}
                    />
                  </div>
                  <Center>
                    <ui.IconButton
                      icon="arrow-up"
                      label={ctx.t("moveUp")}
                      disabled={index === 0}
                      onClick={() =>
                        edit((draft) => {
                          const [item] = draft.models.splice(index, 1)
                          draft.models.splice(index - 1, 0, item)
                        })
                      }
                    />
                  </Center>
                  <Center>
                    <ui.IconButton
                      icon="arrow-down-to-line"
                      label={ctx.t("moveDown")}
                      disabled={index === config().models.length - 1}
                      onClick={() =>
                        edit((draft) => {
                          const [item] = draft.models.splice(index, 1)
                          draft.models.splice(index + 1, 0, item)
                        })
                      }
                    />
                  </Center>
                  <Center>
                    <ui.IconButton
                      icon="trash"
                      label={ctx.t("remove")}
                      onClick={() =>
                        edit((draft) => {
                          const removed = normalize(draft.models[index])
                          draft.models.splice(index, 1)
                          if (!removed) return
                          const mark = draft.confirmModels.findIndex((entry) => normalize(entry) === removed)
                          if (mark !== -1) draft.confirmModels.splice(mark, 1)
                        })
                      }
                    />
                  </Center>
                </Row>
              )}
            </Index>

            <Row title={ctx.t("addModel")}>
              <ui.Button icon="plus" size="small" onClick={() => edit((draft) => draft.models.push(""))}>
                {ctx.t("addModel")}
              </ui.Button>
              <Show when={canPickModels()}>
                <ui.Button icon="models" size="small" onClick={addCurrentModel}>
                  {ctx.t("addCurrent")}
                </ui.Button>
              </Show>
            </Row>
          </Section>

          <Section title={ctx.t("sectionResume")}>
            <Row id="trigger" title={ctx.t("triggerText")} description={ctx.t("triggerTextDescription")}>
              <div style={fieldStyle}>
                <ui.TextInput
                  label={ctx.t("triggerText")}
                  value={config().triggerText}
                  placeholder="Continue"
                  onInput={(value) => edit((draft) => (draft.triggerText = value))}
                />
              </div>
            </Row>
          </Section>
        </Layout>
      )
    }

    ctx.add(SettingsPage, {
      id: "local-model-fallback",
      icon: "models",
      get title() {
        return ctx.t("title")
      },
      get entries() {
        return [
          { id: "local-model-fallback", title: ctx.t("title"), description: ctx.t("description") },
          { id: "enabled", title: ctx.t("entryEnabled"), keywords: "fallback model provider" },
          { id: "auto-retry", title: ctx.t("entryResume"), keywords: "resume continue retry" },
          { id: "click-action", title: ctx.t("clickAction"), keywords: "badge header button log window" },
          { id: "codes", title: ctx.t("entryTrigger"), keywords: "status http 429 500 error" },
          { id: "any-error", title: ctx.t("anyError"), keywords: "error pattern" },
          { id: "max-attempts", title: ctx.t("entryLimits"), keywords: "attempts cooldown timeout" },
          { id: "models", title: ctx.t("entryChain"), keywords: "chain provider model" },
          { id: "trigger", title: ctx.t("triggerText"), keywords: "continue prompt" },
        ]
      },
      render: () => <Settings />,
    })

    /* ------------------------------ fallback engine ----------------------------- */

    const attemptsBySession = new Map<string, number>()
    /** Model key -> timestamp until which that model is skipped. */
    const cooldownUntilByModel = new Map<string, number>()
    const modelBySession = new Map<string, Model>()
    const lastSetBySession = new Map<string, string>()

    type Execution = {
      /** Model the execution started on. Failures belong to it, not to whatever is selected later. */
      model: Model | undefined
      /** Set once this execution caused a switch; its remaining failures are the old model's. */
      switched: boolean
      /** Set once a resume prompt was sent for this execution. */
      resumed: boolean
      /** The user declined a paid switch; ignore the rest of this execution. */
      stopped: boolean
    }

    /** What the header badge shows for a session after an automatic switch. */
    type LastSwitch = { from: string; to: string; reason: string; at: number; attempt?: number }

    /** How many switches the side log keeps per session. */
    const LOG_LIMIT = 60

    const [lastSwitch, setLastSwitch] = createSignal<Record<string, LastSwitch | undefined>>({})
    /** Newest first; in memory, one list per session. */
    const [switchHistory, setSwitchHistory] = createSignal<Record<string, LastSwitch[]>>({})

    const rememberSwitch = (sessionID: string, value: LastSwitch) => {
      setLastSwitch((previous) => ({ ...previous, [sessionID]: value }))
      setSwitchHistory((previous) => ({
        ...previous,
        [sessionID]: [value, ...(previous[sessionID] ?? [])].slice(0, LOG_LIMIT),
      }))
    }

    /** Clearing a session's log must not take the badge with it: they are separate views. */
    const clearSwitchHistory = (sessionID: string) => {
      setSwitchHistory((previous) => {
        if (!previous[sessionID]) return previous
        const next = { ...previous }
        delete next[sessionID]
        return next
      })
    }

    const forgetSwitch = (sessionID: string) => {
      setLastSwitch((previous) => {
        if (!previous[sessionID]) return previous
        const next = { ...previous }
        delete next[sessionID]
        return next
      })
    }

    const executionBySession = new Map<string, Execution>()
    /** Handled `session.retry.scheduled` assistant message ids, so late retries cannot switch twice. */
    const handledRetries = new Map<string, Set<string>>()

    let timeout: { sessionID: string; timer: ReturnType<typeof setTimeout> } | undefined

    const cancelTimeout = () => {
      if (timeout) {
        clearTimeout(timeout.timer)
        timeout = undefined
      }
    }

    onCleanup(cancelTimeout)

    const notify = (title: string, description: string, variant: "success" | "error") => {
      if (!config().notifyOnFallback) return
      ctx.toast.show({ variant, title, description, duration: 5000 })
    }

    const routedSession = (sessionID: string) => {
      const session = ctx.sessions.current()
      return session && session.id === sessionID ? session : undefined
    }

    const liveSession = (sessionID: string) => {
      return routedSession(sessionID) ?? ctx.sessions.list().find((session) => session.id === sessionID)
    }

    const currentModel = (sessionID: string): Model | undefined => {
      const session = routedSession(sessionID)
      const composer = session ? ctx.screen.current()?.composer : undefined
      const live = composer?.model()
      if (live) {
        modelBySession.set(sessionID, live)
        return live
      }
      return modelBySession.get(sessionID)
    }

    /** State for the execution in flight, created lazily for servers that do not emit `started`. */
    const executionFor = (sessionID: string): Execution => {
      const existing = executionBySession.get(sessionID)
      if (existing) return existing
      const created: Execution = { model: currentModel(sessionID), switched: false, resumed: false, stopped: false }
      executionBySession.set(sessionID, created)
      return created
    }

    /** A new execution starts on whatever model is selected right now. */
    const beginExecution = (sessionID: string) => {
      const created: Execution = { model: currentModel(sessionID), switched: false, resumed: false, stopped: false }
      executionBySession.set(sessionID, created)
      log("execution started", sessionID, created.model ? modelPath(created.model) : "unknown model")
    }

    const retryHandled = (sessionID: string, messageID: unknown) => {
      if (!messageID) return false
      return handledRetries.get(sessionID)?.has(String(messageID)) ?? false
    }

    const markRetryHandled = (sessionID: string, messageID: unknown) => {
      if (!messageID) return
      let seen = handledRetries.get(sessionID)
      if (!seen) {
        seen = new Set()
        handledRetries.set(sessionID, seen)
      }
      seen.add(String(messageID))
      while (seen.size > 50) {
        const oldest = seen.values().next().value
        if (oldest === undefined) break
        seen.delete(oldest)
      }
    }

    const resume = async (sessionID: string) => {
      const session = liveSession(sessionID)
      if (!session) return
      try {
        await session.server.client.session.prompt({
          sessionID,
          text: config().triggerText.trim() || "Continue",
        })
      } catch (cause) {
        log("resume failed", sessionID, String(cause))
      }
    }

    const MAX_RETRY_AFTER_MS = 24 * 60 * 60 * 1000

    /** Cooldown for a failed model; a provider's own retry hint wins when it is longer. */
    const cooldownFor = (error: any, cfg: Config) => {
      const base = Math.max(0, int(cfg.cooldownSeconds, 60)) * 1000
      const retryAfter = Number(error?.retryAfterMs)
      if (!Number.isFinite(retryAfter) || retryAfter <= base) return base
      return Math.min(retryAfter, MAX_RETRY_AFTER_MS)
    }

    /** Chain entries after the current model, wrapping around. */
    const candidates = (current: Model | undefined, cfg: Config) => {
      const chain = cfg.models.map((entry) => entry.trim()).filter(Boolean)
      if (chain.length === 0) return { chain, list: [] as string[] }

      let start = 0
      if (current) {
        const index = chain.findIndex((entry) => entryMatches(entry, current))
        if (index !== -1) start = index + 1
      }

      return { chain, list: [...chain.slice(start), ...chain.slice(0, start)] }
    }

    const switchTo = async (
      sessionID: string,
      current: Model,
      reason: string,
      options: { interrupt?: boolean; prompt?: boolean; cool?: boolean; coolForMs?: number },
      execution?: Execution,
    ) => {
      const cfg = config()
      if (!cfg.enabled) return

      const session = liveSession(sessionID)
      if (!session) return

      log("switch", sessionID, "from", modelPath(current), "reason:", reason)

      // A confirmation dialog leaves the execution running, and a scheduled retry
      // may fire on the old model. Stop it before asking, so nothing spends while
      // the user decides; an approved switch then resumes the turn.
      let interrupted = false
      const interruptNow = async () => {
        if (interrupted) return
        interrupted = true
        try {
          await session.server.client.session.interrupt({ sessionID })
        } catch {
          // The execution may already be over; nothing to stop.
        }
      }

      // The user picked another model since our last switch: this turn starts fresh.
      const lastSet = lastSetBySession.get(sessionID)
      if (lastSet && lastSet !== modelKey(current)) {
        attemptsBySession.delete(sessionID)
        lastSetBySession.delete(sessionID)
      }

      const used = attemptsBySession.get(sessionID) ?? 0
      const max = Math.max(1, int(cfg.maxAttempts, 10))
      if (used >= max) {
        notify(ctx.t("exhaustedTitle"), ctx.t("exhaustedBody"), "error")
        return
      }

      const { chain, list } = candidates(current, cfg)
      if (chain.length === 0) {
        notify(ctx.t("exhaustedTitle"), ctx.t("noChain"), "error")
        return
      }

      // Resolve entries to the ids the providers actually use before switching.
      const catalog = await catalogFor(session.server, session.location)
      log("catalog", catalog.available ? `${catalog.models.length} models / ${catalog.providers.length} providers` : "unavailable")
      const now = Date.now()
      const cooldownMs = Math.max(0, int(cfg.cooldownSeconds, 60)) * 1000
      const skipped: string[] = []
      const targets: { entry: string; target: Model }[] = []
      let cooling = 0

      for (const entry of list) {
        const target = resolveEntry(entry, catalog)
        if (!target) {
          log("skip unresolved", entry)
          skipped.push(entry)
          continue
        }
        const until = cooldownUntilByModel.get(modelKey(target))
        if (until !== undefined && now < until) {
          log("skip cooling", entry, `${Math.ceil((until - now) / 1000)}s left`)
          cooling++
          continue
        }
        if (sameModel(target, current)) continue
        targets.push({ entry, target })
      }

      const giveUp = () => {
        if (skipped.length > 0) {
          log("give up: unresolved", skipped.join(", "))
          notify(ctx.t("exhaustedTitle"), ctx.t("unresolvedBody", { models: skipped.slice(0, 4).join(", ") }), "error")
        } else if (cooling > 0) {
          log("give up: cooling", cooling)
          notify(ctx.t("exhaustedTitle"), ctx.t("coolingBody"), "error")
        } else {
          log("give up: no targets")
          notify(ctx.t("exhaustedTitle"), ctx.t("exhaustedBody"), "error")
        }
      }

      if (targets.length === 0) {
        giveUp()
        return
      }

      if (options.cool !== false) {
        const key = modelKey(resolveEntry(modelPath(current), catalog) ?? current)
        cooldownUntilByModel.set(key, now + (options.coolForMs ?? cooldownMs))
      }

      const composer = routedSession(sessionID) ? ctx.screen.current()?.composer : undefined
      const ask = (ctx.dialogs as any)?.confirm

      // One decline also skips the other marked models in this attempt: the user
      // asked for a free model, not for another prompt per paid entry.
      let declined = false
      let skippedMarked = 0
      let unavailable = false

      let switched: Model | undefined
      for (const { entry, target } of targets) {
        if (needsConfirmation(entry, target, cfg)) {
          if (declined) {
            log("skip declined", entry)
            skippedMarked++
            continue
          }

          // A dialog raised from a background chat interrupts that chat and then
          // waits for an answer nobody can see, so only ask in the open session.
          if (!routedSession(sessionID)) {
            log("skip confirm outside the active chat", entry)
            declined = true
            skippedMarked++
            continue
          }

          if (typeof ask !== "function") {
            log("confirmation unavailable", entry)
            unavailable = true
            declined = true
            skippedMarked++
            continue
          }

          await interruptNow()
          // The interrupted execution must not resume itself while the dialog waits.
          if (execution) execution.resumed = true

          const details = ctx.t("confirmBody", {
            from: modelPath(current),
            reason,
            model: modelPath(target),
          })

          let approved = false
          try {
            approved = await ask.call(ctx.dialogs, {
              title: ctx.t("confirmTitle"),
              description: details,
              confirm: ctx.t("confirmAction"),
              cancel: ctx.t("confirmCancel"),
              danger: true,
            })
          } catch (cause) {
            log("confirmation failed", entry, String(cause))
          }

          if (!approved) {
            log("declined", entry)
            declined = true
            skippedMarked++
            continue
          }

          // A new execution may have started while the dialog was open; its turn
          // must not be switched by a decision about the old one.
          if (execution && executionBySession.get(sessionID) !== execution) {
            log("confirmation superseded", entry)
            return
          }
        }

        // Persist the change on the server first. `composer.setModel` only updates
        // the UI; a prompt sent before the server knows the new model runs the old one.
        try {
          await session.server.client.session.switchModel({
            sessionID,
            model: { id: target.modelID, providerID: target.providerID },
          })
        } catch (cause) {
          log("switchModel failed", entry, String(cause))
          cooldownUntilByModel.set(modelKey(target), Date.now() + cooldownMs)
          skipped.push(entry)
          continue
        }

        if (composer && !composer.setModel(target)) log("setModel rejected", entry)

        modelBySession.set(sessionID, target)
        switched = target
        break
      }

      if (!switched) {
        if (execution && (declined || unavailable)) execution.stopped = true
        if (skippedMarked > 0) {
          log("give up: declined", skippedMarked)
          notify(ctx.t("exhaustedTitle"), ctx.t(unavailable ? "confirmUnavailable" : "declinedBody"), "error")
        } else {
          giveUp()
        }
        return
      }

      log("switched to", modelPath(switched), "attempt", used + 1, "cool:", options.cool !== false)

      attemptsBySession.set(sessionID, used + 1)
      lastSetBySession.set(sessionID, modelKey(switched))

      if (options.interrupt || interrupted) await interruptNow()

      if (cfg.autoRetry && (options.prompt || interrupted)) await resume(sessionID)

      rememberSwitch(sessionID, {
        from: modelPath(current),
        to: modelPath(switched),
        reason,
        at: Date.now(),
        attempt: used + 1,
      })
      notify(ctx.t("switchedTitle"), ctx.t("switchedBody", { model: modelPath(switched), reason }), "success")
    }

    const onFailure = (sessionID: string, error: any) => {
      const cfg = config()
      if (!cfg.enabled) return

      // A failure in a background chat must still advance that chat's chain.
      // Otherwise the chat sits dead until the user notices and presses Continue.
      const session = liveSession(sessionID)
      if (!session) return

      // Attribute the failure to the model the execution started on. The composer
      // may already show a different model because of an earlier switch.
      const execution = executionFor(sessionID)
      if (execution.stopped) {
        log("ignore failure after a declined switch", sessionID)
        return
      }

      const reason = matchError(error, cfg)
      if (!reason) return

      const model = execution.model ?? currentModel(sessionID)
      if (!model) return

      if (execution.switched) {
        // This execution already caused a switch. Its remaining failures belong to
        // the old model; resume on the currently selected one instead of walking the
        // chain again and cooling healthy models.
        log("stale failure", sessionID, modelPath(model), `(${reason})`, "resumed:", execution.resumed)
        if (!execution.resumed && cfg.autoRetry) {
          execution.resumed = true
          void resume(sessionID)
        }
        return
      }

      execution.switched = true
      execution.resumed = cfg.autoRetry

      log("failure", sessionID, modelPath(model), `(${reason})`)
      void switchTo(
        sessionID,
        model,
        reason,
        {
          prompt: cfg.autoRetry,
          coolForMs: cooldownFor(error, cfg),
        },
        execution,
      )
    }

    const onRetryScheduled = (sessionID: string, error: any, messageID: unknown) => {
      const cfg = config()
      if (!cfg.enabled) return

      const session = liveSession(sessionID)
      if (!session) return

      // The same retry can be announced more than once, and a retry scheduled for
      // an execution that already switched must not trigger another switch.
      if (retryHandled(sessionID, messageID)) {
        log("ignore handled retry", sessionID, String(messageID))
        return
      }

      const reason = matchError(error, cfg) ?? "retry scheduled"
      const execution = executionFor(sessionID)
      if (execution.stopped) {
        markRetryHandled(sessionID, messageID)
        log("ignore retry after a declined switch", sessionID)
        return
      }

      const model = execution.model ?? currentModel(sessionID)
      if (!model) return

      if (execution.switched) {
        markRetryHandled(sessionID, messageID)
        log("ignore retry from switched execution", sessionID, modelPath(model), `(${reason})`)
        return
      }

      execution.switched = true
      markRetryHandled(sessionID, messageID)

      log("retry scheduled", sessionID, modelPath(model), `(${reason})`)
      // The server retries on its own; only the model has to change. If the retry
      // still fails, `execution.failed` resumes the turn on the new model.
      void switchTo(sessionID, model, reason, { coolForMs: cooldownFor(error, cfg) }, execution)
    }

    const armTimeout = (sessionID: string) => {
      const cfg = config()
      const seconds = int(cfg.timeoutSeconds, 120)
      if (seconds <= 0) return

      const session = liveSession(sessionID)
      if (!session) return

      cancelTimeout()
      log("arm timeout", sessionID, `${seconds}s`)
      timeout = {
        sessionID,
        timer: setTimeout(() => {
          timeout = undefined
          const cfgNow = config()
          if (!cfgNow.enabled || int(cfgNow.timeoutSeconds, 120) <= 0) return
          if (!liveSession(sessionID)) return

          const execution = executionFor(sessionID)
          if (execution.switched || execution.stopped) return

          const current = execution.model ?? currentModel(sessionID)
          if (!current) return

          execution.switched = true
          execution.resumed = cfgNow.autoRetry

          log("timeout", sessionID, modelPath(current), `${int(cfgNow.timeoutSeconds, 120)}s`)
          void switchTo(
            sessionID,
            current,
            `timeout ${int(cfgNow.timeoutSeconds, 120)}s`,
            {
              interrupt: true,
              prompt: cfgNow.autoRetry,
              cool: false,
            },
            execution,
          )
        }, seconds * 1000),
      }
    }

    /* --------------------------- event subscriptions --------------------------- */

    createKeyed(
      () => ctx.servers.get("sidecar")?.data,
      (data) => {
        const progress = (event: any) => {
          const sessionID = event?.data?.sessionID
          if (sessionID && timeout?.sessionID === sessionID) cancelTimeout()
        }

        onCleanup(
          data.on("session.execution.started", (event) => {
            beginExecution(event.data.sessionID)
            armTimeout(event.data.sessionID)
          }),
        )
        onCleanup(data.on("session.text.started", progress))
        onCleanup(data.on("session.reasoning.started", progress))
        onCleanup(data.on("session.step.started", progress))
        onCleanup(data.on("session.tool.called", progress))
        onCleanup(data.on("permission.asked", progress))
        onCleanup(data.on("session.execution.interrupted", progress))
        onCleanup(data.on("session.idle", progress))

        onCleanup(
          data.on("session.execution.succeeded", (event) => {
            progress(event)
            const sessionID = event.data.sessionID
            attemptsBySession.delete(sessionID)
            lastSetBySession.delete(sessionID)
            executionBySession.delete(sessionID)
            handledRetries.delete(sessionID)
          }),
        )

        onCleanup(
          data.on("session.execution.failed", (event) => {
            progress(event)
            onFailure(event.data.sessionID, event.data.error)
          }),
        )

        onCleanup(
          data.on("session.retry.scheduled", (event) => {
            progress(event)
            onRetryScheduled(event.data.sessionID, (event.data as any).error, (event.data as any).assistantMessageID)
          }),
        )

        onCleanup(
          data.on("session.model.selected", (event) => {
            const { sessionID, model } = event.data as any
            if (!model?.providerID || !model?.id) return
            const selected = { providerID: model.providerID, modelID: model.id }
            modelBySession.set(sessionID, selected)

            // A manual choice replaces the story the badge tells.
            const badge = lastSwitch()[sessionID]
            const badgeTarget = badge ? splitModel(badge.to) : undefined
            if (badgeTarget && !sameModel(badgeTarget, selected)) forgetSwitch(sessionID)

            // A model change makes the old first-token watchdog meaningless.
            if (timeout?.sessionID === sessionID) cancelTimeout()

            // A running execution still belongs to the model it started on. Do not
            // let its failures be blamed on the freshly selected model.
            const execution = executionBySession.get(sessionID)
            if (execution && execution.model && !sameModel(execution.model, selected)) {
              execution.switched = true
            }
          }),
        )

        onCleanup(cancelTimeout)
      },
    )

    /* -------------------------------- badge + log ------------------------------- */

    const logKey = `${ctx.id}:log`

    /** Open this session's switch log in the side panel; false when the host has no panels. */
    const openLog = (session: any) => {
      const layout = (ctx as any).layout
      if (typeof layout?.open !== "function") return false
      try {
        layout.open(logKey, session, { tab: "open" })
        if (typeof layout.side?.opened === "function" && !layout.side.opened(session)) {
          layout.side.toggle(session)
        }
        return true
      } catch (cause) {
        log("log panel open failed", String(cause))
        return false
      }
    }

    const logRowStyle = {
      display: "flex",
      "flex-direction": "column",
      gap: "2px",
      padding: "8px 0",
      "border-bottom": "1px solid rgba(128, 128, 128, 0.14)",
    }
    const logTimeStyle = { "font-size": "11px", opacity: 0.6, "font-variant-numeric": "tabular-nums" }
    const logModelsStyle = { "font-size": "12px", "word-break": "break-word" }
    const logReasonStyle = { "font-size": "11px", opacity: 0.7, "word-break": "break-word" }

    /** Today's switch history, newest first, in the side panel. */
    const SwitchLog = (props: { session: () => { id: string } }) => {
      const entries = () =>
        (switchHistory()[props.session().id] ?? []).filter((entry) => isToday(entry.at))

      return (
        <div style={{ display: "flex", "flex-direction": "column", height: "100%", "min-height": "0" }}>
          <div
            style={{
              display: "flex",
              "align-items": "center",
              gap: "8px",
              padding: "10px 12px",
              "border-bottom": "1px solid rgba(128, 128, 128, 0.18)",
            }}
          >
            <span style={{ flex: "1", "font-size": "12px", "font-weight": "600" }}>{ctx.t("logTitle")}</span>
            <Show when={entries().length > 0}>
              <ui.Button
                size="small"
                variant="ghost-muted"
                icon="trash"
                onClick={() => clearSwitchHistory(props.session().id)}
              >
                {ctx.t("logClear")}
              </ui.Button>
            </Show>
          </div>
          <div style={{ flex: "1", "min-height": "0", overflow: "auto", padding: "4px 12px 12px" }}>
            <Show
              when={entries().length > 0}
              fallback={
                <div style={{ "font-size": "12px", opacity: 0.6, padding: "12px 0" }}>{ctx.t("logEmpty")}</div>
              }
            >
              <Index each={entries()}>
                {(entry) => (
                  <div style={logRowStyle}>
                    <span style={logTimeStyle}>{formatLogTime(entry().at)}</span>
                    <span style={logModelsStyle}>
                      {entry().from} → {entry().to}
                    </span>
                    <span style={logReasonStyle}>
                      {entry().reason}
                      <Show when={entry().attempt}>
                        {(attempt) => (
                          <span> · {ctx.t("logAttempt", { n: attempt() })}</span>
                        )}
                      </Show>
                    </span>
                  </div>
                )}
              </Index>
            </Show>
          </div>
        </div>
      )
    }

    /** One tab object: the host re-renders the label when the object changes. */
    const logTab = {
      id: "log",
      get title() {
        return ctx.t("logTitle")
      },
      label: () => <span style={{ "font-size": "12px" }}>{ctx.t("logTitle")}</span>,
      closable: "hover" as const,
    }

    const FallbackBadge = (props: {
      sessionID: string
      session: () => any
      compact: boolean
      active: boolean
    }) => {
      const badge = () => lastSwitch()[props.sessionID]

      const details = () => {
        const value = badge()
        if (!value) return ""
        return ctx.t("badgeDetails", { from: value.from, to: value.to, reason: value.reason })
      }

      const showLast = () => {
        const title = ctx.t("badgeTitle")
        const alert = (ctx.dialogs as any)?.alert
        if (typeof alert === "function") {
          void alert.call(ctx.dialogs, { title, description: details() })
          return
        }
        ctx.toast.show({ variant: "success", title, description: details(), duration: 8000 })
      }

      const show = () => {
        if (!badge()) return

        // The settings row decides: today's log in the side panel, or the last switch in a window.
        if (config().clickAction === "log") {
          const session = props.session()
          if (session && openLog(session)) return
          // No panel API in this build: fall through to the window.
        }

        showLast()
      }

      return (
        <Show when={props.active && badge() !== undefined}>
          <ui.Tooltip value={details()}>
            <Show
              when={props.compact}
              fallback={
                <ui.Button variant="ghost-muted" size="small" icon="arrow-undo-down" onClick={show}>
                  {ctx.t("badge")}
                </ui.Button>
              }
            >
              <ui.IconButton icon="arrow-undo-down" label={ctx.t("badgeAria")} onClick={show} />
            </Show>
          </ui.Tooltip>
        </Show>
      )
    }

    try {
      ctx.add(Panel, {
        id: "log",
        region: "side",
        width: 340,
        mobile: { title: ctx.t("logTitle"), order: 20, kind: "menu", icon: "arrow-undo-down" },
        list: ({ open }) => (open.includes("log") ? [logTab] : []),
        render: (props) => <SwitchLog session={() => props.session} />,
      })
    } catch (cause) {
      // Desktop builds without the panel API keep the badge dialog instead.
      log("fallback log panel unavailable", String(cause))
    }

    try {
      ctx.add(MenuItem, {
        id: "log",
        menu: "session.panel",
        get title() {
          return ctx.t("logTitle")
        },
        icon: "arrow-undo-down",
        run: () => {
          const session = ctx.sessions.current()
          if (session) openLog(session)
        },
      })
    } catch (cause) {
      log("fallback log menu unavailable", String(cause))
    }

    try {
      ctx.add(Slot, {
        at: "session.header",
        order: 10,
        render: (input) => (
          <FallbackBadge
            sessionID={input.session.id}
            session={() => input.session}
            compact={input.compact}
            active={input.active}
          />
        ),
      })
    } catch (cause) {
      // Older desktop builds may not expose this slot. The engine must keep
      // working without the badge instead of failing the whole setup.
      log("header badge unavailable", String(cause))
    }
  },
})
