import { HTTPException } from 'hono/http-exception'

import ApplicationError from '#errors/application.error'
import { HttpError } from '#errors/http.error'
import ObjectNotFoundError from '#errors/object.not.found.error'
import { envVariables } from '#factory'

import type { Context, Env } from 'hono'

export const errorHandler = async (err: Error | HTTPException, c: Context) => {
  const { logger } = c.var
  if (envVariables.NODE_ENV === 'local') console.error(err)
  logger?.error(err)
  if (err instanceof HttpError) {
    return c.json(err.toJson(), err.statusCode)
  }
  if (err instanceof HTTPException && err.status === 504) {
    const error = new ApplicationError('Request timeout.', 504)
    return c.json(error.toJson(), error.statusCode)
  }
  if (err instanceof HTTPException && err.status === 403) {
    const error = new ApplicationError('CSRF token Mismatch Error', 403)
    return c.json(error.toJson(), error.statusCode)
  }

  const error = new ApplicationError()
  return c.json(error.toJson(), error.statusCode)
}

export const notFoundHandler = <E extends Env, P extends string>(c: Context<E, P>) => {
  const error = new ObjectNotFoundError()
  return c.json(error.toJson(), error.statusCode)
}
