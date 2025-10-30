import dayjs from 'dayjs'

import type { Bindings, Variables, QueryInputSchema } from '#types/app'
import type { TSocialScraperRequest, TSocialScraperResponse } from '#types/social-scraper'
import type { Context } from 'hono'

export class SocialScraperController {
  simulateScrape = async <
    E extends { Bindings: Bindings; Variables: Variables },
    P extends string,
    I extends QueryInputSchema<TSocialScraperRequest>,
  >(
    c: Context<E, P, I>
  ) => {
    const payload = c.req.valid('json')
    const response: TSocialScraperResponse = {
      platform: payload.platform,
      profileId: 'demo-profile-001',
      displayName: 'Demo Social Profile',
      followers: 15420,
      scrapedAt: dayjs().toISOString(),
      samplePosts: [
        {
          id: 'sample-post-01',
          headline: 'ประกาศกิจกรรมพิเศษประจำสัปดาห์',
          publishedAt: dayjs().subtract(2, 'day').toISOString(),
        },
        {
          id: 'sample-post-02',
          headline: 'สรุปผลรีวิวจากลูกค้าเดือนล่าสุด',
          publishedAt: dayjs().subtract(7, 'day').toISOString(),
        },
      ],
    }

    return c.json<TSocialScraperResponse>(response)
  }
}
