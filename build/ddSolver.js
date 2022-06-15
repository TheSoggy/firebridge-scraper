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
var deal = (0, ref_struct_napi_1.default)({
    trump: 'int',
    first: 'int',
    currentTrickSuit: (0, ref_array_napi_1.default)('int', 3),
    currentTrickRank: (0, ref_array_napi_1.default)('int', 3),
    remainCards: (0, ref_array_napi_1.default)(ref_napi_1.default.types.uint, 16)
});
var boards = (0, ref_struct_napi_1.default)({
    noOfBoards: 'int',
    deal: (0, ref_array_napi_1.default)(deal, 200),
    target: (0, ref_array_napi_1.default)('int', 200),
    solutions: (0, ref_array_napi_1.default)('int', 200),
    mode: (0, ref_array_napi_1.default)('int', 200)
});
var boardsPtr = ref_napi_1.default.refType(boards);
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
var libdds = ffi_napi_1.default.Library('../libdds/src/libdds.so', {
    'CalcAllTablesPBN': ['void', [ddTableDealsPBNPtr, 'int', (0, ref_array_napi_1.default)('int'), ddTablesResPtr, allParResultsPtr]],
    'SolveAllBoards': ['void', [boardsPtr, solvedBoardsPtr]]
});
let cards = "W:T753.KQ832.K.AQ2 AK42.J7.JT542.64 8.T954.9873.T953 QJ96.A6.AQ6.KJ87";
let egdealPBN = new ddTableDealPBN({
    cards: cards.split('')
});
let egdealsPBN = new ddTableDealsPBN({
    noOfTables: 1,
    deals: [egdealPBN]
});
let egddTableResults = new ddTableResults({
    resTable: []
});
let egddTablesRes = new ddTablesRes({
    noOfBoards: 1,
    results: [egddTableResults]
});
let egparResults = new parResults({
    parScore: [],
    parContractsString: []
});
let egallParRes = new allParResults({
    parResults: [egparResults]
});
let egsolvedBoards = new solvedBoards({
    noOfBoards: 1
});
console.log(String.fromCharCode.apply(null, egdealsPBN.deals[0].cards.toString().split(',')));
console.time('test');
libdds.CalcAllTablesPBN.async(egdealsPBN.ref(), 2, [0, 0, 0, 0, 0], egddTablesRes.ref(), egallParRes.ref(), (err, res) => {
    console.log(lodash_1.default.chunk(egddTablesRes.results[0].resTable.toString().split(','), 4));
    console.log(egallParRes.parResults[0].parScore.buffer.toString());
    console.timeEnd('test');
});
