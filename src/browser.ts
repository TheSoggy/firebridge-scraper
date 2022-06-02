import puppeteer from 'puppeteer';

const startBrowser = async (): Promise<puppeteer.Browser> => {
	let browser!: puppeteer.Browser;
	try {
	    console.log("Opening the browser......");
	    browser = await puppeteer.launch({
	        headless: false,
	        args: ["--disable-setuid-sandbox",
				"--no-sandbox",
				"--disable-dev-shm-usage",
				"--use-gl=egl",
				"'--proxy-server=51.79.52.80:3080"
			],
	        'ignoreHTTPSErrors': true,
			// slowMo: 250
	    });
	} catch (err) {
	    console.log("Could not create a browser instance => : ", err);
	}
	return browser;
}

export default startBrowser