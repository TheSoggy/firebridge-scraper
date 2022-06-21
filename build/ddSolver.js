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
const ddTableDealPBN = (0, ref_struct_napi_1.default)({
    cards: (0, ref_array_napi_1.default)('char', 80)
});
const ddTableDealsPBN = (0, ref_struct_napi_1.default)({
    noOfTables: 'int',
    deals: (0, ref_array_napi_1.default)(ddTableDealPBN, 160)
});
const ddTableDealsPBNPtr = ref_napi_1.default.refType(ddTableDealsPBN);
const ddTableResults = (0, ref_struct_napi_1.default)({
    resTable: (0, ref_array_napi_1.default)('int', 20)
});
const ddTablesRes = (0, ref_struct_napi_1.default)({
    noOfBoards: 'int',
    results: (0, ref_array_napi_1.default)(ddTableResults, 160)
});
const ddTablesResPtr = ref_napi_1.default.refType(ddTablesRes);
const parResults = (0, ref_struct_napi_1.default)({
    parScore: (0, ref_array_napi_1.default)('char', 32),
    parContractsString: (0, ref_array_napi_1.default)('char', 256)
});
const allParResults = (0, ref_struct_napi_1.default)({
    parResults: (0, ref_array_napi_1.default)(parResults, 160)
});
const allParResultsPtr = ref_napi_1.default.refType(allParResults);
const dealPBN = (0, ref_struct_napi_1.default)({
    trump: 'int',
    first: 'int',
    currentTrickSuit: (0, ref_array_napi_1.default)('int', 3),
    currentTrickRank: (0, ref_array_napi_1.default)('int', 3),
    remainCards: (0, ref_array_napi_1.default)('char', 80)
});
const boardsPBN = (0, ref_struct_napi_1.default)({
    noOfBoards: 'int',
    deals: (0, ref_array_napi_1.default)(dealPBN, 200),
    target: (0, ref_array_napi_1.default)('int', 200),
    solutions: (0, ref_array_napi_1.default)('int', 200),
    mode: (0, ref_array_napi_1.default)('int', 200)
});
const boardsPBNPtr = ref_napi_1.default.refType(boardsPBN);
const futureTricks = (0, ref_struct_napi_1.default)({
    nodes: 'int',
    cards: 'int',
    suit: (0, ref_array_napi_1.default)('int', 13),
    rank: (0, ref_array_napi_1.default)('int', 13),
    equals: (0, ref_array_napi_1.default)('int', 13),
    score: (0, ref_array_napi_1.default)('int', 13)
});
const solvedBoards = (0, ref_struct_napi_1.default)({
    noOfBoards: 'int',
    solvedBoard: (0, ref_array_napi_1.default)(futureTricks, 200)
});
const solvedBoardsPtr = ref_napi_1.default.refType(solvedBoards);
let libdds = ffi_napi_1.default.Library(path_1.default.join(process.cwd(), process.platform === "win32" ? 'libdds/src/dds.dll' : 'libdds/src/libdds.so'), {
    'CalcAllTablesPBN': ['int', [ddTableDealsPBNPtr, 'int', (0, ref_array_napi_1.default)('int'), ddTablesResPtr, allParResultsPtr]],
    'SolveAllBoards': ['int', [boardsPBNPtr, solvedBoardsPtr]]
});
exports.default = (solveDD, solveLead) => {
    let res = {};
    if (solveDD) {
        res.ddData = [[], [], [], []];
        for (let i = 0; i < 4; i++) {
            let dealPBNs = [];
            let ddRes = [];
            let chunkedBoards = lodash_1.default.chunk(solveDD[i], 32);
            for (let j = 0; j < chunkedBoards.length; j++) {
                for (let hand of chunkedBoards[j]) {
                    dealPBNs.push(new ddTableDealPBN({
                        cards: hand.split('')
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
                        ddTricks: lodash_1.default.zip(...lodash_1.default.chunk(ddAllRes.results[k].resTable.toString().split(',').map(Number), 4)),
                        score: parseInt(allParRes.parResults[k].parScore.buffer.toString().replace(/EW.+/g, '').substring(3))
                    });
                }
            }
        }
    }
    if (solveLead) {
        res.leadData = [];
        let deals = [];
        let chunkedBoards = lodash_1.default.chunk(solveLead, 200);
        for (let i = 0; i < chunkedBoards.length; i++) {
            for (let { trump, leader, hands } of chunkedBoards[i]) {
                deals.push(new dealPBN({
                    trump: trump,
                    first: leader,
                    currentTrickSuit: [0, 0, 0],
                    currentTrickRank: [0, 0, 0],
                    remainCards: hands.split('')
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
            const convertToNum = (equals) => {
                let m = equals >> 2;
                let res = [];
                for (let i = 15; i >= 2; i--) {
                    if (m & (dbitMapRank[i])) {
                        res.push(i - 2);
                    }
                }
                return res;
            };
            libdds.SolveAllBoards(boardsObj.ref(), solvedBoardsObj.ref());
            for (let i = 0; i < deals.length; i++) {
                const cards = [];
                let board = solvedBoardsObj.solvedBoard[i];
                for (let j = 0; j < board.cards; j++) {
                    let sameValues = convertToNum(board.equals[j]);
                    if (cards.length == 0 || cards[cards.length - 1].score != board.score[j]) {
                        cards.push({
                            score: board.score[j],
                            values: [[], [], [], []]
                        });
                    }
                    cards[cards.length - 1].values[board.suit[j]].push(board.rank[j] - 2);
                    sameValues.forEach(card => {
                        cards[cards.length - 1].values[board.suit[j]].push(card);
                    });
                }
                res.leadData.push(cards);
            }
        }
    }
    return res;
};
