import fs from 'node:fs'
import path from 'node:path'

import { chromium } from 'playwright'

const parseBoolean = (value, fallback) => {
  if (!value) {
    return fallback
  }
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
}

const resolvePath = (value, fallback) => {
  const resolved = value ?? fallback
  if (!resolved) {
    return undefined
  }
  return path.isAbsolute(resolved) ? resolved : path.join(process.cwd(), resolved)
}

const TARGET_URL =
  process.argv[2] ??
  process.env.TIKTOK_URL ??
  'https://www.facebook.com/photo/?fbid=842656628141325&set=a.215387227534938'
//   'https://www.tiktok.com/@squirrel9057/video/7555801477894229266?is_from_webapp=1'

const HEADLESS = parseBoolean(process.env.PLAYWRIGHT_HEADLESS, false)
const BROWSER_CHANNEL = process.env.PLAYWRIGHT_BROWSER ?? 'chrome'
const KEEP_OPEN = parseBoolean(process.env.PLAYWRIGHT_KEEP_OPEN, false)
const STORAGE_STATE_PATH = resolvePath(process.env.PLAYWRIGHT_STORAGE_PATH, '.credentials/facebook-storage.json')
const USER_DATA_DIR = resolvePath(process.env.PLAYWRIGHT_USER_DATA_DIR)

const BOT_CHALLENGE_SELECTORS = [
  '#captcha-verify-image',
  'div[data-e2e="captcha-container"]',
  'div[data-e2e="verify-slide"]',
  'canvas[id*="captcha"]',
  'form[action*="captcha"]',
]

const BOT_CHALLENGE_TEXTS = [
  'verify that you are human',
  'verify you are human',
  'are you a robot',
  'unusual traffic',
  'automated queries',
  'too many requests',
]

const detectBotChallenge = async (page) => {
  const url = page.url()
  if (/captcha|verify/i.test(url)) {
    return {
      reason: 'navigated to verification flow',
      detail: url,
    }
  }

  for (const selector of BOT_CHALLENGE_SELECTORS) {
    const element = await page.$(selector)
    if (element) {
      return {
        reason: 'captcha element present',
        detail: selector,
      }
    }
  }

  const bodyText = await page.evaluate(() => document.body?.innerText?.toLowerCase() ?? '')
  for (const keyword of BOT_CHALLENGE_TEXTS) {
    if (bodyText.includes(keyword)) {
      return {
        reason: 'verification keyword detected',
        detail: keyword,
      }
    }
  }

  return null
}

const main = async () => {
  let browser
  let context
  let page

  const safeClose = async (closable) => {
    if (!closable) {
      return
    }
    try {
      await closable.close()
    } catch (error) {
      if (process.env.DEBUG_PLAYWRIGHT_CLOSE === '1') {
        console.warn('Failed to close resource', error)
      }
    }
  }

  const launchOptions = {
    headless: HEADLESS,
    channel: BROWSER_CHANNEL === 'chrome' ? 'chrome' : undefined,
  }

  if (USER_DATA_DIR) {
    context = await chromium.launchPersistentContext(USER_DATA_DIR, { headless: HEADLESS })
    page = await context.newPage()
    browser = context.browser()
  } else {
    browser = await chromium.launch(launchOptions)
    const contextOptions =
      STORAGE_STATE_PATH && fs.existsSync(STORAGE_STATE_PATH)
        ? { storageState: STORAGE_STATE_PATH }
        : undefined
    context = await browser.newContext(contextOptions)
    page = await context.newPage()
  }

  try {
    await page.goto(TARGET_URL, { waitUntil: 'networkidle' })
    const botChallenge = await detectBotChallenge(page)
    if (botChallenge) {
      console.warn('Bot detection triggered on TikTok page', botChallenge)
      process.exitCode = 2
      return
    }

    console.log(`Opened TikTok video: ${page.url()}`)
  } finally {
    if (!KEEP_OPEN) {
      await safeClose(page)
      await safeClose(context)
      if (browser?.isConnected?.()) {
        await safeClose(browser)
      } else if (browser && !context) {
        await safeClose(browser)
      }
    }
  }
}

main().catch((error) => {
  console.error('Failed to open TikTok video', error)
  process.exitCode = 1
})
