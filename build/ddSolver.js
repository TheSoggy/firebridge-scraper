"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ffi_napi_1 = __importDefault(require("ffi-napi"));
const ref_napi_1 = __importDefault(require("ref-napi"));
const ref_struct_napi_1 = __importDefault(require("ref-struct-napi"));
const ref_array_napi_1 = __importDefault(require("ref-array-napi"));
const lodash_1 = __importDefault(require("lodash"));
const path_1 = __importDefault(require("path"));
const worker_threads_1 = require("worker_threads");
var ddTableDealPBN = (0, ref_struct_napi_1.default)({
    cards: (0, ref_array_napi_1.default)('char', 80)
});
var ddTableDealsPBN = (0, ref_struct_napi_1.default)({
    noOfTables: 'int',
    deals: (0, ref_array_napi_1.default)(ddTableDealPBN, 160)
});
var ddTableDealsPBNPtr = ref_napi_1.default.refType(ddTableDealsPBN);
var ddTableResults = (0, ref_struct_napi_1.default)({
    resTable: (0, ref_array_napi_1.default)('int', 20)
});
var ddTablesRes = (0, ref_struct_napi_1.default)({
    noOfBoards: 'int',
    results: (0, ref_array_napi_1.default)(ddTableResults, 160)
});
var ddTablesResPtr = ref_napi_1.default.refType(ddTablesRes);
var parResults = (0, ref_struct_napi_1.default)({
    parScore: (0, ref_array_napi_1.default)('char', 32),
    parContractsString: (0, ref_array_napi_1.default)('char', 256)
});
var allParResults = (0, ref_struct_napi_1.default)({
    parResults: (0, ref_array_napi_1.default)(parResults, 160)
});
var allParResultsPtr = ref_napi_1.default.refType(allParResults);
var dealPBN = (0, ref_struct_napi_1.default)({
    trump: 'int',
    first: 'int',
    currentTrickSuit: (0, ref_array_napi_1.default)('int', 3),
    currentTrickRank: (0, ref_array_napi_1.default)('int', 3),
    remainCards: (0, ref_array_napi_1.default)('char', 80)
});
var boardsPBN = (0, ref_struct_napi_1.default)({
    noOfBoards: 'int',
    deals: (0, ref_array_napi_1.default)(dealPBN, 200),
    target: (0, ref_array_napi_1.default)('int', 200),
    solutions: (0, ref_array_napi_1.default)('int', 200),
    mode: (0, ref_array_napi_1.default)('int', 200)
});
var boardsPBNPtr = ref_napi_1.default.refType(boardsPBN);
var futureTricks = (0, ref_struct_napi_1.default)({
    nodes: 'int',
    cards: 'int',
    suit: (0, ref_array_napi_1.default)('int', 13),
    rank: (0, ref_array_napi_1.default)('int', 13),
    equals: (0, ref_array_napi_1.default)('int', 13),
    score: (0, ref_array_napi_1.default)('int', 13)
});
var solvedBoards = (0, ref_struct_napi_1.default)({
    noOfBoards: 'int',
    solvedBoard: (0, ref_array_napi_1.default)(futureTricks, 200)
});
var solvedBoardsPtr = ref_napi_1.default.refType(solvedBoards);
var libdds = ffi_napi_1.default.Library(path_1.default.join(process.cwd(), 'libdds/src/libdds.so'), {
    'CalcAllTablesPBN': ['int', [ddTableDealsPBNPtr, 'int', (0, ref_array_napi_1.default)('int'), ddTablesResPtr, allParResultsPtr]],
    'SolveAllBoards': ['int', [boardsPBNPtr, solvedBoardsPtr]]
});
worker_threads_1.parentPort.on('message', workerData => {
    let res = {};
    if (workerData.solveDD) {
        res.ddData = [[], [], [], []];
        for (let i = 0; i < 4; i++) {
            let dealPBNs = [];
            let ddRes = [];
            let chunkedBoards = lodash_1.default.chunk(workerData.solveDD[i], 32);
            for (let j = 0; j < chunkedBoards.length; j++) {
                for (let k = 0; k < chunkedBoards[j].length; k++) {
                    dealPBNs.push(new ddTableDealPBN({
                        cards: chunkedBoards[j][k].split('')
                    }));
                    ddRes.push(new ddTableResults({
                        resTable: []
                    }));
                }
                let dealsPBNobj = new ddTableDealsPBN({
                    noOfTables: dealPBNs.length,
                    deals: dealPBNs
                });
                let ddAllRes = new ddTablesRes({
                    noOfBoards: ddRes.length,
                    results: ddRes
                });
                let allParRes = new allParResults({
                    parResults: []
                });
                libdds.CalcAllTablesPBN(dealsPBNobj.ref(), i, [0, 0, 0, 0, 0], ddAllRes.ref(), allParRes.ref());
                for (let k = 0; k < dealPBNs.length; k++) {
                    res.ddData[i].push({
                        ddTricks: lodash_1.default.zip.apply(this, lodash_1.default.chunk(ddAllRes.results[k].resTable.toString().split(',').map(Number), 4)),
                        score: allParRes.parResults[k].parScore.buffer.toString()
                    });
                }
            }
        }
    }
    if (workerData.solveLead) {
        res.leadData = [];
        let deals = [];
        let chunkedBoards = lodash_1.default.chunk(workerData.solveLead, 200);
        for (let i = 0; i < chunkedBoards.length; i++) {
            for (let board of chunkedBoards[i]) {
                deals.push(new dealPBN({
                    trump: board.trump,
                    first: board.leader,
                    currentTrickSuit: [0, 0, 0],
                    currentTrickRank: [0, 0, 0],
                    remainCards: board.hands.split('')
                }));
            }
            let boardsObj = new boardsPBN({
                noOfBoards: deals.length,
                deals: deals,
                target: new Array(deals.length).fill(-1),
                solutions: new Array(deals.length).fill(3),
                mode: new Array(deals.length).fill(0)
            });
            let solvedBoardsObj = new solvedBoards({
                noOfBoards: deals.length,
                solvedBoard: []
            });
            const dbitMapRank = [
                0x0000, 0x0000, 0x0001, 0x0002, 0x0004, 0x0008, 0x0010, 0x0020,
                0x0040, 0x0080, 0x0100, 0x0200, 0x0400, 0x0800, 0x1000, 0x2000
            ];
            const equals_to_string = (equals, res) => {
                let m = equals >> 2;
                for (let i = 15; i >= 2; i--) {
                    if (m & (dbitMapRank[i])) {
                        res.push(i - 2);
                    }
                }
            };
            libdds.SolveAllBoards(boardsObj.ref(), solvedBoardsObj.ref());
            for (let i = 0; i < deals.length; i++) {
                const cards = [];
                let board = solvedBoardsObj.solvedBoard[i];
                for (let j = 0; j < board.cards; j++) {
                    let res = [];
                    equals_to_string(board.equals[j], res);
                    if (cards[cards.length - 1].score != board.score[j]) {
                        cards.push({
                            score: board.score[j],
                            values: [[], [], [], []]
                        });
                    }
                    cards[cards.length - 1].values[board.suit[j]].push(board.rank[j] - 2);
                    if (res.length > 0) {
                        res.forEach(card => {
                            cards[cards.length - 1].values[board.suit[j]].push(card);
                        });
                    }
                }
                res.leadData.push(cards);
            }
        }
    }
    worker_threads_1.parentPort.postMessage(res);
});
