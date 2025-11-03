import { chromium } from 'playwright'

import type { TSocialScraperComment } from '#types/social-scraper'
import type { PinoLogger } from 'hono-pino'
import type { Browser, BrowserContext, Page } from 'playwright'

interface YouTubeScrapeOptions {
  url: string
  maxComments?: number
  headless?: boolean
  logger?: PinoLogger
  onMetadata?: (snapshot: YouTubeScrapeMetrics) => Promise<void> | void
  onComment?: (comment: TSocialScraperComment) => Promise<void> | void
  signal?: AbortSignal
}

interface YouTubeScrapeResult {
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

interface YouTubeMetadata {
  title: string
  channelName: string
  likeCount: number
  viewCount: number
  commentCount: number
}

interface YouTubeScrapeMetrics {
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

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) {
    return fallback
  }
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
}

const parseCountText = (raw: string | undefined): number => {
  const original = raw ?? ''
  const text = original.replace(/[,\s]/g, '').toLowerCase()
  if (!text) {
    return 0
  }
  const match = text.match(/[0-9]+(?:\.[0-9]+)?/)
  if (!match) {
    return 0
  }
  const value = Number.parseFloat(match[0] ?? '0')
  if (Number.isNaN(value)) {
    return 0
  }
  const thaiMultipliers: Record<string, number> = {
    พัน: 1_000,
    หมื่น: 10_000,
    แสน: 100_000,
    ล้าน: 1_000_000,
  }
  for (const [keyword, multiplier] of Object.entries(thaiMultipliers)) {
    if (text.includes(keyword)) {
      return Math.floor(value * multiplier)
    }
  }
  if (text.includes('k')) {
    return Math.floor(value * 1_000)
  }
  if (text.includes('m')) {
    return Math.floor(value * 1_000_000)
  }
  if (text.includes('b')) {
    return Math.floor(value * 1_000_000_000)
  }
  return Math.floor(value)
}

const ensureVisible = async (page: Page, selector: string, timeout = 15_000): Promise<void> => {
  await page.locator(selector).first().waitFor({ state: 'visible', timeout })
}

const launchBrowser = async (headless: boolean): Promise<{ browser: Browser; context: BrowserContext }> => {
  const browser = await chromium.launch({ headless, timeout: 60_000 })
  const context = await browser.newContext()
  return { browser, context }
}

const collectVideoMetadata = async (page: Page, logger?: PinoLogger): Promise<YouTubeMetadata> => {
  await ensureVisible(page, 'h1.style-scope.ytd-watch-metadata yt-formatted-string')

  const title = (
    (await page.locator('h1.style-scope.ytd-watch-metadata yt-formatted-string').first().textContent()) ?? ''
  ).trim()
  const channelName = ((await page.locator('#channel-name a').first().textContent()) ?? '').trim()

  let likeCount = 0
  const likeSelectors = [
    '#top-level-buttons-computed > segmented-like-dislike-button-view-model > yt-smartimation > div > div > like-button-view-model > toggle-button-view-model > button-view-model > button > div.yt-spec-button-shape-next__button-text-content',
    '#segmented-like-button button div.yt-spec-button-shape-next__button-text-content',
    '#segmented-like-button button span',
    '#menu-container #segmented-like-button yt-formatted-string',
  ]

  const likeCandidate = await page
    .evaluate<{ selector: string; text: string } | null, string[]>((selectors) => {
      const doc = (
        globalThis as typeof globalThis & {
          document?: {
            querySelector?: (
              selector: string
            ) => { textContent?: string | null; getAttribute?: (name: string) => string | null } | null
          }
        }
      ).document
      if (!doc?.querySelector) {
        return null
      }

      for (const selector of selectors) {
        const node = doc.querySelector(selector)
        const text = node?.textContent?.trim()
        if (text) {
          return { selector, text }
        }
      }

      const button =
        doc.querySelector('#segmented-like-button button') ?? doc.querySelector('#top-level-buttons-computed button')
      const aria = button?.getAttribute?.('aria-label')?.trim()
      if (aria) {
        return { selector: 'aria-label', text: aria }
      }

      return null
    }, likeSelectors)
    .catch(() => null)

  if (likeCandidate) {
    logger?.debug({ source: likeCandidate.selector, raw: likeCandidate.text }, 'youtube like raw text')
    likeCount = parseCountText(likeCandidate.text)
    logger?.debug({ source: likeCandidate.selector, parsed: likeCount }, 'youtube like candidate')
  }

  if (likeCount === 0) {
    logger?.warn('youtube like count resolved to 0 after all parsing strategies')
  }

  let viewCount = 0
  try {
    const directView = await page
      .locator('#info > span:nth-child(1)')
      .first()
      .textContent({ timeout: 5_000 })
      .catch(() => null)

    if (directView) {
      const parsed = parseCountText(directView)
      logger?.debug({ source: 'direct', raw: directView, parsed }, 'youtube view candidate')
      if (parsed > 0) {
        viewCount = parsed
      }
    }

    const ariaLabel = await page
      .evaluate<string | null>(() => {
        const doc = (
          globalThis as typeof globalThis & {
            document?: { querySelector?: (selector: string) => { ariaLabel?: string | null } | null }
          }
        ).document
        const element = doc?.querySelector?.('#view-count')
        if (typeof element?.ariaLabel === 'string') {
          return element.ariaLabel
        }
        return null
      })
      .catch(() => null)
    if (ariaLabel) {
      logger?.debug({ source: 'aria-eval', raw: ariaLabel }, 'youtube view ariaLabel raw')
    } else {
      logger?.debug('youtube view ariaLabel raw not found via document.querySelector')
    }

    if (viewCount === 0) {
      const ariaView = await page
        .locator('#view-count')
        .first()
        .getAttribute('aria-label')
        .catch(() => null)
      if (ariaView) {
        const parsed = parseCountText(ariaView)
        logger?.debug({ source: 'aria', raw: ariaView, parsed }, 'youtube view candidate')
        if (parsed > 0) {
          viewCount = parsed
        }
      }
    }

    const fallbackSelectors = [
      '#primary-inner #count .view-count',
      '#info-text span.view-count',
      '#info > span:nth-child(1)',
      'span.yt-view-count-renderer',
    ]

    if (viewCount === 0) {
      for (const selector of fallbackSelectors) {
        const text = await page
          .locator(selector)
          .first()
          .textContent({ timeout: 2_000 })
          .catch(() => null)
        if (!text) {
          continue
        }
        const parsed = parseCountText(text)
        logger?.debug({ source: selector, raw: text, parsed }, 'youtube view candidate')
        if (parsed > 0) {
          viewCount = parsed
          break
        }
      }
    }

    if (viewCount === 0) {
      const infoStrings = await page.locator('#info-container yt-formatted-string').allTextContents()
      const viewText = infoStrings.find((content) => /views|ครั้ง|การดู/i.test(content ?? ''))
      const parsed = parseCountText(viewText)
      logger?.info({ source: 'fallback-list', raw: viewText, parsed }, 'youtube view candidate')
      if (parsed > 0) {
        viewCount = parsed
      }
    }
  } catch (error) {
    logger?.error({ error }, 'failed to parse youtube view count')
    viewCount = 0
  }

  if (viewCount === 0) {
    logger?.warn('youtube view count resolved to 0 after all parsing strategies')
  }

  let commentCount = 0
  try {
    await ensureVisible(page, '#comments', 10_000)
    const commentHeader = page.locator('h2#count .count-text').first()
    const countText = await commentHeader.textContent()
    commentCount = parseCountText(countText ?? undefined)
  } catch {
    commentCount = 0
  }

  return { title, channelName, likeCount, viewCount, commentCount }
}

