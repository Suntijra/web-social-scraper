import { readFile } from 'node:fs/promises'

import { chromium } from 'playwright'

import type { TSocialScraperComment } from '#types/social-scraper'
import type { Browser, BrowserContext, Page } from 'playwright'

interface TikTokScrapeOptions {
  url: string
  storageStatePath?: string
  headless?: boolean
  maxComments?: number
  onMetadata?: (snapshot: TikTokScrapeMetrics) => Promise<void> | void
  onComment?: (comment: TSocialScraperComment) => Promise<void> | void
  signal?: AbortSignal
}

interface TikTokScrapeResult {
  displayName: string
  title: string
  followers: number
  commentsCount: number
  bookmarks: number
  reposts: number
  view: number
  shares: number
  likes: number
  comments: TSocialScraperComment[]
}

interface TikTokScrapeMetrics {
  displayName: string
  title: string
  followers: number
  commentsCount: number
  bookmarks: number
  reposts: number
  view: number
  shares: number
  likes: number
}

type TikTokStorageState = Awaited<ReturnType<BrowserContext['storageState']>>

const DEFAULT_TIKTOK_STORAGE_STATE_PATH = 'tiktok-state.json'

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) {
    return fallback
  }
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
}

const parseCountText = (text: string | undefined): number => {
  if (!text) {
    return 0
  }
  const sanitized = text.trim().toUpperCase().replace(/,/g, '')
  if (!sanitized) {
    return 0
  }
  if (sanitized.endsWith('K')) {
    return Math.floor(Number.parseFloat(sanitized.replace('K', '')) * 1_000)
  }
  if (sanitized.endsWith('M')) {
    return Math.floor(Number.parseFloat(sanitized.replace('M', '')) * 1_000_000)
  }
  if (sanitized.endsWith('B')) {
    return Math.floor(Number.parseFloat(sanitized.replace('B', '')) * 1_000_000_000)
  }
  const numeric = Number.parseFloat(sanitized)
  return Number.isNaN(numeric) ? 0 : Math.floor(numeric)
}

const launchBrowser = async (
  headless: boolean,
  storageState?: TikTokStorageState
): Promise<{ browser: Browser; context: BrowserContext }> => {
  const browser = await chromium.launch({ headless, timeout: 60_000 })
  const context = storageState ? await browser.newContext({ storageState }) : await browser.newContext()
  return { browser, context }
}

const loadStorageState = async (path?: string): Promise<TikTokStorageState | undefined> => {
  if (!path) {
    return undefined
  }

  try {
    const content = await readFile(path, 'utf8')
    return JSON.parse(content) as TikTokStorageState
  } catch {
    return undefined
  }
}

const handlePopups = async (page: Page): Promise<void> => {
  await page.keyboard.press('Escape').catch(() => undefined)
  const selectors = [
    'button[aria-label*="Close"]',
    'button[data-e2e*="close-modal"]',
    'button:has-text("Not now")',
    'button:has-text("No thanks")',
  ]

  for (const selector of selectors) {
    await page
      .locator(selector)
      .first()
      .click({ timeout: 2_000 })
      .catch(() => undefined)
  }
}

const collectComments = async (
  page: Page,
  limit: number,
  options?: {
    onComment?: (comment: TSocialScraperComment) => Promise<void> | void
    signal?: AbortSignal
  }
): Promise<TSocialScraperComment[]> => {
  const comments: TSocialScraperComment[] = []
  const commentItems = await page.locator('div[data-e2e="comment-item"]')
  const total = await commentItems.count()

  const isAborted = (): boolean => Boolean(options?.signal?.aborted)

  for (let index = 0; index < total; index += 1) {
    if (isAborted()) {
      break
    }

    if (limit > 0 && comments.length >= limit) {
      break
    }

    const item = commentItems.nth(index)

    try {
      const authorName = ((await item.locator('a[data-e2e="comment-avatar-name"] span').textContent()) ?? '').trim()
      const text = ((await item.locator('p[data-e2e="comment-text"]').textContent()) ?? '').trim()

      if (!text) {
        continue
      }

      const comment = {
        authorName,
        text,
      }
      comments.push(comment)
      if (options?.onComment) {
        await options.onComment(comment)
      }
    } catch {
      continue
    }
  }

  return comments
}

export const scrapeTiktokVideo = async ({
  url,
  storageStatePath,
  headless,
  maxComments = 20,
  onMetadata,
  onComment,
  signal,
}: TikTokScrapeOptions): Promise<TikTokScrapeResult> => {
  if (!url) {
    throw new Error('URL is required for TikTok scrape')
  }

  const resolvedHeadless = headless ?? parseBoolean(process.env.PLAYWRIGHT_HEADLESS, true)
  const storageState = await loadStorageState(
    storageStatePath ?? process.env.TIKTOK_STORAGE_STATE_PATH ?? DEFAULT_TIKTOK_STORAGE_STATE_PATH
  )
  const { browser, context } = await launchBrowser(resolvedHeadless, storageState)

  try {
    const page = await context.newPage()
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await handlePopups(page)
    await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => undefined)

    const displayName = (
      (await page.locator('a[data-e2e="user-name"], span[data-e2e="user-name"]').first().textContent()) ?? ''
    ).trim()

    const title = ((await page.locator('h1[data-e2e="video-desc"]').first().textContent()) ?? '').trim()

    const commentRaw = await page
      .locator('[data-e2e="comment-count"] strong, [data-e2e="comment-count"]')
      .first()
      .textContent()
    const likeRaw = await page.locator('[data-e2e="like-count"] strong, [data-e2e="like-count"]').first().textContent()
    const shareRaw = await page
      .locator('[data-e2e="share-count"] strong, [data-e2e="share-count"]')
      .first()
      .textContent()

    const commentCount = parseCountText(commentRaw ?? undefined)
    const likeCount = parseCountText(likeRaw ?? undefined)
    const shareCount = parseCountText(shareRaw ?? undefined)

    let viewCount = 0
    const viewLocator = page.locator('[data-e2e="video-views"], .tiktok-bvy84n-DivVideoCount').first()
    if (await viewLocator.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const viewText = await viewLocator.textContent()
      viewCount = parseCountText(viewText ?? undefined)
    }

    const snapshot: TikTokScrapeMetrics = {
      displayName,
      title,
      followers: 0,
      commentsCount: commentCount,
      bookmarks: 0,
      reposts: shareCount,
      view: viewCount,
      shares: shareCount,
      likes: likeCount,
    }
    await onMetadata?.(snapshot)

    const comments = await collectComments(page, maxComments, { onComment, signal })

    return {
      ...snapshot,
      comments,
    }
  } finally {
    await context.close()
    await browser.close()
  }
}

export type { TikTokScrapeResult }
