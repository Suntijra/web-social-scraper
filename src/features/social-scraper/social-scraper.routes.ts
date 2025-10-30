import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'

import { socialScraperRequestSchema } from '#schemas/social-scraper.schema'

import { SocialScraperController } from './social-scraper.controller'
import { postSocialScraperSimulateDoc } from './social-scraper.openapi'

const route = new Hono()
const socialScraperController = new SocialScraperController()

route.post(
  '/',
  zValidator('json', socialScraperRequestSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          message: 'Invalid request payload.',
          issues: result.error.issues,
        },
        422
      )
    }
  }),
  postSocialScraperSimulateDoc,
  socialScraperController.simulateScrape
)

export default route
