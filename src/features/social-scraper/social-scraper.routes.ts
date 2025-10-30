import { Hono } from 'hono'

import { SocialScraperController } from './social-scraper.controller'
import { postSocialScraperSimulateDoc } from './social-scraper.openapi'

const route = new Hono()
const socialScraperController = new SocialScraperController()

route.post('/', postSocialScraperSimulateDoc, socialScraperController.simulateScrape)

export default route
