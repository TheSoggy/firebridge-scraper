"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const grpc = __importStar(require("@grpc/grpc-js"));
const stargate_grpc_node_client_1 = require("@stargate-oss/stargate-grpc-node-client");
const uuid_1 = require("uuid");
require("dotenv/config");
const lodash_1 = __importDefault(require("lodash"));
const bearerToken = new stargate_grpc_node_client_1.StargateBearerToken(process.env.ASTRA_TOKEN);
const credentials = grpc.credentials.combineChannelCredentials(grpc.credentials.createSsl(), bearerToken);
const stargateClient = new stargate_grpc_node_client_1.StargateClient(process.env.ASTRA_GRPC_ENDPOINT, credentials);
const promisifiedClient = (0, stargate_grpc_node_client_1.promisifyStargateClient)(stargateClient);
async function insert(boards) {
    for (let board of boards) {
        const insertDeal = new stargate_grpc_node_client_1.Query();
        const dealUuid = (0, uuid_1.v4)();
        const queryStr = `INSERT INTO bridge.deals (
      deal_id,
      lin
    ) VALUES (
      ${dealUuid},
      '${board.lin}'
    )`;
        insertDeal.setCql(queryStr);
        await promisifiedClient.executeQuery(insertDeal);
        const dealType = [0, 0, 0, 0];
        let declarerIdx = lodash_1.default.indexOf(board.playerIds, board.declarer);
        if (declarerIdx != -1) {
            dealType[declarerIdx] = 4;
            for (let i = 1; i < 4; i++) {
                dealType[(i + declarerIdx) % 4] = i;
            }
        }
        for (let i = 0; i < 4; i++) {
            const insertDealByUser = new stargate_grpc_node_client_1.Query();
            const queryStr = `INSERT INTO bridge.deals_by_user (
        bbo_username,
        timestamp,
        deal_id,
        contract_level,
        contract,
        tricks_over_contract,
        deal_type,
        optimal_points,
        lead_cost,
        tricks_diff,
        points_diff,
        competitive
      ) VALUES (
        '${board.playerIds[i]}',
        toTimestamp(now()),
        ${dealUuid},
        ${board.contractLevel},
        '${board.contract}',
        ${board.tricksOverContract},
        ${dealType[i]},
        ${board.optimalPoints},
        ${board.leadCost},
        ${board.tricksDiff},
        ${board.pointsDiff},
        ${board.competitive}
      )`;
            insertDealByUser.setCql(queryStr);
            await promisifiedClient.executeQuery(insertDealByUser);
        }
    }
}
exports.default = insert;
