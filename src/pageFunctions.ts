import { Page } from 'puppeteer'
import puppeteer from 'puppeteer-extra'
import parseLin from './lin_parser'
import Stealth from 'puppeteer-extra-plugin-stealth'
import { Cluster } from 'puppeteer-cluster'
import { Board, ContractLevel } from './types'
import { bboDir, ddsDir, bboNumtoDir, ddsContractSuits, ddsSuits, cardRank, pointsToImp } from './constants'
import axios from 'axios'
import axiosRetry from 'axios-retry'
import { getRandom } from 'random-useragent'
import xmlParser from 'xml2json'
import pLimit from 'p-limit'

puppeteer.use(Stealth())

export const newCluster = async (monitoring: boolean) => {
  const cluster = await Cluster.launch({
    concurrency: Cluster.CONCURRENCY_PAGE,
    maxConcurrency: 25,
    retryLimit: 20,
    retryDelay: 2000,
    timeout: 600000,
    puppeteer,
    monitor: monitoring,
    puppeteerOptions: {
      args: ["--disable-setuid-sandbox",
          "--no-sandbox",
          "--disable-dev-shm-usage",
          "--use-gl=egl",
          "--single-process"
      ],
      'ignoreHTTPSErrors': true,
    }
  })
  cluster.on('taskerror', (err, data) => {
    console.log(`Error crawling ${data}: ${err.message}`)
  })
  return cluster
}

export const restartWorker = () => {
  return axios.delete(`https://api.heroku.com/apps/${process.env.HEROKU_APP}/dynos/worker`, {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.heroku+json; version=3',
      'Authorization': `Bearer ${process.env.HEROKU_API_TOKEN}`
    }
  })
}

export const disableImgCss = async (page: Page) => {
  await page.setRequestInterception(true)
  page.on('request', (req) => {
    if(req.resourceType() == 'stylesheet' || req.resourceType() == 'script' || req.resourceType() == 'font' || req.resourceType() === 'image'){
      req.abort()
    }
    else {
      req.continue()
    }
  })
}

export const gotoLink = async (page: Page, link: string) => {
  let response, i = 0
  do {
    await page.setUserAgent(getRandom())
    response = await page.goto(link, { waitUntil: 'networkidle0' })
    if (i > 20) {
      console.log("BBO down")
      restartWorker()
      return
    }
    i++
    if (response === null) {
      console.log("Got null, trying wait.")
      response = await page.waitForResponse(() => true)
    }
    if (!response.ok()) {
      await page.waitForTimeout(1000)
    }
    if (link.includes("mbthands")) {
      await page.waitForTimeout(200)
    }
  } while (!response.ok())
}

export const profilePromise = async ({ page, data: link }: { page: Page, data: string }): Promise<string[]> => {
  await disableImgCss(page)
  await gotoLink(page, link)
  await page.waitForSelector('.bbo_content')
  return await page.$$eval('.body > tbody > .tourney > .traveller > a',
    links => links.map(link => (<HTMLAnchorElement>link).href.replace(/&username=.*/, '')))
}

export const getLin = async (board: Board) => {
  axiosRetry(axios, {
    retries: 3,
    retryDelay: (retryCount) => {
      console.log(`retry attempt: ${retryCount}`)
      return 2000
    },
    retryCondition: (_error) => true
  })
  if (board.lin.includes('popuplin')) {
    board.lin = decodeURIComponent(board.lin.slice(13, -39))
  } else if (board.lin.includes('popup')) {
    axiosRetry(axios, {
      retries: 3,
      retryDelay: (retryCount) => {
        console.log(`retry attempt: ${retryCount}`)
        return 2000
      },
      retryCondition: (_error) => true
    })
    await axios.get(`https://webutil.bridgebase.com/v2/mh_handxml.php?id=${board.lin.slice(12, -39)}`, {
      headers: {
        'user-agent': getRandom()
      }
    }).then(res => {
      board.lin = JSON.parse(xmlParser.toJson(res.data)).lin.$t
    }).catch(err => {
      console.log('BBO down')
      return restartWorker()
    })
  }
}

type parsedLin = {
  hands: string[]
  playerIds: string[]
  vul: string
  competitive: boolean
  lead: string
}

export const DDSolverAPI = (parsedLin: parsedLin, ddApiLimit: pLimit.Limit) => {
  axiosRetry(axios, {
    retries: 3,
    retryDelay: (retryCount) => {
      console.log(`retry attempt: ${retryCount}`)
      return 2000
    },
    retryCondition: (_error) => true
  })
  const url = "https://dds.bridgewebs.com/cgi-bin/bsol2/ddummy?request=m&dealstr=W:" +
    `${parsedLin.hands.join(' ')}&vul=${parsedLin.vul}&sockref=${Date.now()}&uniqueTID=${Date.now()+3}&_=${Date.now()-1000}`
  return ddApiLimit(() => axios.get(url, {
    headers: {
      'user-agent': getRandom()
    }
  }).catch(err => {
    console.log('DD Solver down')
    return restartWorker()
  }))
}

