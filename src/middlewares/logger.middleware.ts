import { createMiddleware } from 'hono/factory'

import logging from '#libs/logger'

import type { Context, Next } from 'hono'

const getReqData = async (c: Context): Promise<Record<string, unknown> | undefined> => {
  try {
    const contentType = c.req.header('Content-Type')
    return contentType === 'application/json' ? await c.req.json() : undefined
  } catch (_err) {
    return undefined
  }
}

export const pinoLogger = createMiddleware(async (c: Context, next: Next) => {
  c.env.incoming.id = c.var.requestId
  const body = await getReqData(c)
  await new Promise<void>((resolve) =>
    logging(Object.assign(c.env.incoming, { raw: { body } }), c.env.outgoing, () => resolve())
  )
  c.set('logger', c.env.incoming.log)
  await next()
})
