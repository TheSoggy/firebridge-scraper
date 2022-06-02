"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cassandra_driver_1 = require("cassandra-driver");
async function run() {
    const client = new cassandra_driver_1.Client({
        cloud: {
            secureConnectBundle: "secure-connect-firebridge.zip",
        },
        credentials: {
            username: process.env.ASTRA_CLIENT_ID,
            password: process.env.ASTRA_CLIENT_SECRET,
        },
    });
    await client.connect();
    // Execute a query
    const rs = await client.execute("SELECT * FROM system.local");
    console.log(`Your cluster returned ${rs.rowLength} row(s)`);
    await client.shutdown();
}
// Run the async function
run();
