import { envSchema } from '#schemas/env.schema'

import type { JWTPayload } from 'hono/utils/jwt/types'
import type { PinoLogger } from 'hono-pino'

declare module 'hono' {
  interface ContextVariableMap {
    logger: PinoLogger
    jwtPayload: JWTPayload & { sub: string; uid?: string }
  }
}

declare global {
  namespace NodeJS {
    type ProcessEnv = z.infer<typeof envSchema>
  }
}
