import 'dotenv/config'
import axios from 'axios'
import { Page } from 'puppeteer'
import { StargateClient, StargateBearerToken, promisifyStargateClient } from "@stargate-oss/stargate-grpc-node-client";
import { Board } from './types'
import * as grpc from "@grpc/grpc-js";
import axiosRetry from 'axios-retry'
import _ from 'lodash'
import insert from './astraDB'
import parseLin from './lin_parser'
import { disableImgCss, gotoLink, profilePromise, newCluster, getLin, getDDData } from './pageFunctions'
import { processBoard } from './utils'
import { StaticPool } from 'node-worker-threads-pool'
import { Cluster } from 'ioredis'

const scraperObject = {
	url: 'https://webutil.bridgebase.com/v2/tarchive.php?m=all&d=All%20Tourneys',
  login: 'https://www.bridgebase.com/myhands/myhands_login.php?t=%2Fmyhands%2Findex.php%3F',
	async scrape() {
    axiosRetry(axios, {
      retries: 3,
      retryDelay: (retryCount) => {
        console.log(`retry attempt: ${retryCount}`)
        return 2000
      },
      retryCondition: (_error) => true
    })
    const pool = new StaticPool({
      size: 4,
      task: './build/ddSolver.js',
    })
    const cluster = await newCluster(false)
    // Scraping process
    // Getting all tourneys
    var urls: string[] = await cluster.execute(this.url, async ({ page, data: url }) => {
      await disableImgCss(page)
      await gotoLink(page, url)
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
        (rows, link) => (rows.map(row => {
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
          try {
            board.contract = row.querySelector('td.result')!.textContent!
            board.score = parseInt(row.querySelector('td.score,td.negscore')!.textContent!)
            board.lin = row.querySelector('td.movie > a[onclick]')!.getAttribute('onclick')!
          } catch (err) {
            console.log(link)
          }
          return board
        }) || []), link)
      boards.forEach(board => processBoard(board, board.contract))
      await Promise.all(boards.map(async board => getLin(board)))
      boards = boards.filter(board => parseLin(board.lin))
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
      dataObj.boards = (await page.$$eval('table.handrecords > tbody > tr > td > a', 
        links => (links.map(link => {
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
          result.contract = htmllink.text
          return result
      }) || []))).filter(board => parseLin(board.lin))
      dataObj.boards.forEach(board => processBoard(board, board.contract))
      await page.$$eval('table.handrecords > tbody > tr > td.resultcell + td',
        cells => (cells.map(cell => (<HTMLTableCellElement>cell).textContent!) || [])
        .filter(text => text.length > 0))
        .then(cells => cells
          .forEach((cell, idx) => {
            dataObj.boards[idx].score = parseInt(cell)
          }))
      if (dataObj.firstPair) {
        if (dataObj.firstPair.includes('mbthands')) {
          let people = await page.$$eval('.onesection > .sectiontable > tbody > tr > td > a',
            links => links.map(link => 
              (<HTMLAnchorElement>link).href
          ))
          Promise.all(people.map(async person => {
            cluster.execute(person, travellerPromise).then(res => {
              if (res.length > 0) {
                DDPromises.push(getDDData(res, false, pool)
                  .then(updatedResult => {
                    console.log(JSON.stringify(updatedResult[0]))
                    //insert(updatedResult, promisifiedClient)
                  })
                )
              } else {
                console.log(`${++failures} no data`)
              }
            })
          }))
        } else {
          cluster.execute(dataObj.firstPair, profilePromise).then((travellerData: string[]) => {
            if (travellerData.length == 0) return
            Promise.all(travellerData.map(async traveller => {
              cluster.execute(traveller, travellerPromise).then(res => {
                if (res.length > 0) {
                  DDPromises.push(getDDData(res, true, pool)
                    .then(updatedResult => {
                      console.log(JSON.stringify(updatedResult[0]))
                      //insert(updatedResult, promisifiedClient)
                    })
                  )
                } else {
                  console.log(`${++failures} no data`)
                }
              })
            }))
          })
        }
      }
      return dataObj.boards
    }
    _.reverse(urls)
    if (process.env.LAST_TOURNEY_URL != '') {
      let idx = _.indexOf(urls, process.env.LAST_TOURNEY_URL)
      if (idx != -1) {
        urls = _.drop(urls, idx + 1)
      }
    }
    let failures = 0
    let chunkedUrls = _.chunk(urls, 50)
    const bearerToken = new StargateBearerToken(process.env.ASTRA_TOKEN!)
    const credentials = grpc.credentials.combineChannelCredentials(
      grpc.credentials.createSsl(), bearerToken)
    const stargateClient = new StargateClient(process.env.ASTRA_GRPC_ENDPOINT!, credentials)
    const promisifiedClient = promisifyStargateClient(stargateClient)
    for (let chunk of chunkedUrls) {
      var DDPromises: Promise<void>[] = []
      chunk.forEach(url => cluster.execute(url, boardsPromise).then(res => {
        if (res.length > 0) {
          DDPromises.push(getDDData(res, false, pool)
            .then(updatedResult => {
              console.log(JSON.stringify(updatedResult[0]))
              //insert(updatedResult, promisifiedClient)
            })
          )
        } else {
          console.log(`${++failures} no data`)
        }
      }))
      await cluster.idle()
      await Promise.all(DDPromises)
      await axios.patch(`https://api.heroku.com/apps/${process.env.HEROKU_APP}/config-vars/`, {
        "LAST_TOURNEY_URL": chunk[chunk.length - 1]
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