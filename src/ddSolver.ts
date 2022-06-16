import ffi from 'ffi-napi'
import ref  from 'ref-napi'
import StructType from 'ref-struct-napi'
import ArrayType from "ref-array-napi"
import _ from 'lodash'
import path from 'path'
import fs from 'fs'
import rl from 'readline'

var ddTableDealPBN = StructType({
  cards: ArrayType('char', 80)
})

var ddTableDealsPBN = StructType({
  noOfTables: 'int',
  deals: ArrayType(ddTableDealPBN, 160)
})
var ddTableDealsPBNPtr = ref.refType(ddTableDealsPBN)

var ddTableResults = StructType({
  resTable: ArrayType('int', 20)
})

var ddTablesRes = StructType({
  noOfBoards: 'int',
  results: ArrayType(ddTableResults, 160)
})
var ddTablesResPtr = ref.refType(ddTablesRes)

var parResults = StructType({
  parScore: ArrayType('char', 32),
  parContractsString: ArrayType('char', 256)
})

var allParResults = StructType({
  parResults: ArrayType(parResults, 160)
})
var allParResultsPtr = ref.refType(allParResults)

var dealPBN = StructType({
  trump: 'int',
  first: 'int',
  currentTrickSuit: ArrayType('int', 3),
  currentTrickRank: ArrayType('int', 3),
  remainCards: ArrayType('char', 80)
})

var boardsPBN = StructType({
  noOfBoards: 'int',
  deals: ArrayType(dealPBN, 200),
  target: ArrayType('int', 200),
  solutions: ArrayType('int', 200),
  mode: ArrayType('int', 200)
})
var boardsPBNPtr = ref.refType(boardsPBN)

var futureTricks = StructType({
  nodes: 'int',
  cards: 'int',
  suit: ArrayType('int', 13),
  rank: ArrayType('int', 13),
  equals: ArrayType('int', 13),
  score: ArrayType('int', 13)
})

var solvedBoards = StructType({
  noOfBoards: 'int',
  solvedBoard: ArrayType(futureTricks, 200)
})
var solvedBoardsPtr = ref.refType(solvedBoards)

var libdds = ffi.Library(path.join(process.cwd(), 'libdds/src/libdds.so'), {
  'CalcAllTablesPBN': [ 'int', [ ddTableDealsPBNPtr, 'int', ArrayType('int'), ddTablesResPtr, allParResultsPtr ] ],
  'SolveAllBoards': [ 'int', [ boardsPBNPtr, solvedBoardsPtr ] ]
})

let cards: string[] = []
var lineReader = rl.createInterface({
  input: fs.createReadStream('list100.txt')
});

lineReader.on('line', function (line) {
  cards.push(line)
}).on('close', () => {
  let egdealPBNs = []
  let egddTableResults = []
  let egparResults = []
  for (let card of cards){
    egdealPBNs.push(new ddTableDealPBN({
      cards: card.split('')
    }))
    egddTableResults.push(new ddTableResults({
      resTable: []
    }))
    egparResults.push(new parResults({
      parScore: [],
      parContractsString: []
    }))
  }

  let egdealsPBN = new ddTableDealsPBN({
    noOfTables: cards.length,
    deals: egdealPBNs
  })


  let egddTablesRes = new ddTablesRes({
    noOfBoards: cards.length,
    results: egddTableResults
  })

  let egallParRes = new allParResults({
    parResults: []
  })

  let egdeals = []
  for (let card of cards) {
    egdeals.push(new dealPBN({
      trump: 0,
      first: 0,
      currentTrickSuit: [0, 0, 0],
      currentTrickRank: [0, 0, 0],
      remainCards: card.split('')
    }))
  }

  let egboards = new boardsPBN({
    noOfBoards: cards.length,
    deals: egdeals,
    target: new Array(cards.length).fill(-1),
    solutions: new Array(cards.length).fill(3),
    mode: new Array(cards.length).fill(0)
  })

  let egfutureTricks = new futureTricks({
    nodes: 0,
    cards: 0,
    suit: [],
    rank: [],
    equals: [],
    score: []
  })

  let egsolvedBoards = new solvedBoards({
    noOfBoards: cards.length,
    solvedBoard: []
  })

  console.log(String.fromCharCode.apply(null, egdealsPBN.deals[0].cards.toString().split(',')))
  console.time('test')
  libdds.CalcAllTablesPBN(egdealsPBN.ref(), 2, [0, 0, 0, 0, 0], egddTablesRes.ref(), egallParRes.ref())
  for (let i = 0; i < cards.length; i++) {
    console.log(_.zip.apply(this, _.chunk(egddTablesRes.results[i].resTable.toString().split(','), 4)))
  }
  //egallParRes.parResults.map(res => console.log(res.parScore.buffer.toString()))
  libdds.SolveAllBoards(egboards.ref(), egsolvedBoards.ref())

  const dbitMapRank = [
    0x0000, 0x0000, 0x0001, 0x0002, 0x0004, 0x0008, 0x0010, 0x0020,
    0x0040, 0x0080, 0x0100, 0x0200, 0x0400, 0x0800, 0x1000, 0x2000
  ]

  const dcardRank = [ 
    'x', 'x', '2', '3', '4', '5', '6', '7',
    '8', '9', 'T', 'J', 'Q', 'K', 'A', '-'
  ]

  const dcardSuit = [ 'S', 'H', 'D', 'C', 'N' ]

  const equals_to_string = (equals: number, res: string) => {
    let m = equals >> 2
    for (let i = 15; i >= 2; i--) {
      if (m & (dbitMapRank[i])) {
        res += dcardRank[i]
      }
    }
    return res
  }

  for (let i = 0; i < cards.length; i++) {
    let board = egsolvedBoards.solvedBoard[i]
    for (let j = 0; j < board.cards; j++) {
      let res = ""
      res = equals_to_string(board.equals[j], res)
      console.log(j, dcardSuit[board.suit[j]],
        dcardRank[board.rank[j]], res,
        board.score[j])
    }
  }
  console.timeEnd('test')  
})