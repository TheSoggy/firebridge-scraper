import { Client } from "cassandra-driver";

async function run() {
  const client = new Client({
    cloud: {
      secureConnectBundle: "secure-connect-firebridge.zip",
    },
    credentials: {
      username: process.env.ASTRA_CLIENT_ID!,
      password: process.env.ASTRA_CLIENT_SECRET!,
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
