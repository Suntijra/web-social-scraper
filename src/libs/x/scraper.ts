import { chromium } from 'playwright'

import type { TSocialScraperComment } from '#types/social-scraper'
import type { Browser, BrowserContext, Cookie, Page } from 'playwright'

interface XCredentials {
  authToken: string
  ct0: string
}

const DEFAULT_X_AUTH_TOKEN = 'be732f9bd8ba416c0e5f249154dca0a1cac952a6'
const DEFAULT_X_CT0_TOKEN =
  '76fe636f7c7edeeaa941ca1f80e4cb9658653513602e4eaf22be107ff7ac8c75e453e804c95d06b89a663a8b4bde07f2460b54ed91f2233a08c3bbb445d817deaaa53ef09ca5dbdf173e6c9120dbcdb3'

interface XScrapeOptions {
  url: string
  maxComments?: number
  headless?: boolean
  credentials?: Partial<XCredentials>
}

interface XMainTweetData {
  displayName: string
  title: string
  repostCount: number
  likeCount: number
  bookmarkCount: number
  viewCount: number
  replyCount: number
}

interface XScrapeResult {
  likes: number
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
  if (/k$/i.test(sanitized)) {
    return Math.floor(Number.parseFloat(sanitized.replace(/k$/i, '')) * 1_000)
  }
  if (/m$/i.test(sanitized)) {
    return Math.floor(Number.parseFloat(sanitized.replace(/m$/i, '')) * 1_000_000)
  }
  if (/b$/i.test(sanitized)) {
    return Math.floor(Number.parseFloat(sanitized.replace(/b$/i, '')) * 1_000_000_000)
  }
  const numeric = sanitized.match(/\d+/)
  return numeric ? Number.parseInt(numeric[0] ?? '0', 10) : 0
}

const resolveCredentials = (credentials?: Partial<XCredentials>): XCredentials => {
  const authToken = credentials?.authToken ?? process.env.X_AUTH_TOKEN ?? DEFAULT_X_AUTH_TOKEN
  const ct0 = credentials?.ct0 ?? process.env.X_CT0_TOKEN ?? DEFAULT_X_CT0_TOKEN

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
    const viewsContainer = page.locator('a[href*="/analytics"]').first()
    const viewCountText = (await viewsContainer.textContent()) ?? '0'
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

const collectComments = async (page: Page, limit: number): Promise<TSocialScraperComment[]> => {
  const comments = new Map<string, TSocialScraperComment>()
  let scrollAttempts = 0
  const maxScrollAttempts = 10
  let lastSize = 0

  while (comments.size < limit && scrollAttempts < maxScrollAttempts) {
    const commentArticles = await page.locator('article[data-testid="tweet"]').all()
    if (commentArticles.length > 1) {
      for (const commentElement of commentArticles.slice(1)) {
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
            comments.set(key, {
              authorName,
              text,
            })
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
}: XScrapeOptions): Promise<XScrapeResult> => {
  if (!url) {
    throw new Error('URL is required for X scrape')
  }

  const resolvedHeadless = headless ?? parseEnvBoolean(process.env.PLAYWRIGHT_HEADLESS, true)
  const resolvedCredentials = resolveCredentials(credentials)

  const { browser, context } = await launchBrowser(resolvedHeadless)

  try {
    await context.addCookies(createAuthCookies(resolvedCredentials))
    const page = await context.newPage()

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await page.waitForTimeout(5_000)

    await ensureAuthenticated(page)

    const mainTweetData = await collectMainTweetData(page)
    const comments = await collectComments(
      page,
      maxComments ?? Math.min(mainTweetData.replyCount || DEFAULT_MAX_COMMENTS, DEFAULT_MAX_COMMENTS)
    )

    return {
      displayName: mainTweetData.displayName,
      title: mainTweetData.title,
      followers: 0,
      commentsCount: mainTweetData.replyCount,
      bookmarks: mainTweetData.bookmarkCount,
      reposts: mainTweetData.repostCount,
      view: mainTweetData.viewCount,
      shares: 0,
      likes: mainTweetData.likeCount,
      comments,
    }
  } finally {
    await context.close()
    await browser.close()
  }
}

export type { XScrapeResult }
