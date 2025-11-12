import type {
  socialScraperCommentSchema,
  socialScraperRequestSchema,
  socialScraperResponseSchema,
} from '#schemas/social-scraper.schema'

export type TSocialScraperRequest = z.infer<typeof socialScraperRequestSchema>
export type TSocialScraperResponse = z.infer<typeof socialScraperResponseSchema>
export type TSocialScraperComment = z.infer<typeof socialScraperCommentSchema>
