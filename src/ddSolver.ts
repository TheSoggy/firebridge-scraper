import ffi from 'ffi-napi'
import ref  from 'ref-napi'
import StructType from 'ref-struct-napi'
import ArrayType from "ref-array-napi"
import _ from 'lodash'
import path from 'path'
import { parentPort } from 'worker_threads'

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

parentPort!.on('message', workerData => {
  
  type boardData = {
    ddTricks: number[][],
    score: string
  }

  type leadData = {
    score: number,
    values: number[][]
  }

  let res: {leadData?: leadData[][], ddData?: boardData[][]} = {}

  if (workerData.solveDD) {
    res.ddData = [[], [], [], []]
    for (let i = 0; i < 4; i++) {
      let dealPBNs = []
      let ddRes = []
      let chunkedBoards = _.chunk(workerData.solveDD[i], 32) as string[][]
      for (let j = 0; j < chunkedBoards.length; j++) {
        for (let k = 0; k < chunkedBoards[j].length; k++) {
          dealPBNs.push(new ddTableDealPBN({
            cards: chunkedBoards[j][k].split('')
          }))
          ddRes.push(new ddTableResults({
            resTable: []
          }))
        }
          
        let dealsPBNobj = new ddTableDealsPBN({
          noOfTables: dealPBNs.length,
          deals: dealPBNs
        })


        let ddAllRes = new ddTablesRes({
          noOfBoards: ddRes.length,
          results: ddRes
        })

        
        let allParRes = new allParResults({
          parResults: []
        })

        libdds.CalcAllTablesPBN(dealsPBNobj.ref(), i, [0, 0, 0, 0, 0], ddAllRes.ref(), allParRes.ref())
        
        for (let k = 0; k < dealPBNs.length; k++) {
          res.ddData[i].push({
            ddTricks: _.zip.apply(this, _.chunk(ddAllRes.results[k].resTable.toString().split(',').map(Number), 4)) as number[][],
            score: allParRes.parResults[k].parScore.buffer.toString()
          })
        }
      }
    }
  }

  if (workerData.solveLead) {
    type leadInfo = {
      hands: string
      leader: number
      trump: number
    }
    res.leadData = []
    let deals = []
    let chunkedBoards = _.chunk(workerData.solveLead, 200) as leadInfo[][]
    for (let i = 0; i < chunkedBoards.length; i++) {
      for (let board of chunkedBoards[i]) {
        deals.push(new dealPBN({
          trump: board.trump,
          first: board.leader, // player on lead
          currentTrickSuit: [0, 0, 0],
          currentTrickRank: [0, 0, 0],
          remainCards: board.hands.split('')
        }))
      }

      let boardsObj = new boardsPBN({
        noOfBoards: deals.length,
        deals: deals,
        target: new Array(deals.length).fill(-1),
        solutions: new Array(deals.length).fill(3),
        mode: new Array(deals.length).fill(0)
      })

      let solvedBoardsObj = new solvedBoards({
        noOfBoards: deals.length,
        solvedBoard: []
      })

      const dbitMapRank = [
        0x0000, 0x0000, 0x0001, 0x0002, 0x0004, 0x0008, 0x0010, 0x0020,
        0x0040, 0x0080, 0x0100, 0x0200, 0x0400, 0x0800, 0x1000, 0x2000
      ]

      const equals_to_string = (equals: number, res: number[]) => {
        let m = equals >> 2
        for (let i = 15; i >= 2; i--) {
          if (m & (dbitMapRank[i])) {
            res.push(i - 2)
          }
        }
      }
      libdds.SolveAllBoards(boardsObj.ref(), solvedBoardsObj.ref())
      for (let i = 0; i < deals.length; i++) {
        const cards: leadData[] = []
        let board = solvedBoardsObj.solvedBoard[i]
        for (let j = 0; j < board.cards; j++) {
          let res: number[] = []
          equals_to_string(board.equals[j], res)
          if (cards[cards.length - 1].score != board.score[j]) {
            cards.push({
              score: board.score[j],
              values: [[], [], [], []]
            })
          }
          cards[cards.length - 1].values[board.suit[j]].push(board.rank[j] - 2)
          if (res.length > 0) {
            res.forEach(card => {
              cards[cards.length - 1].values[board.suit[j]].push(card)
            })
          }
        }
        res.leadData.push(cards)
      }
    }
  }
  
  parentPort!.postMessage(res)
})