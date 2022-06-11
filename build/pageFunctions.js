"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDDData = exports.getLeadSolver = exports.getDDSolver = exports.DDSolverAPI = exports.getLin = exports.profilePromise = exports.gotoLink = exports.disableImgCss = exports.restartWorker = exports.newCluster = void 0;
const puppeteer_extra_1 = __importDefault(require("puppeteer-extra"));
const lin_parser_1 = __importDefault(require("./lin_parser"));
const puppeteer_extra_plugin_stealth_1 = __importDefault(require("puppeteer-extra-plugin-stealth"));
const puppeteer_cluster_1 = require("puppeteer-cluster");
const types_1 = require("./types");
const constants_1 = require("./constants");
const axios_1 = __importDefault(require("axios"));
const axios_retry_1 = __importDefault(require("axios-retry"));
const random_useragent_1 = require("random-useragent");
const xml2json_1 = __importDefault(require("xml2json"));
puppeteer_extra_1.default.use((0, puppeteer_extra_plugin_stealth_1.default)());
(0, axios_retry_1.default)(axios_1.default, {
    retries: 3,
    retryDelay: (retryCount) => {
        console.log(`retry attempt: ${retryCount}`);
        return 2000;
    },
    retryCondition: (_error) => true
});
const newCluster = async (monitoring) => {
    const cluster = await puppeteer_cluster_1.Cluster.launch({
        concurrency: puppeteer_cluster_1.Cluster.CONCURRENCY_PAGE,
        maxConcurrency: 32,
        retryLimit: 20,
        retryDelay: 2000,
        timeout: 600000,
        puppeteer: puppeteer_extra_1.default,
        monitor: monitoring,
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
    return cluster;
};
exports.newCluster = newCluster;
const restartWorker = () => {
    return axios_1.default.delete(`https://api.heroku.com/apps/${process.env.HEROKU_APP}/dynos/worker`, {
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.heroku+json; version=3',
            'Authorization': `Bearer ${process.env.HEROKU_API_TOKEN}`
        }
    });
};
exports.restartWorker = restartWorker;
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
        await page.setUserAgent((0, random_useragent_1.getRandom)());
        response = await page.goto(link, { waitUntil: 'networkidle0' });
        if (i > 20) {
            console.log("BBO down");
            (0, exports.restartWorker)();
            return;
        }
        i++;
        if (response === null) {
            console.log("Got null, trying wait.");
            response = await page.waitForResponse(() => true);
        }
        if (!response.ok()) {
            await page.waitForTimeout(1000);
        }
        if (link.includes("mbthands")) {
            await page.waitForTimeout(200);
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
const getLin = async (board) => {
    (0, axios_retry_1.default)(axios_1.default, {
        retries: 3,
        retryDelay: (retryCount) => {
            console.log(`retry attempt: ${retryCount}`);
            return 2000;
        },
        retryCondition: (_error) => true
    });
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
            return (0, exports.restartWorker)();
        });
    }
};
exports.getLin = getLin;
const DDSolverAPI = (parsedLin) => {
    const url = "https://dds.bridgewebs.com/cgi-bin/bsol2/ddummy?request=m&dealstr=W:" +
        `${parsedLin.hands.join(' ')}&vul=${parsedLin.vul}&sockref=${Date.now()}&uniqueTID=${Date.now() + 3}&_=${Date.now() - 10000}`;
    return axios_1.default.get(url, {
        headers: {
            'user-agent': (0, random_useragent_1.getRandom)()
        }
    }).catch(err => {
        console.log('DD Solver down');
        return (0, exports.restartWorker)();
    });
};
exports.DDSolverAPI = DDSolverAPI;
const getDDSolver = async (parsedLin, board) => {
    const res = await (0, exports.DDSolverAPI)(parsedLin);
    if (board.contract != 'P') {
        board.tricksDiff = board.tricksTaken -
            parseInt(res.data.sess.ddtricks[5 * constants_1.ddsDir[board.contract[2]] + constants_1.ddsContractSuits[board.contract[1]]], 16);
    }
    board.pointsDiff = board.score -
        parseInt(res.data.scoreNS.substring(3));
    board.impsDiff = (0, constants_1.pointsToImp)(board.pointsDiff);
    board.optimalPoints = parseInt(res.data.scoreNS.substring(3));
};
exports.getDDSolver = getDDSolver;
const getLeadSolver = (parsedLin, board) => {
    const url = "https://dds.bridgewebs.com/cgi-bin/bsol2/ddummy?request=g&dealstr=" +
        `${parsedLin.hands.join(' ')}&trumps=${board.contract[1]}` +
        `&leader=${constants_1.bboNumtoDir[(constants_1.bboDir[board.contract[2]] + 1) % 4]}` +
        `&requesttoken=${Date.now()}&uniqueTID=${Date.now() + 3}`;
    return axios_1.default.get(url, {
        headers: {
            'user-agent': (0, random_useragent_1.getRandom)()
        }
    }).then(res => {
        board.leadCost = 13 - res.data.sess.cards.filter(set => set.values[constants_1.ddsSuits[parsedLin.lead[0]]].includes(constants_1.cardRank[parsedLin.lead[1]]))[0].score -
            board.tricksTaken + board.tricksDiff;
    }).catch(err => {
        console.log('DD Solver down');
        return (0, exports.restartWorker)();
    });
};
exports.getLeadSolver = getLeadSolver;
const getDDData = async (boards, fromTraveller) => {
    if (fromTraveller && boards.length > 0) {
        let parsedLin = (0, lin_parser_1.default)(boards[0].lin);
        await (0, exports.getDDSolver)(parsedLin, boards[0]);
        var tricksDiff = boards[0].tricksDiff;
        var pointsDiff = boards[0].pointsDiff;
        var impsDiff = boards[0].impsDiff;
        var optimalPoints = boards[0].optimalPoints;
    }
    await Promise.all(boards.map(async (board) => {
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
            await (0, exports.getLeadSolver)(parsedLin, board);
        }
        else {
            board.contractLevel = types_1.ContractLevel.PASSOUT;
        }
        if (!fromTraveller) {
            await (0, exports.getDDSolver)(parsedLin, board);
        }
        else {
            board.tricksDiff = tricksDiff;
            board.pointsDiff = pointsDiff;
            board.impsDiff = impsDiff;
            board.optimalPoints = optimalPoints;
        }
    }));
    return boards;
};
exports.getDDData = getDDData;
