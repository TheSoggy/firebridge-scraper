import { Board } from './types'
import { suitSymbols } from './constants'
export const processBoard = (board: Board, contractStr: string) => {
  contractStr = contractStr.toUpperCase()
  if (!/^[P1-7]/.test(contractStr)) {
    return null
  }
  board.contract = contractStr.replace(/[♣♦♥♠]/, match => suitSymbols[match]).replace(/[+\-=]+.*/, '')
  if ('X' == board.contract[2]) {
    board.contract = board.contract.substring(0, 2) + board.contract[board.contract.length - 1]
      + board.contract.substring(2, board.contract.length - 1)
  }
  if (contractStr == 'PASS') board.contract = 'P'
  if (/[+\-=]+.*/.test(contractStr)) {
    switch (contractStr.match(/[+\-=]+.*/)![0][0]) {
      case '+':
        board.tricksOverContract = parseInt(contractStr.match(/[+\-=]+.*/)![0])
        board.tricksTaken = parseInt(contractStr[0]) + 6 + board.tricksOverContract
        break
      case '-':
        board.tricksOverContract = parseInt(contractStr.match(/[+\-=]+.*/)![0])
        board.tricksTaken = parseInt(contractStr[0]) + 6 + board.tricksOverContract
        break
      case '=':
        board.tricksTaken = parseInt(contractStr[0]) + 6
        break
    }
  }
  return board
}

export const handleRejection = (p: Promise<any>) => {
  return p.catch(err=>{
    console.log(err)
    return err
  })
}

export const numToString = (num: number): string => {
  return (num < 0 ? "" : "+") + num
}