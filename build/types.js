"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dealType = exports.Vul = exports.ContractLevel = void 0;
var ContractLevel;
(function (ContractLevel) {
    ContractLevel[ContractLevel["PASSOUT"] = 0] = "PASSOUT";
    ContractLevel[ContractLevel["PARTIAL"] = 1] = "PARTIAL";
    ContractLevel[ContractLevel["GAME"] = 2] = "GAME";
    ContractLevel[ContractLevel["SLAM"] = 3] = "SLAM";
    ContractLevel[ContractLevel["GRANDSLAM"] = 4] = "GRANDSLAM";
})(ContractLevel = exports.ContractLevel || (exports.ContractLevel = {}));
var Vul;
(function (Vul) {
    Vul[Vul["NONE"] = 0] = "NONE";
    Vul[Vul["ALL"] = 1] = "ALL";
    Vul[Vul["NS"] = 2] = "NS";
    Vul[Vul["EW"] = 3] = "EW";
})(Vul = exports.Vul || (exports.Vul = {}));
var dealType;
(function (dealType) {
    dealType[dealType["PASSOUT"] = 0] = "PASSOUT";
    dealType[dealType["LEAD"] = 1] = "LEAD";
    dealType[dealType["DUMMY"] = 2] = "DUMMY";
    dealType[dealType["DEFENCE"] = 3] = "DEFENCE";
    dealType[dealType["DECLARING"] = 4] = "DECLARING";
})(dealType = exports.dealType || (exports.dealType = {}));
