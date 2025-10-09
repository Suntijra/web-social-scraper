import { z } from 'zod'

export const envSchema = z.object({
  NODE_ENV: z.enum(['local', 'development', 'production']).default('local'),
  HOST: z.string().default('localhost'),
  PORT: z.coerce.number().default(8000),
})
