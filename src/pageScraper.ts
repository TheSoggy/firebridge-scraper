import 'dotenv/config'
import parseLin from './lin_parser'
import axios, { AxiosError } from 'axios'
import { Page } from 'puppeteer'
import puppeteer from 'puppeteer-extra'
import Stealth from 'puppeteer-extra-plugin-stealth'
import { Cluster } from 'puppeteer-cluster'
import { Board, ContractLevel } from './types'
import xmlParser from 'xml2json'
import * as fs from 'fs'
import axiosRetry from 'axios-retry'
import _ from 'lodash'
import insert from './astraDB'
import { bboDir, ddsDir, bboNumtoDir, ddsContractSuits, ddsSuits, suitSymbols, cardRank } from './constants'
import { disableImgCss, gotoLink, profilePromise } from './pageFunctions'

const scraperObject = {
	url: 'https://webutil.bridgebase.com/v2/tarchive.php?m=all&d=All%20Tourneys',
  login: 'https://www.bridgebase.com/myhands/myhands_login.php?t=%2Fmyhands%2Findex.php%3F',
	async scrape() {
    puppeteer.use(Stealth())
    const stream = fs.createWriteStream("test19.txt", {flags:'a'})
    axiosRetry(axios, { retryDelay: (retryCount) => {
      console.log(`retry attempt: ${retryCount}`)
      return retryCount * 2000 // time interval between retries
    }})
    const cluster = await Cluster.launch({
      concurrency: Cluster.CONCURRENCY_PAGE,
      maxConcurrency: 32,
      retryLimit: 20,
      retryDelay: 2000,
      timeout: 6000000,
      puppeteer,
      monitor: true,
      puppeteerOptions: {
        args: ["--disable-setuid-sandbox",
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--use-gl=egl",
        ],
        'ignoreHTTPSErrors': true,
      }
    })
    cluster.on('taskerror', (err, data) => {
      console.log(`Error crawling ${data}: ${err.message}`)
    })
    // Scraping process
    // Getting all tourneys
    var urls: string[] = await cluster.execute(this.url, async ({ page, data: url }) => {
      await disableImgCss(page)
      await page.goto(url, { waitUntil: 'networkidle0' })
      await page.waitForSelector('#tourneys')
      return await page.$$eval('#tourneys > center > table > tbody > tr > td > a.ldr',
        links => links.map(link => (<HTMLAnchorElement>link).href))
    })
    await cluster.execute(this.login, async ({ page, data: url }) => {
      await disableImgCss(page)
      await page.goto(url, { waitUntil: 'domcontentloaded' })
      await page.type('#username', process.env.BBO_USERNAME!)
      await page.type('#password', process.env.BBO_PASSWORD!)
      await Promise.all([
        page.evaluate(() => {
          (<HTMLAnchorElement>document.querySelector('input[type=submit]')).click();
        }),
        page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
      ])
    })
    // Scraping data from individual tourneys
    const travellerPromise = async ({ page, data: link }: { page: Page, data: string }): Promise<Board[]> => {
      await disableImgCss(page)
      let boards: Board[] = []
      await gotoLink(page, link)
      await page.waitForSelector('.bbo_content')
      page.on('console', message =>
        console.log(`${message.type().substring(0, 3).toUpperCase()} ${message.text()}`))
      boards = await page.$$eval('.body > tbody > .tourney',
        (rows, suits: any) => rows.map(row => {
          let board: Board = {
            contract: '',
            score: 0,
            lin: '',
            tricksOverContract: 0,
            leadCost: 0,
            tricksDiff: 0,
            tricksTaken: 0,
            competitive: false,
            declarer: ''
          }
          let contract = row.querySelector('td.result')!.textContent!
          board.contract = contract.replace(/[♣♦♥♠]/, match => suits[match])!.replace(/[+\-=]+.*/, '')!
          if (contract == 'PASS') board.contract = 'P'
          if (!/^[P1-7]/.test(contract)) {
            return board
          }
          if (/[+\-=]+.*/.test(contract)) {
            switch (contract.match(/[+\-=]+.*/)![0][0]) {
              case '+':
                board.tricksOverContract = parseInt(contract.match(/[+\-=]+.*/)![0])
                board.tricksTaken = parseInt(contract[0]) + 6 + board.tricksOverContract
                break
              case '-':
                board.tricksOverContract = parseInt(contract.match(/[+\-=]+.*/)![0])
                board.tricksTaken = parseInt(contract[0]) + 6 + board.tricksOverContract
                break
              case '=':
                board.tricksTaken = parseInt(contract[0]) + 6
                break
            }
          }
          board.score = parseInt(row.querySelector('td.score,td.negscore')!.textContent!)
          board.lin = row.querySelector('td.movie > a[onclick]')!.getAttribute('onclick')!
          return board
        }).filter(board => board.lin.length > 0), suitSymbols)
      await Promise.all(boards.map(async board => {
        if (board.lin.includes('popuplin')) {
          board.lin = decodeURIComponent(board.lin.slice(13, -39))
        } else if (board.lin.includes('popup')) {
          await axios.get(`https://webutil.bridgebase.com/v2/mh_handxml.php?id=${board.lin.slice(12, -39)}`)
          .then(res => {
            board.lin = JSON.parse(xmlParser.toJson(res.data)).lin.$t
          }).catch(err => {
            axios.delete(`https://api.heroku.com/apps/${process.env.HEROKU_APP}/dynos/worker`, {
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.heroku+json; version=3',
                'Authorization': `Bearer ${process.env.HEROKU_API_TOKEN}`
              }
            })
          })
        }
      }))
      if (boards.length == 0 || !boards) return boards
      let boardInfo = parseLin(boards[0].lin)!
      let getDDSolver = async () => {
        try {
          const res = await axios.get("https://dds.bridgewebs.com/cgi-bin/bsol2/ddummy?request=m&dealstr=W:" +
            `${boardInfo.hands.join(' ')}&vul=${boardInfo.vul}&sockref=${Date.now()}&uniqueTID=${Date.now()}&_=${Date.now()}`)
          boards.forEach(board => {
            if (board.contract != 'P') {
                board.tricksDiff = board.tricksTaken! -
                    parseInt(res.data.sess.ddtricks[5 * ddsDir[board.contract[2]] + ddsContractSuits[board.contract[1]]], 16)
            }
            board.pointsDiff = board.score -
                parseInt(res.data.scoreNS.substring(3))
            board.optimalPoints = parseInt(res.data.scoreNS.substring(3))
          })
        } catch (err) {
          axios.delete(`https://api.heroku.com/apps/${process.env.HEROKU_APP}/dynos/worker`, {
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/vnd.heroku+json; version=3',
              'Authorization': `Bearer ${process.env.HEROKU_API_TOKEN}`
            }
          })
        }
      }
      await getDDSolver()
      await Promise.all(boards.map(async board => {
        let parsedLin = parseLin(board.lin)!
        if (!parsedLin) {
          console.log(link)
          console.log(board.lin)
        }
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
          let getLeadSolver = async () => {
            try {
              const res = await axios.get("https://dds.bridgewebs.com/cgi-bin/bsol2/ddummy?request=g&dealstr=" +
                `${parsedLin.hands.join(' ')}&trumps=${board.contract[1]}` +
                `&leader=${bboNumtoDir[(bboDir[board.contract[2]] + 1) % 4]}` +
                `&requesttoken=${Date.now()}&uniqueTID=${Date.now()}`)
              board.leadCost = 13 - (<any[]>res.data.sess.cards).filter(set => set.values[ddsSuits[parsedLin.lead[0]]].includes(cardRank[parsedLin.lead[1]]))[0].score -
                board.tricksTaken! + board.tricksDiff!
            } catch (err) {
              axios.delete(`https://api.heroku.com/apps/${process.env.HEROKU_APP}/dynos/worker`, {
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/vnd.heroku+json; version=3',
                  'Authorization': `Bearer ${process.env.HEROKU_API_TOKEN}`
                }
              })
            }
          }
          await getLeadSolver()
        } else {
          board.contractLevel = ContractLevel.PASSOUT
        }
      }))
			return boards
		}
    const boardsPromise = async ({ page, data: link }: { page: Page, data: string }) => {
      await disableImgCss(page)
      let dataObj: {
        'firstPair': string,
        'boards': Board[]
      } = {'firstPair': '', 'boards': []}
      await gotoLink(page, link)
      dataObj.firstPair = await page.evaluate(() => {
        const link = document.querySelector('.onesection > .sectiontable > tbody > tr > td > a')
        if (link) {
          return (<HTMLAnchorElement>link).href
        } else return ''
      })
      dataObj.boards = await page.$$eval('table.handrecords > tbody > tr > td > a', 
        links => links.map(link => {
          let result: Board = {
            contract: '',
            score: 0,
            lin: '',
            tricksOverContract: 0,
            leadCost: 0,
            tricksDiff: 0,
            tricksTaken: 0,
            competitive: false,
            declarer: ''
          }
          let htmllink = (<HTMLAnchorElement>link)
          result.lin = decodeURIComponent(htmllink.href.slice(59))
          if (result.lin.length == 0) return result
          result.contract = htmllink.text.replace(/[+\-=]+.*/, '')
          if (result.contract == 'PASS') result.contract = 'P'
          if (result.contract != 'P' && /[+\-=]+.*/.test(htmllink.text)) {
            switch (htmllink.text.match(/[+\-=]+.*/)![0][0]) {
              case '+':
                result.tricksOverContract = parseInt(htmllink.text.match(/[+\-=]+.*/)![0])
                result.tricksTaken = parseInt(htmllink.text[0]) + 6 + result.tricksOverContract
                break
              case '-':
                result.tricksOverContract = parseInt(htmllink.text.match(/[+\-=]+.*/)![0])
                result.tricksTaken = parseInt(htmllink.text[0]) + 6 + result.tricksOverContract
                break
              case '=':
                result.tricksTaken = parseInt(htmllink.text[0]) + 6
                break
            }
          }
          return result
      }).filter(board => board.lin.length > 0))
      await page.$$eval('table.handrecords > tbody > tr > td.resultcell + td',
        cells => cells.map(cell => (<HTMLTableCellElement>cell).textContent!)
        .filter(text => text.length > 0))
        .then(cells => cells
          .forEach((cell, idx) => {
            dataObj.boards[idx].score = parseInt(cell)
          }))
      await Promise.all(dataObj.boards.map(async board => {
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
        } else {
          board.contractLevel = ContractLevel.PASSOUT
        }
        let getDDSolver = async () => {
          try {
            const res = await axios.get("https://dds.bridgewebs.com/cgi-bin/bsol2/ddummy?request=m&dealstr=W:" +
              `${parsedLin.hands.join(' ')}&vul=${parsedLin.vul}&sockref=${Date.now()}&uniqueTID=${Date.now()}&_=${Date.now()}`)
            if (board.contract != 'P') {
              board.tricksDiff = board.tricksTaken! -
                parseInt(res.data.sess.ddtricks[5 * ddsDir[board.contract[2]] + ddsContractSuits[board.contract[1]]], 16)
            }
            board.pointsDiff = board.score -
              parseInt(res.data.scoreNS.substring(3))
            board.optimalPoints = parseInt(res.data.scoreNS.substring(3))
          } catch (err) {
            axios.delete(`https://api.heroku.com/apps/${process.env.HEROKU_APP}/dynos/worker`, {
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.heroku+json; version=3',
                'Authorization': `Bearer ${process.env.HEROKU_API_TOKEN}`
              }
            })
          }
        }
        let getLeadSolver = async () => {
          try {
            const res = await axios.get("https://dds.bridgewebs.com/cgi-bin/bsol2/ddummy?request=g&dealstr=" +
              `${parsedLin.hands.join(' ')}&trumps=${board.contract[1]}` +
              `&leader=${bboNumtoDir[(bboDir[board.contract[2]] + 1) % 4]}` +
              `&requesttoken=${Date.now()}&uniqueTID=${Date.now()}`)
            board.leadCost = 13 - (<any[]>res.data.sess.cards).filter(set => set.values[ddsSuits[parsedLin.lead[0]]].includes(cardRank[parsedLin.lead[1]]))[0].score -
              board.tricksTaken! + board.tricksDiff!
          } catch (err) {
            axios.delete(`https://api.heroku.com/apps/${process.env.HEROKU_APP}/dynos/worker`, {
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.heroku+json; version=3',
                'Authorization': `Bearer ${process.env.HEROKU_API_TOKEN}`
              }
            })
          }
        }
        await getDDSolver()
        if (board.contract != 'P') {
          await getLeadSolver()
        }
      }))            
      if (dataObj.firstPair) {
        if (dataObj.firstPair.includes('mbthands')) {
          let people = await page.$$eval('.onesection > .sectiontable > tbody > tr > td > a',
            links => links.map(link => 
              (<HTMLAnchorElement>link).href
          ))
          for (let i = 0; i < people.length; i++) {
            let boardData = await cluster.execute(people[i], travellerPromise)
            dataObj.boards.push.apply(dataObj.boards, boardData)
          }
        } else {
          let travellerData: string[] = await cluster.execute(dataObj.firstPair, profilePromise)
          if (travellerData.length == 0) return
          for (let i = 0; i < travellerData.length; i++) {
            let boardData = await cluster.execute(travellerData[i], travellerPromise)
            dataObj.boards.push.apply(dataObj.boards, boardData)
          }
        }
      }
      if (dataObj.boards.length > 0) {
        insert(dataObj.boards)
      } else {
        console.log(`${++failures} no data`)
      }
    }
    console.log(urls.length)
    _.reverse(urls)
    if (process.env.LAST_TOURNEY_URL != '') {
      let idx = _.indexOf(urls, process.env.LAST_TOURNEY_URL)
      if (idx != -1) {
        urls = _.drop(urls, idx + 1)
      }
    }
    let failures = 0
    let chunkedUrls = _.chunk(urls, 125)
    for (let chunk of chunkedUrls) {
      chunk.forEach(url => cluster.queue(url, boardsPromise))
      await cluster.idle()
      await axios.patch(`https://api.heroku.com/apps/${process.env.HEROKU_APP}/config-vars/`, {
        'LAST_TOURNEY_URL': chunk[chunk.length - 1]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.heroku+json; version=3',
          'Authorization': `Bearer ${process.env.HEROKU_API_TOKEN}`
        }
      })
    }
    await cluster.close()
	}
}

export default scraperObject