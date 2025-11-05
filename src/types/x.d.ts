import type { TSocialScraperComment } from '#types/social-scraper'

export interface XCredentials {
  authToken: string
  ct0: string
}

export interface XScrapeOptions {
  url: string
  maxComments?: number
  headless?: boolean
  credentials?: Partial<XCredentials>
  onMetadata?: (snapshot: XScrapeMetrics) => Promise<void> | void
  onComment?: (comment: TSocialScraperComment) => Promise<void> | void
  signal?: AbortSignal
}

export interface XMainTweetData {
  displayName: string
  title: string
  repostCount: number
  likeCount: number
  bookmarkCount: number
  viewCount: number
  replyCount: number
}

export interface XScrapeMetrics {
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

export interface XScrapeResult extends XScrapeMetrics {
  comments: TSocialScraperComment[]
}
