"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.profilePromise = exports.gotoLink = exports.disableImgCss = void 0;
const disableImgCss = async (page) => {
    await page.setRequestInterception(true);
    page.on('request', (req) => {
        if (req.resourceType() == 'stylesheet' || req.resourceType() == 'script' || req.resourceType() == 'font' || req.resourceType() === 'image') {
            req.abort();
        }
        else {
            req.continue();
        }
    });
};
exports.disableImgCss = disableImgCss;
const gotoLink = async (page, link) => {
    let response, i = 0;
    do {
        response = await page.goto(link, { waitUntil: 'networkidle0' });
        if (i > 20) {
            console.log("BBO down");
            break;
        }
        i++;
        if (response === null) {
            console.log("Got null, trying wait.");
            response = await page.waitForResponse(() => true);
        }
        if (!response.ok()) {
            await page.waitForTimeout(1000);
        }
    } while (!response.ok());
};
exports.gotoLink = gotoLink;
const profilePromise = async ({ page, data: link }) => {
    await (0, exports.disableImgCss)(page);
    await (0, exports.gotoLink)(page, link);
    await page.waitForSelector('.bbo_content');
    return await page.$$eval('.body > tbody > .tourney > .traveller > a', links => links.map(link => link.href.replace(/&username=.*/, '')));
};
exports.profilePromise = profilePromise;
