import type { TSocialScraperComment } from '#types/social-scraper'

export interface TikTokScrapeOptions {
  url: string
  headless?: boolean
  browserChannel?: string
  signal?: AbortSignal
  onMetadata?: (snapshot: TikTokScrapeMetrics) => Promise<void> | void
  onComment?: (comment: TSocialScraperComment) => Promise<void> | void
}

export interface TikTokScrapeMetrics {
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

export interface TikTokScrapeResult extends TikTokScrapeMetrics {
  comments: TSocialScraperComment[]
}
