import { chromium, firefox, webkit, type Browser, type BrowserContext, type Page } from 'playwright'

import { appConfig } from './config'
type BrowserFactory = () => Promise<Browser>

type SupportedBrowser = 'chromium' | 'firefox' | 'webkit'

const browserFactories: Record<SupportedBrowser, BrowserFactory> = {
  chromium: () => chromium.launch({ headless: appConfig.headless }),
  firefox: () => firefox.launch({ headless: appConfig.headless }),
  webkit: () => webkit.launch({ headless: appConfig.headless }),
}

const withBrowser = async <T>(fn: (page: Page, context: BrowserContext) => Promise<T>): Promise<T> => {
  const launch = browserFactories[appConfig.browser] ?? browserFactories.chromium
  const browser = await launch()
  const context = await browser.newContext()
  const page = await context.newPage()
  try {
    return await fn(page, context)
  } finally {
    await context.close()
    await browser.close()
  }
}

export interface PageSnapshot {
  title: string
  url: string
  bodyHtml: string
}

export const openUrlInBrowser = async (url: string): Promise<PageSnapshot> => {
  return withBrowser(async (page) => {
    await page.goto(url, { waitUntil: 'networkidle' })
    const [title, bodyHtml] = await Promise.all([page.title(), page.content()])
    return { title, url: page.url(), bodyHtml }
  })
}
