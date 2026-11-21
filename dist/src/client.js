"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientQuest = void 0;
const core_1 = require("@discordjs/core");
const undici_1 = require("undici");
const rest_1 = require("@discordjs/rest");
const ws_1 = require("@discordjs/ws");
const v10_1 = require("discord-api-types/v10");
const questManager_1 = require("./questManager");
const constants_1 = require("./constants");
// Shared undici agent for high performance & connection reuse across sessions
const sharedAgent = new undici_1.Agent({
    keepAliveTimeout: 15_000,
    keepAliveMaxTimeout: 60_000,
    connections: 50,
    pipelining: 1,
});
(0, undici_1.setGlobalDispatcher)(sharedAgent);
// Pre-compute base64 properties once to avoid repeated serialization & allocations
const SUPER_PROPERTIES_BASE64 = Buffer.from(JSON.stringify(constants_1.Constants.Properties)).toString('base64');
async function makeRequest(url, init) {
    if (init.headers) {
        const myHeaders = new Headers(init.headers);
        if (myHeaders.has('User-Agent')) {
            myHeaders.set('User-Agent', constants_1.Constants.USER_AGENT);
        }
        if (myHeaders.has('Authorization')) {
            myHeaders.set('Authorization', myHeaders.get('Authorization').replace('Bot ', ''));
        }
        myHeaders.append('accept-language', 'en-US');
        myHeaders.append('origin', 'https://discord.com');
        myHeaders.append('pragma', 'no-cache');
        myHeaders.append('priority', 'u=1, i');
        myHeaders.append('referer', 'https://discord.com/channels/@me');
        myHeaders.append('sec-ch-ua', '"Not)A;Brand";v="8", "Chromium";v="148"');
        myHeaders.append('sec-ch-ua-mobile', '?0');
        myHeaders.append('sec-ch-ua-platform', '"Windows"');
        myHeaders.append('sec-fetch-dest', 'empty');
        myHeaders.append('sec-fetch-mode', 'cors');
        myHeaders.append('sec-fetch-site', 'same-origin');
        myHeaders.append('x-debug-options', 'bugReporterEnabled');
        myHeaders.append('x-discord-locale', 'en-US');
        myHeaders.append('x-discord-timezone', 'Asia/Saigon');
        myHeaders.append('x-super-properties', SUPER_PROPERTIES_BASE64);
        init.headers = myHeaders;
    }
    return rest_1.DefaultRestOptions.makeRequest(url, init);
}
// Guard against multiple prototype patches in shared runtime
// ONLY transform Identify payloads for user quest clients (__isUserQuestManager === true).
// MUST NOT interfere with the Discord bot manager client's own intents and Identify payload!
if (!ws_1.WebSocketShard.prototype.__sendPatched) {
    const originalSend = ws_1.WebSocketShard.prototype.send;
    ws_1.WebSocketShard.prototype.send = async function (payload) {
        const isUserQuest = this?.strategy?.manager?.__isUserQuestManager === true;
        if (isUserQuest && payload.op === v10_1.GatewayOpcodes.Identify) {
            payload.d = {
                token: payload.d.token,
                properties: {
                    ...constants_1.Constants.Properties,
                    is_fast_connect: false,
                    gateway_connect_reasons: 'AppSkeleton',
                },
                capabilities: 0,
                presence: payload.d.presence,
                compress: payload.d.compress,
                client_state: {
                    guild_versions: {},
                },
            };
        }
        return originalSend.call(this, payload);
    };
    ws_1.WebSocketShard.prototype.__sendPatched = true;
}
class ClientQuest extends core_1.Client {
    questManager = null;
    websocketManager = null;
    destroyed = false;
    constructor(token, options) {
        const rest = new rest_1.REST({
            version: '10',
            api: options?.api ?? 'https://discord.com/api',
            makeRequest,
        }).setToken(token);
        const gateway = new ws_1.WebSocketManager({
            token: token,
            intents: 0,
            rest,
        });
        // Mark this manager so the shard knows it's a selfbot user client
        gateway.__isUserQuestManager = true;
        gateway.fetchGatewayInformation = (force) => {
            return Promise.resolve({
                url: options?.gatewayUrl ?? 'wss://gateway.discord.gg',
                shards: 1,
                session_start_limit: {
                    total: 1000,
                    remaining: 1000,
                    reset_after: 14400000,
                    max_concurrency: 1,
                },
            });
        };
        super({ rest, gateway });
        this.websocketManager = gateway;
    }
    connect() {
        if (this.destroyed || !this.websocketManager) {
            return Promise.reject(new Error('Client is destroyed'));
        }
        return this.websocketManager.connect();
    }
    fetchQuests() {
        return this.rest.get('/quests/@me').then((response) => {
            if (this.destroyed) {
                throw new Error('Client destroyed');
            }
            // Discord sometimes returns a plain array instead of { quests: [] }
            const normalized = Array.isArray(response)
                ? { quests: response, excluded_quests: [], quest_enrollment_blocked_until: null }
                : response;
            this.questManager = questManager_1.QuestManager.fromResponse(this, normalized);
            return this.questManager;
        });
    }
    async destroy() {
        if (this.destroyed)
            return;
        this.destroyed = true;
        try {
            if (this.websocketManager) {
                await this.websocketManager.destroy({ code: 1000, reason: 'Session closed' });
            }
        }
        catch (_) { }
        this.websocketManager = null;
        try {
            this.questManager?.clear();
            this.questManager = null;
        }
        catch (_) { }
        try {
            this.removeAllListeners?.();
        }
        catch (_) { }
    }
}
exports.ClientQuest = ClientQuest;
