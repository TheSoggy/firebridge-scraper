import { Query, Value, Values } from "@stargate-oss/stargate-grpc-node-client"
import { Board } from "./types"
import { numToString } from "./utils"
import { v4 as uuidv4 } from 'uuid'
import 'dotenv/config'
import _, { toNumber } from 'lodash'
import Redis from 'ioredis'
import { PromisifiedStargateClient } from "@stargate-oss/stargate-grpc-node-client/lib/util/promise"

/*let client = new Redis("redis://:YOUR_PASSWORD@YOUR_ENDPOINT:YOUR_PORT");
await client.set('foo', 'bar');
let x = await client.get('foo');
console.log(x);*/
async function insert(boards: Board[], promisifiedClient: PromisifiedStargateClient) {
  const tryQuery = async (query: Query, retryCount: number) => {
    try {
      await promisifiedClient.executeQuery(query)
    } catch (err) {
      setTimeout(async () => await tryQuery(query, retryCount + 1), 250 * retryCount)
    }
  }
  for (let board of boards) {
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
    await tryQuery(insertDeal, 1)
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
        imps_diff,
        points_diff,
        competitive
      ) VALUES (?, toTimestamp(now()), ${dealUuid}, ?, ?,
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
      const imps_diff = new Value()
      imps_diff.setInt(board.impsDiff!)
      const points_diff = new Value()
      points_diff.setInt(board.pointsDiff!)
      const competitive = new Value()
      competitive.setBoolean(board.competitive)
      const queryValues = new Values();
      queryValues.setValuesList([player_id, contract_level, contract, 
        tricks_over_contract, deal_type, optimal_points, lead_cost, tricks_diff,
        imps_diff, points_diff, competitive]);
      insertDealByUser.setValues(queryValues);
      const updateCounters = new Query()
      var updateStr = `UPDATE bridge.stats_by_user
        SET num_deals = num_deals + 1,
        points_diff = points_diff ${numToString(board.pointsDiff!)},
        imps_diff = imps_diff ${numToString(board.impsDiff!)}`
      switch (dealType[i]) {
        case 1:
          updateStr += `, num_lead = num_lead + 1`
          updateStr += `, num_defence = num_defence + 1`
          updateStr += `, tricks_diff_defence = tricks_diff_defence ${numToString(-board.tricksDiff)}`
          updateStr += `, lead_cost = lead_cost ${numToString(board.leadCost!)}`
          if (board.contract[board.contract.length - 1] == 'X') {
            if (board.optimalPoints!/(board.pointsDiff! + Math.abs(board.optimalPoints!)/board.optimalPoints!) >= 0) {
              updateStr += `, num_x_pen_optimal = num_x_pen_optimal + 1`
            }
            updateStr += `, num_x_pen = num_x_pen + 1`
          }
          break
        case 3:
          updateStr += `, num_defence = num_defence + 1`
          updateStr += `, tricks_diff_defence = tricks_diff_defence ${numToString(-board.tricksDiff)}`
          if (board.contract[board.contract.length - 1] == 'X') {
            if (board.optimalPoints!/(board.pointsDiff! + Math.abs(board.optimalPoints!)/board.optimalPoints!) >= 0) {
              updateStr += `, num_x_pen_optimal = num_x_pen_optimal + 1`
            }
            updateStr += `, num_x_pen = num_x_pen + 1`
          }
          break
        case 4:
          updateStr += `, num_declaring = num_declaring + 1`
          updateStr += `, tricks_diff_declaring = tricks_diff_declaring ${numToString(board.tricksDiff)}`
          break
      }
      if (dealType[i] % 2 == 0) {
        if (board.contract[board.contract.length - 1] == 'X') {
          if (board.optimalPoints!/(board.pointsDiff! - Math.abs(board.optimalPoints!)/board.optimalPoints!) < 0) {
            updateStr += `, num_x_sac_optimal = num_x_sac_optimal + 1`
          }
          updateStr += `, num_x_sac = num_x_sac + 1`
        }
        switch (board.contractLevel) {
          case 1:
            updateStr += `, num_partial = num_partial + 1`
            if (Math.abs(board.optimalPoints!) > 400 && 
              board.optimalPoints!/(board.score + Math.abs(board.optimalPoints!)/board.optimalPoints!) >= 1) {
              updateStr += `, num_missed_game = num_missed_game + 1`
            }
            break
          case 2:
            updateStr += `, num_game = num_game + 1`
            if (board.tricksOverContract >= 0) {
              updateStr += `, num_game_make = num_game_make + 1`
            }
            break
          case 3:
            updateStr += `, num_slam = num_slam + 1`
            if (board.tricksOverContract >= 0) {
              updateStr += `, num_slam_make = num_slam_make + 1`
            }
            break
          case 4:
            updateStr += `, num_grand = num_grand + 1`
            if (board.tricksOverContract >= 0) {
              updateStr += `, num_grand_make = num_grand_make + 1`
            }
            break
        }
        if (board.contract.includes("3N")) {
          updateStr += `, num_3n = num_3n + 1`
          if (board.tricksOverContract >= 0) {
            updateStr += `, num_3n_make = num_3n_make + 1`
          }
        }
      }
      updateStr += ` WHERE bbo_username = '${board.playerIds![i]}'`
      updateCounters.setCql(updateStr)
      await tryQuery(insertDealByUser, 1)
      await tryQuery(updateCounters, 1)
    }
  }
}

export default insert