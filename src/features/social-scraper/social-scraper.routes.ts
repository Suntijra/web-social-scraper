import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { cors } from 'hono/cors'

import { socialScraperRequestSchema } from '#schemas/social-scraper.schema'

import { SocialScraperController } from './social-scraper.controller'
import { getSocialScraperStreamDoc, postSocialScraperSimulateDoc } from './social-scraper.openapi'

const route = new Hono()
const socialScraperController = new SocialScraperController()
const socialScraperQuerySchema = socialScraperRequestSchema.pick({
  platform: true,
  profileUrl: true,
})

route.use(
  '*',
  cors({
    origin: '*',
    allowHeaders: ['Content-Type', 'Accept'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
  })
)

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

route.get(
  '/stream',
  zValidator('query', socialScraperQuerySchema, (result, c) => {
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
  getSocialScraperStreamDoc,
  socialScraperController.streamScrape
)

export default route
