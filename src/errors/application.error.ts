import { EHttpStatusCode } from '#types/response.d'

import { HttpError } from './http.error'

export default class ApplicationError extends HttpError {
  constructor(message?: string, statusCode?: number) {
    super(message ?? 'Something went wrong. Please try again.', statusCode ?? EHttpStatusCode.INTERNAL_ERROR)
    Object.setPrototypeOf(this, new.target.prototype)
  }
}
