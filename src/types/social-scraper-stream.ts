import type { TSocialScraperComment, TSocialScraperRequest } from '#types/social-scraper'
import type { PinoLogger } from 'hono-pino'

export interface SocialScraperSimulateOptions {
  logger?: PinoLogger
}

export interface SocialScraperStreamEmitter {
  emit: (event: string, data: unknown) => Promise<void>
  signal: AbortSignal
}

export interface SocialScraperMetricsSnapshot {
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

export interface SocialScraperMetricsEventPayload {
  platform: TSocialScraperRequest['platform']
  displayName: string
  title: string
  followers: number
  comments_count: number
  bookmarks: number
  reposts: number
  view: number
  shares: number
  likes: number
  scrapedAt?: string
}

export interface SocialScraperCommentEvent {
  platform: TSocialScraperRequest['platform']
  index: number
  comment: TSocialScraperComment
}