export const getDDSolver = async (parsedLin: parsedLin, board: Board, ddApiLimit: pLimit.Limit) => {
  const res = await DDSolverAPI(parsedLin, ddApiLimit)
  if (board.contract != 'P') {
    board.tricksDiff = board.tricksTaken! -
      parseInt(res!.data.sess.ddtricks[5 * ddsDir[board.contract[2]] + ddsContractSuits[board.contract[1]]], 16)
  }
  board.pointsDiff = board.score -
    parseInt(res!.data.scoreNS.substring(3))
  board.impsDiff = pointsToImp(board.pointsDiff)
  board.optimalPoints = parseInt(res!.data.scoreNS.substring(3))
}

export const getLeadSolver = (parsedLin: parsedLin, board: Board, leadApiLimit: pLimit.Limit) => {
  axiosRetry(axios, {
    retries: 3,
    retryDelay: (retryCount) => {
      console.log(`retry attempt: ${retryCount}`)
      return 2000
    },
    retryCondition: (_error) => true
  })
  const url = "https://dds.bridgewebs.com/cgi-bin/bsol2/ddummy?request=g&dealstr=" +
    `${parsedLin.hands.join(' ')}&trumps=${board.contract[1]}` +
    `&leader=${bboNumtoDir[(bboDir[board.contract[2]] + 1) % 4]}` +
    `&requesttoken=${Date.now()}&uniqueTID=${Date.now()+3}`
  return leadApiLimit(() => axios.get(url, {
      headers: {
        'user-agent': getRandom()
      }
    }).then(res => {
      board.leadCost = 13 - (<any[]>res.data.sess.cards).filter(set => set.values[ddsSuits[parsedLin.lead[0]]].includes(cardRank[parsedLin.lead[1]]))[0].score -
        board.tricksTaken! + board.tricksDiff!
    }).catch(err => {
      console.log('DD Solver down')
      return restartWorker()
    }))
}

export const getDDData = async (boards: Board[], fromTraveller: boolean, ddApiLimit: pLimit.Limit, leadApiLimit: pLimit.Limit) => {
  if (fromTraveller && boards.length > 0) {
    let parsedLin = parseLin(boards[0].lin)!
    await getDDSolver(parsedLin, boards[0], ddApiLimit)
    var tricksDiff = boards[0].tricksDiff
    var pointsDiff = boards[0].pointsDiff
    var impsDiff = boards[0].impsDiff
    var optimalPoints = boards[0].optimalPoints
  }
  await Promise.all(boards.map(async board => {
    let parsedLin = parseLin(board.lin)!
    board.playerIds = parsedLin.playerIds
    board.competitive = parsedLin.competitive
    if (board.contract != 'P') {
      board.declarer = board.playerIds[bboDir[board.contract[2]]]
      switch (board.contract[1]) {
        case 'H':
        case 'S':
          if (parseInt(board.contract[0]) == 7) {
            board.contractLevel = ContractLevel.GRANDSLAM
          } else if (parseInt(board.contract[0]) == 6) {
            board.contractLevel = ContractLevel.SLAM
          } else if (parseInt(board.contract[0]) >= 4) {
            board.contractLevel = ContractLevel.GAME
          } else {
            board.contractLevel = ContractLevel.PARTIAL
          }
          break
        case 'C':
        case 'D':
          if (parseInt(board.contract[0]) == 7) {
            board.contractLevel = ContractLevel.GRANDSLAM
          } else if (parseInt(board.contract[0]) == 6) {
            board.contractLevel = ContractLevel.SLAM
          } else if (parseInt(board.contract[0]) == 5) {
            board.contractLevel = ContractLevel.GAME
          } else {
            board.contractLevel = ContractLevel.PARTIAL
          }
          break
        case 'N':
          if (parseInt(board.contract[0]) == 7) {
            board.contractLevel = ContractLevel.GRANDSLAM
          } else if (parseInt(board.contract[0]) == 6) {
            board.contractLevel = ContractLevel.SLAM
          } else if (parseInt(board.contract[0]) >= 3) {
            board.contractLevel = ContractLevel.GAME
          } else {
            board.contractLevel = ContractLevel.PARTIAL
          }
          break
      }
      await getLeadSolver(parsedLin, board, leadApiLimit)
    } else {
      board.contractLevel = ContractLevel.PASSOUT
    }
    if (!fromTraveller) {
      await getDDSolver(parsedLin, board, ddApiLimit)
    } else {
      board.tricksDiff = tricksDiff
      board.pointsDiff = pointsDiff
      board.impsDiff = impsDiff
      board.optimalPoints = optimalPoints
    }
  }))
  return boards
}