const collectComments = async (
  page: Page,
  limit: number,
  options?: {
    onComment?: (comment: TSocialScraperComment) => Promise<void> | void
    signal?: AbortSignal
  }
): Promise<TSocialScraperComment[]> => {
  const comments = new Map<string, TSocialScraperComment>()
  let scrollAttempts = 0
  const maxScrollAttempts = 15
  let lastSize = 0

  await page
    .locator('#comments')
    .first()
    .scrollIntoViewIfNeeded()
    .catch(() => undefined)
  await page.waitForTimeout(3_000)

  const isAborted = (): boolean => Boolean(options?.signal?.aborted)

  while (!isAborted() && (limit <= 0 || comments.size < limit) && scrollAttempts < maxScrollAttempts) {
    const commentElements = await page.locator('ytd-comment-thread-renderer #comment-container').all()

    for (const element of commentElements) {
      if (isAborted()) {
        break
      }

      try {
        const username = ((await element.locator('#author-text span').first().textContent()) ?? '').trim()
        const text = ((await element.locator('yt-attributed-string#content-text').textContent()) ?? '').trim()

        if (!username || !text) {
          continue
        }

        const key = `${username}:${text.substring(0, 48)}`
        if (!comments.has(key)) {
          const comment = {
            authorName: username,
            text,
          }
          comments.set(key, comment)
          if (options?.onComment) {
            await options.onComment(comment)
          }
        }

        if (limit > 0 && comments.size >= limit) {
          break
        }
      } catch {
        continue
      }
    }

    if (limit > 0 && comments.size >= limit) {
      break
    }

    if (isAborted()) {
      break
    }

    if (comments.size > lastSize) {
      lastSize = comments.size
      scrollAttempts = 0
    } else {
      scrollAttempts += 1
    }

    if (scrollAttempts >= maxScrollAttempts) {
      break
    }

    await page.mouse.wheel(0, 1_200)
    await page.waitForTimeout(2_000)
  }

  return Array.from(comments.values()).slice(0, limit > 0 ? limit : undefined)
}

export const scrapeYouTubeVideo = async ({
  url,
  maxComments = 20,
  headless,
  logger,
  onMetadata,
  onComment,
  signal,
}: YouTubeScrapeOptions): Promise<YouTubeScrapeResult> => {
  if (!url) {
    throw new Error('URL is required for YouTube scrape')
  }

  const resolvedHeadless = headless ?? parseBoolean(process.env.PLAYWRIGHT_HEADLESS, true)

  const { browser, context } = await launchBrowser(resolvedHeadless)

  try {
    const page = await context.newPage()
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined)

    const metadata = await collectVideoMetadata(page, logger)
    const snapshot: YouTubeScrapeMetrics = {
      displayName: metadata.channelName,
      title: metadata.title,
      followers: 0,
      commentsCount: metadata.commentCount,
      bookmarks: 0,
      reposts: 0,
      view: metadata.viewCount,
      shares: 0,
      likes: metadata.likeCount,
    }
    await onMetadata?.(snapshot)

    const comments = await collectComments(page, maxComments, {
      onComment,
      signal,
    })

    return {
      ...snapshot,
      comments,
    }
  } finally {
    await context.close()
    await browser.close()
  }
}

export type { YouTubeScrapeResult }
