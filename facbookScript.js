import { chromium } from 'playwright'

async function main() {
  const browser = await chromium.launch({ headless: false, channel: 'chrome' })
  const page = await browser.newPage()
  await page.goto(
    'https://www.facebook.com/ophtus/posts/pfbid02Ycy93CeGcjZhG5tv4SksCkAVc7us8fnPnUN4Dfk1QxnEGewY9kf8czFFwri3xUCcl?rdid=HSvKCSm8wStgdT96#',
    {
      waitUntil: 'networkidle',
    }
  )
  // https://www.facebook.com/100063473081250/videos/25146382691671545/?__so__=permalink
  // https://www.facebook.com/ophtus/posts/pfbid02Ycy93CeGcjZhG5tv4SksCkAVc7us8fnPnUN4Dfk1QxnEGewY9kf8czFFwri3xUCcl?rdid=HSvKCSm8wStgdT96#
  const likes_selector = 'div > div.x6s0dn4.x78zum5.x1iyjqo2.x13a6bvl.x6ikm8r.x10wlt62 > div > span > span > span'
  try {
    try {
      await page.waitForSelector(likes_selector, { timeout: 5000 })
    } finally {
      console.log('Selector found or timeout reached')
    }
    const likes = await page
      .locator(likes_selector)
      .textContent()
      .then((text) => text?.trim() ?? '')
    console.log('likes:', likes)
  } catch (error) {
    console.error('Unable to read text content:', error)
  } finally {
    // await browser.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
