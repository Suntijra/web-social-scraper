import { EHttpStatusCode } from '#types/response.d'

import { HttpError } from './http.error'

export default class UnauthorizedError extends HttpError {
  constructor(message?: string, statusCode?: number) {
    super(message ?? 'Request had invalid authentication credentials.', statusCode ?? EHttpStatusCode.UNAUTHORIZED)
    Object.setPrototypeOf(this, new.target.prototype)
  }
}
