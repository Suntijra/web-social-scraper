import dayjs from 'dayjs'

import InvalidParameterError from '#errors/invalid.parameter.error'
import { cleanPageBody } from '#libs/facebook/bodyCleaner'
import { detectEngagementStats } from '#libs/facebook/ollamaClient'
import { openUrlInBrowser } from '#libs/facebook/playwrightRunner'
import { scrapeTiktokVideo } from '#libs/tiktok/scraper'
import { scrapeXPost } from '#libs/x/scraper'
import { scrapeYouTubeVideo } from '#libs/youtube/scraper'

import type { TSocialScraperComment, TSocialScraperRequest, TSocialScraperResponse } from '#types/social-scraper'
import type {
  SocialScraperMetricsEventPayload,
  SocialScraperMetricsSnapshot,
  SocialScraperSimulateOptions,
  SocialScraperStreamEmitter,
} from '#types/social-scraper-stream'

export class SocialScraperService {
  async simulate(
    payload: TSocialScraperRequest,
    options?: SocialScraperSimulateOptions
  ): Promise<TSocialScraperResponse> {
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

  async simulateStream(
    payload: TSocialScraperRequest,
    emitter: SocialScraperStreamEmitter,
    options?: SocialScraperSimulateOptions
  ): Promise<TSocialScraperResponse | undefined> {
    try {
      switch (payload.platform) {
        case 'facebook':
          return await this.streamFacebook(payload, emitter, options)
        case 'x':
          return await this.streamX(payload, emitter, options)
        case 'youtube':
          return await this.streamYouTube(payload, emitter, options)
        case 'tiktok':
          return await this.streamTiktok(payload, emitter, options)
        default:
          throw new InvalidParameterError(`แพลตฟอร์ม ${payload.platform} ยังไม่รองรับในตัวอย่างนี้`)
      }
    } catch (error) {
      if (!emitter.signal.aborted) {
        const message = error instanceof Error ? error.message : 'Unexpected error'
        await this.safeEmit(emitter, 'error', {
          message,
          platform: payload.platform,
        })
      }
      throw error
    }
  }

  private async simulateFacebook(
    { profileUrl }: TSocialScraperRequest,
    options?: SocialScraperSimulateOptions
  ): Promise<TSocialScraperResponse> {
    const { logger } = options ?? {}
    const snapshot = await openUrlInBrowser(profileUrl)
    const cleanedBody = cleanPageBody(snapshot.bodyHtml)
    let followers = 0
    let commentsCount = 0
    let reposts = 0
    let likes = 0
    let shares = 0

    try {
      const engagement = await detectEngagementStats(cleanedBody)
      followers = engagement.likes ?? 0
      likes = engagement.likes ?? 0
      commentsCount = engagement.comments ?? 0
      reposts = engagement.shares ?? 0
      shares = engagement.shares ?? 0
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
      shares,
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
      shares: result.shares,
      likes: result.likes,
      comments: result.comments,
    })
  }

