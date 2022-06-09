import * as grpc from "@grpc/grpc-js";
import { StargateClient, Query, StargateBearerToken, Response, promisifyStargateClient, Value, Values, Uuid } from "@stargate-oss/stargate-grpc-node-client";
import { Board } from "./types";
import { v4 as uuidv4, parse } from 'uuid';
import 'dotenv/config'
import _ from 'lodash'

const bearerToken = new StargateBearerToken(process.env.ASTRA_TOKEN!);
const credentials = grpc.credentials.combineChannelCredentials(
  grpc.credentials.createSsl(), bearerToken);

const stargateClient = new StargateClient(process.env.ASTRA_GRPC_ENDPOINT!, credentials);
const promisifiedClient = promisifyStargateClient(stargateClient);

async function insert(boards: Board[]) {
  for (let board of boards) {
    console.log(board.lin)
    const insertDeal = new Query()
    const dealUuid = uuidv4()
    const queryStr = `INSERT INTO bridge.deals (
      deal_id,
      lin
    ) VALUES (${dealUuid}, ?)`
    insertDeal.setCql(queryStr)
    const lin = new Value()
    lin.setString(board.lin)
    const queryValues = new Values()
    queryValues.setValuesList([lin])
    insertDeal.setValues(queryValues)
    await promisifiedClient.executeQuery(insertDeal)
    const dealType: number[] = [0, 0, 0, 0]
    let declarerIdx = _.indexOf(board.playerIds, board.declarer)
    if (declarerIdx != -1) {
      dealType[declarerIdx] = 4
      for (let i = 1; i < 4; i++) {
        dealType[(i + declarerIdx) % 4] = i
      }
    }
    for (let i = 0; i < 4; i++) {
      const insertDealByUser = new Query()
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
      ) VALUES (?, toTimestamp(now()), ${dealUuid}, ?,
        ?, ?, ?, ?, ?, ?, ?, ?)`
      insertDealByUser.setCql(queryStr)
      const player_id = new Value()
      player_id.setString(board.playerIds![i])
      const contract_level = new Value()
      contract_level.setInt(board.contractLevel!)
      const contract = new Value()
      contract.setString(board.contract)
      const tricks_over_contract = new Value()
      tricks_over_contract.setInt(board.tricksOverContract)
      const deal_type = new Value()
      deal_type.setInt(dealType[i])
      const optimal_points = new Value()
      optimal_points.setInt(board.optimalPoints!)
      const lead_cost = new Value()
      lead_cost.setInt(board.leadCost)
      const tricks_diff = new Value()
      tricks_diff.setInt(board.tricksDiff)
      const points_diff = new Value()
      points_diff.setInt(board.pointsDiff!)
      const competitive = new Value()
      competitive.setBoolean(board.competitive)
      const queryValues = new Values();
      queryValues.setValuesList([player_id, contract_level, contract, 
        tricks_over_contract, deal_type, optimal_points, lead_cost, tricks_diff,
        points_diff, competitive]);
      insertDealByUser.setValues(queryValues);      
      await promisifiedClient.executeQuery(insertDealByUser)
    }
  }
}

export default insert