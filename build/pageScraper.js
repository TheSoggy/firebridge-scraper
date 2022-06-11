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
const axios_1 = __importDefault(require("axios"));
const stargate_grpc_node_client_1 = require("@stargate-oss/stargate-grpc-node-client");
const grpc = __importStar(require("@grpc/grpc-js"));
const axios_retry_1 = __importDefault(require("axios-retry"));
const lodash_1 = __importDefault(require("lodash"));
const astraDB_1 = __importDefault(require("./astraDB"));
const lin_parser_1 = __importDefault(require("./lin_parser"));
const pageFunctions_1 = require("./pageFunctions");
const utils_1 = require("./utils");
const scraperObject = {
    url: 'https://webutil.bridgebase.com/v2/tarchive.php?m=all&d=All%20Tourneys',
    login: 'https://www.bridgebase.com/myhands/myhands_login.php?t=%2Fmyhands%2Findex.php%3F',
    async scrape() {
        (0, axios_retry_1.default)(axios_1.default, {
            retries: 3,
            retryDelay: (retryCount) => {
                console.log(`retry attempt: ${retryCount}`);
                return 2000;
            },
            retryCondition: (_error) => true
        });
        const cluster = await (0, pageFunctions_1.newCluster)(false);
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
            boards = await page.$$eval('.body > tbody > .tourney', (rows, link) => (rows.map(row => {
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
                try {
                    board.contract = row.querySelector('td.result').textContent;
                    board.score = parseInt(row.querySelector('td.score,td.negscore').textContent);
                    board.lin = row.querySelector('td.movie > a[onclick]').getAttribute('onclick');
                }
                catch (err) {
                    console.log(link);
                }
                return board;
            }) || []).filter(board => (0, lin_parser_1.default)(board.lin)), link);
            boards.forEach(board => (0, utils_1.processBoard)(board, board.contract));
            await Promise.all(boards.map(async (board) => (0, pageFunctions_1.getLin)(board)));
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
            dataObj.boards = await page.$$eval('table.handrecords > tbody > tr > td > a', links => (links.map(link => {
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
                result.contract = htmllink.text;
                return result;
            }) || []).filter(board => (0, lin_parser_1.default)(board.lin)));
            dataObj.boards.forEach(board => (0, utils_1.processBoard)(board, board.contract));
            await page.$$eval('table.handrecords > tbody > tr > td.resultcell + td', cells => (cells.map(cell => cell.textContent) || [])
                .filter(text => text.length > 0))
                .then(cells => cells
                .forEach((cell, idx) => {
                dataObj.boards[idx].score = parseInt(cell);
            }));
            if (dataObj.firstPair) {
                if (dataObj.firstPair.includes('mbthands')) {
                    let people = await page.$$eval('.onesection > .sectiontable > tbody > tr > td > a', links => links.map(link => link.href));
                    Promise.all(people.map(async (person) => {
                        cluster.execute(person, travellerPromise).then(res => {
                            DDPromises.push((0, utils_1.handleRejection)(new Promise(() => {
                                if (res.length > 0) {
                                    (0, pageFunctions_1.getDDData)(res, false).then(updatedResult => (0, astraDB_1.default)(updatedResult, promisifiedClient));
                                }
                                else {
                                    console.log(`${++failures} no data`);
                                }
                            })));
                        });
                    }));
                }
                else {
                    cluster.execute(dataObj.firstPair, pageFunctions_1.profilePromise).then((travellerData) => {
                        if (travellerData.length == 0)
                            return;
                        Promise.all(travellerData.map(async (traveller) => {
                            cluster.execute(traveller, travellerPromise).then(res => {
                                DDPromises.push((0, utils_1.handleRejection)(new Promise(() => {
                                    if (res.length > 0) {
                                        (0, pageFunctions_1.getDDData)(res, false).then(updatedResult => (0, astraDB_1.default)(updatedResult, promisifiedClient));
                                    }
                                    else {
                                        console.log(`${++failures} no data`);
                                    }
                                })));
                            });
                        }));
                    });
                }
            }
            return dataObj.boards;
        };
        lodash_1.default.reverse(urls);
        if (process.env.LAST_TOURNEY_URL != '') {
            let idx = lodash_1.default.indexOf(urls, process.env.LAST_TOURNEY_URL);
            if (idx != -1) {
                urls = lodash_1.default.drop(urls, idx + 1);
            }
        }
        let failures = 0;
        let chunkedUrls = lodash_1.default.chunk(urls, 80);
        const bearerToken = new stargate_grpc_node_client_1.StargateBearerToken(process.env.ASTRA_TOKEN);
        const credentials = grpc.credentials.combineChannelCredentials(grpc.credentials.createSsl(), bearerToken);
        const stargateClient = new stargate_grpc_node_client_1.StargateClient(process.env.ASTRA_GRPC_ENDPOINT, credentials);
        const promisifiedClient = (0, stargate_grpc_node_client_1.promisifyStargateClient)(stargateClient);
        for (let chunk of chunkedUrls) {
            var DDPromises = [];
            chunk.forEach(url => cluster.execute(url, boardsPromise).then(res => {
                DDPromises.push((0, utils_1.handleRejection)(new Promise(() => {
                    if (res.length > 0) {
                        (0, pageFunctions_1.getDDData)(res, false).then(updatedResult => (0, astraDB_1.default)(updatedResult, promisifiedClient));
                    }
                    else {
                        console.log(`${++failures} no data`);
                    }
                })));
            }));
            await cluster.idle();
            await Promise.all(DDPromises);
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
