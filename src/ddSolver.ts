import ffi from 'ffi-napi'
import ref  from 'ref-napi'
import StructType from 'ref-struct-napi'
import ArrayType from "ref-array-napi"
import _ from 'lodash'
import path from 'path'

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

var deal = StructType({
  trump: 'int',
  first: 'int',
  currentTrickSuit: ArrayType('int', 3),
  currentTrickRank: ArrayType('int', 3),
  remainCards: ArrayType(ref.types.uint, 16)
})

var boards = StructType({
  noOfBoards: 'int',
  deal: ArrayType(deal, 200),
  target: ArrayType('int', 200),
  solutions: ArrayType('int', 200),
  mode: ArrayType('int', 200)
})
var boardsPtr = ref.refType(boards)

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
  'CalcAllTablesPBN': [ 'void', [ ddTableDealsPBNPtr, 'int', ArrayType('int'), ddTablesResPtr, allParResultsPtr ] ],
  'SolveAllBoards': [ 'void', [ boardsPtr, solvedBoardsPtr ] ]
})

let cards = "W:T753.KQ832.K.AQ2 AK42.J7.JT542.64 8.T954.9873.T953 QJ96.A6.AQ6.KJ87"

let egdealPBN = new ddTableDealPBN({
  cards: cards.split('')
})

let egdealsPBN = new ddTableDealsPBN({
  noOfTables: 1,
  deals: [egdealPBN]
})

let egddTableResults = new ddTableResults({
  resTable: []
})

let egddTablesRes = new ddTablesRes({
  noOfBoards: 1,
  results: [egddTableResults]
})

let egparResults = new parResults({
  parScore: [],
  parContractsString: []
})

let egallParRes = new allParResults({
  parResults: [egparResults]
})

let egsolvedBoards = new solvedBoards({
  noOfBoards: 1
})

console.log(String.fromCharCode.apply(null, egdealsPBN.deals[0].cards.toString().split(',')))
console.time('test')
libdds.CalcAllTablesPBN.async(egdealsPBN.ref(), 2, [0, 0, 0, 0, 0], egddTablesRes.ref(), egallParRes.ref(), (err, res) => {
  console.log(_.chunk(egddTablesRes.results[0].resTable.toString().split(','), 4))
  console.log(egallParRes.parResults[0].parScore.buffer.toString())
  console.timeEnd('test')
})