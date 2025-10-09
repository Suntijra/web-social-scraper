import { createFactory } from 'hono/factory'

import { envSchema } from '#schemas/env.schema'

import type { Bindings, Variables } from '#types/app'
import '#types/global.d'
import type { AppEnvVariables } from '#types/env'

export const envVariables = envSchema.parse(process.env)

export const factory = createFactory<{ Bindings: Bindings; Variables: Variables }>({
  initApp: (app) => {
    app.use(async (c, next) => {
      for (const [key, value] of Object.entries(envVariables)) {
        c.set(key as keyof AppEnvVariables, value)
      }
      await next()
    })
  },
})
