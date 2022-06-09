export enum ContractLevel {
  PASSOUT = 0,
  PARTIAL = 1,
  GAME = 2,
  SLAM = 3,
  GRANDSLAM = 4
}
export type Board = {
  contract: string
  score: number
  lin: string
  contractLevel?: ContractLevel
  tricksOverContract: number
  optimalPoints?: number
  leadCost: number
  tricksDiff: number
  pointsDiff?: number
  tricksTaken: number
  playerIds?: string[]
  competitive: boolean
  declarer: string
}
export enum dealType {
  PASSOUT = 0,
  LEAD = 1,
  DUMMY = 2,
  DEFENCE = 3,
  DECLARING = 4
}