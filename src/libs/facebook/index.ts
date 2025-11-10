import logging from '#libs/logger'

import { cleanPageBody } from './bodyCleaner'
import { ensureTargetUrl } from './config'
import { runOcrEngagement } from './engagementOcr'
import { exportFacebookCookies } from './exportCookies'
import { detectEngagementStats } from './ollamaClient'
import { openUrlInBrowser } from './playwrightRunner'

const logger = logging.logger

const normalizeJson = <T>(raw: string | null, fallback: T): T => {
  if (!raw) {
    return fallback
  }
  const firstJson = raw.match(/\{[\s\S]*\}/)
  if (!firstJson) {
    return fallback
  }
  try {
    return JSON.parse(firstJson[0]) as T
  } catch (error) {
    logger.warn({ error, raw }, 'Failed to parse OCR JSON response')
    return fallback
  }
}

const run = async (): Promise<void> => {
  const cliUrl = process.argv[2]
  const targetUrl = cliUrl ?? ensureTargetUrl()

  logger.info('Refreshing Facebook cookies (if needed)...')
  try {
    await exportFacebookCookies({ targetUrl })
  } catch (error) {
    logger.warn({ error }, 'Failed to refresh cookies automatically; continuing with existing session.')
  }

  logger.info(`Running OCR engagement capture for ${targetUrl}`)
  const ocrResult = await runOcrEngagement(targetUrl)
  logger.info({ screenshotPath: ocrResult.screenshotPath }, 'OCR screenshot captured')

  const ocrMetrics = normalizeJson<{
    likes: number | null
    comments: number | null
    shares: number | null
    view: number | null
    evidence?: string
  }>(ocrResult.responseText, { likes: null, comments: null, shares: null, view: null })

  if ([ocrMetrics.likes, ocrMetrics.comments, ocrMetrics.shares, ocrMetrics.view].some((value) => value !== null)) {
    logger.info({ ocrMetrics }, 'OCR engagement metrics extracted')
    return
  }

  logger.info('OCR did not yield engagement metrics; falling back to DOM text extraction.')

  logger.info(`Opening browser to: ${targetUrl}`)
  const { title, url, bodyHtml } = await openUrlInBrowser(targetUrl)
  logger.info(`Loaded page: ${title || '(no title)'}`)
  logger.info(`Final URL: ${url}`)

  const body = cleanPageBody(bodyHtml)
  logger.debug({ bodyPreview: body.slice(0, 300) }, 'Cleaned body content (preview)')

  try {
    const engagement = await detectEngagementStats(body)
    logger.info({ engagement }, 'Fallback engagement detection result')
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
