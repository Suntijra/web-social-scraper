import { chromium, type Page } from 'playwright'

import type { TikTokScrapeMetrics, TikTokScrapeOptions, TikTokScrapeResult } from '#types/tiktok'

const ACTION_BAR_ROOT = '#one-column-item-0 > div > section.css-jbg155-5e6d46e3--SectionActionBarContainer.e12arnib0'
const METRIC_TIMEOUT = 15_000

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

const readFirstTextContent = async (page: Page, selectors: string[]): Promise<string> => {
  for (const selector of selectors) {
    try {
      const locator = page.locator(selector).first()
      await locator.waitFor({ state: 'attached', timeout: METRIC_TIMEOUT })
      const text = await locator.textContent()
      if (text && text.trim().length > 0) {
        return text.trim()
      }
    } catch {
      continue
    }
  }
  return ''
}

const readMetricCount = async (page: Page, selector: string): Promise<number> => {
  try {
    const locator = page.locator(selector).first()
    await locator.waitFor({ state: 'visible', timeout: METRIC_TIMEOUT })
    const text = (await locator.textContent()) ?? ''
    return parseCountText(text)
  } catch {
    return 0
  }
}

export const scrapeTiktokVideo = async ({
  url,
  headless,
  browserChannel,
  signal,
  onMetadata,
}: TikTokScrapeOptions): Promise<TikTokScrapeResult> => {
  if (!url) {
    throw new Error('URL is required for TikTok scrape')
  }

  const resolvedHeadless = headless ?? parseBoolean(process.env.PLAYWRIGHT_HEADLESS, false)
  const resolvedChannel = browserChannel ?? process.env.PLAYWRIGHT_TIKTOK_BROWSER_CHANNEL ?? 'chrome'

  const browser = await chromium.launch({ headless: resolvedHeadless, channel: resolvedChannel, timeout: 60_000 })
  const page = await browser.newPage()

  const abortListener = () => {
    void page.close().catch(() => undefined)
  }

  if (signal?.aborted) {
    await browser.close()
    throw new Error('TikTok scraping aborted')
  }

  signal?.addEventListener('abort', abortListener, { once: true })

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 90_000 })

    if (signal?.aborted) {
      throw new Error('TikTok scraping aborted')
    }

    const displayName = await readFirstTextContent(page, [
      'a[data-e2e="user-name"] span',
      'a[data-e2e="user-name"]',
      'span[data-e2e="user-name"]',
    ])
    const title = await readFirstTextContent(page, [
      'h1[data-e2e="video-desc"]',
      'h1[data-e2e="video-title"]',
      'h1[data-e2e="browse-video-desc"]',
    ])

    const commentCount = await readMetricCount(page, `${ACTION_BAR_ROOT} > button:nth-child(1) > strong`)
    const likeCount = await readMetricCount(page, `${ACTION_BAR_ROOT} > button:nth-child(2) > strong`)
    const shareCount = await readMetricCount(page, `${ACTION_BAR_ROOT} > button:nth-child(5) > strong`)
    const bookmarkCount = await readMetricCount(page, `${ACTION_BAR_ROOT} > div:nth-child(4) > button > strong`)
    const viewCount = await readMetricCount(page, '[data-e2e="video-views"], .tiktok-bvy84n-DivVideoCount strong')

    const snapshot: TikTokScrapeMetrics = {
      displayName,
      title,
      followers: 0,
      commentsCount: commentCount,
      bookmarks: bookmarkCount,
      reposts: shareCount,
      view: viewCount,
      shares: shareCount,
      likes: likeCount,
    }

    await onMetadata?.(snapshot)

    const comments: TikTokScrapeResult['comments'] = []

    return {
      ...snapshot,
      comments,
    }
  } finally {
    if (signal) {
      signal.removeEventListener('abort', abortListener)
    }
    await browser.close()
  }
}

export type { TikTokScrapeResult }
