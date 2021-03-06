"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDDData = exports.getLin = exports.profilePromise = exports.gotoLink = exports.disableImgCss = exports.restartWorker = exports.newCluster = void 0;
const puppeteer_extra_1 = __importDefault(require("puppeteer-extra"));
const lin_parser_1 = __importDefault(require("./lin_parser"));
const puppeteer_cluster_1 = require("puppeteer-cluster");
const types_1 = require("./types");
const constants_1 = require("./constants");
const axios_1 = __importDefault(require("axios"));
const axios_retry_1 = __importDefault(require("axios-retry"));
const random_useragent_1 = require("random-useragent");
const xml2json_1 = __importDefault(require("xml2json"));
const ddSolver_1 = __importDefault(require("./ddSolver"));
const newCluster = async (monitoring) => {
    const cluster = await puppeteer_cluster_1.Cluster.launch({
        concurrency: puppeteer_cluster_1.Cluster.CONCURRENCY_PAGE,
        maxConcurrency: 25,
        retryLimit: 5,
        retryDelay: 2000,
        timeout: 600000,
        puppeteer: puppeteer_extra_1.default,
        monitor: monitoring,
        puppeteerOptions: {
            args: [
                "--disable-setuid-sandbox",
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--use-gl=egl",
                "--no-zygote",
            ],
            'ignoreHTTPSErrors': true
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
    page.on('request', async (req) => {
        ['image', 'stylesheet', 'font', 'script'].includes(req.resourceType())
            ? await req.abort()
            : await req.continue();
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
            await page.waitForTimeout(500);
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
        retries: 5,
        retryDelay: (retryCount) => {
            console.log(`retry attempt: ${retryCount}`);
            return 2000 * retryCount;
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
const getDDData = (boards, fromTraveller) => {
    if (boards.length == 0)
        return boards;
    const handsByVul = [[], [], [], []];
    const idxByVul = [[], [], [], []];
    const leadSolverBoards = [];
    const leadSolverBoardIdx = [];
    if (fromTraveller) {
        let parsedLin = (0, lin_parser_1.default)(boards[0].lin);
        const hands = "W:" + parsedLin.hands.join(' ');
        handsByVul[parsedLin.vul].push(hands);
        const res = (0, ddSolver_1.default)([...handsByVul], undefined);
        if (res.ddData) {
            if (boards[0].contract != 'P') {
                boards[0].tricksDiff = boards[0].tricksTaken -
                    res.ddData[parsedLin.vul][0].ddTricks[constants_1.ddsDir[boards[0].contract[2]]][constants_1.ddsContractSuits[boards[0].contract[1]]];
            }
            boards[0].pointsDiff = boards[0].score -
                res.ddData[parsedLin.vul][0].score;
            boards[0].impsDiff = (0, constants_1.pointsToImp)(boards[0].pointsDiff);
            boards[0].optimalPoints = res.ddData[parsedLin.vul][0].score;
        }
        var tricksDiff = boards[0].tricksDiff;
        var pointsDiff = boards[0].pointsDiff;
        var impsDiff = boards[0].impsDiff;
        var optimalPoints = boards[0].optimalPoints;
    }
    for (const [boardIdx, board] of boards.entries()) {
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
            leadSolverBoards.push({
                hands: "W:" + parsedLin.hands.join(' '),
                leader: constants_1.ddsDir[constants_1.bboNumtoDir[(constants_1.bboDir[board.contract[2]] + 1) % 4]],
                trump: constants_1.ddsContractSuits[board.contract[1]]
            });
            leadSolverBoardIdx.push(boardIdx);
        }
        else {
            board.contractLevel = types_1.ContractLevel.PASSOUT;
        }
        if (fromTraveller) {
            board.tricksDiff = tricksDiff;
            board.pointsDiff = pointsDiff;
            board.impsDiff = impsDiff;
            board.optimalPoints = optimalPoints;
        }
        else {
            const hands = "W:" + parsedLin.hands.join(' ');
            handsByVul[parsedLin.vul].push(hands);
            idxByVul[parsedLin.vul].push(boardIdx);
        }
    }
    if (fromTraveller) {
        const res = (0, ddSolver_1.default)(undefined, [...leadSolverBoards]);
        if (res.leadData) {
            for (const [i, leadIdx] of leadSolverBoardIdx.entries()) {
                let parsedLin = (0, lin_parser_1.default)(boards[leadIdx].lin);
                if (res.leadData[i].some(set => set.values[constants_1.ddsSuits[parsedLin.lead[0]]] === undefined)) {
                    console.log(JSON.stringify(res.leadData[i]));
                    console.log(JSON.stringify(parsedLin));
                    console.log(JSON.stringify(boards[leadIdx]));
                }
                if (res.leadData[i].filter(set => set.values[constants_1.ddsSuits[parsedLin.lead[0]]].includes(constants_1.cardRank[parsedLin.lead[1]]))[0] === undefined) {
                    console.log(JSON.stringify(res.leadData[i]));
                    console.log(JSON.stringify(lin_parser_1.default));
                }
                boards[leadIdx].leadCost = 13 - res.leadData[i].filter(set => set.values[constants_1.ddsSuits[parsedLin.lead[0]]].includes(constants_1.cardRank[parsedLin.lead[1]]))[0].score -
                    boards[leadIdx].tricksTaken + boards[leadIdx].tricksDiff;
            }
        }
    }
    else {
        const res = (0, ddSolver_1.default)([...handsByVul], [...leadSolverBoards]);
        if (res.ddData) {
            for (let i = 0; i < 4; i++) {
                for (let j = 0; j < handsByVul[i].length; j++) {
                    if (boards[idxByVul[i][j]].contract != 'P') {
                        if (res.ddData[i][j].ddTricks[constants_1.ddsDir[boards[idxByVul[i][j]].contract[2]]] === undefined) {
                            console.log(res.ddData[i][j].ddTricks);
                            console.log(boards[idxByVul[i][j]].contract);
                        }
                        boards[idxByVul[i][j]].tricksDiff = boards[idxByVul[i][j]].tricksTaken -
                            res.ddData[i][j].ddTricks[constants_1.ddsDir[boards[idxByVul[i][j]].contract[2]]][constants_1.ddsContractSuits[boards[idxByVul[i][j]].contract[1]]];
                    }
                    boards[idxByVul[i][j]].pointsDiff = boards[idxByVul[i][j]].score -
                        res.ddData[i][j].score;
                    boards[idxByVul[i][j]].impsDiff = (0, constants_1.pointsToImp)(boards[idxByVul[i][j]].pointsDiff);
                    boards[idxByVul[i][j]].optimalPoints = res.ddData[i][j].score;
                }
            }
        }
        if (res.leadData) {
            for (const [i, leadIdx] of leadSolverBoardIdx.entries()) {
                let parsedLin = (0, lin_parser_1.default)(boards[leadIdx].lin);
                if (res.leadData[i].some(set => set.values[constants_1.ddsSuits[parsedLin.lead[0]]] === undefined)) {
                    console.log(JSON.stringify(res.leadData[i]));
                    console.log(JSON.stringify(parsedLin));
                    console.log(JSON.stringify(boards[leadIdx]));
                }
                if (res.leadData[i].filter(set => set.values[constants_1.ddsSuits[parsedLin.lead[0]]].includes(constants_1.cardRank[parsedLin.lead[1]]))[0] === undefined) {
                    console.log(JSON.stringify(res.leadData[i]));
                    console.log(JSON.stringify(lin_parser_1.default));
                }
                boards[leadIdx].leadCost = 13 - res.leadData[i].filter(set => set.values[constants_1.ddsSuits[parsedLin.lead[0]]].includes(constants_1.cardRank[parsedLin.lead[1]]))[0].score -
                    boards[leadIdx].tricksTaken + boards[leadIdx].tricksDiff;
            }
        }
    }
    return boards;
};
exports.getDDData = getDDData;
