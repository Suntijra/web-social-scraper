import dayjs from 'dayjs'

import type { THealthResponse } from '#types/health'
import type { Context } from 'hono'

export class HealthController {
  async getHealth(c: Context) {
    const ptime = process.hrtime()
    const message = 'Ok'
    const diff = process.hrtime(ptime)
    const processTime = (diff[0] * 1e9 + diff[1]) / 1e6

    return c.json<THealthResponse>({
      ptime: processTime,
      message: message,
      date: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    })
  }
}
