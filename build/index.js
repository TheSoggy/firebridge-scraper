"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pageController_1 = __importDefault(require("./pageController"));
//Start the browser and create a browser instance
// let browserInstance = startBrowser();
// Pass the browser instance to the scraper controller
(0, pageController_1.default)( /*browserInstance*/);
