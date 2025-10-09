import { EHttpStatusCode } from '#types/response.d'

import { HttpError } from './http.error'

export default class InsufficientPermissionError extends HttpError {
  constructor(message?: string, statusCode?: number) {
    super(message ?? 'Insufficient permissions to access the resource.', statusCode ?? EHttpStatusCode.FORBIDDEN)
    Object.setPrototypeOf(this, new.target.prototype)
  }
}
