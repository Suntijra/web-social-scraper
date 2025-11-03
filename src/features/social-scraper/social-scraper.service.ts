import dayjs from 'dayjs'

import InvalidParameterError from '#errors/invalid.parameter.error'
import { cleanPageBody } from '#libs/facebook/bodyCleaner'
import { detectEngagementStats } from '#libs/facebook/ollamaClient'
import { openUrlInBrowser } from '#libs/facebook/playwrightRunner'
import { scrapeTiktokVideo } from '#libs/tiktok/scraper'
import { scrapeXPost } from '#libs/x/scraper'
import { scrapeYouTubeVideo } from '#libs/youtube/scraper'

import type { TSocialScraperComment, TSocialScraperRequest, TSocialScraperResponse } from '#types/social-scraper'
import type { PinoLogger } from 'hono-pino'

interface SimulateOptions {
  logger?: PinoLogger
}

export class SocialScraperService {
  async simulate(payload: TSocialScraperRequest, options?: SimulateOptions): Promise<TSocialScraperResponse> {
    switch (payload.platform) {
      case 'facebook':
        return this.simulateFacebook(payload, options)
      case 'x':
        return this.simulateX(payload)
      case 'youtube':
        return this.simulateYouTube(payload, options)
      case 'tiktok':
        return this.simulateTiktok(payload)
      default:
        throw new InvalidParameterError(`แพลตฟอร์ม ${payload.platform} ยังไม่รองรับในตัวอย่างนี้`)
    }
  }

  private async simulateFacebook(
    { profileUrl }: TSocialScraperRequest,
    options?: SimulateOptions
  ): Promise<TSocialScraperResponse> {
    const { logger } = options ?? {}
    const snapshot = await openUrlInBrowser(profileUrl)
    const cleanedBody = cleanPageBody(snapshot.bodyHtml)
    let followers = 0
    let commentsCount = 0
    let reposts = 0
    let likes = 0

    try {
      const engagement = await detectEngagementStats(cleanedBody)
      followers = engagement.likes ?? 0
      likes = engagement.likes ?? 0
      commentsCount = engagement.comments ?? 0
      reposts = engagement.shares ?? 0
      logger?.info({ engagement, profileUrl }, 'ดึงข้อมูล engagement จากหน้าเพจสำเร็จ')
    } catch (error) {
      logger?.error({ error, profileUrl }, 'ไม่สามารถดึงข้อมูล engagement ได้ จะใช้ค่าเริ่มต้นแทน')
    }

    const metrics = {
      displayName: snapshot.title?.trim() ?? '',
      title: this.deriveTitleFromBody(cleanedBody, snapshot.title ?? ''),
      followers,
      commentsCount,
      bookmarks: 0,
      reposts,
      view: 0,
      likes,
      comments: [] as TSocialScraperComment[],
    }

    return this.toResponse('facebook', metrics)
  }

  private async simulateX({ profileUrl }: TSocialScraperRequest): Promise<TSocialScraperResponse> {
    const result = await scrapeXPost({ url: profileUrl })
    return this.toResponse('x', {
      displayName: result.displayName,
      title: result.title,
      followers: result.followers,
      commentsCount: result.commentsCount,
      bookmarks: result.bookmarks,
      reposts: result.reposts,
      view: result.view,
      likes: result.likes,
      comments: result.comments,
    })
  }

  private async simulateYouTube(
    { profileUrl }: TSocialScraperRequest,
    options?: SimulateOptions
  ): Promise<TSocialScraperResponse> {
    const result = await scrapeYouTubeVideo({ url: profileUrl, logger: options?.logger })
    return this.toResponse('youtube', {
      displayName: result.displayName,
      title: result.title,
      followers: result.followers,
      commentsCount: result.commentsCount,
      bookmarks: result.bookmarks,
      reposts: result.reposts,
      view: result.view,
      likes: result.likes,
      comments: result.comments,
    })
  }

  private async simulateTiktok({ profileUrl }: TSocialScraperRequest): Promise<TSocialScraperResponse> {
    const result = await scrapeTiktokVideo({ url: profileUrl })
    return this.toResponse('tiktok', {
      displayName: result.displayName,
      title: result.title,
      followers: result.followers,
      commentsCount: result.commentsCount,
      bookmarks: result.bookmarks,
      reposts: result.reposts,
      view: result.view,
      likes: result.likes,
      comments: result.comments,
    })
  }

  private toResponse(
    platform: TSocialScraperRequest['platform'],
    metrics: {
      displayName: string
      title: string
      followers: number
      commentsCount: number
      bookmarks: number
      reposts: number
      view: number
      likes: number
      comments: TSocialScraperComment[]
    }
  ): TSocialScraperResponse {
    return {
      platform,
      displayName: metrics.displayName,
      title: metrics.title,
      followers: metrics.followers,
      comments_count: metrics.commentsCount,
      bookmarks: metrics.bookmarks,
      reposts: metrics.reposts,
      view: metrics.view,
      likes: metrics.likes,
      comments: metrics.comments,
      scrapedAt: dayjs().toISOString(),
    }
  }

  private deriveTitleFromBody(cleanedBody: string, fallback: string): string {
    const segments = cleanedBody
      .split(/\s{2,}|\n/u)
      .map((segment) => segment.trim())
      .filter(Boolean)

    const candidate = segments.length > 0 ? (segments[0] ?? fallback) : fallback
    return candidate.trim().slice(0, 140)
  }
}

export const socialScraperService = new SocialScraperService()
