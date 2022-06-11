export const bboDir: {[key: string]: number} = {
  'S': 0,
  'W': 1,
  'N': 2,
  'E': 3,
}
export const ddsDir: {[key: string]: number} = {
  'N': 0,
  'S': 1,
  'E': 2,
  'W': 3,
}
export const bboNumtoDir = ['S', 'W', 'N', 'E']
export const ddsContractSuits: {[key: string]: number} = {
  'N': 0,
  'S': 1,
  'H': 2,
  'D': 3,
  'C': 4,
}
export const ddsSuits: {[key: string]: number} = {
  'S': 0,
  'H': 1,
  'D': 2,
  'C': 3,
}
export const suitSymbols: {[key: string]: string} = {
  '♣': 'C',
  '♦': 'D',
  '♥': 'H',
  '♠': 'S',
} 
export const cardRank: {[key: string]: number} = {
  '2': 0,
  '3': 1,
  '4': 2,
  '5': 3,
  '6': 4,
  '7': 5,
  '8': 6,
  '9': 7,
  'T': 8,
  'J': 9,
  'Q': 10,
  'K': 11,
  'A': 12,
}
export const pointsToImp = (points: number) => {
  let absPts = Math.abs(points)
  if (absPts >= 4000) return 24*points/absPts
  else if (absPts >= 3500) return 23*points/absPts
  else if (absPts >= 3000) return 22*points/absPts
  else if (absPts >= 2500) return 21*points/absPts
  else if (absPts >= 2250) return 20*points/absPts
  else if (absPts >= 2000) return 19*points/absPts
  else if (absPts >= 1750) return 18*points/absPts
  else if (absPts >= 1500) return 17*points/absPts
  else if (absPts >= 1300) return 16*points/absPts
  else if (absPts >= 1100) return 15*points/absPts
  else if (absPts >= 900) return 14*points/absPts
  else if (absPts >= 750) return 13*points/absPts
  else if (absPts >= 600) return 12*points/absPts
  else if (absPts >= 500) return 11*points/absPts
  else if (absPts >= 430) return 10*points/absPts
  else if (absPts >= 370) return 9*points/absPts
  else if (absPts >= 320) return 8*points/absPts
  else if (absPts >= 270) return 7*points/absPts
  else if (absPts >= 220) return 6*points/absPts
  else if (absPts >= 170) return 5*points/absPts
  else if (absPts >= 130) return 4*points/absPts
  else if (absPts >= 90) return 3*points/absPts
  else if (absPts >= 50) return 2*points/absPts
  else if (absPts >= 20) return 1*points/absPts
  else return 0
}