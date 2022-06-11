"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.numToString = exports.handleRejection = exports.processBoard = void 0;
const constants_1 = require("./constants");
const processBoard = (board, contractStr) => {
    contractStr = contractStr.toUpperCase();
    if (!/^[P1-7]/.test(contractStr)) {
        return;
    }
    board.contract = contractStr.replace(/[♣♦♥♠]/, match => constants_1.suitSymbols[match]).replace(/[+\-=]+.*/, '');
    if ('X' == board.contract[2]) {
        board.contract = board.contract.substring(0, 2) + board.contract[board.contract.length - 1]
            + board.contract.substring(2, board.contract.length - 1);
    }
    if (contractStr == 'PASS')
        board.contract = 'P';
    if (/[+\-=]+.*/.test(contractStr)) {
        switch (contractStr.match(/[+\-=]+.*/)[0][0]) {
            case '+':
                board.tricksOverContract = parseInt(contractStr.match(/[+\-=]+.*/)[0]);
                board.tricksTaken = parseInt(contractStr[0]) + 6 + board.tricksOverContract;
                break;
            case '-':
                board.tricksOverContract = parseInt(contractStr.match(/[+\-=]+.*/)[0]);
                board.tricksTaken = parseInt(contractStr[0]) + 6 + board.tricksOverContract;
                break;
            case '=':
                board.tricksTaken = parseInt(contractStr[0]) + 6;
                break;
        }
    }
};
exports.processBoard = processBoard;
const handleRejection = (p) => {
    return p.catch(err => {
        console.log(err);
        return err;
    });
};
exports.handleRejection = handleRejection;
const numToString = (num) => {
    return (num < 0 ? "" : "+") + num;
};
exports.numToString = numToString;
