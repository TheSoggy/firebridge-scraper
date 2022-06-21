import ffi from 'ffi-napi'
import ref  from 'ref-napi'
import StructType from 'ref-struct-napi'
import ArrayType from "ref-array-napi"
import _ from 'lodash'
import path from 'path'

const ddTableDealPBN = StructType({
  cards: ArrayType('char', 80)
})

const ddTableDealsPBN = StructType({
  noOfTables: 'int',
  deals: ArrayType(ddTableDealPBN, 160)
})
const ddTableDealsPBNPtr = ref.refType(ddTableDealsPBN)

const ddTableResults = StructType({
  resTable: ArrayType('int', 20)
})

const ddTablesRes = StructType({
  noOfBoards: 'int',
  results: ArrayType(ddTableResults, 160)
})
const ddTablesResPtr = ref.refType(ddTablesRes)

const parResults = StructType({
  parScore: ArrayType('char', 32),
  parContractsString: ArrayType('char', 256)
})

const allParResults = StructType({
  parResults: ArrayType(parResults, 160)
})
const allParResultsPtr = ref.refType(allParResults)

const dealPBN = StructType({
  trump: 'int',
  first: 'int',
  currentTrickSuit: ArrayType('int', 3),
  currentTrickRank: ArrayType('int', 3),
  remainCards: ArrayType('char', 80)
})

const boardsPBN = StructType({
  noOfBoards: 'int',
  deals: ArrayType(dealPBN, 200),
  target: ArrayType('int', 200),
  solutions: ArrayType('int', 200),
  mode: ArrayType('int', 200)
})
const boardsPBNPtr = ref.refType(boardsPBN)

const futureTricks = StructType({
  nodes: 'int',
  cards: 'int',
  suit: ArrayType('int', 13),
  rank: ArrayType('int', 13),
  equals: ArrayType('int', 13),
  score: ArrayType('int', 13)
})

const solvedBoards = StructType({
  noOfBoards: 'int',
  solvedBoard: ArrayType(futureTricks, 200)
})
const solvedBoardsPtr = ref.refType(solvedBoards)

type boardData = {
  ddTricks: number[][],
  score: number
}

type leadData = {
  score: number,
  values: number[][]
}

type leadInfo = {
  hands: string
  leader: number
  trump: number
}

let libdds = ffi.Library(path.join(process.cwd(), process.platform === "win32" ? 'libdds/src/dds.dll' : 'libdds/src/libdds.so'), {
  'CalcAllTablesPBN': [ 'int', [ ddTableDealsPBNPtr, 'int', ArrayType('int'), ddTablesResPtr, allParResultsPtr ] ],
  'SolveAllBoards': [ 'int', [ boardsPBNPtr, solvedBoardsPtr ] ]
})

export default (solveDD?: string[][], solveLead?: leadInfo[]) => {

  let res: {leadData?: leadData[][], ddData?: boardData[][]} = {}

  if (solveDD) {
    res.ddData = [[], [], [], []]
    for (let i = 0; i < 4; i++) {
      let dealPBNs = []
      let ddRes = []
      let chunkedBoards = _.chunk(solveDD[i], 32) as string[][]
      for (let j = 0; j < chunkedBoards.length; j++) {
        for (let hand of chunkedBoards[j]) {
          dealPBNs.push(new ddTableDealPBN({
            cards: hand.split('')
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
            ddTricks: _.zip(..._.chunk(ddAllRes.results[k].resTable.toString().split(',').map(Number), 4)) as number[][],
            score: parseInt(allParRes.parResults[k].parScore.buffer.toString().replace(/EW.+/g, '').substring(3))
          })
        }
      }
    }
  }

  if (solveLead) {
    res.leadData = []
    let deals = []
    let chunkedBoards = _.chunk(solveLead, 200) as leadInfo[][]
    for (let i = 0; i < chunkedBoards.length; i++) {
      for (let {trump, leader, hands} of chunkedBoards[i]) {
        deals.push(new dealPBN({
          trump: trump,
          first: leader, // player on lead
          currentTrickSuit: [0, 0, 0],
          currentTrickRank: [0, 0, 0],
          remainCards: hands.split('')
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

      const convertToNum = (equals: number) => {
        let m = equals >> 2
        let res: number[] = []
        for (let i = 15; i >= 2; i--) {
          if (m & (dbitMapRank[i])) {
            res.push(i - 2)
          }
        }
        return res
      }
      libdds.SolveAllBoards(boardsObj.ref(), solvedBoardsObj.ref())
      for (let i = 0; i < deals.length; i++) {
        const cards: leadData[] = []
        let board = solvedBoardsObj.solvedBoard[i]
        for (let j = 0; j < board.cards; j++) {
          let sameValues: number[] = convertToNum(board.equals[j])
          if (cards.length == 0 || cards[cards.length - 1].score != board.score[j]) {
            cards.push({
              score: board.score[j],
              values: [[], [], [], []]
            })
          }
          cards[cards.length - 1].values[board.suit[j]].push(board.rank[j] - 2)
          sameValues.forEach(card => {
            cards[cards.length - 1].values[board.suit[j]].push(card)
          })
        }
        res.leadData.push(cards)
      }
    }
  }
  return res
}