import 'dotenv/config'
import parseLin from './lin_parser'
import axios, { AxiosError } from 'axios'
import { Browser, Page } from 'puppeteer'
import { Cluster } from 'puppeteer-cluster'
import { ContractLevel } from './enums'
import xmlParser from 'xml2json'
import * as fs from 'fs'
import axiosRetry from 'axios-retry'
import _ from 'lodash'

const scraperObject = {
	url: 'https://webutil.bridgebase.com/v2/tarchive.php?m=all&d=All%20Tourneys',
    login: 'https://www.bridgebase.com/myhands/myhands_login.php?t=%2Fmyhands%2Findex.php%3F',
	async scraper(browser: Browser) {
        const cluster = await Cluster.launch({
            concurrency: Cluster.CONCURRENCY_PAGE,
            maxConcurrency: 10,
        })
        cluster.on('taskerror', (err, data) => {
            console.log(`Error crawling ${data}: ${err.message}`);
        })
        const bboDir: {[key: string]: number} = {
            'S': 0,
            'W': 1,
            'N': 2,
            'E': 3,
        }
        const ddsDir: {[key: string]: number} = {
            'N': 0,
            'S': 1,
            'E': 2,
            'W': 3,
        }
        const bboNumtoDir = ['S', 'W', 'N', 'E']
        const ddsContractSuits: {[key: string]: number} = {
            'N': 0,
            'S': 1,
            'H': 2,
            'D': 3,
            'C': 4,
        }
        const ddsSuits: {[key: string]: number} = {
            'S': 0,
            'H': 1,
            'D': 2,
            'C': 3,
        }
        const suitSymbols: {[key: string]: string} = {
            '♣': 'C',
            '♦': 'D',
            '♥': 'H',
            '♠': 'S',
        }
        const cardRank: {[key: string]: number} = {
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
        type Board = {
            contract: string
            score: number
            lin: string
            contractLevel?: ContractLevel
            tricksOverContract: number
            optimalPoints?: number
            leadCost: number
            tricksDiff?: number
            pointsDiff?: number
            tricksTaken: number
            playerIds?: string[]
            competitive: boolean
            declarer: string
        }
        const disableImgCss = async (page: Page) => {
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
        axiosRetry(axios, { retryDelay: (retryCount) => {
            console.log(`retry attempt: ${retryCount}`);
            return retryCount * 2000; // time interval between retries
          }})
        // Login process
		let login = await browser.newPage()
        await disableImgCss(login)
		await login.goto(this.login, { waitUntil: 'domcontentloaded' })
        await login.type('#username', process.env.BBO_USERNAME!)
        await login.type('#password', process.env.BBO_PASSWORD!)
        await Promise.all([
            login.evaluate(() => {
                (<HTMLAnchorElement>document.querySelector('input[type=submit]')).click();
            }),
            login.waitForNavigation({ waitUntil: 'domcontentloaded' }),
        ])
        await login.close()
        // Scraping process
        // Getting all tourneys
        let page = await browser.newPage()
        await disableImgCss(page)
        await page.goto(this.url, { waitUntil: 'networkidle0' })
        await page.waitForSelector('#tourneys')
        let urls = await page.$$eval('#tourneys > center > table > tbody > tr > td > a.ldr',
            links => links.map(link => (<HTMLAnchorElement>link).href))
        // Scraping data from individual tourneys
        let pagePromise = (link: string) => new Promise<any>(async(resolve, reject) => {
            let dataObj: {
                'firstPair': string,
                'boards': Board[]
            } = {'firstPair': '', 'boards': []}
            let newPage = await browser.newPage()
            await disableImgCss(newPage)
            let response
            let i = 0
            do {
                response = await newPage.goto(link, { waitUntil: 'domcontentloaded' });
                if (i > 20) {
                    console.log("BBO down")
                    resolve(dataObj)
                    break
                }
                i++
                if (response === null) {
                    console.log("Got null, trying wait.")
                    response = await newPage.waitForResponse(() => true)
                }
                if (!response.ok()) {
                    await newPage.waitForTimeout(1000)
                }
            } while (!response.ok())
            dataObj.firstPair = await newPage.evaluate(() => {
                const link = document.querySelector('.onesection > .sectiontable > tbody > tr > td > a')
                if (link) {
                    return (<HTMLAnchorElement>link).href
                } else return ''
            })
            dataObj.boards = await newPage.$$eval('table.handrecords > tbody > tr > td > a', 
                links => links.map(link => {
                    let result: Board = {
                        lin: '',
                        contract: '',
                        score: 0,
                        tricksTaken: 0,
                        tricksOverContract: 0,
                        leadCost: 0,
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
            await newPage.$$eval('table.handrecords > tbody > tr > td.resultcell + td',
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
                                board.contractLevel = ContractLevel.GrandSlam
                            } else if (parseInt(board.contract[0]) == 6) {
                                board.contractLevel = ContractLevel.Slam
                            } else if (parseInt(board.contract[0]) >= 4) {
                                board.contractLevel = ContractLevel.Game
                            } else {
                                board.contractLevel = ContractLevel.Partial
                            }
                            break
                        case 'C':
                        case 'D':
                            if (parseInt(board.contract[0]) == 7) {
                                board.contractLevel = ContractLevel.GrandSlam
                            } else if (parseInt(board.contract[0]) == 6) {
                                board.contractLevel = ContractLevel.Slam
                            } else if (parseInt(board.contract[0]) == 5) {
                                board.contractLevel = ContractLevel.Game
                            } else {
                                board.contractLevel = ContractLevel.Partial
                            }
                            break
                        case 'N':
                            if (parseInt(board.contract[0]) == 7) {
                                board.contractLevel = ContractLevel.GrandSlam
                            } else if (parseInt(board.contract[0]) == 6) {
                                board.contractLevel = ContractLevel.Slam
                            } else if (parseInt(board.contract[0]) >= 3) {
                                board.contractLevel = ContractLevel.Game
                            } else {
                                board.contractLevel = ContractLevel.Partial
                            }
                            break
                    }
                } else {
                    board.contractLevel = ContractLevel.PassOut
                }
                let getDDSolver = async () => {
                    try {
                        const res = await axios.get("https://dds.bridgewebs.com/cgi-bin/bsol2/ddummy?request=m&dealstr=W:" +
                            `${parsedLin.hands.join(' ')}&vul=${parsedLin.vul}&sockref=${Date.now()}&uniqueTID=${Date.now()}&_=${Date.now()}`)
                        board.tricksDiff = board.tricksTaken! -
                            parseInt(res.data.sess.ddtricks[5 * ddsDir[board.contract[2]] + ddsContractSuits[board.contract[1]]], 16)
                        board.pointsDiff = board.score -
                            parseInt(res.data.scoreNS.substring(3))
                        board.optimalPoints = parseInt(res.data.scoreNS.substring(3))
                    } catch (err) {
                        // console.log('Waiting for DD API retry')
                        // await getDDSolver()
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
                        // console.log('Waiting for lead API retry')
                        // await getLeadSolver()
                    }
                }
                await getDDSolver()
                if (board.contract != 'P') {
                    await getLeadSolver()
                }
            }))
            resolve(dataObj)
            await newPage.close()
		});
        let profilePromise = (link: string) => new Promise<string[]>(async(resolve, reject) => {
            let newProfilePage = await browser.newPage()
            await disableImgCss(newProfilePage)
            let response
            let i = 0
            do {
			    response = await newProfilePage.goto(link, { waitUntil: 'networkidle0' })
                if (i > 20) {
                    console.log("BBO down")
                    break
                }
                i++
                if (response === null) {
                    console.log("Got null, trying wait.")
                    response = await newProfilePage.waitForResponse(() => true)
                }
                if (!response.ok()) {
                    await newProfilePage.waitForTimeout(1000)
                }
            } while (!response.ok())
            await newProfilePage.waitForSelector('.bbo_content');
            let travellers = await newProfilePage.$$eval('.body > tbody > .tourney > .traveller > a',
                links => links.map(link => (<HTMLAnchorElement>link).href.replace(/&username=.*/, '')))
			resolve(travellers)
			await newProfilePage.close()
		});
        let travellerPromise = (link: string) => new Promise<Board[]>(async(resolve, reject) => {
            let boards: Board[] = []
            let newBoardPage = await browser.newPage()
            await disableImgCss(newBoardPage)
            let response
            let i = 0
            do {
			    response = await newBoardPage.goto(link, { waitUntil: 'domcontentloaded' })
                if (i > 20) {
                    console.log("BBO down")
                    resolve(boards)
                    break
                }
                i++
                if (response === null) {
                    console.log("Got null, trying wait.")
                    response = await newBoardPage.waitForResponse(() => true)
                }
                if (!response.ok()) {
                    await newBoardPage.waitForTimeout(1000)
                }
            } while (!response.ok())
            await newBoardPage.waitForSelector('.bbo_content')
            page.on('console', message =>
                console.log(`${message.type().substring(0, 3).toUpperCase()} ${message.text()}`))
            boards = await newBoardPage.$$eval('.body > tbody > .tourney',
                (rows, suits: any) => rows.map(row => {
                    let board: Board = {
                        lin: '',
                        contract: '',
                        score: 0,
                        tricksTaken: 0,
                        tricksOverContract: 0,
                        leadCost: 0,
                        competitive: false,
                        declarer: ''
                    }
                    let contract = row.querySelector('td.result')!.textContent!
                    board.contract = contract.replace(/[♣♦♥♠]/, match => suits[match])!.replace(/[+\-=]+.*/, '')!;
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
                    board.score = parseInt(row.querySelector('td.score')!.textContent!)
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
                        })
                }
            }))
            if (boards.length == 0) resolve(boards)
            let boardInfo = parseLin(boards[0].lin)!
            let getDDSolver = async () => {
                try {
                    const res = await axios.get("https://dds.bridgewebs.com/cgi-bin/bsol2/ddummy?request=m&dealstr=W:" +
                        `${boardInfo.hands.join(' ')}&vul=${boardInfo.vul}&sockref=${Date.now()}&uniqueTID=${Date.now()}&_=${Date.now()}`)
                    boards.forEach(board => {
                        board.tricksDiff = board.tricksTaken! -
                            parseInt(res.data.sess.ddtricks[5 * ddsDir[board.contract[2]] + ddsContractSuits[board.contract[1]]], 16)
                        board.pointsDiff = board.score -
                            parseInt(res.data.scoreNS.substring(3))
                        board.optimalPoints = parseInt(res.data.scoreNS.substring(3))
                    })
                } catch (err) {
                    // console.log('Waiting for DD API retry')
                    // await getDDSolver()
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
                                board.contractLevel = ContractLevel.GrandSlam
                            } else if (parseInt(board.contract[0]) == 6) {
                                board.contractLevel = ContractLevel.Slam
                            } else if (parseInt(board.contract[0]) >= 4) {
                                board.contractLevel = ContractLevel.Game
                            } else {
                                board.contractLevel = ContractLevel.Partial
                            }
                            break
                        case 'C':
                        case 'D':
                            if (parseInt(board.contract[0]) == 7) {
                                board.contractLevel = ContractLevel.GrandSlam
                            } else if (parseInt(board.contract[0]) == 6) {
                                board.contractLevel = ContractLevel.Slam
                            } else if (parseInt(board.contract[0]) == 5) {
                                board.contractLevel = ContractLevel.Game
                            } else {
                                board.contractLevel = ContractLevel.Partial
                            }
                            break
                        case 'N':
                            if (parseInt(board.contract[0]) == 7) {
                                board.contractLevel = ContractLevel.GrandSlam
                            } else if (parseInt(board.contract[0]) == 6) {
                                board.contractLevel = ContractLevel.Slam
                            } else if (parseInt(board.contract[0]) >= 3) {
                                board.contractLevel = ContractLevel.Game
                            } else {
                                board.contractLevel = ContractLevel.Partial
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
                            // console.log('Waiting for lead API retry')
                            // await getLeadSolver()
                        }
                    }
                    await getLeadSolver()
                } else {
                    board.contractLevel = ContractLevel.PassOut
                }
            }))
			resolve(boards)
			await newBoardPage.close()
		})
        const stream = fs.createWriteStream("test10.txt", {flags:'a'});
        let i = 0;
        let chunkedUrls = _.chunk(urls, 25)
        for (let chunk of chunkedUrls) {
            await Promise.all(chunk.map(async url => {
                let currentPageData = await pagePromise(url)
                if (currentPageData.firstPair) {
                    let travellerData = await profilePromise(currentPageData.firstPair)
                    if (travellerData.length == 0) return
                    for (let i = 0; i < travellerData.length; i++) {
                        let boardData = await travellerPromise(travellerData[i])
                        currentPageData.boards.push.apply(currentPageData.boards, boardData)
                    }
                }
                if (currentPageData.boards.length > 0) {
                    stream.write(JSON.stringify(currentPageData.boards) + "\n");
                }
                console.log(`${++i}/${urls.length} boards done`)
            }))
        }
        await page.close()
	}
}

export default scraperObject