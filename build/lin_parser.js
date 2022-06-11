"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const parseLin = (lin) => {
    let result;
    result = {
        hands: [],
        playerIds: [],
        vul: '',
        competitive: false,
        lead: '',
    };
    let player_ids = lin.match(/pn\|([^\|]+)/);
    if (player_ids === null) {
        return null;
    }
    try {
        // player order is always S,W,N,E
        result.playerIds = player_ids[0].substring(3).split(',')
            .map(player_id => player_id == '~GiB' || player_id.startsWith('~~M') ? 'Robot' : player_id);
        let hands = lin.match(/md\|([^\|]+)/);
        hands = hands[0].substring(4).split(',');
        result.hands = hands.map(hand => hand.substring(1).replace(/[HDChdc]/g, '.'));
        if (hands.length < 4 || hands[3].length == 0) {
            let cards = '23456789TJQKA';
            let lastHandSuits = Array(4).fill(cards);
            result.hands.forEach(hand => {
                hand.split('.').forEach((suit, idx) => {
                    lastHandSuits[idx] = lastHandSuits[idx].replace(new RegExp(`[${suit}]`, 'g'), '');
                });
            });
            result.hands[3] = lastHandSuits.join('.');
        }
        result.hands.push(result.hands.shift());
        let vul_str = lin.match(/sv\|(.)\|/)[0].slice(3, -1);
        if ('NnSs'.includes(vul_str)) {
            result.vul = 'NS';
        }
        else if ('EeWw'.includes(vul_str)) {
            result.vul = 'EW';
        }
        else if ('oO0'.includes(vul_str)) {
            result.vul = 'None';
        }
        else if ('Bb'.includes(vul_str)) {
            result.vul = 'All';
        }
        let bids_match = lin.match(/mb\|(.+?)\|(p[cg])?/);
        let bids = [];
        if (bids_match) {
            if (/(p[cg])/.test(bids_match[0])) {
                bids = bids_match[0].slice(3, -3).replace(/!?\|an\|[^\|]*\|/g, '|').split('|mb|');
            }
            else {
                bids = bids_match[0].slice(3, -1).replace(/!?\|an\|[^\|]*\|/g, '|').split('|mb|');
            }
        }
        let bidsPerSide = [0, 0];
        let lastLvlBidPerSide = [0, 0];
        for (let i = 0; i < bids.length; i++) {
            if (bids[i] != 'p') {
                bidsPerSide[i % 2]++;
                lastLvlBidPerSide[i % 2] = isNaN(parseInt(bids[i][0]))
                    ? lastLvlBidPerSide[(i + 1) % 2]
                    : parseInt(bids[i][0]);
            }
            if (bidsPerSide.every(numBids => numBids >= 2) &&
                lastLvlBidPerSide.every(lastLvl => lastLvl >= 2)) {
                result.competitive = true;
                break;
            }
        }
        let lead = lin.match(/\|pc\|.{2}\|/);
        if (lead) {
            result.lead = lead[0].slice(4, -1).toUpperCase();
        }
    }
    catch (e) {
        return null;
    }
    return result;
};
exports.default = parseLin;
