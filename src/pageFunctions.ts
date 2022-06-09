import { Page } from 'puppeteer'
export const disableImgCss = async (page: Page) => {
  await page.setRequestInterception(true)
  page.on('request', (req) => {
    if(req.resourceType() == 'stylesheet' || req.resourceType() == 'script' || req.resourceType() == 'font' || req.resourceType() === 'image'){
      req.abort()
    }
    else {
      req.continue()
    }
  })
}
export const gotoLink = async (page: Page, link: string) => {
  let response, i = 0
  do {
    response = await page.goto(link, { waitUntil: 'networkidle0' })
    if (i > 20) {
      console.log("BBO down")
      break
    }
    i++
    if (response === null) {
      console.log("Got null, trying wait.")
      response = await page.waitForResponse(() => true)
    }
    if (!response.ok()) {
      await page.waitForTimeout(1000)
    }
  } while (!response.ok())
}
export const profilePromise = async ({ page, data: link }: { page: Page, data: string }): Promise<string[]> => {
  await disableImgCss(page)
  await gotoLink(page, link)
  await page.waitForSelector('.bbo_content')
  return await page.$$eval('.body > tbody > .tourney > .traveller > a',
    links => links.map(link => (<HTMLAnchorElement>link).href.replace(/&username=.*/, '')))
}