import { z } from '@hono/zod-openapi'

export const healthResponseSchema = z.object({
  ptime: z.number().openapi({
    example: 12.1001,
  }),
  message: z.string().openapi({
    example: 'Ok',
  }),
  date: z.string().openapi({
    example: '2025-02-22T19:50:43.174Z',
  }),
})
