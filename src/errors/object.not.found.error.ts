import { EHttpStatusCode } from '#types/response.d'

import { HttpError } from './http.error'

export default class ObjectNotFoundError extends HttpError {
  constructor(message?: string, statusCode?: number) {
    super(message ?? 'The requested URL path was not found on this object.', statusCode ?? EHttpStatusCode.NOT_FOUND)
    Object.setPrototypeOf(this, new.target.prototype)
  }
}
