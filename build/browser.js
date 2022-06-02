"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const puppeteer_1 = __importDefault(require("puppeteer"));
const startBrowser = async () => {
    let browser;
    try {
        console.log("Opening the browser......");
        browser = await puppeteer_1.default.launch({
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
    }
    catch (err) {
        console.log("Could not create a browser instance => : ", err);
    }
    return browser;
};
exports.default = startBrowser;
