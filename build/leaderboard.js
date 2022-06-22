"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const cassandra_driver_1 = require("cassandra-driver");
const p_limit_1 = __importDefault(require("p-limit"));
/*let client = new Redis("redis://:YOUR_PASSWORD@YOUR_ENDPOINT:YOUR_PORT");
await client.set('foo', 'bar');
let x = await client.get('foo');
console.log(x);*/
async function update() {
    const MAX_SIMULTANEOUS_API_CALLS = 125;
    const apiLimit = (0, p_limit_1.default)(MAX_SIMULTANEOUS_API_CALLS);
    const client = new cassandra_driver_1.Client({
        cloud: {
            secureConnectBundle: "./secure-connect-firebridge.zip",
        },
        credentials: {
            username: process.env.ASTRA_CLIENT_ID,
            password: process.env.ASTRA_CLIENT_SECRET,
        },
    });
    await client.connect();
    const processValues = (val1, val2) => {
        if (typeof val1 === 'number' || typeof val2 === 'number') {
            return val2 === 0
                ? -1
                : val1 / val2;
        }
        else {
            return val2
                ? val1
                    ? val1.toNumber() / val2.toNumber()
                    : 0
                : -1;
        }
    };
    const shouldInsert = (val) => {
        return val !== -1;
    };
    const insertQuery = 'INSERT INTO bridge.stats_by_type (stat_type, val_asc, val_desc, num_deals, bbo_username) VALUES (?, ?, ?, ?, ?)';
    const allTimeStats = await client.execute(`SELECT * FROM bridge.stats_by_user`);
    console.log(`Your cluster returned ${allTimeStats.rowLength} row(s)`);
    await Promise.all(allTimeStats.rows.map(async (row) => {
        if (row.num_deals > 30) {
            let values = [processValues(row.num_3n_make, row.num_3n), processValues(row.tricks_diff_declaring, row.num_declaring),
                processValues(row.num_game_make, row.num_game), processValues(row.num_slam_make, row.num_slam),
                processValues(row.num_grand_make, row.num_grand), processValues(row.tricks_diff_defence, row.num_defence),
                processValues(row.num_missed_game, row.num_partial), processValues(row.num_x_pen_optimal, row.num_x_pen),
                processValues(row.num_x_sac_optimal, row.num_x_sac), processValues(row.lead_cost, row.num_lead), processValues(row.points_diff, row.num_deals),
                processValues(row.imps_diff, row.num_deals)
            ];
            let statNames = ['%_3n_make_all_time', 'tricks_diff_declaring_all_time', '%_game_make_all_time', '%_slam_make_all_time', '%_grand_make_all_time',
                'tricks_diff_defence_all_time', '%_missed_game_all_time', '%_x_pen_optimal_all_time', '%_x_sac_optimal_all_time', 'avg_lead_cost_all_time',
                'avg_points_diff_all_time', 'avg_imps_diff_all_time'
            ];
            let valAsc = [false, false, false, false, false, false, true, false, false, true, false, false];
            return apiLimit(() => Promise.all(values.map(async (val, idx) => {
                if (shouldInsert(val)) {
                    return client.execute(insertQuery, [statNames[idx], valAsc[idx] ? val : 0, valAsc[idx] ? 0 : val, row.num_deals.toNumber(), row.bbo_username], { prepare: true });
                }
            })));
        }
    }));
    console.log('Done all-time stats');
    const today = new Date();
    const minusDays = (date, days) => {
        let res = new Date(date);
        res.setDate(res.getDate() - days);
        return res;
    };
    const weeklyStats = await client.execute(`SELECT bbo_username, COUNT(bbo_username), SUM(CAST(num_lead as int)), SUM(CAST(num_defence as int)),
    SUM(CAST(num_declaring as int)), SUM(CAST(num_partial as int)), SUM(CAST(num_game as int)), SUM(CAST(num_slam as int)), SUM(CAST(num_grand as int)),
    SUM(CAST(num_3n as int)), SUM(CAST(num_3n_make as int)), SUM(CAST(num_game_make as int)), SUM(CAST(num_slam_make as int)), SUM(CAST(num_grand_make as int)),
    SUM(CAST(num_missed_game as int)), SUM(CAST(tricks_diff_declaring as int)), SUM(CAST(tricks_diff_defence as int)), SUM(CAST(lead_cost as int)),
    SUM(CAST(points_diff as bigint)), SUM(CAST(imps_diff as int)), SUM(CAST(num_x_pen as int)), SUM(CAST(num_x_sac as int)), SUM(CAST(num_x_pen_optimal as int)),
    SUM(CAST(num_x_sac_optimal as int)) FROM bridge.stats_by_user_periodic WHERE timestamp >= '${minusDays(today, 7).toJSON().substring(0, 10)}' GROUP BY bbo_username`);
    console.log(`Your cluster returned ${weeklyStats.rowLength} row(s)`);
    await Promise.all(weeklyStats.rows.map(async (row) => {
        if (row['system.count(bbo_username)'] > 30) {
            let values = [processValues(row['system.sum(cast(num_3n_make as int))'], row['system.sum(cast(num_3n as int))']),
                processValues(row['system.sum(cast(tricks_diff_declaring as int))'], row['system.sum(cast(num_declaring as int))']),
                processValues(row['system.sum(cast(num_game_make as int))'], row['system.sum(cast(num_game as int))']),
                processValues(row['system.sum(cast(num_slam_make as int))'], row['system.sum(cast(num_slam as int))']),
                processValues(row['system.sum(cast(num_grand_make as int))'], row['system.sum(cast(num_grand as int))']),
                processValues(row['system.sum(cast(tricks_diff_defence as int))'], row['system.sum(cast(num_defence as int))']),
                processValues(row['system.sum(cast(num_missed_game as int))'], row['system.sum(cast(num_partial as int))']),
                processValues(row['system.sum(cast(num_x_pen_optimal as int))'], row['system.sum(cast(num_x_pen as int))']),
                processValues(row['system.sum(cast(num_x_sac_optimal as int))'], row['system.sum(cast(num_x_sac as int))']),
                processValues(row['system.sum(cast(lead_cost as int))'], row['system.sum(cast(num_lead as int))']),
                processValues(row['system.sum(cast(points_diff as bigint))'], row['system.sum(cast(num_deals as int))']),
                processValues(row['system.sum(cast(imps_diff as int))'], row['system.sum(cast(num_deals as int))'])
            ];
            let statNames = ['%_3n_make_weekly', 'tricks_diff_declaring_weekly', '%_game_make_weekly', '%_slam_make_weekly', '%_grand_make_weekly',
                'tricks_diff_defence_weekly', '%_missed_game_weekly', '%_x_pen_optimal_weekly', '%_x_sac_optimal_weekly', 'avg_lead_cost_weekly',
                'avg_points_diff_weekly', 'avg_imps_diff_weekly'
            ];
            let valAsc = [false, false, false, false, false, false, true, false, false, true, false, false];
            return apiLimit(() => Promise.all(values.map(async (val, idx) => {
                if (shouldInsert(val)) {
                    return client.execute(insertQuery, [statNames[idx], valAsc[idx] ? val : 0, valAsc[idx] ? 0 : val, row['system.count(bbo_username)'].toNumber(), row.bbo_username], { prepare: true });
                }
            })));
        }
    }));
    console.log('Done weekly stats');
    const monthlyStats = await client.execute(`SELECT bbo_username, COUNT(bbo_username), SUM(CAST(num_lead as int)), SUM(CAST(num_defence as int)),
    SUM(CAST(num_declaring as int)), SUM(CAST(num_partial as int)), SUM(CAST(num_game as int)), SUM(CAST(num_slam as int)), SUM(CAST(num_grand as int)),
    SUM(CAST(num_3n as int)), SUM(CAST(num_3n_make as int)), SUM(CAST(num_game_make as int)), SUM(CAST(num_slam_make as int)), SUM(CAST(num_grand_make as int)),
    SUM(CAST(num_missed_game as int)), SUM(CAST(tricks_diff_declaring as int)), SUM(CAST(tricks_diff_defence as int)), SUM(CAST(lead_cost as int)),
    SUM(CAST(points_diff as bigint)), SUM(CAST(imps_diff as int)), SUM(CAST(num_x_pen as int)), SUM(CAST(num_x_sac as int)), SUM(CAST(num_x_pen_optimal as int)),
    SUM(CAST(num_x_sac_optimal as int)) FROM bridge.stats_by_user_periodic WHERE timestamp >= '${minusDays(today, 30).toJSON().substring(0, 10)}' GROUP BY bbo_username`);
    console.log(`Your cluster returned ${monthlyStats.rowLength} row(s)`);
    await Promise.all(monthlyStats.rows.map(async (row) => {
        if (row['system.count(bbo_username)'] > 30) {
            let values = [processValues(row['system.sum(cast(num_3n_make as int))'], row['system.sum(cast(num_3n as int))']),
                processValues(row['system.sum(cast(tricks_diff_declaring as int))'], row['system.sum(cast(num_declaring as int))']),
                processValues(row['system.sum(cast(num_game_make as int))'], row['system.sum(cast(num_game as int))']),
                processValues(row['system.sum(cast(num_slam_make as int))'], row['system.sum(cast(num_slam as int))']),
                processValues(row['system.sum(cast(num_grand_make as int))'], row['system.sum(cast(num_grand as int))']),
                processValues(row['system.sum(cast(tricks_diff_defence as int))'], row['system.sum(cast(num_defence as int))']),
                processValues(row['system.sum(cast(num_missed_game as int))'], row['system.sum(cast(num_partial as int))']),
                processValues(row['system.sum(cast(num_x_pen_optimal as int))'], row['system.sum(cast(num_x_pen as int))']),
                processValues(row['system.sum(cast(num_x_sac_optimal as int))'], row['system.sum(cast(num_x_sac as int))']),
                processValues(row['system.sum(cast(lead_cost as int))'], row['system.sum(cast(num_lead as int))']),
                processValues(row['system.sum(cast(points_diff as bigint))'], row['system.sum(cast(num_deals as int))']),
                processValues(row['system.sum(cast(imps_diff as int))'], row['system.sum(cast(num_deals as int))'])
            ];
            let statNames = ['%_3n_make_monthly', 'tricks_diff_declaring_monthly', '%_game_make_monthly', '%_slam_make_monthly', '%_grand_make_monthly',
                'tricks_diff_defence_monthly', '%_missed_game_monthly', '%_x_pen_optimal_monthly', '%_x_sac_optimal_monthly', 'avg_lead_cost_monthly',
                'avg_points_diff_monthly', 'avg_imps_diff_monthly'
            ];
            let valAsc = [false, false, false, false, false, false, true, false, false, true, false, false];
            return apiLimit(() => Promise.all(values.map(async (val, idx) => {
                if (shouldInsert(val)) {
                    return client.execute(insertQuery, [statNames[idx], valAsc[idx] ? val : 0, valAsc[idx] ? 0 : val, row['system.count(bbo_username)'].toNumber(), row.bbo_username], { prepare: true });
                }
            })));
        }
    }));
    console.log('Done monthly stats');
    const yearlyStats = await client.execute(`SELECT bbo_username, COUNT(bbo_username), SUM(CAST(num_lead as int)), SUM(CAST(num_defence as int)),
    SUM(CAST(num_declaring as int)), SUM(CAST(num_partial as int)), SUM(CAST(num_game as int)), SUM(CAST(num_slam as int)), SUM(CAST(num_grand as int)),
    SUM(CAST(num_3n as int)), SUM(CAST(num_3n_make as int)), SUM(CAST(num_game_make as int)), SUM(CAST(num_slam_make as int)), SUM(CAST(num_grand_make as int)),
    SUM(CAST(num_missed_game as int)), SUM(CAST(tricks_diff_declaring as int)), SUM(CAST(tricks_diff_defence as int)), SUM(CAST(lead_cost as int)),
    SUM(CAST(points_diff as bigint)), SUM(CAST(imps_diff as int)), SUM(CAST(num_x_pen as int)), SUM(CAST(num_x_sac as int)), SUM(CAST(num_x_pen_optimal as int)),
    SUM(CAST(num_x_sac_optimal as int)) FROM bridge.stats_by_user_periodic WHERE timestamp >= '${minusDays(today, 365).toJSON().substring(0, 10)}' GROUP BY bbo_username`);
    console.log(`Your cluster returned ${yearlyStats.rowLength} row(s)`);
    await Promise.all(yearlyStats.rows.map(async (row) => {
        if (row['system.count(bbo_username)'] > 30) {
            let values = [processValues(row['system.sum(cast(num_3n_make as int))'], row['system.sum(cast(num_3n as int))']),
                processValues(row['system.sum(cast(tricks_diff_declaring as int))'], row['system.sum(cast(num_declaring as int))']),
                processValues(row['system.sum(cast(num_game_make as int))'], row['system.sum(cast(num_game as int))']),
                processValues(row['system.sum(cast(num_slam_make as int))'], row['system.sum(cast(num_slam as int))']),
                processValues(row['system.sum(cast(num_grand_make as int))'], row['system.sum(cast(num_grand as int))']),
                processValues(row['system.sum(cast(tricks_diff_defence as int))'], row['system.sum(cast(num_defence as int))']),
                processValues(row['system.sum(cast(num_missed_game as int))'], row['system.sum(cast(num_partial as int))']),
                processValues(row['system.sum(cast(num_x_pen_optimal as int))'], row['system.sum(cast(num_x_pen as int))']),
                processValues(row['system.sum(cast(num_x_sac_optimal as int))'], row['system.sum(cast(num_x_sac as int))']),
                processValues(row['system.sum(cast(lead_cost as int))'], row['system.sum(cast(num_lead as int))']),
                processValues(row['system.sum(cast(points_diff as bigint))'], row['system.sum(cast(num_deals as int))']),
                processValues(row['system.sum(cast(imps_diff as int))'], row['system.sum(cast(num_deals as int))'])
            ];
            let statNames = ['%_3n_make_yearly', 'tricks_diff_declaring_yearly', '%_game_make_yearly', '%_slam_make_yearly', '%_grand_make_yearly',
                'tricks_diff_defence_yearly', '%_missed_game_yearly', '%_x_pen_optimal_yearly', '%_x_sac_optimal_yearly', 'avg_lead_cost_yearly',
                'avg_points_diff_yearly', 'avg_imps_diff_yearly'
            ];
            let valAsc = [false, false, false, false, false, false, true, false, false, true, false, false];
            return apiLimit(() => Promise.all(values.map(async (val, idx) => {
                if (shouldInsert(val)) {
                    return client.execute(insertQuery, [statNames[idx], valAsc[idx] ? val : 0, valAsc[idx] ? 0 : val, row['system.count(bbo_username)'].toNumber(), row.bbo_username], { prepare: true });
                }
            })));
        }
    }));
    console.log('Done yearly stats');
    await client.shutdown();
}
update();
