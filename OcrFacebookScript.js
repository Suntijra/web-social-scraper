#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import axios from 'axios'
import dotenv from 'dotenv'
import { chromium } from 'playwright'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DEFAULT_OUTPUT_DIR = path.resolve(__dirname, 'captures')
const DEFAULT_URL =
  process.env.FACEBOOK_OCR_DEFAULT_URL ??
  'https://www.facebook.com/photo/?fbid=1140504118293032&set=gm.2444124459338516&idorvanity=1806641556420146'
const DEFAULT_COOKIES_PATH =
  process.env.FACEBOOK_COOKIES_PATH ?? path.resolve(__dirname, 'facebook', 'facebook_cookies.txt')
const DEFAULT_PROMPT =
  'You are an assistant that reads engagement metrics from Facebook screenshots. Inspect the image and extract total counts for reactions/likes, comments, shares, and video views (if present). Respond ONLY with JSON using this schema: {"likes": number|null, "comments": number|null, "shares": number|null, "view": number|null, "evidence": string|null}. Convert abbreviations like 2.3K/1.1M into absolute numbers. Treat view/viewers/plays as the “view” value. If a count is missing or unclear, set it to null. evidence should include the original text snippet you used, or null if none. Do not add extra text.'
const DEFAULT_MODEL = process.env.FACEBOOK_OCR_MODEL ?? 'qwen3-vl-30b'
const DEFAULT_API_URL = process.env.FACEBOOK_OCR_URL ?? 'https://bai-ap.jts.co.th:10628/v1/chat/completions'
const TOKEN_ENV_KEY = 'FACEBOOK_OCR_TOKEN'

const ensureOutputDir = async (dirPath) => {
  await fs.mkdir(dirPath, { recursive: true })
}

const parseNetscapeCookies = async (filePath) => {
  try {
    const content = await fs.readFile(filePath, 'utf8')
    const cookies = content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => line.split('\t'))
      .filter((parts) => parts.length >= 7)
      .map(([domain, , cookiePath, secure, expires, name, value]) => {
        const normalizedDomain = domain.startsWith('.') ? domain : `.${domain}`
        const secureFlag = secure.toUpperCase() === 'TRUE'
        const httpOnly = name.startsWith('c_user') || name.startsWith('xs')
        const expiresEpoch = Number.parseInt(expires, 10)
        return {
          domain: normalizedDomain,
          path: cookiePath || '/',
          name,
          value,
          secure: secureFlag,
          httpOnly,
          sameSite: 'Lax',
          expires: Number.isNaN(expiresEpoch) ? undefined : expiresEpoch,
        }
      })
    if (cookies.length === 0) {
      throw new Error('No cookies parsed from file')
    }
    return cookies
  } catch (error) {
    console.warn(`[warn] Failed to load cookies from ${filePath}: ${error.message}`)
    return []
  }
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const autoScroll = async (page, { step = 600, wait = 500 } = {}) => {
  const scrollState = await page.evaluateHandle(() => ({
    lastScrollTop: 0,
    finished: false,
  }))

  while (true) {
    const { finished } = await page.evaluate(
      async ({ state, scrollStep }) => {
        const doc = globalThis.document
        const { documentElement, body } = doc
        const maxScroll = Math.max(documentElement.scrollHeight, body.scrollHeight)
        globalThis.scrollBy({ top: scrollStep, behavior: 'smooth' })
        await new Promise((resolve) => setTimeout(resolve, 200))
        const currentScrollTop = globalThis.scrollY + globalThis.innerHeight
        const nearBottom = currentScrollTop + 5 >= maxScroll
        const stuck = Math.abs(state.lastScrollTop - currentScrollTop) < 5
        state.lastScrollTop = currentScrollTop
        state.finished = nearBottom || stuck
        return state
      },
      { state: scrollState, scrollStep: step }
    )

    if (finished) {
      break
    }
    await delay(wait)
  }
}

