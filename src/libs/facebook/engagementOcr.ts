import fs from 'node:fs/promises'
import path from 'node:path'

import axios from 'axios'
import { chromium, type BrowserContext } from 'playwright'

import logging from '#libs/logger'

const DEFAULT_OCR_MODEL = process.env.FACEBOOK_OCR_MODEL ?? 'qwen3-vl-30b'
const DEFAULT_OCR_URL = process.env.FACEBOOK_OCR_URL ?? 'https://bai-ap.jts.co.th:10628/v1/chat/completions'
const TOKEN_ENV_KEY = 'FACEBOOK_OCR_TOKEN'
const DEFAULT_COOKIES_PATH =
  process.env.FACEBOOK_COOKIES_PATH ?? path.resolve(process.cwd(), 'facebook', 'facebook_cookies.txt')

const DEFAULT_PROMPT =
  'You are an assistant that reads engagement metrics from Facebook screenshots. Inspect the image and extract total counts for reactions/likes, comments, shares, and video views (if present). Respond ONLY with JSON using this schema: {"likes": number|null, "comments": number|null, "shares": number|null, "view": number|null, "evidence": string|null}. Convert abbreviations like 2.3K/1.1M into absolute numbers. Treat view/viewers/plays as the “view” value. If a count is missing or unclear, set it to null. evidence should include the original text snippet you used, or null if none. Do not add extra text.'

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

interface DomScrollWindow {
  document: {
    documentElement: { scrollHeight: number }
    body: { scrollHeight: number }
  }
  scrollBy: (options: { top: number; behavior?: 'auto' | 'smooth' }) => void
  scrollY: number
  innerHeight: number
}

interface ScrollComputationResult {
  finished: boolean
  currentScrollTop: number
}

type PlaywrightCookie = Parameters<BrowserContext['addCookies']>[0][number]

const parseNetscapeCookies = async (filePath: string): Promise<PlaywrightCookie[]> => {
  try {
    const content = await fs.readFile(filePath, 'utf8')
    const cookies = content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => line.split('\t'))
      .filter((parts): parts is [string, string, string, string, string, string, string] => parts.length >= 7)
      .map(([domain = '', , cookiePath = '/', secure = 'FALSE', expires = '', name = '', value = '']) => {
        if (!domain || !name) {
          return null
        }
        const normalizedDomain = domain.startsWith('.') ? domain : `.${domain}`
        const expiresEpoch = Number.parseInt(expires, 10)
        const cookie: PlaywrightCookie = {
          domain: normalizedDomain,
          path: cookiePath || '/',
          name,
          value,
          secure: secure.toUpperCase() === 'TRUE',
          httpOnly: name.startsWith('c_user') || name.startsWith('xs'),
          sameSite: 'Lax',
        }
        if (!Number.isNaN(expiresEpoch)) {
          cookie.expires = expiresEpoch
        }
        return cookie
      })
      .filter((cookie): cookie is PlaywrightCookie => Boolean(cookie))
    return cookies
  } catch (error) {
    logging.logger.warn(
      { error: error instanceof Error ? error.message : error, filePath },
      'Failed to load cookies for OCR session'
    )
    return []
  }
}

interface ScreenshotResult {
  imageBuffer: Buffer
  outputPath: string
}

const captureScreenshot = async (
  url: string,
  options?: { enableScroll?: boolean; outputDir?: string }
): Promise<ScreenshotResult> => {
  const outputDir = options?.outputDir ?? path.resolve(process.cwd(), 'captures')
  await fs.mkdir(outputDir, { recursive: true })
  const browser = await chromium.launch({ headless: false, args: ['--disable-blink-features=AutomationControlled'] })
  const context = await browser.newContext()
  const page = await context.newPage()
  try {
    const cookies = await parseNetscapeCookies(DEFAULT_COOKIES_PATH)
    if (cookies.length > 0) {
      await context.addCookies(cookies)
    }
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 })
    await delay(1_000)
    if (options?.enableScroll) {
      let lastScrollTop = 0
      let done = false
      while (!done) {
        const result = await page.evaluate<ScrollComputationResult, { previousScrollTop: number; scrollStep: number }>(
          async ({ previousScrollTop, scrollStep }: { previousScrollTop: number; scrollStep: number }) => {
            const win = globalThis as unknown as DomScrollWindow
            const { documentElement, body } = win.document
            const maxScroll = Math.max(documentElement.scrollHeight, body.scrollHeight)
            win.scrollBy({ top: scrollStep, behavior: 'smooth' })
            await new Promise((resolve) => setTimeout(resolve, 200))
            const currentScrollTop = win.scrollY + win.innerHeight
            const nearBottom = currentScrollTop + 5 >= maxScroll
            const stuck = Math.abs(previousScrollTop - currentScrollTop) < 5
            return { finished: nearBottom || stuck, currentScrollTop }
          },
          { previousScrollTop: lastScrollTop, scrollStep: 600 }
        )
        done = result.finished
        lastScrollTop = result.currentScrollTop
        await delay(600)
      }
    }
    await delay(500)
    const filename = path.join(outputDir, `capture-${Date.now()}.png`)
    await page.screenshot({ path: filename, fullPage: true })
    const buffer = await fs.readFile(filename)
    return { imageBuffer: buffer, outputPath: filename }
  } finally {
    await page.close()
    await context.close()
    await browser.close()
  }
}

const toBase64DataUrl = (buffer: Buffer): string => `data:image/png;base64,${buffer.toString('base64')}`

const callVisionModel = async (params: { image: Buffer; prompt?: string }): Promise<string | null> => {
  const token = process.env[TOKEN_ENV_KEY]
  if (!token) {
    throw new Error(`Environment variable ${TOKEN_ENV_KEY} is required for OCR requests.`)
  }
  const bearerToken = token.trim()
  const payload = {
    model: DEFAULT_OCR_MODEL,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: toBase64DataUrl(params.image),
            },
          },
          {
            type: 'text',
            text: params.prompt ?? DEFAULT_PROMPT,
          },
        ],
      },
    ],
  }
  const { data } = await axios.post<{
    choices?: {
      message?: {
        content?: string | { type: string; text?: string }[]
      }
    }[]
  }>(DEFAULT_OCR_URL, payload, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bearerToken}`,
    },
    timeout: Number.parseInt(process.env.FACEBOOK_OCR_TIMEOUT ?? '120000', 10),
  })
  const choice = data.choices?.[0]?.message?.content
  if (!choice) {
    return null
  }
  if (typeof choice === 'string') {
    return choice
  }
  if (Array.isArray(choice)) {
    const textContent = choice.find((entry) => entry.type === 'text')?.text
    return textContent ?? null
  }
  return null
}

export interface OcrEngagementResult {
  responseText: string | null
  screenshotPath: string
}

export const runOcrEngagement = async (
  url: string,
  options?: { prompt?: string; screenshotDir?: string }
): Promise<OcrEngagementResult> => {
  const { imageBuffer, outputPath } = await captureScreenshot(url, {
    enableScroll: process.env.FACEBOOK_OCR_ENABLE_SCROLL === '1',
    outputDir: options?.screenshotDir,
  })
  const responseText = await callVisionModel({ image: imageBuffer, prompt: options?.prompt })
  return { responseText, screenshotPath: outputPath }
}
