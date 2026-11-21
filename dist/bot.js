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
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const v10_1 = require("discord-api-types/v10");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const client_1 = require("./src/client");
const chalk_1 = __importDefault(require("chalk"));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { buildQuestProgressComponents } = require('./embeds.js');
// ── pink palette ─────────────────────────────────────────────
const pink = chalk_1.default.hex('#ffb6c1');
const hotpink = chalk_1.default.hex('#ff69b4');
const blush = chalk_1.default.hex('#ffccd5');
const mint = chalk_1.default.hex('#c8f0e0');
const peach = chalk_1.default.hex('#ffd6a5');
const rose = chalk_1.default.hex('#ff4d6d');
const dim = chalk_1.default.hex('#d4a0b0').dim;
// ── config ───────────────────────────────────────────────────
const CONFIG_PATH = fs.existsSync(path.join(process.cwd(), 'database', 'config.json')) ? path.join(process.cwd(), 'database', 'config.json') : path.join(process.cwd(), 'config.json');
const CONFIG = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
const TOKEN = CONFIG.TOKEN;
const MANAGER_TOKEN = CONFIG.MANAGER_TOKEN;
const STATUS_CHANNEL = CONFIG.STATUS_CHANNEL_ID;
const EMBED_MSG_ID = CONFIG.EMBED_MESSAGE_ID;
const MAX_QUESTS = CONFIG.MAX_QUESTS ?? Infinity;
// ── quest db ─────────────────────────────────────────────────
const QUEST_DB = {
    '1432436088508780675': { name: 'R.E.P.O. Monster', duration: 960 },
    '1436125144404725770': { name: 'Download Comet Browser', duration: 960 },
    '1439764528715010058': { name: 'New Season Ahsarah', duration: 960 },
    '1440059727005614090': { name: 'Opera GX', duration: 42 },
    '1418350811687419914': { name: 'The Power of Nitro', duration: 24 },
    '1425677992721514516': { name: 'Battlefield 6 Launch', duration: 960 },
    '1432424574561026070': { name: 'Dance with a Demon', duration: 960 },
    '1435391191834165398': { name: 'ABI Red Drops Fest', duration: 960 },
    '1437518140476100638': { name: 'Marvel Rivals S5.0', duration: 960 },
    '1431027486506094623': { name: 'Amazon Luna', duration: 29 },
    '1428083229587669155': { name: 'Bloons TD 6 Dart Monkey', duration: 960 },
    '1502164508033155162': { name: 'Where Winds Meet Ver 1.6 Qinchuan', duration: 960 },
    '1502102122492071958': { name: 'Where Winds Meet Ver 1.6 Qinchuan', duration: 960 },
    '1428459919212019874': { name: 'Crimson Desert', duration: 29 },
    '1435016951251603496': { name: 'Courtroom Chaos', duration: 75 },
    '1421275302923079721': { name: 'Space Marine 2 Free Demo', duration: 960 },
    '1435012985872715946': { name: 'Anno 117', duration: 158 },
    '1432205768106705070': { name: 'Battlefield REDSEC', duration: 960 },
    '1435367355759726642': { name: 'King of Meat Sale', duration: 29 },
    '1436481141711442101': { name: 'Where Winds Meet Launch', duration: 960 },
    '1430279721777762495': { name: 'PvZ Replanted', duration: 960 },
    '1432798014786764871': { name: 'Honkai: Star Rail', duration: 960 },
    '1410358070831480904': { name: 'Mobile Orbs Intro', duration: 31 },
    '1428139680477614150': { name: 'ARC Raiders', duration: 91 },
    '1432410015721062480': { name: 'ARC Raiders', duration: 960 },
    '1427820398283722833': { name: 'Painkiller', duration: 99 },
    '1427811805065121875': { name: 'Battlefield 6 on PS5 Video', duration: 29 },
    '1435777559475257428': { name: 'Amazon', duration: 29 },
    '1422714633357103315': { name: "Monopoly at McD's", duration: 96 },
    '1435324548827451605': { name: 'GO Wild Area 2025', duration: 29 },
    '1437537235133005914': { name: 'Call of Duty: Black Ops 7', duration: 960 },
    '1438202046804136028': { name: 'Microsoft Edge', duration: 29 },
    '1428092429030129755': { name: 'Chainsaw Man Movie', duration: 61 },
    '1434969640194539610': { name: 'Dinkum on Switch', duration: 89 },
    '1438642430571315290': { name: 'Alloyed Collective Gupdoption', duration: 960 },
    '1433219183411462265': { name: 'Palworld Collab', duration: 960 },
    '1435003145339273317': { name: 'The Running Man', duration: 148 },
    '1433542422268350574': { name: 'Firefox', duration: 19 },
    '1430258734113755247': { name: 'Jurassic World Rebirth', duration: 29 },
    '1432770475590684784': { name: 'Fortnite Discord', duration: 960 },
    '1438303745166409840': { name: 'EVE Online Video', duration: 89 },
    '1425291943302398073': { name: 'Discord Halloween 2025', duration: 22 },
    '1427829905323724922': { name: 'Bugonia', duration: 114 },
    '1463558755621929219': { name: 'One Piece Gachapon', duration: 960 },
    '1475943803956232283': { name: 'VALORANT Masters Santiago', duration: 960 },
    '1480604391718256773': { name: 'Version Update: Tangtang', duration: 960 },
};
// ── helpers ──────────────────────────────────────────────────
function getQuestData(quest) {
    const questId = quest.id || quest.config?.id || 'unknown';
    const name = QUEST_DB[questId]?.name ?? quest.config?.messages?.quest_name?.trim() ?? String(questId);
    const duration = QUEST_DB[questId]?.duration ?? 900;
    let reward = 'Unknown';
    const rewards = quest.config?.rewards_config?.rewards;
    if (rewards?.length > 0) {
        if (rewards[0].messages?.name)
            reward = rewards[0].messages.name;
        else if (rewards[0].orb_quantity)
            reward = `${rewards[0].orb_quantity} Orbs`;
    }
    return { name, duration, reward };
}
function writeProgress(done, total, quests) {
    try {
        fs.writeFileSync(path.join(process.cwd(), 'progress.json'), JSON.stringify({ done, total, quests }), 'utf-8');
    }
    catch { /* ignore */ }
}
// patch embed using manager bot token
async function patchEmbed(body) {
    if (!STATUS_CHANNEL || !EMBED_MSG_ID) {
        return;
    }
    try {
        const res = await fetch(`https://discord.com/api/v10/channels/${STATUS_CHANNEL}/messages/${EMBED_MSG_ID}`, {
            method: 'PATCH',
            headers: { Authorization: `Bot ${MANAGER_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            console.error(rose(`  [embed] patch failed: ${res.status} — ${JSON.stringify(err)}`));
        }
    }
    catch (e) {
        console.error(rose(`  [embed] patch error: ${e?.message}`));
    }
}
async function updateEmbed(quests, done) {
    const container = buildQuestProgressComponents(quests, done, MAX_QUESTS);
    await patchEmbed({ components: [container.toJSON()], flags: 32768 });
}
async function updateEmbedNoQuests(username) {
    await patchEmbed({
        flags: 32768,
        components: [{
                type: 17,
                components: [
                    { type: 10, content: `𝜗𝜚 **${username}**` },
                    { type: 14 },
                    { type: 10, content: '✗ no valid quests found for this account\n-# all quests may already be completed or expired' },
                ],
            }],
    });
}
// ── error logger ─────────────────────────────────────────────
const LOG_CHANNEL_ID = '976357084381741076';
function withTimeout(promise, ms, message) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(message)), ms);
        promise.then((value) => {
            clearTimeout(timer);
            resolve(value);
        }, (error) => {
            clearTimeout(timer);
            reject(error);
        });
    });
}
async function sendError(label, message) {
    if (!MANAGER_TOKEN || !LOG_CHANNEL_ID)
        return;
    try {
        await fetch(`https://discord.com/api/v10/channels/${LOG_CHANNEL_ID}/messages`, {
            method: 'POST',
            headers: { Authorization: `Bot ${MANAGER_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                flags: 32768,
                components: [{
                        type: 17,
                        components: [{
                                type: 10,
                                content: `**✗ bot error · ${label}**\n\`\`\`${String(message).slice(0, 1800)}\`\`\`\n-# ${new Date().toUTCString()}`,
                            }],
                    }],
            }),
        });
    }
    catch (_) { }
}
process.on('uncaughtException', (err) => {
    console.error(rose(`  [bot] uncaught: ${err.message}`));
    sendError('uncaught', err.stack || err.message).finally(() => process.exit(1));
});
process.on('unhandledRejection', () => { });
// ── main ─────────────────────────────────────────────────────
const client = new client_1.ClientQuest(TOKEN);
// ── suppress noisy WebSocket error crash ─────────────────────
client.on?.('error', () => { });
client.websocketManager?.on?.('error', () => { });
// ── invalid token detection (heartbeat 401/4004) ──────────────
// The underlying ws will emit a close event with a GatewayCloseCode
// when Discord rejects the token. We listen and exit with code 401
// so manager.js knows to DM the user and skip to the next token.
client.on?.('disconnect', (event) => {
    const INVALID_CODES = [
        v10_1.GatewayCloseCodes.AuthenticationFailed, // 4004
        v10_1.GatewayCloseCodes.InvalidShard, // 4010
        v10_1.GatewayCloseCodes.ShardingRequired, // 4011
    ];
    if (INVALID_CODES.includes(event?.code)) {
        process.exit(401);
    }
});
// Fallback: if the underlying websocket emits a raw close with 4004
client.websocketManager?.on?.('shardClose', (code) => {
    if (code === 4004) {
        process.exit(401);
    }
});
client.once(v10_1.GatewayDispatchEvents.Ready, async ({ data }) => {
    const { username } = data.user;
    console.log('');
    console.log(pink('  ♡ ──────────────────── ♡'));
    console.log(hotpink(`     coquettes autoquest`));
    console.log(blush(`     `) + dim(username));
    console.log(pink('  ♡ ──────────────────── ♡'));
    console.log('');
    const fetchingResult = [{ name: 'Fetching quests', reward: '-', status: 'running' }];
    writeProgress(0, 1, fetchingResult);
    await updateEmbed(fetchingResult, false);
    try {
        await withTimeout(client.fetchQuests(), 45_000, 'fetch quests timed out after 45 seconds');
    }
    catch (e) {
        const message = e?.message ?? String(e);
        const failedResult = [{ name: 'Fetch quests', reward: '-', status: 'failed', error: message.substring(0, 40) }];
        console.error(rose(`  [bot] fetch quests failed: ${message}`));
        writeProgress(0, 1, failedResult);
        await updateEmbed(failedResult, true);
        await sendError('fetchQuests', message);
        process.exit(1);
    }
    const manager = client.questManager;
    let validQuests = manager?.filterQuestsValid() ?? [];
    if (Number.isFinite(MAX_QUESTS) && validQuests.length > MAX_QUESTS) {
        validQuests = validQuests.slice(0, MAX_QUESTS);
    }
    if (validQuests.length === 0) {
        console.log(peach('  no valid quests found'));
        await updateEmbedNoQuests(username);
        setTimeout(() => process.exit(2), 500);
        return;
    }
    console.log(pink(`  ${validQuests.length} quest(s) found`));
    const questResults = validQuests.map((quest) => {
        const d = getQuestData(quest);
        return { name: d.name, reward: d.reward, status: 'running' };
    });
    writeProgress(0, validQuests.length, questResults);
    await updateEmbed(questResults, false);
    const results = await Promise.allSettled(validQuests.map(async (quest, index) => {
        const result = await manager.doingQuest(quest);
        if (result === 'skipped') {
            questResults[index].status = 'failed';
            questResults[index].error = 'unsupported quest type';
        }
        else if (result === 'failed') {
            questResults[index].status = 'failed';
            questResults[index].error = 'quest execution failed';
        }
        else {
            questResults[index].status = 'done';
            questResults[index].reward = String(result ?? questResults[index].reward);
        }
        const doneSoFar = questResults.filter(q => q.status !== 'running').length;
        writeProgress(doneSoFar, validQuests.length, questResults);
        await updateEmbed(questResults, questResults.every(q => q.status !== 'running'));
        return result;
    }));
    results.forEach((result, index) => {
        if (result.status === 'rejected') {
            questResults[index].status = 'failed';
            const errMsg = result.reason?.message ?? 'Unknown';
            questResults[index].error = errMsg.substring(0, 40);
            sendError(`quest · ${questResults[index].name}`, errMsg);
        }
    });
    writeProgress(questResults.filter(q => q.status === 'done').length, validQuests.length, questResults);
    await updateEmbed(questResults, true);
    console.log('');
    const done = questResults.filter(q => q.status === 'done').length;
    const failed = questResults.filter(q => q.status === 'failed').length;
    console.log(pink('  ♡ ──────────────────── ♡'));
    console.log(mint(`     ✓ ${done} done`) + (failed ? rose(`  ✗ ${failed} failed`) : ''));
    console.log(pink('  ♡ ──────────────────── ♡'));
    console.log('');
    setTimeout(() => process.exit(0), 500);
});
client.connect().catch((err) => {
    if (err?.message?.includes('Authentication failed'))
        process.exit(401);
});
