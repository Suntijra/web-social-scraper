import { validator } from 'hono-openapi'

import InvalidParameterError from '#errors/invalid.parameter.error'
import { parseValidateErrorDetails } from '#util/format.util'

import type { Context } from 'hono'
import type { MiddlewareHandler, Next, ValidationTargets } from 'hono/types'
import type { z, ZodError } from 'zod'

export const zValidator = (target: keyof ValidationTargets, schame: z.ZodTypeAny): MiddlewareHandler => {
  return validator(target, schame, (result, c: Context) => {
    if (!result.success) {
      const details = parseValidateErrorDetails(result.error as ZodError['issues'])
      const message =
        c.req.method === 'GET'
          ? `The query string has ${details.length} error(s)`
          : `The request body has ${details.length} error(s)`
      const error = new InvalidParameterError(message, 400, details)
      return c.json(error.toJson(), error.statusCode)
    }
  })
}

export const uploadBinaryValidate = (support: string[] = []): MiddlewareHandler => {
  return async (c: Context, next: Next) => {
    const body = await c.req.blob()
    const mimeType = body.type
    if (!support.includes(mimeType)) {
      const error = new InvalidParameterError('The content-type is invalid.')
      return c.json(error.toJson(), error.statusCode)
    }
    await next()
  }
}
