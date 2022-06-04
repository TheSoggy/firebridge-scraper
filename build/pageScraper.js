"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const lin_parser_1 = __importDefault(require("./lin_parser"));
const axios_1 = __importDefault(require("axios"));
const puppeteer_extra_1 = __importDefault(require("puppeteer-extra"));
const puppeteer_extra_plugin_stealth_1 = __importDefault(require("puppeteer-extra-plugin-stealth"));
const puppeteer_cluster_1 = require("puppeteer-cluster");
const enums_1 = require("./enums");
const xml2json_1 = __importDefault(require("xml2json"));
const fs = __importStar(require("fs"));
const axios_retry_1 = __importDefault(require("axios-retry"));
const lodash_1 = __importDefault(require("lodash"));
const scraperObject = {
    url: 'https://webutil.bridgebase.com/v2/tarchive.php?m=all&d=All%20Tourneys',
    login: 'https://www.bridgebase.com/myhands/myhands_login.php?t=%2Fmyhands%2Findex.php%3F',
    async scrape() {
        puppeteer_extra_1.default.use((0, puppeteer_extra_plugin_stealth_1.default)());
        const stream = fs.createWriteStream("test18.txt", { flags: 'a' });
        const bboDir = {
            'S': 0,
            'W': 1,
            'N': 2,
            'E': 3,
        };
        const ddsDir = {
            'N': 0,
            'S': 1,
            'E': 2,
            'W': 3,
        };
        const bboNumtoDir = ['S', 'W', 'N', 'E'];
        const ddsContractSuits = {
            'N': 0,
            'S': 1,
            'H': 2,
            'D': 3,
            'C': 4,
        };
        const ddsSuits = {
            'S': 0,
            'H': 1,
            'D': 2,
            'C': 3,
        };
        const suitSymbols = {
            '♣': 'C',
            '♦': 'D',
            '♥': 'H',
            '♠': 'S',
        };
        const cardRank = {
            '2': 0,
            '3': 1,
            '4': 2,
            '5': 3,
            '6': 4,
            '7': 5,
            '8': 6,
            '9': 7,
            'T': 8,
            'J': 9,
            'Q': 10,
            'K': 11,
            'A': 12,
        };
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
        (0, axios_retry_1.default)(axios_1.default, { retryDelay: (retryCount) => {
                console.log(`retry attempt: ${retryCount}`);
                return retryCount * 2000; // time interval between retries
            } });
        const cluster = await puppeteer_cluster_1.Cluster.launch({
            concurrency: puppeteer_cluster_1.Cluster.CONCURRENCY_PAGE,
            maxConcurrency: 16,
            retryLimit: 20,
            retryDelay: 2000,
            timeout: 6000000,
            puppeteer: puppeteer_extra_1.default,
            puppeteerOptions: {
                args: ["--disable-setuid-sandbox",
                    "--no-sandbox",
                    "--disable-dev-shm-usage",
                    "--use-gl=egl",
                ],
                'ignoreHTTPSErrors': true,
            }
        });
        cluster.on('taskerror', (err, data) => {
            console.log(`Error crawling ${data}: ${err.message}`);
        });
        // Scraping process
        // Getting all tourneys
        const urls = await cluster.execute(this.url, async ({ page, data: url }) => {
            await disableImgCss(page);
            await page.goto(url, { waitUntil: 'networkidle0' });
            await page.waitForSelector('#tourneys');
            return await page.$$eval('#tourneys > center > table > tbody > tr > td > a.ldr', links => links.map(link => link.href));
        });
        await cluster.execute(this.login, async ({ page, data: url }) => {
            await disableImgCss(page);
            await page.goto(url, { waitUntil: 'domcontentloaded' });
            await page.type('#username', process.env.BBO_USERNAME);
            await page.type('#password', process.env.BBO_PASSWORD);
            await Promise.all([
                page.evaluate(() => {
                    document.querySelector('input[type=submit]').click();
                }),
                page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
            ]);
        });
        // Scraping data from individual tourneys
        const profilePromise = async ({ page, data: link }) => {
            await disableImgCss(page);
            await gotoLink(page, link);
            await page.waitForSelector('.bbo_content');
            return await page.$$eval('.body > tbody > .tourney > .traveller > a', links => links.map(link => link.href.replace(/&username=.*/, '')));
        };
        const travellerPromise = async ({ page, data: link }) => {
            await disableImgCss(page);
            let boards = [];
            await gotoLink(page, link);
            await page.waitForSelector('.bbo_content');
            page.on('console', message => console.log(`${message.type().substring(0, 3).toUpperCase()} ${message.text()}`));
            boards = await page.$$eval('.body > tbody > .tourney', (rows, suits) => rows.map(row => {
                let board = {
                    lin: '',
                    contract: '',
                    score: 0,
                    tricksTaken: 0,
                    tricksOverContract: 0,
                    tricksDiff: 0,
                    leadCost: 0,
                    competitive: false,
                    declarer: ''
                };
                let contract = row.querySelector('td.result').textContent;
                board.contract = contract.replace(/[♣♦♥♠]/, match => suits[match]).replace(/[+\-=]+.*/, '');
                if (contract == 'PASS')
                    board.contract = 'P';
                if (!/^[P1-7]/.test(contract)) {
                    return board;
                }
                if (/[+\-=]+.*/.test(contract)) {
                    switch (contract.match(/[+\-=]+.*/)[0][0]) {
                        case '+':
                            board.tricksOverContract = parseInt(contract.match(/[+\-=]+.*/)[0]);
                            board.tricksTaken = parseInt(contract[0]) + 6 + board.tricksOverContract;
                            break;
                        case '-':
                            board.tricksOverContract = parseInt(contract.match(/[+\-=]+.*/)[0]);
                            board.tricksTaken = parseInt(contract[0]) + 6 + board.tricksOverContract;
                            break;
                        case '=':
                            board.tricksTaken = parseInt(contract[0]) + 6;
                            break;
                    }
                }
                board.score = parseInt(row.querySelector('td.score,td.negscore').textContent);
                board.lin = row.querySelector('td.movie > a[onclick]').getAttribute('onclick');
                return board;
            }).filter(board => board.lin.length > 0), suitSymbols);
            await Promise.all(boards.map(async (board) => {
                if (board.lin.includes('popuplin')) {
                    board.lin = decodeURIComponent(board.lin.slice(13, -39));
                }
                else if (board.lin.includes('popup')) {
                    await axios_1.default.get(`https://webutil.bridgebase.com/v2/mh_handxml.php?id=${board.lin.slice(12, -39)}`)
                        .then(res => {
                        board.lin = JSON.parse(xml2json_1.default.toJson(res.data)).lin.$t;
                    });
                }
            }));
            if (boards.length == 0 || !boards)
                return boards;
            let boardInfo = (0, lin_parser_1.default)(boards[0].lin);
            let getDDSolver = async () => {
                try {
                    const res = await axios_1.default.get("https://dds.bridgewebs.com/cgi-bin/bsol2/ddummy?request=m&dealstr=W:" +
                        `${boardInfo.hands.join(' ')}&vul=${boardInfo.vul}&sockref=${Date.now()}&uniqueTID=${Date.now()}&_=${Date.now()}`);
                    boards.forEach(board => {
                        if (board.contract != 'P') {
                            board.tricksDiff = board.tricksTaken -
                                parseInt(res.data.sess.ddtricks[5 * ddsDir[board.contract[2]] + ddsContractSuits[board.contract[1]]], 16);
                        }
                        board.pointsDiff = board.score -
                            parseInt(res.data.scoreNS.substring(3));
                        board.optimalPoints = parseInt(res.data.scoreNS.substring(3));
                    });
                }
                catch (err) {
                    // console.log('Waiting for DD API retry')
                    // await getDDSolver()
                }
            };
            await getDDSolver();
            await Promise.all(boards.map(async (board) => {
                let parsedLin = (0, lin_parser_1.default)(board.lin);
                if (!parsedLin) {
                    console.log(link);
                    console.log(board.lin);
                }
                board.playerIds = parsedLin.playerIds;
                board.competitive = parsedLin.competitive;
                if (board.contract != 'P') {
                    board.declarer = board.playerIds[bboDir[board.contract[2]]];
                    switch (board.contract[1]) {
                        case 'H':
                        case 'S':
                            if (parseInt(board.contract[0]) == 7) {
                                board.contractLevel = enums_1.ContractLevel.GrandSlam;
                            }
                            else if (parseInt(board.contract[0]) == 6) {
                                board.contractLevel = enums_1.ContractLevel.Slam;
                            }
                            else if (parseInt(board.contract[0]) >= 4) {
                                board.contractLevel = enums_1.ContractLevel.Game;
                            }
                            else {
                                board.contractLevel = enums_1.ContractLevel.Partial;
                            }
                            break;
                        case 'C':
                        case 'D':
                            if (parseInt(board.contract[0]) == 7) {
                                board.contractLevel = enums_1.ContractLevel.GrandSlam;
                            }
                            else if (parseInt(board.contract[0]) == 6) {
                                board.contractLevel = enums_1.ContractLevel.Slam;
                            }
                            else if (parseInt(board.contract[0]) == 5) {
                                board.contractLevel = enums_1.ContractLevel.Game;
                            }
                            else {
                                board.contractLevel = enums_1.ContractLevel.Partial;
                            }
                            break;
                        case 'N':
                            if (parseInt(board.contract[0]) == 7) {
                                board.contractLevel = enums_1.ContractLevel.GrandSlam;
                            }
                            else if (parseInt(board.contract[0]) == 6) {
                                board.contractLevel = enums_1.ContractLevel.Slam;
                            }
                            else if (parseInt(board.contract[0]) >= 3) {
                                board.contractLevel = enums_1.ContractLevel.Game;
                            }
                            else {
                                board.contractLevel = enums_1.ContractLevel.Partial;
                            }
                            break;
                    }
                    let getLeadSolver = async () => {
                        try {
                            const res = await axios_1.default.get("https://dds.bridgewebs.com/cgi-bin/bsol2/ddummy?request=g&dealstr=" +
                                `${parsedLin.hands.join(' ')}&trumps=${board.contract[1]}` +
                                `&leader=${bboNumtoDir[(bboDir[board.contract[2]] + 1) % 4]}` +
                                `&requesttoken=${Date.now()}&uniqueTID=${Date.now()}`);
                            board.leadCost = 13 - res.data.sess.cards.filter(set => set.values[ddsSuits[parsedLin.lead[0]]].includes(cardRank[parsedLin.lead[1]]))[0].score -
                                board.tricksTaken + board.tricksDiff;
                        }
                        catch (err) {
                            // console.log('Waiting for lead API retry')
                            // await getLeadSolver()
                        }
                    };
                    await getLeadSolver();
                }
                else {
                    board.contractLevel = enums_1.ContractLevel.PassOut;
                }
            }));
            return boards;
        };
        const boardsPromise = async ({ page, data: link }) => {
            await disableImgCss(page);
            let dataObj = { 'firstPair': '', 'boards': [] };
            await gotoLink(page, link);
            dataObj.firstPair = await page.evaluate(() => {
                const link = document.querySelector('.onesection > .sectiontable > tbody > tr > td > a');
                if (link) {
                    return link.href;
                }
                else
                    return '';
            });
            dataObj.boards = await page.$$eval('table.handrecords > tbody > tr > td > a', links => links.map(link => {
                let result = {
                    lin: '',
                    contract: '',
                    score: 0,
                    tricksTaken: 0,
                    tricksOverContract: 0,
                    tricksDiff: 0,
                    leadCost: 0,
                    competitive: false,
                    declarer: ''
                };
                let htmllink = link;
                result.lin = decodeURIComponent(htmllink.href.slice(59));
                if (result.lin.length == 0)
                    return result;
                result.contract = htmllink.text.replace(/[+\-=]+.*/, '');
                if (result.contract == 'PASS')
                    result.contract = 'P';
                if (result.contract != 'P' && /[+\-=]+.*/.test(htmllink.text)) {
                    switch (htmllink.text.match(/[+\-=]+.*/)[0][0]) {
                        case '+':
                            result.tricksOverContract = parseInt(htmllink.text.match(/[+\-=]+.*/)[0]);
                            result.tricksTaken = parseInt(htmllink.text[0]) + 6 + result.tricksOverContract;
                            break;
                        case '-':
                            result.tricksOverContract = parseInt(htmllink.text.match(/[+\-=]+.*/)[0]);
                            result.tricksTaken = parseInt(htmllink.text[0]) + 6 + result.tricksOverContract;
                            break;
                        case '=':
                            result.tricksTaken = parseInt(htmllink.text[0]) + 6;
                            break;
                    }
                }
                return result;
            }).filter(board => board.lin.length > 0));
            await page.$$eval('table.handrecords > tbody > tr > td.resultcell + td', cells => cells.map(cell => cell.textContent)
                .filter(text => text.length > 0))
                .then(cells => cells
                .forEach((cell, idx) => {
                dataObj.boards[idx].score = parseInt(cell);
            }));
            await Promise.all(dataObj.boards.map(async (board) => {
                let parsedLin = (0, lin_parser_1.default)(board.lin);
                board.playerIds = parsedLin.playerIds;
                board.competitive = parsedLin.competitive;
                if (board.contract != 'P') {
                    board.declarer = board.playerIds[bboDir[board.contract[2]]];
                    switch (board.contract[1]) {
                        case 'H':
                        case 'S':
                            if (parseInt(board.contract[0]) == 7) {
                                board.contractLevel = enums_1.ContractLevel.GrandSlam;
                            }
                            else if (parseInt(board.contract[0]) == 6) {
                                board.contractLevel = enums_1.ContractLevel.Slam;
                            }
                            else if (parseInt(board.contract[0]) >= 4) {
                                board.contractLevel = enums_1.ContractLevel.Game;
                            }
                            else {
                                board.contractLevel = enums_1.ContractLevel.Partial;
                            }
                            break;
                        case 'C':
                        case 'D':
                            if (parseInt(board.contract[0]) == 7) {
                                board.contractLevel = enums_1.ContractLevel.GrandSlam;
                            }
                            else if (parseInt(board.contract[0]) == 6) {
                                board.contractLevel = enums_1.ContractLevel.Slam;
                            }
                            else if (parseInt(board.contract[0]) == 5) {
                                board.contractLevel = enums_1.ContractLevel.Game;
                            }
                            else {
                                board.contractLevel = enums_1.ContractLevel.Partial;
                            }
                            break;
                        case 'N':
                            if (parseInt(board.contract[0]) == 7) {
                                board.contractLevel = enums_1.ContractLevel.GrandSlam;
                            }
                            else if (parseInt(board.contract[0]) == 6) {
                                board.contractLevel = enums_1.ContractLevel.Slam;
                            }
                            else if (parseInt(board.contract[0]) >= 3) {
                                board.contractLevel = enums_1.ContractLevel.Game;
                            }
                            else {
                                board.contractLevel = enums_1.ContractLevel.Partial;
                            }
                            break;
                    }
                }
                else {
                    board.contractLevel = enums_1.ContractLevel.PassOut;
                }
                let getDDSolver = async () => {
                    try {
                        const res = await axios_1.default.get("https://dds.bridgewebs.com/cgi-bin/bsol2/ddummy?request=m&dealstr=W:" +
                            `${parsedLin.hands.join(' ')}&vul=${parsedLin.vul}&sockref=${Date.now()}&uniqueTID=${Date.now()}&_=${Date.now()}`);
                        if (board.contract != 'P') {
                            board.tricksDiff = board.tricksTaken -
                                parseInt(res.data.sess.ddtricks[5 * ddsDir[board.contract[2]] + ddsContractSuits[board.contract[1]]], 16);
                        }
                        board.pointsDiff = board.score -
                            parseInt(res.data.scoreNS.substring(3));
                        board.optimalPoints = parseInt(res.data.scoreNS.substring(3));
                    }
                    catch (err) {
                        // console.log('Waiting for DD API retry')
                        // await getDDSolver()
                    }
                };
                let getLeadSolver = async () => {
                    try {
                        const res = await axios_1.default.get("https://dds.bridgewebs.com/cgi-bin/bsol2/ddummy?request=g&dealstr=" +
                            `${parsedLin.hands.join(' ')}&trumps=${board.contract[1]}` +
                            `&leader=${bboNumtoDir[(bboDir[board.contract[2]] + 1) % 4]}` +
                            `&requesttoken=${Date.now()}&uniqueTID=${Date.now()}`);
                        board.leadCost = 13 - res.data.sess.cards.filter(set => set.values[ddsSuits[parsedLin.lead[0]]].includes(cardRank[parsedLin.lead[1]]))[0].score -
                            board.tricksTaken + board.tricksDiff;
                    }
                    catch (err) {
                        // console.log('Waiting for lead API retry')
                        // await getLeadSolver()
                    }
                };
                await getDDSolver();
                if (board.contract != 'P') {
                    await getLeadSolver();
                }
            }));
            if (dataObj.firstPair) {
                if (dataObj.firstPair.includes('mbthands')) {
                    let people = await page.$$eval('.onesection > .sectiontable > tbody > tr > td > a', links => links.map(link => link.href));
                    for (let i = 0; i < people.length; i++) {
                        let boardData = await cluster.execute(people[i], travellerPromise);
                        dataObj.boards.push.apply(dataObj.boards, boardData);
                    }
                }
                else {
                    let travellerData = await cluster.execute(dataObj.firstPair, profilePromise);
                    if (travellerData.length == 0)
                        return;
                    for (let i = 0; i < travellerData.length; i++) {
                        let boardData = await cluster.execute(travellerData[i], travellerPromise);
                        dataObj.boards.push.apply(dataObj.boards, boardData);
                    }
                }
            }
            if (dataObj.boards.length > 0) {
                console.log(JSON.stringify(dataObj.boards) + "\n");
            }
            else {
                console.log(`${++failures} no data`);
            }
        };
        console.log(urls.length);
        let failures = 0;
        let chunkedUrls = lodash_1.default.chunk(urls, 200);
        for (let chunk of chunkedUrls) {
            chunk.forEach(url => cluster.queue(url, boardsPromise));
            await cluster.idle();
        }
        await cluster.close();
    }
};
exports.default = scraperObject;
