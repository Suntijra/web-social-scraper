import type { socialScraperRequestSchema, socialScraperResponseSchema } from '#schemas/social-scraper.schema'
import type { z } from 'zod'

export type TSocialScraperRequest = z.infer<typeof socialScraperRequestSchema>
export type TSocialScraperResponse = z.infer<typeof socialScraperResponseSchema>
