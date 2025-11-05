import { chromium } from 'playwright'

async function main() {
  const browser = await chromium.launch({ headless: false, channel: 'chrome' })
  const page = await browser.newPage()
  await page.goto('https://www.tiktok.com/@lalalalisa_m/video/7567284744648412429?is_from_webapp=1&sender_device=pc', {
    waitUntil: 'networkidle',
  })
  const likes_selector =
    '#one-column-item-0 > div > section.css-jbg155-5e6d46e3--SectionActionBarContainer.e12arnib0 > button:nth-child(2) > strong'
  try {
    await page.waitForSelector(likes_selector, { timeout: 15000 })
    const likes = await page
      .locator(likes_selector)
      .textContent()
      .then((text) => text?.trim() ?? '')
    console.log('likes:', likes)
    await page.waitForSelector(likes_selector, { timeout: 15000 })
    const bookmarks_selector =
      '#one-column-item-0 > div > section.css-jbg155-5e6d46e3--SectionActionBarContainer.e12arnib0 > div:nth-child(4) > button > strong'
    const bookmarks = await page
      .locator(bookmarks_selector)
      .textContent()
      .then((text) => text?.trim() ?? '')
    console.log('bookmarks:', bookmarks)

    await page.waitForSelector(likes_selector, { timeout: 15000 })
    const shares_selector =
      '#one-column-item-0 > div > section.css-jbg155-5e6d46e3--SectionActionBarContainer.e12arnib0 > button:nth-child(5) > strong'
    const shares = await page
      .locator(shares_selector)
      .textContent()
      .then((text) => text?.trim() ?? '')
    console.log('shares:', shares)
  } catch (error) {
    console.error('Unable to read text content:', error)
  } finally {
    await browser.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
