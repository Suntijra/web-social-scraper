import { streamSSE } from 'hono/streaming'

import { socialScraperService } from './social-scraper.service'

import type { TSocialScraperRequest, TSocialScraperResponse } from '#types/social-scraper'
import type { Context } from 'hono'

export class SocialScraperController {
  async simulateScrape(c: Context) {
    const payload = c.req.valid('json' as never) as TSocialScraperRequest

    try {
      const response = await socialScraperService.simulate(payload, { logger: c.var.logger })
      return c.json<TSocialScraperResponse>(response)
    } catch (error) {
      c.var.logger?.error({ error, payload }, 'ไม่สามารถจำลองการสแครปได้')
      throw error
    }
  }

  async streamScrape(c: Context) {
    const payload = c.req.valid('query' as never) as TSocialScraperRequest

    const response = streamSSE(c, async (stream) => {
      const abortSignal = (c.req.raw as Request | undefined)?.signal ?? new AbortController().signal

      const emitter = {
        signal: abortSignal,
        emit: async (event: string, data: unknown) => {
          if (abortSignal.aborted) {
            return
          }
          await stream.writeSSE({
            event,
            data: JSON.stringify(data ?? null),
          })
        },
      }

      abortSignal.addEventListener(
        'abort',
        () => {
          try {
            stream.close()
          } catch {
            /* noop */
          }
        },
        { once: true }
      )

      try {
        await socialScraperService.simulateStream(payload, emitter, { logger: c.var.logger })
      } catch (error) {
        if (!abortSignal.aborted) {
          const message = error instanceof Error ? error.message : 'Unexpected error'
          c.var.logger?.error({ error, payload }, 'ไม่สามารถสตรีมผลการสแครปได้')
          await stream.writeSSE({
            event: 'error',
            data: JSON.stringify({ message, platform: payload.platform }),
          })
        }
      } finally {
        try {
          stream.close()
        } catch {
          /* noop */
        }
      }
    })

    response.headers.delete('Transfer-Encoding') // Let Node/Nginx manage Transfer-Encoding to avoid duplicate headers.
    return response
  }
}
