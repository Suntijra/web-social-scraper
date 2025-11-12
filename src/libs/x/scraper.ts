import { chromium } from 'playwright'

import { envVariables } from '#factory'

import type { TSocialScraperComment } from '#types/social-scraper'
import type { XCredentials, XMainTweetData, XScrapeMetrics, XScrapeOptions, XScrapeResult } from '#types/x'
import type { Browser, BrowserContext, Cookie, Page } from 'playwright'

const DEFAULT_X_AUTH_TOKEN = 'be732f9bd8ba416c0e5f249154dca0a1cac952a6'
const DEFAULT_X_CT0_TOKEN =
  '76fe636f7c7edeeaa941ca1f80e4cb9658653513602e4eaf22be107ff7ac8c75e453e804c95d06b89a663a8b4bde07f2460b54ed91f2233a08c3bbb445d817deaaa53ef09ca5dbdf173e6c9120dbcdb3'

const DEFAULT_MAX_COMMENTS = 20

const parseEnvBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) {
    return fallback
  }
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
}

const parseCountText = (text: string): number => {
  const sanitized = text.replace(/,/g, '').trim()
  if (!sanitized) {
    return 0
  }

  const match = sanitized.match(/([\d.]+)\s*([kmb])?/i)
  if (!match) {
    return 0
  }

  const baseValue = Number.parseFloat(match[1] ?? '0')
  if (Number.isNaN(baseValue)) {
    return 0
  }

  const suffix = (match[2] ?? '').toLowerCase()
  if (suffix === 'k') {
    return Math.floor(baseValue * 1_000)
  }
  if (suffix === 'm') {
    return Math.floor(baseValue * 1_000_000)
  }
  if (suffix === 'b') {
    return Math.floor(baseValue * 1_000_000_000)
  }

  return Math.floor(baseValue)
}

const resolveCredentials = (credentials?: Partial<XCredentials>): XCredentials => {
  const authToken = credentials?.authToken ?? envVariables.X_AUTH_TOKEN ?? DEFAULT_X_AUTH_TOKEN
  const ct0 = credentials?.ct0 ?? envVariables.X_CT0_TOKEN ?? DEFAULT_X_CT0_TOKEN

  if (!authToken || !ct0) {
    throw new Error('X credentials (auth_token, ct0) are required to scrape tweets')
  }

  return { authToken, ct0 }
}

const createAuthCookies = ({ authToken, ct0 }: XCredentials): Cookie[] => [
  {
    name: 'auth_token',
    value: authToken,
    domain: '.x.com',
    path: '/',
    expires: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
  },
  {
    name: 'ct0',
    value: ct0,
    domain: '.x.com',
    path: '/',
    expires: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
    httpOnly: false,
    secure: true,
    sameSite: 'Lax',
  },
]