const takeScreenshot = async (page, outputDir, index) => {
  await ensureOutputDir(outputDir)
  const filename = path.join(outputDir, `capture-${String(index).padStart(2, '0')}.png`)
  await page.screenshot({ path: filename, fullPage: true })
  const buffer = await fs.readFile(filename)
  return { filename, buffer }
}

const toBase64DataUrl = (buffer) => {
  const base64 = buffer.toString('base64')
  return `data:image/png;base64,${base64}`
}

const buildRequestPayload = (imageDataUrl, prompt) => {
  return {
    model: DEFAULT_MODEL,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: imageDataUrl,
            },
          },
          {
            type: 'text',
            text: prompt ?? DEFAULT_PROMPT,
          },
        ],
      },
    ],
  }
}

const callVisionModel = async ({ imageBuffer, prompt }) => {
  const rawToken = process.env[TOKEN_ENV_KEY]
  if (!rawToken) {
    throw new Error(`Environment variable ${TOKEN_ENV_KEY} is required for authorization.`)
  }
  console.log('rawToken : ', rawToken)
  const bearerToken = rawToken
  const imageDataUrl = toBase64DataUrl(imageBuffer)

  const payload = buildRequestPayload(imageDataUrl, prompt)
  const { data } = await axios.post(DEFAULT_API_URL, payload, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bearerToken}`,
    },
    timeout: Number.parseInt(process.env.FACEBOOK_OCR_TIMEOUT ?? '120000', 10),
  })
  return data
}

const parseCliArgs = () => {
  const [, , targetUrl, outputDirArg, promptArg] = process.argv
  return {
    url: targetUrl ?? DEFAULT_URL,
    outputDir: outputDirArg ? path.resolve(outputDirArg) : DEFAULT_OUTPUT_DIR,
    prompt: promptArg ?? DEFAULT_PROMPT,
  }
}

const run = async () => {
  const { url, outputDir, prompt } = parseCliArgs()
  if (!url) {
    throw new Error('No target URL provided and DEFAULT_URL is empty. Set FACEBOOK_OCR_DEFAULT_URL or pass a URL.')
  }
  const browser = await chromium.launch({ headless: false, args: ['--disable-blink-features=AutomationControlled'] })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    const cookieCandidates = await parseNetscapeCookies(DEFAULT_COOKIES_PATH)
    if (cookieCandidates.length > 0) {
      await context.addCookies(cookieCandidates)
      console.log(`Loaded ${cookieCandidates.length} cookies from ${DEFAULT_COOKIES_PATH}`)
    }

    console.log(`Navigating to ${url}`)
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 })
    await delay(1500)
    const shouldScroll = process.env.FACEBOOK_OCR_ENABLE_SCROLL === '1'
    if (shouldScroll) {
      console.log('Auto scrolling to bottom (FACEBOOK_OCR_ENABLE_SCROLL=1)...')
      await autoScroll(page)
      await delay(1000)
    } else {
      console.log('Skipping auto scroll (set FACEBOOK_OCR_ENABLE_SCROLL=1 to enable)')
    }

    console.log('Capturing screenshot...')
    const { filename, buffer } = await takeScreenshot(page, outputDir, 1)
    console.log(`Saved capture to ${filename}`)

    console.log('Sending image to vision model...')
    const response = await callVisionModel({ imageBuffer: buffer, prompt })
    console.log('Vision response:')
    console.dir(response, { depth: null })

    const outputJson = path.join(outputDir, 'ocr-response.json')
    await fs.writeFile(outputJson, JSON.stringify(response, null, 2), 'utf8')
    console.log(`Response saved to ${outputJson}`)
  } finally {
    await page.close()
    await context.close()
    await browser.close()
  }
}

run().catch((error) => {
  console.error('Failed to capture and process Facebook page:')
  console.error(error)
  process.exitCode = 1
})
