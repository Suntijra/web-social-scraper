import pino from 'pino'
import { pinoHttp } from 'pino-http'

import type { Options as PinoOptions } from 'pino-http'
const options: PinoOptions = {
  logger: pino({
    level: 'debug',
    redact: {
      paths: ['req.headers.authorization', 'req.body.password', 'req.headers.cookie', 'req.body.refresh_token'],
      censor: '***',
    },
  }),
  useLevel: 'debug',
  serializers: {
    req(req) {
      req.url = req.url.replace(/access_token=[^&]+/, 'access_token=***')
      req.body = req.raw.body
      return req
    },
  },
}

export default pinoHttp(options)
