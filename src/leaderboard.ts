import { Query, Value, Values } from "@stargate-oss/stargate-grpc-node-client"
import 'dotenv/config'
import _, { isNumber } from 'lodash'
import Redis from 'ioredis'
import { StargateClient, StargateBearerToken, promisifyStargateClient } from "@stargate-oss/stargate-grpc-node-client";
import * as grpc from "@grpc/grpc-js";

/*let client = new Redis("redis://:YOUR_PASSWORD@YOUR_ENDPOINT:YOUR_PORT");
await client.set('foo', 'bar');
let x = await client.get('foo');
console.log(x);*/
async function update() {
  const bearerToken = new StargateBearerToken(process.env.ASTRA_TOKEN!)
  const credentials = grpc.credentials.combineChannelCredentials(
    grpc.credentials.createSsl(), bearerToken)
  const stargateClient = new StargateClient(process.env.ASTRA_GRPC_ENDPOINT!, credentials)
  const promisifiedClient = promisifyStargateClient(stargateClient)
  const tryQuery = async (query: Query, retryCount: number) => {
    try {
      return await promisifiedClient.executeQuery(query)
    } catch (err) {
      setTimeout(async () => await tryQuery(query, retryCount + 1), 250 * retryCount)
    }
  }
  const getUsers = new Query()
  const queryStr = `SELECT * FROM bridge.stats_by_user`
  getUsers.setCql(queryStr)
  const res = await tryQuery(getUsers, 1)
  if (res) {
    const resultSet = res.getResultSet()
    resultSet!.getColumnsList().forEach(col => console.log(col.getName()))
    const rows = resultSet!.getRowsList()
    // This for loop gets 2 results
    for ( let i = 0; i < rows.length; i++) {
      var valueToPrint = ""
      for ( let j = 0; j < 23; j++) {
        var value = rows[i].getValuesList()[j].getString()
        if (value) {
          valueToPrint += value + " "
        } else {
          value = rows[i].getValuesList()[j].getInt().toString()
          valueToPrint += value + " "
        }
      }
      console.log(valueToPrint)
    }
  }
}

update()