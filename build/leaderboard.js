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
Object.defineProperty(exports, "__esModule", { value: true });
const stargate_grpc_node_client_1 = require("@stargate-oss/stargate-grpc-node-client");
require("dotenv/config");
const stargate_grpc_node_client_2 = require("@stargate-oss/stargate-grpc-node-client");
const grpc = __importStar(require("@grpc/grpc-js"));
/*let client = new Redis("redis://:YOUR_PASSWORD@YOUR_ENDPOINT:YOUR_PORT");
await client.set('foo', 'bar');
let x = await client.get('foo');
console.log(x);*/
async function update() {
    const bearerToken = new stargate_grpc_node_client_2.StargateBearerToken(process.env.ASTRA_TOKEN);
    const credentials = grpc.credentials.combineChannelCredentials(grpc.credentials.createSsl(), bearerToken);
    const stargateClient = new stargate_grpc_node_client_2.StargateClient(process.env.ASTRA_GRPC_ENDPOINT, credentials);
    const promisifiedClient = (0, stargate_grpc_node_client_2.promisifyStargateClient)(stargateClient);
    const tryQuery = async (query, retryCount) => {
        try {
            return await promisifiedClient.executeQuery(query);
        }
        catch (err) {
            setTimeout(async () => await tryQuery(query, retryCount + 1), 250 * retryCount);
        }
    };
    const getUsers = new stargate_grpc_node_client_1.Query();
    const queryStr = `SELECT * FROM bridge.stats_by_user`;
    getUsers.setCql(queryStr);
    const res = await tryQuery(getUsers, 1);
    if (res) {
        const resultSet = res.getResultSet();
        resultSet.getColumnsList().forEach(col => console.log(col.getName()));
        const rows = resultSet.getRowsList();
        // This for loop gets 2 results
        for (let i = 0; i < rows.length; i++) {
            var valueToPrint = "";
            for (let j = 0; j < 23; j++) {
                var value = rows[i].getValuesList()[j].getString();
                if (value) {
                    valueToPrint += value + " ";
                }
                else {
                    value = rows[i].getValuesList()[j].getInt().toString();
                    valueToPrint += value + " ";
                }
            }
            console.log(valueToPrint);
        }
    }
}
update();
