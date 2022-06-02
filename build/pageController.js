"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pageScraper_1 = __importDefault(require("./pageScraper"));
async function scrapeAll( /*browserInstance: Promise<Browser>*/) {
    // let browser: Browser;
    try {
        let startTime = Date.now();
        // browser = await browserInstance;
        // await pageScraper.scraper(browser);
        await pageScraper_1.default.scrape();
        let duration = Date.now() - startTime;
        const msToTime = (s) => {
            var ms = s % 1000;
            s = (s - ms) / 1000;
            var secs = s % 60;
            s = (s - secs) / 60;
            var mins = s % 60;
            var hrs = (s - mins) / 60;
            return hrs + ':' + mins + ':' + secs + '.' + ms;
        };
        console.log(msToTime(duration));
    }
    catch (err) {
        console.log("Could not resolve the browser instance => ", err);
    }
}
exports.default = scrapeAll;