const collectMainTweetData = async (page: Page): Promise<XMainTweetData> => {
  const mainTweet = page.locator('article[data-testid="tweet"]').first()
  await mainTweet.waitFor({ state: 'visible', timeout: 15_000 })

  const displayName = (
    (await mainTweet.locator('div[data-testid="User-Name"] span').first().textContent()) ?? ''
  ).trim()

  const titleParts = await mainTweet.locator('[data-testid="tweetText"] span').allTextContents()
  const title = titleParts
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ')
    .trim()

  const resolveMetric = async (selector: string): Promise<number> => {
    try {
      const button = mainTweet.locator(selector)
      const ariaLabel = await button.getAttribute('aria-label')
      if (!ariaLabel) {
        return 0
      }
      const countText = ariaLabel.split(' ')[0] ?? '0'
      return parseCountText(countText)
    } catch {
      return 0
    }
  }

  const repostCount = await resolveMetric('button[data-testid="retweet"]')
  const likeCount = await resolveMetric('button[data-testid="like"]')
  const bookmarkCount = await resolveMetric('button[data-testid="bookmark"]')

  let viewCount = 0
  try {
    const viewCountText =
      (await page
        .locator(
          '#react-root > div > div > div.css-175oi2r.r-1f2l425.r-13qz1uu.r-417010.r-18u37iz > main > div > div > div > div > div > section > div > div > div:nth-child(1) > div > div > article > div > div > div:nth-child(3) > div.css-175oi2r.r-12kyg2d > div > div.css-175oi2r.r-1wbh5a2.r-1a11zyx > div > div:nth-child(3) > span > div > span > span > span'
        )
        .first()
        .textContent()) ?? '0'
    viewCount = parseCountText(viewCountText)
  } catch {
    viewCount = 0
  }

  let replyCount = 0
  try {
    const replyButton = mainTweet.locator('button[data-testid="reply"]').first()
    const replyLabel = await replyButton.getAttribute('aria-label')
    if (replyLabel) {
      replyCount = parseCountText(replyLabel.split(' ')[0] ?? '0')
    }
  } catch {
    replyCount = 0
  }

  return {
    displayName,
    title,
    repostCount,
    likeCount,
    bookmarkCount,
    viewCount,
    replyCount,
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
  const comments = new Map<string, TSocialScraperComment>()
  let scrollAttempts = 0
  const maxScrollAttempts = Number.isFinite(limit) ? Math.max(10, Math.ceil(limit / 5)) : 30
  let lastSize = 0
  const idleTimeoutMs = 60_000
  let lastNewCommentTimestamp = Date.now()

  const isAborted = (): boolean => Boolean(options?.signal?.aborted)

  while (!isAborted() && comments.size < limit && scrollAttempts < maxScrollAttempts) {
    const commentArticles = await page.locator('article[data-testid="tweet"]').all()
    if (commentArticles.length > 1) {
      for (const commentElement of commentArticles.slice(1)) {
        if (isAborted()) {
          break
        }

        try {
          const usernameLocator = commentElement.locator('div[data-testid="User-Name"] span:has-text("@")').first()
          const handle = ((await usernameLocator.textContent()) ?? '').trim()
          const authorName = handle.startsWith('@') ? handle : handle ? `@${handle}` : ''

          const textLocator = commentElement.locator('div[data-testid="tweetText"]').first()
          const text = ((await textLocator.textContent()) ?? '').trim()

          if (!text) {
            continue
          }

          const key = `${authorName}:${text.substring(0, 32)}`
          if (!comments.has(key)) {
            const comment = {
              authorName,
              text,
            }
            comments.set(key, comment)
            lastNewCommentTimestamp = Date.now()
            if (options?.onComment) {
              await options.onComment(comment)
            }
          }

          if (comments.size >= limit) {
            break
          }
        } catch {
          continue
        }
      }
    }

    if (comments.size > lastSize) {
      lastSize = comments.size
      scrollAttempts = 0
    } else {
      scrollAttempts += 1
    }

    if (comments.size >= limit || scrollAttempts >= maxScrollAttempts) {
      break
    }

    if (isAborted()) {
      break
    }

    if (Date.now() - lastNewCommentTimestamp >= idleTimeoutMs) {
      break
    }

    await page.mouse.wheel(0, 1_200)
    await page.waitForTimeout(2_000)
  }

  return Array.from(comments.values())
}

const ensureAuthenticated = async (page: Page): Promise<void> => {
  const loginPromptVisible = await page
    .locator('a[href*="/i/flow/login"], div[data-testid="loginSheetDialog"], div[data-testid="app-bar-login"]')
    .first()
    .isVisible()
    .catch(() => false)

  if (loginPromptVisible) {
    throw new Error('Unable to access tweet content because login is required')
  }
}

const launchBrowser = async (headless: boolean): Promise<{ browser: Browser; context: BrowserContext }> => {
  const browser = await chromium.launch({ headless, timeout: 60_000 })
  const context = await browser.newContext()
  return { browser, context }
}

export const scrapeXPost = async ({
  url,
  maxComments,
  headless,
  credentials,
  onMetadata,
  onComment,
  signal,
}: XScrapeOptions): Promise<XScrapeResult> => {
  if (!url) {
    throw new Error('URL is required for X scrape')
  }

  const resolvedHeadless = headless ?? parseEnvBoolean(envVariables.PLAYWRIGHT_HEADLESS, true)
  const resolvedCredentials = resolveCredentials(credentials)

  const { browser, context } = await launchBrowser(resolvedHeadless)

  try {
    await context.addCookies(createAuthCookies(resolvedCredentials))
    const page = await context.newPage()

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => undefined)

    await ensureAuthenticated(page)

    const mainTweetData = await collectMainTweetData(page)
    const snapshot: XScrapeMetrics = {
      displayName: mainTweetData.displayName,
      title: mainTweetData.title,
      followers: 0,
      commentsCount: mainTweetData.replyCount,
      bookmarks: mainTweetData.bookmarkCount,
      reposts: mainTweetData.repostCount,
      view: mainTweetData.viewCount,
      shares: 0,
      likes: mainTweetData.likeCount,
    }
    await onMetadata?.(snapshot)

    const hasReplyCount = typeof mainTweetData.replyCount === 'number' && mainTweetData.replyCount > 0
    const inferredCommentTarget = maxComments ?? (hasReplyCount ? mainTweetData.replyCount : DEFAULT_MAX_COMMENTS)

    const comments = await collectComments(page, inferredCommentTarget, { onComment, signal })

    return {
      ...snapshot,
      comments,
    }
  } finally {
    await context.close()
    await browser.close()
  }
}

export type { XScrapeResult }
