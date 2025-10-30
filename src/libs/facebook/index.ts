import logging from '#libs/logger'

import { cleanPageBody } from './bodyCleaner'
import { ensureTargetUrl } from './config'
import { detectEngagementStats } from './ollamaClient'
import { openUrlInBrowser } from './playwrightRunner'

const logger = logging.logger

const run = async (): Promise<void> => {
  const cliUrl = process.argv[2]
  const targetUrl = cliUrl ?? ensureTargetUrl()

  logger.info(`Opening browser to: ${targetUrl}`)
  const { title, url, bodyHtml } = await openUrlInBrowser(targetUrl)
  logger.info(`Loaded page: ${title || '(no title)'}`)
  logger.info(`Final URL: ${url}`)

  const body = cleanPageBody(bodyHtml)
  logger.debug({ bodyPreview: body.slice(0, 300) }, 'Cleaned body content (preview)')

  try {
    const engagement = await detectEngagementStats(body)
    logger.info({ engagement }, 'Engagement detection result')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    logger.error({ error }, `Failed to detect engagement stats: ${message}`)
  }
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unknown error'
  logger.error({ error }, `Fatal error: ${message}`)
  process.exitCode = 1
})
