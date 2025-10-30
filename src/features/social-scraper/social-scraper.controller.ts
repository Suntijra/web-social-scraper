import { socialScraperService } from './social-scraper.service'

import type { TSocialScraperRequest, TSocialScraperResponse } from '#types/social-scraper'
import type { Context } from 'hono'

export class SocialScraperController {
  async simulateScrape(c: Context) {
    const payload = c.req.valid('json') as TSocialScraperRequest

    try {
      const response = await socialScraperService.simulate(payload, { logger: c.var.logger })
      return c.json<TSocialScraperResponse>(response)
    } catch (error) {
      c.var.logger?.error({ error, payload }, 'ไม่สามารถจำลองการสแครปได้')
      throw error
    }
  }
}
