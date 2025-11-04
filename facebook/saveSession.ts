/* eslint-disable no-console */

import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'

import { chromium, firefox, webkit, type Browser, type BrowserContext } from 'playwright'

import { appConfig, ensureTargetUrl } from '../src/libs/facebook/config'

type SupportedBrowser = 'chromium' | 'firefox' | 'webkit'
type BrowserLauncher = () => Promise<Browser>

const waitForEnter = async (message: string): Promise<void> => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  await new Promise<void>((resolve) => {
    rl.question(message, () => {
      rl.close()
      resolve()
    })
  })
}

const ensureParentDirectory = (filePath: string): void => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
}

const browserLaunchers: Record<SupportedBrowser, BrowserLauncher> = {
  chromium: () => chromium.launch({ headless: false }),
  firefox: () => firefox.launch({ headless: false }),
  webkit: () => webkit.launch({ headless: false }),
}

const launchWithConfiguredBrowser = async (): Promise<Browser> => {
  if (appConfig.headless) {
    console.warn('PLAYWRIGHT_HEADLESS=true detected. Overriding to false for interactive login.')
  }
  const launcher = browserLaunchers[appConfig.browser] ?? browserLaunchers.chromium
  return launcher()
}

const openPersistentContext = async (): Promise<BrowserContext> => {
  if (appConfig.browser !== 'chromium') {
    throw new Error('Persistent profiles require PLAYWRIGHT_BROWSER=chromium.')
  }
  if (!appConfig.userDataDir) {
    throw new Error('PLAYWRIGHT_USER_DATA_DIR must be defined when using a persistent profile.')
  }
  fs.mkdirSync(appConfig.userDataDir, { recursive: true })
  return chromium.launchPersistentContext(appConfig.userDataDir, { headless: false })
}

const runWithStorageState = async (targetUrl: string, storageStatePath: string): Promise<void> => {
  ensureParentDirectory(storageStatePath)
  const browser = await launchWithConfiguredBrowser()
  try {
    const context = fs.existsSync(storageStatePath)
      ? await browser.newContext({ storageState: storageStatePath })
      : await browser.newContext()
    const page = await context.newPage()
    try {
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded' })
      console.log('Log in to Facebook in the opened browser window.')
      await waitForEnter('Press Enter here after the Facebook login flow is complete to save the session: ')
      await context.storageState({ path: storageStatePath })
      console.log(`Stored Playwright storage state at ${storageStatePath}`)
    } finally {
      await page.close()
      await context.close()
    }
  } finally {
    await browser.close()
  }
}

const runWithPersistentProfile = async (targetUrl: string): Promise<void> => {
  const context = await openPersistentContext()
  const page = await context.newPage()
  try {
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' })
    console.log(
      'Persistent Chrome profile opened. Log in if required; session data will remain in the profile directory.'
    )
    await waitForEnter('Press Enter here once you have finished the Facebook login flow: ')
    console.log(`Persistent user data retained at ${appConfig.userDataDir}`)
  } finally {
    await page.close()
    await context.close()
  }
}

const main = async (): Promise<void> => {
  const targetUrl = ensureTargetUrl()
  if (appConfig.userDataDir) {
    await runWithPersistentProfile(targetUrl)
    return
  }

  if (!appConfig.storageStatePath) {
    throw new Error('Set PLAYWRIGHT_STORAGE_PATH or PLAYWRIGHT_USER_DATA_DIR to capture a reusable Facebook session.')
  }

  await runWithStorageState(targetUrl, appConfig.storageStatePath)
}

void main().catch((error) => {
  console.error('Failed to capture Facebook session:')
  console.error(error)
  process.exitCode = 1
})
