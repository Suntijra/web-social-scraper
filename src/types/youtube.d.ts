import type { TSocialScraperComment } from '#types/social-scraper'
import type { PinoLogger } from 'hono-pino'

export interface YouTubeScrapeOptions {
  url: string
  maxComments?: number
  headless?: boolean
  logger?: PinoLogger
  onMetadata?: (snapshot: YouTubeScrapeMetrics) => Promise<void> | void
  onComment?: (comment: TSocialScraperComment) => Promise<void> | void
  signal?: AbortSignal
}

export interface YouTubeScrapeMetrics {
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

export interface YouTubeMetadata {
  title: string
  channelName: string
  likeCount: number
  viewCount: number
  commentCount: number
}

export interface YouTubeScrapeResult extends YouTubeScrapeMetrics {
  comments: TSocialScraperComment[]
}
