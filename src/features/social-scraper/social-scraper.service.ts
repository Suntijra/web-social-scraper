import fs from 'node:fs'
import path from 'node:path'

import dayjs from 'dayjs'

import InvalidParameterError from '#errors/invalid.parameter.error'
import { runOcrEngagement } from '#libs/facebook/engagementOcr'
import logging from '#libs/logger'
// import { cleanPageBody } from '#libs/facebook/bodyCleaner'
// import { detectEngagementStats } from '#libs/facebook/ollamaClient'
// import { openUrlInBrowser } from '#libs/facebook/playwrightRunner'
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
  private static readonly facebookCookiePath = path.resolve(process.cwd(), 'facebook', 'facebook_cookies.txt')
  private static readonly requiredFacebookCookies = ['c_user', 'xs']

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
    this.ensureFacebookCookiesAvailable()
    logging.logger.info({ profileUrl }, '[facebook] simulateFacebook: starting OCR OCR-only flow')
    const ocrMetrics = await this.tryFacebookOcr(profileUrl, logger)
    if (ocrMetrics) {
      logger?.info({ profileUrl, ocrMetrics }, 'ใช้ผลลัพธ์จาก OCR engagement')
      logging.logger.info({ profileUrl }, '[facebook] simulateFacebook: OCR success')
      return this.toResponse('facebook', ocrMetrics)
    }

    logger?.warn({ profileUrl }, 'ปิด fallback DOM ชั่วคราว ต้องมีผลจาก OCR เท่านั้น')
    throw new InvalidParameterError(
      'Facebook OCR ไม่สามารถอ่าน engagement ได้ในตอนนี้ กรุณาลองใหม่หลังสร้างสกรีนช็อตอีกครั้ง'
    )

    /*
    // เดิม: fallback DOM scraping
    logger?.info({ profileUrl }, 'OCR ไม่มีข้อมูล จะ fallback ไป DOM')
    const snapshot = await openUrlInBrowser(profileUrl)
    const cleanedBody = cleanPageBody(snapshot.bodyHtml)

    let commentsCount = 0
    let likes = 0
    let shares = 0
    const view = 0

    try {
      const engagement = await detectEngagementStats(cleanedBody)
      likes = engagement.likes ?? 0
      commentsCount = engagement.comments ?? 0
      shares = engagement.shares ?? 0
      logger?.info({ engagement, profileUrl }, 'ดึงข้อมูล engagement จากหน้าเพจสำเร็จ (fallback)')
    } catch (error) {
      logger?.error({ error, profileUrl }, 'fallback ไม่สามารถดึงข้อมูล engagement ได้ จะใช้ค่าเริ่มต้นแทน')
    }

    const metrics = {
      displayName: snapshot.title?.trim() ?? '',
      title: this.deriveTitleFromBody(cleanedBody, snapshot.title ?? ''),
      followers: 0,
      commentsCount,
      bookmarks: 0,
      reposts: 0,
      view,
      shares,
      likes,
      comments: [] as TSocialScraperComment[],
    }

    return this.toResponse('facebook', metrics)
    */
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

  private parseOcrMetrics(
    raw: string | null
  ): { likes: number | null; comments: number | null; shares: number | null; view: number | null } | null {
    if (!raw) {
      return null
    }
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return null
    }
    try {
      const parsed = JSON.parse(jsonMatch[0]) as Partial<{
        likes: number | null
        comments: number | null
        shares: number | null
        view: number | null
      }>
      return {
        likes: typeof parsed.likes === 'number' ? parsed.likes : null,
        comments: typeof parsed.comments === 'number' ? parsed.comments : null,
        shares: typeof parsed.shares === 'number' ? parsed.shares : null,
        view: typeof parsed.view === 'number' ? parsed.view : null,
      }
    } catch {
      return null
    }
  }

  private async tryFacebookOcr(
    profileUrl: string,
    logger?: SocialScraperSimulateOptions['logger']
  ): Promise<{
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
  } | null> {
    try {
      const activeLogger = logger ?? logging.logger
      activeLogger.info({ profileUrl }, '[facebook] tryFacebookOcr: invoking runOcrEngagement')
      const ocr = await runOcrEngagement(profileUrl)
      activeLogger.info(
        { profileUrl, screenshotPath: ocr.screenshotPath },
        '[facebook] tryFacebookOcr: screenshot captured'
      )
      const parsed = this.parseOcrMetrics(ocr.responseText)
      if (!parsed) {
        logger?.warn({ profileUrl }, 'OCR ไม่พบ JSON ที่ต้องการ')
        activeLogger.warn({ profileUrl }, '[facebook] tryFacebookOcr: failed to parse OCR JSON')
        return null
      }
      return {
        displayName: '',
        title: '',
        followers: 0,
        commentsCount: parsed.comments ?? 0,
        bookmarks: 0,
        reposts: 0,
        view: parsed.view ?? 0,
        shares: parsed.shares ?? 0,
        likes: parsed.likes ?? 0,
        comments: [],
      }
    } catch (error) {
      logger?.error({ error, profileUrl }, 'เกิดข้อผิดพลาดระหว่าง OCR engagement')
      logging.logger.error({ error, profileUrl }, '[facebook] tryFacebookOcr: error while running OCR')
      return null
    }
  }

  private ensureFacebookCookiesAvailable(): void {
    const cookiePath = SocialScraperService.facebookCookiePath
    logging.logger.info({ cookiePath }, '[facebook] ensureCookies: checking cookie file')
    if (!fs.existsSync(cookiePath)) {
      throw new InvalidParameterError(
        `ไม่พบไฟล์ Facebook cookies ที่ ${cookiePath}. กรุณารันสคริปต์ export คุกกี้ก่อนใช้งาน`
      )
    }
    try {
      const content = fs.readFileSync(cookiePath, 'utf8')
      const lines = content.split('\n').map((line) => line.trim())
      const now = Math.floor(Date.now() / 1000)
      for (const cookieName of SocialScraperService.requiredFacebookCookies) {
        const line = lines.find((entry) => entry && !entry.startsWith('#') && entry.includes(`\t${cookieName}\t`))
        if (!line) {
          throw new InvalidParameterError(
            `ไฟล์ Facebook cookies ไม่มีคุกกี้ ${cookieName}. กรุณาอัปเดตไฟล์ facebook_cookies.txt`
          )
        }
        const parts = line.split('\t')
        if (parts.length < 5) {
          throw new InvalidParameterError('โครงสร้างไฟล์ Facebook cookies ไม่ถูกต้อง กรุณาสร้างใหม่')
        }
        const expires = Number.parseInt(parts[4] ?? '', 10)
        if (!Number.isFinite(expires) || expires <= now) {
          logging.logger.warn({ cookieName }, '[facebook] ensureCookies: cookie expired')
          throw new InvalidParameterError('Facebook cookies หมดอายุแล้ว กรุณาสร้างไฟล์ใหม่')
        }
      }
    } catch (error) {
      if (error instanceof InvalidParameterError) {
        throw error
      }
      logging.logger.error({ error }, '[facebook] ensureCookies: failed to read cookies file')
      throw new InvalidParameterError('ไม่สามารถอ่านไฟล์ Facebook cookies ได้ กรุณาตรวจสอบสิทธิ์ไฟล์')
    }
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
      comments_count: comments.length,
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
