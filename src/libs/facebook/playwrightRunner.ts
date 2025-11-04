import fs from 'node:fs'

import { chromium, errors, firefox, webkit, type Browser, type BrowserContext, type Page } from 'playwright'

import { appConfig } from './config'
type BrowserFactory = () => Promise<Browser>

type SupportedBrowser = 'chromium' | 'firefox' | 'webkit'

const browserFactories: Record<SupportedBrowser, BrowserFactory> = {
  chromium: () => chromium.launch({ headless: appConfig.headless }),
  firefox: () => firefox.launch({ headless: appConfig.headless }),
  webkit: () => webkit.launch({ headless: appConfig.headless }),
}

const withPersistentContext = async <T>(fn: (page: Page, context: BrowserContext) => Promise<T>): Promise<T> => {
  if (appConfig.browser !== 'chromium') {
    throw new Error('PLAYWRIGHT_USER_DATA_DIR is only supported for the chromium browser.')
  }
  if (!appConfig.userDataDir) {
    throw new Error('PLAYWRIGHT_USER_DATA_DIR must be provided to use a persistent browser profile.')
  }
  const context = await chromium.launchPersistentContext(appConfig.userDataDir, {
    headless: appConfig.headless,
  })
  context.setDefaultNavigationTimeout(appConfig.navigationTimeoutMs)
  const page = await context.newPage()
  try {
    return await fn(page, context)
  } finally {
    if (!appConfig.keepBrowserOpen) {
      await page.close()
      await context.close()
    }
  }
}

const withBrowser = async <T>(fn: (page: Page, context: BrowserContext) => Promise<T>): Promise<T> => {
  if (appConfig.userDataDir) {
    return withPersistentContext(fn)
  }

  const launch = browserFactories[appConfig.browser] ?? browserFactories.chromium
  const browser = await launch()
  try {
    const context =
      appConfig.storageStatePath && fs.existsSync(appConfig.storageStatePath)
        ? await browser.newContext({ storageState: appConfig.storageStatePath })
        : await browser.newContext()
    context.setDefaultNavigationTimeout(appConfig.navigationTimeoutMs)
    const page = await context.newPage()
    try {
      return await fn(page, context)
    } finally {
      if (!appConfig.keepBrowserOpen) {
        await page.close()
        await context.close()
      }
    }
  } finally {
    if (!appConfig.keepBrowserOpen) {
      await browser.close()
    }
  }
}

export interface PageSnapshot {
  title: string
  url: string
  bodyHtml: string
}

export const openUrlInBrowser = async (url: string): Promise<PageSnapshot> => {
  return withBrowser(async (page) => {
    await page.goto(url, { waitUntil: 'domcontentloaded' }).catch((error) => {
      if (!(error instanceof errors.TimeoutError)) {
        throw error
      }
    })
    const [title, bodyHtml] = await Promise.all([page.title(), page.content()])
    return { title, url: page.url(), bodyHtml }
  })
}
