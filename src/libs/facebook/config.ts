import path from 'node:path'

import dotenv from 'dotenv'

dotenv.config()

type SupportedBrowser = 'chromium' | 'firefox' | 'webkit'

const toOptionalString = (value: string | undefined | null): string | undefined => {
  if (!value) {
    return undefined
  }
  const trimmed = value.trim()
  return trimmed.length === 0 ? undefined : trimmed
}

const parseNumber = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback
  }
  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? fallback : parsed
}

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (!value) {
    return fallback
  }
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
}

const sanitizeBaseUrl = (value: string): string => {
  return value.endsWith('/') ? value.slice(0, -1) : value
}

const resolvePath = (value: string | undefined): string | undefined => {
  if (!value) {
    return undefined
  }
  return path.isAbsolute(value) ? value : path.join(process.cwd(), value)
}

const isSupportedBrowser = (value: string): value is SupportedBrowser => {
  return ['chromium', 'firefox', 'webkit'].includes(value)
}

export interface AppConfig {
  targetUrl?: string
  headless: boolean
  browser: SupportedBrowser
  ollamaBaseUrl: string
  ollamaModel: string
  ollamaTimeoutMs: number
  ollamaInsecureTls: boolean
  storageStatePath?: string
  userDataDir?: string
  navigationTimeoutMs: number
  keepBrowserOpen: boolean
}

const defaultBaseUrl = 'https://bai-ap.jts.co.th:10602'
const defaultModel = 'qwen3:30b'
const defaultStorageState = '.credentials/facebook-storage.json'

const browserEnv = (process.env.PLAYWRIGHT_BROWSER ?? 'chromium').toLowerCase()

export const appConfig: AppConfig = {
  targetUrl: toOptionalString(process.env.TARGET_URL),
  headless: parseBoolean(process.env.PLAYWRIGHT_HEADLESS ?? undefined, false),
  browser: isSupportedBrowser(browserEnv) ? browserEnv : 'chromium',
  ollamaBaseUrl: sanitizeBaseUrl(process.env.OLLAMA_BASE_URL ?? defaultBaseUrl),
  ollamaModel: process.env.OLLAMA_MODEL ?? defaultModel,
  ollamaTimeoutMs: parseNumber(process.env.OLLAMA_TIMEOUT_MS ?? undefined, 60_000),
  ollamaInsecureTls: parseBoolean(process.env.OLLAMA_INSECURE_TLS ?? undefined, false),
  storageStatePath: resolvePath(process.env.PLAYWRIGHT_STORAGE_PATH ?? defaultStorageState),
  userDataDir: resolvePath(toOptionalString(process.env.PLAYWRIGHT_USER_DATA_DIR)),
  navigationTimeoutMs: parseNumber(process.env.PLAYWRIGHT_NAVIGATION_TIMEOUT_MS ?? undefined, 45_000),
  keepBrowserOpen: parseBoolean(process.env.PLAYWRIGHT_KEEP_OPEN ?? undefined, false),
}

export const ensureTargetUrl = (): string => {
  if (!appConfig.targetUrl) {
    throw new Error('TARGET_URL is not defined. Please set it in your environment or .env file.')
  }
  return appConfig.targetUrl
}