  private async simulateYouTube(
    { profileUrl }: TSocialScraperRequest,
    options?: SocialScraperSimulateOptions
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
      shares: result.shares,
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
      shares: result.shares,
      likes: result.likes,
      comments: result.comments,
    })
  }

  private async streamFacebook(
    payload: TSocialScraperRequest,
    emitter: SocialScraperStreamEmitter,
    options?: SocialScraperSimulateOptions
  ): Promise<TSocialScraperResponse> {
    const response = await this.simulateFacebook(payload, options)
    await this.emitMetricsFromResponse(emitter, response)
    if (response.comments.length > 0) {
      await this.emitComments(emitter, response.platform, response.comments)
    }
    await this.emitComplete(emitter, response)
    return response
  }

  private async streamX(
    payload: TSocialScraperRequest,
    emitter: SocialScraperStreamEmitter,
    _options?: SocialScraperSimulateOptions
  ): Promise<TSocialScraperResponse> {
    let metricsSent = false
    let streamedCount = 0
    const result = await scrapeXPost({
      url: payload.profileUrl,
      onMetadata: async (snapshot) => {
        metricsSent = true
        await this.emitMetricsFromSnapshot(emitter, 'x', snapshot)
      },
      onComment: async (comment) => {
        streamedCount += 1
        await this.emitComment(emitter, 'x', streamedCount - 1, comment)
      },
      signal: emitter.signal,
    })

    const response = this.toResponse('x', {
      displayName: result.displayName,
      title: result.title,
      followers: result.followers,
      commentsCount: result.commentsCount,
      bookmarks: result.bookmarks,
      reposts: result.reposts,
      view: result.view,
      shares: result.shares,
      likes: result.likes,
      comments: result.comments,
    })

    if (!metricsSent) {
      await this.emitMetricsFromSnapshot(
        emitter,
        'x',
        {
          displayName: result.displayName,
          title: result.title,
          followers: result.followers,
          commentsCount: result.commentsCount,
          bookmarks: result.bookmarks,
          reposts: result.reposts,
          view: result.view,
          shares: result.shares,
          likes: result.likes,
        },
        response.scrapedAt
      )
    }

    if (streamedCount < response.comments.length) {
      await this.emitComments(emitter, response.platform, response.comments, streamedCount)
    }

    await this.emitComplete(emitter, response)
    return response
  }

  private async streamYouTube(
    payload: TSocialScraperRequest,
    emitter: SocialScraperStreamEmitter,
    options?: SocialScraperSimulateOptions
  ): Promise<TSocialScraperResponse> {
    let metricsSnapshot: SocialScraperMetricsSnapshot | null = null
    let streamedCount = 0
    const result = await scrapeYouTubeVideo({
      url: payload.profileUrl,
      logger: options?.logger,
      signal: emitter.signal,
      onMetadata: async (snapshot) => {
        metricsSnapshot = snapshot
        await this.emitMetricsFromSnapshot(emitter, 'youtube', snapshot)
      },
      onComment: async (comment) => {
        streamedCount += 1
        await this.emitComment(emitter, 'youtube', streamedCount - 1, comment)
      },
    })
    const response = this.toResponse('youtube', {
      displayName: result.displayName,
      title: result.title,
      followers: result.followers,
      commentsCount: result.commentsCount,
      bookmarks: result.bookmarks,
      reposts: result.reposts,
      view: result.view,
      shares: result.shares,
      likes: result.likes,
      comments: result.comments,
    })

    if (!metricsSnapshot) {
      metricsSnapshot = {
        displayName: result.displayName,
        title: result.title,
        followers: result.followers,
        commentsCount: result.commentsCount,
        bookmarks: result.bookmarks,
        reposts: result.reposts,
        view: result.view,
        shares: result.shares,
        likes: result.likes,
      }
      await this.emitMetricsFromSnapshot(emitter, 'youtube', metricsSnapshot, response.scrapedAt)
    }

    if (streamedCount < response.comments.length) {
      await this.emitComments(emitter, response.platform, response.comments, streamedCount)
    }

    await this.emitComplete(emitter, response)
    return response
  }

  private async streamTiktok(
    payload: TSocialScraperRequest,
    emitter: SocialScraperStreamEmitter,
    _options?: SocialScraperSimulateOptions
  ): Promise<TSocialScraperResponse> {
    let metricsSent = false
    let streamedCount = 0

    const result = await scrapeTiktokVideo({
      url: payload.profileUrl,
      signal: emitter.signal,
      onMetadata: async (snapshot) => {
        metricsSent = true
        await this.emitMetricsFromSnapshot(emitter, 'tiktok', snapshot)
      },
      onComment: async (comment) => {
        streamedCount += 1
        await this.emitComment(emitter, 'tiktok', streamedCount - 1, comment)
      },
    })

    const response = this.toResponse('tiktok', {
      displayName: result.displayName,
      title: result.title,
      followers: result.followers,
      commentsCount: result.commentsCount,
      bookmarks: result.bookmarks,
      reposts: result.reposts,
      view: result.view,
      shares: result.shares,
      likes: result.likes,
      comments: result.comments,
    })

    if (!metricsSent) {
      await this.emitMetricsFromSnapshot(
        emitter,
        'tiktok',
        {
          displayName: result.displayName,
          title: result.title,
          followers: result.followers,
          commentsCount: result.commentsCount,
          bookmarks: result.bookmarks,
          reposts: result.reposts,
          view: result.view,
          shares: result.shares,
          likes: result.likes,
        },
        response.scrapedAt
      )
    }

    if (streamedCount < response.comments.length) {
      await this.emitComments(emitter, response.platform, response.comments, streamedCount)
    }

    await this.emitComplete(emitter, response)
    return response
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
      shares: number
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
      shares: metrics.shares,
      likes: metrics.likes,
      comments: metrics.comments,
      scrapedAt: dayjs().toISOString(),
    }
  }

  private async emitMetricsFromResponse(
    emitter: SocialScraperStreamEmitter,
    response: TSocialScraperResponse
  ): Promise<void> {
    const payload: SocialScraperMetricsEventPayload = {
      platform: response.platform,
      displayName: response.displayName,
      title: response.title,
      followers: response.followers,
      comments_count: response.comments_count,
      bookmarks: response.bookmarks,
      reposts: response.reposts,
      view: response.view,
      shares: response.shares,
      likes: response.likes,
      scrapedAt: response.scrapedAt,
    }
    await this.safeEmit(emitter, 'metrics', payload)
  }

  private async emitMetricsFromSnapshot(
    emitter: SocialScraperStreamEmitter,
    platform: TSocialScraperRequest['platform'],
    snapshot: SocialScraperMetricsSnapshot,
    scrapedAt?: string
  ): Promise<void> {
    const payload: SocialScraperMetricsEventPayload = {
      platform,
      displayName: snapshot.displayName,
      title: snapshot.title,
      followers: snapshot.followers,
      comments_count: snapshot.commentsCount,
      bookmarks: snapshot.bookmarks,
      reposts: snapshot.reposts,
      view: snapshot.view,
      shares: snapshot.shares,
      likes: snapshot.likes,
      scrapedAt,
    }
    await this.safeEmit(emitter, 'metrics', payload)
  }

  private async emitComments(
    emitter: SocialScraperStreamEmitter,
    platform: TSocialScraperRequest['platform'],
    comments: TSocialScraperComment[],
    startIndex = 0
  ): Promise<void> {
    for (let index = startIndex; index < comments.length; index += 1) {
      if (emitter.signal.aborted) {
        break
      }
      const comment = comments[index]
      if (!comment) {
        continue
      }
      await this.emitComment(emitter, platform, index, comment)
    }
  }

  private async emitComment(
    emitter: SocialScraperStreamEmitter,
    platform: TSocialScraperRequest['platform'],
    index: number,
    comment: TSocialScraperComment
  ): Promise<void> {
    await this.safeEmit(emitter, 'comment', {
      platform,
      index,
      comment,
    })
  }

  private async emitComplete(emitter: SocialScraperStreamEmitter, response: TSocialScraperResponse): Promise<void> {
    const comments = response.comments ?? []
    const { comments: _comments, ...rest } = response
    await this.safeEmit(emitter, 'complete', {
      ...rest,
      comments_count: rest.comments_count,
      total_comments_streamed: comments.length,
    })
  }

  private async safeEmit(emitter: SocialScraperStreamEmitter, event: string, data: unknown): Promise<void> {
    if (emitter.signal.aborted) {
      return
    }
    await emitter.emit(event, data)
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
