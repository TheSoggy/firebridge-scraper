import { Browser } from 'puppeteer';
import pageScraper from './pageScraper';
async function scrapeAll(/*browserInstance: Promise<Browser>*/){
  // let browser: Browser;
  try {
    let startTime = Date.now();
    // browser = await browserInstance;
    // await pageScraper.scraper(browser);
    await pageScraper.scrape()
    let duration = Date.now() - startTime
    const msToTime = (s: number) => {
      var ms = s % 1000;
      s = (s - ms) / 1000;
      var secs = s % 60;
      s = (s - secs) / 60;
      var mins = s % 60;
      var hrs = (s - mins) / 60;
      return hrs + ':' + mins + ':' + secs + '.' + ms;
    }
    console.log(msToTime(duration));
  }
  catch(err) {
    console.log("Could not resolve the browser instance => ", err);
  }
}

export default scrapeAll