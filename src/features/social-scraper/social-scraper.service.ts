import dayjs from 'dayjs'

import InvalidParameterError from '#errors/invalid.parameter.error'
import { cleanPageBody } from '#libs/facebook/bodyCleaner'
import { detectEngagementStats } from '#libs/facebook/ollamaClient'
import { openUrlInBrowser } from '#libs/facebook/playwrightRunner'

import type { TSocialScraperRequest, TSocialScraperResponse } from '#types/social-scraper'
import type { PinoLogger } from 'hono-pino'

interface SimulateOptions {
  logger?: PinoLogger
}

export class SocialScraperService {
  async simulate(payload: TSocialScraperRequest, options?: SimulateOptions): Promise<TSocialScraperResponse> {
    switch (payload.platform) {
      case 'facebook':
        return this.simulateFacebook(payload, options)
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

    try {
      const engagement = await detectEngagementStats(cleanedBody)
      followers = engagement.likes ?? 0
      logger?.info({ engagement, profileUrl }, 'ดึงข้อมูล engagement จากหน้าเพจสำเร็จ')
    } catch (error) {
      logger?.error({ error, profileUrl }, 'ไม่สามารถดึงข้อมูล engagement ได้ จะใช้ค่าเริ่มต้นแทน')
    }

    const samplePosts = this.buildSamplePosts(cleanedBody)

    return {
      platform: 'facebook',
      profileId: this.extractProfileId(snapshot.url) ?? 'unknown-profile',
      displayName: snapshot.title?.trim() || 'Facebook Profile',
      followers,
      scrapedAt: dayjs().toISOString(),
      samplePosts,
    }
  }

  private extractProfileId(targetUrl: string): string | null {
    try {
      const { pathname } = new URL(targetUrl)
      const segments = pathname.split('/').filter(Boolean)
      return segments.pop() ?? null
    } catch {
      return null
    }
  }

  private buildSamplePosts(cleanedBody: string): TSocialScraperResponse['samplePosts'] {
    const sentences = cleanedBody
      .split(/[.!?]\s+/u)
      .map((sentence) => sentence.trim())
      .filter(Boolean)
      .slice(0, 2)

    if (sentences.length === 0) {
      return [
        {
          id: 'sample-post-1',
          headline: 'ไม่พบเนื้อหาโพสต์ที่สามารถแสดงได้จากเพจนี้',
          publishedAt: dayjs().subtract(1, 'day').toISOString(),
        },
      ]
    }

    return sentences.map((sentence, index) => {
      const headline = sentence.length > 120 ? `${sentence.slice(0, 117)}...` : sentence
      const publishedAt = dayjs()
        .subtract(index === 0 ? 1 : 7, 'day')
        .toISOString()

      return {
        id: `sample-post-${index + 1}`,
        headline,
        publishedAt,
      }
    })
  }
}

export const socialScraperService = new SocialScraperService()
