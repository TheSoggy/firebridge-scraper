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
const fs_1 = __importDefault(require("fs"));
const readline_1 = __importDefault(require("readline"));
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
let cards = [];
var lineReader = readline_1.default.createInterface({
    input: fs_1.default.createReadStream('list100.txt')
});
lineReader.on('line', function (line) {
    cards.push(line);
}).on('close', () => {
    let egdealPBNs = [];
    let egddTableResults = [];
    let egparResults = [];
    for (let card of cards) {
        egdealPBNs.push(new ddTableDealPBN({
            cards: card.split('')
        }));
        egddTableResults.push(new ddTableResults({
            resTable: []
        }));
        egparResults.push(new parResults({
            parScore: [],
            parContractsString: []
        }));
    }
    let egdealsPBN = new ddTableDealsPBN({
        noOfTables: cards.length,
        deals: egdealPBNs
    });
    let egddTablesRes = new ddTablesRes({
        noOfBoards: cards.length,
        results: egddTableResults
    });
    let egallParRes = new allParResults({
        parResults: []
    });
    let egdeals = [];
    for (let card of cards) {
        egdeals.push(new dealPBN({
            trump: 0,
            first: 0,
            currentTrickSuit: [0, 0, 0],
            currentTrickRank: [0, 0, 0],
            remainCards: card.split('')
        }));
    }
    let egboards = new boardsPBN({
        noOfBoards: cards.length,
        deals: egdeals,
        target: new Array(cards.length).fill(-1),
        solutions: new Array(cards.length).fill(3),
        mode: new Array(cards.length).fill(0)
    });
    let egfutureTricks = new futureTricks({
        nodes: 0,
        cards: 0,
        suit: [],
        rank: [],
        equals: [],
        score: []
    });
    let egsolvedBoards = new solvedBoards({
        noOfBoards: cards.length,
        solvedBoard: []
    });
    console.log(String.fromCharCode.apply(null, egdealsPBN.deals[0].cards.toString().split(',')));
    console.time('test');
    libdds.CalcAllTablesPBN(egdealsPBN.ref(), 2, [0, 0, 0, 0, 0], egddTablesRes.ref(), egallParRes.ref());
    for (let i = 0; i < cards.length; i++) {
        console.log(lodash_1.default.zip.apply(this, lodash_1.default.chunk(egddTablesRes.results[i].resTable.toString().split(','), 4)));
    }
    //egallParRes.parResults.map(res => console.log(res.parScore.buffer.toString()))
    libdds.SolveAllBoards(egboards.ref(), egsolvedBoards.ref());
    const dbitMapRank = [
        0x0000, 0x0000, 0x0001, 0x0002, 0x0004, 0x0008, 0x0010, 0x0020,
        0x0040, 0x0080, 0x0100, 0x0200, 0x0400, 0x0800, 0x1000, 0x2000
    ];
    const dcardRank = [
        'x', 'x', '2', '3', '4', '5', '6', '7',
        '8', '9', 'T', 'J', 'Q', 'K', 'A', '-'
    ];
    const dcardSuit = ['S', 'H', 'D', 'C', 'N'];
    const equals_to_string = (equals, res) => {
        let m = equals >> 2;
        for (let i = 15; i >= 2; i--) {
            if (m & (dbitMapRank[i])) {
                res += dcardRank[i];
            }
        }
        return res;
    };
    for (let i = 0; i < cards.length; i++) {
        let board = egsolvedBoards.solvedBoard[i];
        for (let j = 0; j < board.cards; j++) {
            let res = "";
            res = equals_to_string(board.equals[j], res);
            console.log(j, dcardSuit[board.suit[j]], dcardRank[board.rank[j]], res, board.score[j]);
        }
    }
    console.timeEnd('test');
});
