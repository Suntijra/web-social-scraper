import { EHttpStatusCode } from '#types/response.d'

import { HttpError } from './http.error'

export default class AlreadyExistsError extends HttpError {
  constructor(message?: string, statusCode?: number) {
    super(message ?? 'Object already exists.', statusCode ?? EHttpStatusCode.CONFLICT)
    Object.setPrototypeOf(this, new.target.prototype)
  }
}
