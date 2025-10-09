import { z } from '@hono/zod-openapi'

export const httpErrorDetailsResponseSchema = z.object({
  property: z.string(),
  message: z.string(),
})

export const httpErrorResponseSchema = z.object({
  error: z.object({
    message: z.string(),
    details: z.array(httpErrorDetailsResponseSchema).optional(),
  }),
})

export const emptyResponseSchema = z.object({})

export const paginationMetadataSchema = z.object({
  total: z.number().openapi({ example: 0 }),
  count: z.number().openapi({ example: 0 }),
  page: z.number().openapi({ example: 1 }),
  limit: z.number().openapi({ example: 25 }),
})
