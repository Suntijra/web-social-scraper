import { EHttpStatusCode } from '#types/response.d'

import { HttpError } from './http.error'

import type { THttpErrorDetailsResponse } from '#types/response.d'

export default class InvalidParameterError extends HttpError {
  constructor(message?: string, statusCode?: number, details?: THttpErrorDetailsResponse[]) {
    super(message ?? 'Invalid parameter.', statusCode ?? EHttpStatusCode.BAD_REQUEST, details)
    Object.setPrototypeOf(this, new.target.prototype)
  }
}
