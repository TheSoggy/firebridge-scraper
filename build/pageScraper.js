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
const types_1 = require("./types");
const xml2json_1 = __importDefault(require("xml2json"));
const fs = __importStar(require("fs"));
const axios_retry_1 = __importDefault(require("axios-retry"));
const lodash_1 = __importDefault(require("lodash"));
const astraDB_1 = __importDefault(require("./astraDB"));
const constants_1 = require("./constants");
const pageFunctions_1 = require("./pageFunctions");
const random_useragent_1 = require("random-useragent");
const scraperObject = {
    url: 'https://webutil.bridgebase.com/v2/tarchive.php?m=all&d=All%20Tourneys',
    login: 'https://www.bridgebase.com/myhands/myhands_login.php?t=%2Fmyhands%2Findex.php%3F',
    async scrape() {
        puppeteer_extra_1.default.use((0, puppeteer_extra_plugin_stealth_1.default)());
        const stream = fs.createWriteStream("test19.txt", { flags: 'a' });
        (0, axios_retry_1.default)(axios_1.default, { retryDelay: (retryCount) => {
                console.log(`retry attempt: ${retryCount}`);
                return retryCount * 2000; // time interval between retries
            } });
        const cluster = await puppeteer_cluster_1.Cluster.launch({
            concurrency: puppeteer_cluster_1.Cluster.CONCURRENCY_PAGE,
            maxConcurrency: 32,
            retryLimit: 20,
            retryDelay: 2000,
            timeout: 6000000,
            puppeteer: puppeteer_extra_1.default,
            monitor: true,
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
        var urls = await cluster.execute(this.url, async ({ page, data: url }) => {
            await (0, pageFunctions_1.disableImgCss)(page);
            await page.goto(url, { waitUntil: 'networkidle0' });
            await page.waitForSelector('#tourneys');
            return await page.$$eval('#tourneys > center > table > tbody > tr > td > a.ldr', links => links.map(link => link.href));
        });
        await cluster.execute(this.login, async ({ page, data: url }) => {
            await (0, pageFunctions_1.disableImgCss)(page);
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
        const travellerPromise = async ({ page, data: link }) => {
            await (0, pageFunctions_1.disableImgCss)(page);
            let boards = [];
            await (0, pageFunctions_1.gotoLink)(page, link);
            await page.waitForSelector('.bbo_content');
            page.on('console', message => console.log(`${message.type().substring(0, 3).toUpperCase()} ${message.text()}`));
            boards = await page.$$eval('.body > tbody > .tourney', (rows, suits) => rows.map(row => {
                let board = {
                    contract: '',
                    score: 0,
                    lin: '',
                    tricksOverContract: 0,
                    leadCost: 0,
                    tricksDiff: 0,
                    tricksTaken: 0,
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
            }).filter(board => board.lin.length > 0), constants_1.suitSymbols);
            await Promise.all(boards.map(async (board) => {
                if (board.lin.includes('popuplin')) {
                    board.lin = decodeURIComponent(board.lin.slice(13, -39));
                }
                else if (board.lin.includes('popup')) {
                    await axios_1.default.get(`https://webutil.bridgebase.com/v2/mh_handxml.php?id=${board.lin.slice(12, -39)}`, {
                        headers: {
                            'user-agent': (0, random_useragent_1.getRandom)()
                        }
                    }).then(res => {
                        board.lin = JSON.parse(xml2json_1.default.toJson(res.data)).lin.$t;
                    }).catch(err => {
                        console.log('BBO down');
                        axios_1.default.delete(`https://api.heroku.com/apps/${process.env.HEROKU_APP}/dynos/worker`, {
                            headers: {
                                'Content-Type': 'application/json',
                                'Accept': 'application/vnd.heroku+json; version=3',
                                'Authorization': `Bearer ${process.env.HEROKU_API_TOKEN}`
                            }
                        });
                    });
                }
            }));
            if (boards.length == 0 || !boards)
                return boards;
            let boardInfo = (0, lin_parser_1.default)(boards[0].lin);
            let getDDSolver = async () => {
                try {
                    const res = await axios_1.default.get("https://dds.bridgewebs.com/cgi-bin/bsol2/ddummy?request=m&dealstr=W:" +
                        `${boardInfo.hands.join(' ')}&vul=${boardInfo.vul}&sockref=${Date.now()}&uniqueTID=${Date.now() + 3}&_=${Date.now() - 10000}`, {
                        headers: {
                            'user-agent': (0, random_useragent_1.getRandom)()
                        }
                    });
                    boards.forEach(board => {
                        if (board.contract != 'P') {
                            board.tricksDiff = board.tricksTaken -
                                parseInt(res.data.sess.ddtricks[5 * constants_1.ddsDir[board.contract[2]] + constants_1.ddsContractSuits[board.contract[1]]], 16);
                        }
                        board.pointsDiff = board.score -
                            parseInt(res.data.scoreNS.substring(3));
                        board.optimalPoints = parseInt(res.data.scoreNS.substring(3));
                    });
                }
                catch (err) {
                    console.log('DD Solver down');
                    console.log(err);
                    console.log("https://dds.bridgewebs.com/cgi-bin/bsol2/ddummy?request=m&dealstr=W:" +
                        `${boardInfo.hands.join(' ')}&vul=${boardInfo.vul}&sockref=${Date.now()}&uniqueTID=${Date.now() + 3}&_=${Date.now() - 10000}`);
                    axios_1.default.delete(`https://api.heroku.com/apps/${process.env.HEROKU_APP}/dynos/worker`, {
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/vnd.heroku+json; version=3',
                            'Authorization': `Bearer ${process.env.HEROKU_API_TOKEN}`
                        }
                    });
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
                    board.declarer = board.playerIds[constants_1.bboDir[board.contract[2]]];
                    switch (board.contract[1]) {
                        case 'H':
                        case 'S':
                            if (parseInt(board.contract[0]) == 7) {
                                board.contractLevel = types_1.ContractLevel.GRANDSLAM;
                            }
                            else if (parseInt(board.contract[0]) == 6) {
                                board.contractLevel = types_1.ContractLevel.SLAM;
                            }
                            else if (parseInt(board.contract[0]) >= 4) {
                                board.contractLevel = types_1.ContractLevel.GAME;
                            }
                            else {
                                board.contractLevel = types_1.ContractLevel.PARTIAL;
                            }
                            break;
                        case 'C':
                        case 'D':
                            if (parseInt(board.contract[0]) == 7) {
                                board.contractLevel = types_1.ContractLevel.GRANDSLAM;
                            }
                            else if (parseInt(board.contract[0]) == 6) {
                                board.contractLevel = types_1.ContractLevel.SLAM;
                            }
                            else if (parseInt(board.contract[0]) == 5) {
                                board.contractLevel = types_1.ContractLevel.GAME;
                            }
                            else {
                                board.contractLevel = types_1.ContractLevel.PARTIAL;
                            }
                            break;
                        case 'N':
                            if (parseInt(board.contract[0]) == 7) {
                                board.contractLevel = types_1.ContractLevel.GRANDSLAM;
                            }
                            else if (parseInt(board.contract[0]) == 6) {
                                board.contractLevel = types_1.ContractLevel.SLAM;
                            }
                            else if (parseInt(board.contract[0]) >= 3) {
                                board.contractLevel = types_1.ContractLevel.GAME;
                            }
                            else {
                                board.contractLevel = types_1.ContractLevel.PARTIAL;
                            }
                            break;
                    }
                    let getLeadSolver = async () => {
                        try {
                            const res = await axios_1.default.get("https://dds.bridgewebs.com/cgi-bin/bsol2/ddummy?request=g&dealstr=" +
                                `${parsedLin.hands.join(' ')}&trumps=${board.contract[1]}` +
                                `&leader=${constants_1.bboNumtoDir[(constants_1.bboDir[board.contract[2]] + 1) % 4]}` +
                                `&requesttoken=${Date.now()}&uniqueTID=${Date.now() + 3}`, {
                                headers: {
                                    'user-agent': (0, random_useragent_1.getRandom)()
                                }
                            });
                            board.leadCost = 13 - res.data.sess.cards.filter(set => set.values[constants_1.ddsSuits[parsedLin.lead[0]]].includes(constants_1.cardRank[parsedLin.lead[1]]))[0].score -
                                board.tricksTaken + board.tricksDiff;
                        }
                        catch (err) {
                            console.log('DD Solver down');
                            console.log(err);
                            console.log("https://dds.bridgewebs.com/cgi-bin/bsol2/ddummy?request=g&dealstr=" +
                                `${parsedLin.hands.join(' ')}&trumps=${board.contract[1]}` +
                                `&leader=${constants_1.bboNumtoDir[(constants_1.bboDir[board.contract[2]] + 1) % 4]}` +
                                `&requesttoken=${Date.now()}&uniqueTID=${Date.now() + 3}`);
                            axios_1.default.delete(`https://api.heroku.com/apps/${process.env.HEROKU_APP}/dynos/worker`, {
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Accept': 'application/vnd.heroku+json; version=3',
                                    'Authorization': `Bearer ${process.env.HEROKU_API_TOKEN}`
                                }
                            });
                        }
                    };
                    await getLeadSolver();
                }
                else {
                    board.contractLevel = types_1.ContractLevel.PASSOUT;
                }
            }));
            return boards;
        };
        const boardsPromise = async ({ page, data: link }) => {
            await (0, pageFunctions_1.disableImgCss)(page);
            let dataObj = { 'firstPair': '', 'boards': [] };
            await (0, pageFunctions_1.gotoLink)(page, link);
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
                    contract: '',
                    score: 0,
                    lin: '',
                    tricksOverContract: 0,
                    leadCost: 0,
                    tricksDiff: 0,
                    tricksTaken: 0,
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
                    board.declarer = board.playerIds[constants_1.bboDir[board.contract[2]]];
                    switch (board.contract[1]) {
                        case 'H':
                        case 'S':
                            if (parseInt(board.contract[0]) == 7) {
                                board.contractLevel = types_1.ContractLevel.GRANDSLAM;
                            }
                            else if (parseInt(board.contract[0]) == 6) {
                                board.contractLevel = types_1.ContractLevel.SLAM;
                            }
                            else if (parseInt(board.contract[0]) >= 4) {
                                board.contractLevel = types_1.ContractLevel.GAME;
                            }
                            else {
                                board.contractLevel = types_1.ContractLevel.PARTIAL;
                            }
                            break;
                        case 'C':
                        case 'D':
                            if (parseInt(board.contract[0]) == 7) {
                                board.contractLevel = types_1.ContractLevel.GRANDSLAM;
                            }
                            else if (parseInt(board.contract[0]) == 6) {
                                board.contractLevel = types_1.ContractLevel.SLAM;
                            }
                            else if (parseInt(board.contract[0]) == 5) {
                                board.contractLevel = types_1.ContractLevel.GAME;
                            }
                            else {
                                board.contractLevel = types_1.ContractLevel.PARTIAL;
                            }
                            break;
                        case 'N':
                            if (parseInt(board.contract[0]) == 7) {
                                board.contractLevel = types_1.ContractLevel.GRANDSLAM;
                            }
                            else if (parseInt(board.contract[0]) == 6) {
                                board.contractLevel = types_1.ContractLevel.SLAM;
                            }
                            else if (parseInt(board.contract[0]) >= 3) {
                                board.contractLevel = types_1.ContractLevel.GAME;
                            }
                            else {
                                board.contractLevel = types_1.ContractLevel.PARTIAL;
                            }
                            break;
                    }
                }
                else {
                    board.contractLevel = types_1.ContractLevel.PASSOUT;
                }
                let getDDSolver = async () => {
                    try {
                        const res = await axios_1.default.get("https://dds.bridgewebs.com/cgi-bin/bsol2/ddummy?request=m&dealstr=W:" +
                            `${parsedLin.hands.join(' ')}&vul=${parsedLin.vul}&sockref=${Date.now()}&uniqueTID=${Date.now() + 3}&_=${Date.now() - 10000}`, {
                            headers: {
                                'user-agent': (0, random_useragent_1.getRandom)()
                            }
                        });
                        if (board.contract != 'P') {
                            board.tricksDiff = board.tricksTaken -
                                parseInt(res.data.sess.ddtricks[5 * constants_1.ddsDir[board.contract[2]] + constants_1.ddsContractSuits[board.contract[1]]], 16);
                        }
                        board.pointsDiff = board.score -
                            parseInt(res.data.scoreNS.substring(3));
                        board.optimalPoints = parseInt(res.data.scoreNS.substring(3));
                    }
                    catch (err) {
                        console.log('DD Solver down');
                        console.log(err);
                        console.log("https://dds.bridgewebs.com/cgi-bin/bsol2/ddummy?request=m&dealstr=W:" +
                            `${parsedLin.hands.join(' ')}&vul=${parsedLin.vul}&sockref=${Date.now()}&uniqueTID=${Date.now() + 3}&_=${Date.now() - 10000}`);
                        axios_1.default.delete(`https://api.heroku.com/apps/${process.env.HEROKU_APP}/dynos/worker`, {
                            headers: {
                                'Content-Type': 'application/json',
                                'Accept': 'application/vnd.heroku+json; version=3',
                                'Authorization': `Bearer ${process.env.HEROKU_API_TOKEN}`
                            }
                        });
                    }
                };
                let getLeadSolver = async () => {
                    try {
                        const res = await axios_1.default.get("https://dds.bridgewebs.com/cgi-bin/bsol2/ddummy?request=g&dealstr=" +
                            `${parsedLin.hands.join(' ')}&trumps=${board.contract[1]}` +
                            `&leader=${constants_1.bboNumtoDir[(constants_1.bboDir[board.contract[2]] + 1) % 4]}` +
                            `&requesttoken=${Date.now()}&uniqueTID=${Date.now() + 3}`, {
                            headers: {
                                'user-agent': (0, random_useragent_1.getRandom)()
                            }
                        });
                        board.leadCost = 13 - res.data.sess.cards.filter(set => set.values[constants_1.ddsSuits[parsedLin.lead[0]]].includes(constants_1.cardRank[parsedLin.lead[1]]))[0].score -
                            board.tricksTaken + board.tricksDiff;
                    }
                    catch (err) {
                        console.log('DD Solver down');
                        console.log(err);
                        console.log("https://dds.bridgewebs.com/cgi-bin/bsol2/ddummy?request=g&dealstr=" +
                            `${parsedLin.hands.join(' ')}&trumps=${board.contract[1]}` +
                            `&leader=${constants_1.bboNumtoDir[(constants_1.bboDir[board.contract[2]] + 1) % 4]}` +
                            `&requesttoken=${Date.now()}&uniqueTID=${Date.now() + 3}`);
                        axios_1.default.delete(`https://api.heroku.com/apps/${process.env.HEROKU_APP}/dynos/worker`, {
                            headers: {
                                'Content-Type': 'application/json',
                                'Accept': 'application/vnd.heroku+json; version=3',
                                'Authorization': `Bearer ${process.env.HEROKU_API_TOKEN}`
                            }
                        });
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
                    let travellerData = await cluster.execute(dataObj.firstPair, pageFunctions_1.profilePromise);
                    if (travellerData.length == 0)
                        return;
                    for (let i = 0; i < travellerData.length; i++) {
                        let boardData = await cluster.execute(travellerData[i], travellerPromise);
                        dataObj.boards.push.apply(dataObj.boards, boardData);
                    }
                }
            }
            if (dataObj.boards.length > 0) {
                (0, astraDB_1.default)(dataObj.boards);
            }
            else {
                console.log(`${++failures} no data`);
            }
        };
        console.log(urls.length);
        lodash_1.default.reverse(urls);
        if (process.env.LAST_TOURNEY_URL != '') {
            let idx = lodash_1.default.indexOf(urls, process.env.LAST_TOURNEY_URL);
            if (idx != -1) {
                urls = lodash_1.default.drop(urls, idx + 1);
            }
        }
        let failures = 0;
        let chunkedUrls = lodash_1.default.chunk(urls, 125);
        for (let chunk of chunkedUrls) {
            chunk.forEach(url => cluster.queue(url, boardsPromise));
            await cluster.idle();
            await axios_1.default.patch(`https://api.heroku.com/apps/${process.env.HEROKU_APP}/config-vars/`, {
                "LAST_TOURNEY_URL": chunk[chunk.length - 1]
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/vnd.heroku+json; version=3',
                    'Authorization': `Bearer ${process.env.HEROKU_API_TOKEN}`
                }
            });
        }
        await cluster.close();
    }
};
exports.default = scraperObject;
