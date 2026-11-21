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
exports.questEngine = exports.QuestEngine = exports.QuestSession = void 0;
const events_1 = require("events");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const chalk_1 = __importDefault(require("chalk"));
const v10_1 = require("discord-api-types/v10");
const client_1 = require("./client");
const questDb_1 = require("./questDb");
const metrics_1 = require("./metrics");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { buildQuestProgressComponents } = require(fs.existsSync(path.join(process.cwd(), 'embeds.js'))
    ? path.join(process.cwd(), 'embeds.js')
    : path.resolve(__dirname, '../../embeds.js'));
// ── pink palette ─────────────────────────────────────────────
const pink = chalk_1.default.hex('#ffb6c1');
const hotpink = chalk_1.default.hex('#ff69b4');
const blush = chalk_1.default.hex('#ffccd5');
const mint = chalk_1.default.hex('#c8f0e0');
const peach = chalk_1.default.hex('#ffd6a5');
const rose = chalk_1.default.hex('#ff4d6d');
const dim = chalk_1.default.hex('#d4a0b0').dim;
function sanitizeToken(t) {
    return t.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 32);
}
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
class QuestSession extends events_1.EventEmitter {
    token;
    userId;
    channelId;
    embedMessageId;
    tokenList;
    tokenIndex;
    maxQuests;
    durationMs;
    managerToken;
    logChannelId;
    maxConcurrentQuests;
    startTime;
    instanceDir;
    restApiUrl;
    gatewayUrl;
    targetQuestId;
    status = 'starting';
    endReason = null;
    exitCode = null;
    quests = [];
    activeQuestOperations = 0;
    client = null;
    abortController = new AbortController();
    durationTimeout = null;
    embedUpdateTimer = null;
    lastEmbedUpdate = 0;
    pendingQuestsUpdate = null;
    pendingDoneUpdate = null;
    finished = false;
    // Compatibility object for existing command stop (.stop calls instance.process.kill('SIGINT'))
    process = {
        kill: (sig) => {
            this.endReason = sig === 'SIGINT' ? 'stopped' : 'killed';
            this.stop(this.endReason);
        },
    };
    constructor(options) {
        super();
        this.token = options.token;
        this.userId = options.userId;
        this.channelId = options.channelId;
        this.embedMessageId = options.embedMessageId ?? null;
        this.tokenList = options.tokenList ?? [options.token];
        this.tokenIndex = options.tokenIndex ?? 0;
        this.maxQuests = options.maxQuests ?? Infinity;
        this.durationMs = options.durationMs ?? 20 * 60 * 1000;
        this.managerToken = options.managerToken;
        this.logChannelId = options.logChannelId ?? '976357084381741076';
        this.maxConcurrentQuests = options.maxConcurrentQuests ?? 2; // runs in safe batches of 2
        this.restApiUrl = options.restApiUrl;
        this.gatewayUrl = options.gatewayUrl;
        this.targetQuestId = options.targetQuestId ?? null;
        this.startTime = Date.now();
        this.instanceDir = path.join(process.cwd(), 'instances', sanitizeToken(this.token));
    }
    get signal() {
        return this.abortController.signal;
    }
    async patchEmbed(body) {
        if (!this.channelId || !this.embedMessageId || !this.managerToken)
            return;
        try {
            const baseUrl = this.restApiUrl ?? 'https://discord.com/api/v10';
            const res = await fetch(`${baseUrl}/channels/${this.channelId}/messages/${this.embedMessageId}`, {
                method: 'PATCH',
                headers: { Authorization: `Bot ${this.managerToken}`, 'Content-Type': 'application/json' },
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
    async updateEmbed(quests, done, stopped = false) {
        const container = buildQuestProgressComponents(quests, done, this.maxQuests, stopped);
        await this.patchEmbed({ components: [container.toJSON ? container.toJSON() : container], flags: 32768 });
    }
    async updateStoppedEmbed() {
        await this.updateEmbed(this.quests || [], true, true).catch(() => { });
    }
    scheduleEmbedUpdate(quests, done, immediate = false) {
        this.pendingQuestsUpdate = quests;
        this.pendingDoneUpdate = done;
        if (immediate || done) {
            if (this.embedUpdateTimer) {
                clearTimeout(this.embedUpdateTimer);
                this.embedUpdateTimer = null;
            }
            this.lastEmbedUpdate = Date.now();
            this.updateEmbed(quests, done).catch(() => { });
            return;
        }
        const now = Date.now();
        const timeSinceLast = now - this.lastEmbedUpdate;
        const MIN_UPDATE_INTERVAL = 3000;
        if (timeSinceLast >= MIN_UPDATE_INTERVAL) {
            this.lastEmbedUpdate = now;
            if (this.embedUpdateTimer) {
                clearTimeout(this.embedUpdateTimer);
                this.embedUpdateTimer = null;
            }
            this.updateEmbed(quests, done).catch(() => { });
        }
        else if (!this.embedUpdateTimer) {
            this.embedUpdateTimer = setTimeout(() => {
                this.embedUpdateTimer = null;
                this.lastEmbedUpdate = Date.now();
                if (this.pendingQuestsUpdate && this.pendingDoneUpdate !== null) {
                    this.updateEmbed(this.pendingQuestsUpdate, this.pendingDoneUpdate).catch(() => { });
                }
            }, MIN_UPDATE_INTERVAL - timeSinceLast);
        }
    }
    async updateEmbedNoQuests(username) {
        await this.patchEmbed({
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
    async sendError(label, message) {
        if (!this.managerToken || !this.logChannelId)
            return;
        try {
            const baseUrl = this.restApiUrl ?? 'https://discord.com/api/v10';
            await fetch(`${baseUrl}/channels/${this.logChannelId}/messages`, {
                method: 'POST',
                headers: { Authorization: `Bot ${this.managerToken}`, 'Content-Type': 'application/json' },
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
    writeProgress(done, total, quests) {
        try {
            if (!fs.existsSync(this.instanceDir)) {
                fs.mkdirSync(this.instanceDir, { recursive: true });
            }
            fs.writeFileSync(path.join(this.instanceDir, 'progress.json'), JSON.stringify({ done, total, quests }), 'utf-8');
        }
        catch { /* ignore */ }
    }
    async start() {
        this.status = 'running';
        // Set maximum duration timeout
        this.durationTimeout = setTimeout(() => {
            this.endReason = 'duration';
            this.stop('duration');
        }, this.durationMs);
        this.client = new client_1.ClientQuest(this.token, {
            api: this.restApiUrl,
            gatewayUrl: this.gatewayUrl,
        });
        // Suppress noisy error crash
        this.client.on?.('error', () => { });
        this.client.websocketManager?.on?.('error', () => { });
        // Auth failure detection
        const onDisconnect = (event) => {
            const INVALID_CODES = [
                v10_1.GatewayCloseCodes.AuthenticationFailed, // 4004
                v10_1.GatewayCloseCodes.InvalidShard,
                v10_1.GatewayCloseCodes.ShardingRequired,
            ];
            if (INVALID_CODES.includes(event?.code)) {
                this.exitCode = 401;
                this.endReason = 'auth_failed';
                this.stop('auth_failed');
            }
        };
        this.client.on?.('disconnect', onDisconnect);
        const onShardClose = (code) => {
            if (code === 4004) {
                this.exitCode = 401;
                this.endReason = 'auth_failed';
                this.stop('auth_failed');
            }
        };
        this.client.websocketManager?.on?.('shardClose', onShardClose);
        this.client.once(v10_1.GatewayDispatchEvents.Ready, async ({ data }) => {
            if (this.finished || this.signal.aborted)
                return;
            const { username } = data.user;
            console.log('');
            console.log(pink('  ♡ ──────────────────── ♡'));
            console.log(hotpink(`     coquettes autoquest [shared engine]`));
            console.log(blush(`     `) + dim(username) + dim(` (user: ${this.userId})`));
            console.log(pink('  ♡ ──────────────────── ♡'));
            console.log('');
            const fetchingResult = [{ name: 'Fetching quests', reward: '-', status: 'running' }];
            this.quests = fetchingResult;
            this.writeProgress(0, 1, fetchingResult);
            await this.updateEmbed(fetchingResult, false);
            try {
                await withTimeout(this.client.fetchQuests(), 45_000, 'fetch quests timed out after 45 seconds');
            }
            catch (e) {
                if (this.finished || this.signal.aborted)
                    return;
                const message = e?.message ?? String(e);
                const failedResult = [{ name: 'Fetch quests', reward: '-', status: 'failed', error: message.substring(0, 40) }];
                this.quests = failedResult;
                console.error(rose(`  [bot:${this.userId}] fetch quests failed: ${message}`));
                this.writeProgress(0, 1, failedResult);
                await this.updateEmbed(failedResult, true);
                await this.sendError('fetchQuests', message);
                this.exitCode = 1;
                this.stop('fetch_failed');
                return;
            }
            if (this.finished || this.signal.aborted)
                return;
            const manager = this.client?.questManager;
            let validQuests = manager?.filterQuestsValid() ?? [];
            const targetList = Array.isArray(this.targetQuestId)
                ? this.targetQuestId
                : (this.targetQuestId && this.targetQuestId !== 'all' ? [this.targetQuestId] : []);
            if (targetList.length > 0 && !targetList.includes('all')) {
                const matched = validQuests.filter(q => targetList.includes(q.id));
                if (matched.length > 0) {
                    validQuests = matched;
                }
                else {
                    const direct = targetList
                        .map(id => manager?.get(id))
                        .filter((q) => Boolean(q && !q.isCompleted() && !q.isExpired()));
                    validQuests = direct;
                }
            }
            if (Number.isFinite(this.maxQuests) && validQuests.length > this.maxQuests) {
                validQuests = validQuests.slice(0, this.maxQuests);
            }
            if (validQuests.length === 0) {
                console.log(peach(`  [${this.userId}] no valid quests found`));
                await this.updateEmbedNoQuests(username);
                this.exitCode = 2;
                this.stop('no_quests');
                return;
            }
            console.log(pink(`  [${this.userId}] ${validQuests.length} quest(s) found`));
            const questResults = validQuests.map((quest) => {
                const d = (0, questDb_1.getQuestData)(quest);
                const target = d.duration ?? 900;
                return {
                    name: d.name,
                    reward: d.reward,
                    status: 'running',
                    current: 0,
                    secondsNeeded: target,
                    percent: 0,
                    timeLeft: `~${Math.ceil(target / 60)} min left`,
                };
            });
            this.quests = questResults;
            this.writeProgress(0, validQuests.length, questResults);
            await this.updateEmbed(questResults, false);
            // Run all valid quests concurrently so they all complete together
            await this.executeQuests(validQuests, manager, questResults);
            if (this.finished || this.signal.aborted)
                return;
            const done = questResults.filter(q => q.status === 'done').length;
            const failed = questResults.filter(q => q.status === 'failed').length;
            this.writeProgress(done, validQuests.length, questResults);
            await this.updateEmbed(questResults, true).catch(() => { });
            console.log('');
            console.log(pink('  ♡ ──────────────────── ♡'));
            console.log(mint(`     ✓ ${done} done`) + (failed ? rose(`  ✗ ${failed} failed`) : ''));
            console.log(pink('  ♡ ──────────────────── ♡'));
            console.log('');
            this.exitCode = 0;
            this.stop('completed');
        });
        this.client.connect().catch((err) => {
            if (err?.message?.includes('Authentication failed')) {
                this.exitCode = 401;
                this.endReason = 'auth_failed';
                this.stop('auth_failed');
            }
        });
    }
    async executeQuests(validQuests, manager, questResults) {
        const total = validQuests.length;
        if (total === 0)
            return;
        // If maxConcurrentQuests is specified and finite, respect it; otherwise run all simultaneously in parallel
        const concurrency = Number.isFinite(this.maxConcurrentQuests) && this.maxConcurrentQuests > 0
            ? this.maxConcurrentQuests
            : total;
        let nextIdx = 0;
        const worker = async () => {
            while (nextIdx < total && !this.signal.aborted && !this.finished) {
                const index = nextIdx++;
                const quest = validQuests[index];
                this.activeQuestOperations++;
                const onProgress = (cur, target, minsLeft) => {
                    questResults[index].current = cur;
                    questResults[index].secondsNeeded = target;
                    questResults[index].percent = Math.min(100, Math.floor((cur / target) * 100));
                    const secLeft = Math.max(0, target - cur);
                    const calcMins = minsLeft ?? Math.ceil(secLeft / 60);
                    questResults[index].timeLeft = cur >= target || questResults[index].percent >= 100 ? 'done' : calcMins > 1 ? `~${calcMins} min left` : secLeft > 0 ? `~${secLeft}s left` : 'almost done';
                    const doneSoFar = questResults.filter(q => q.status !== 'running').length;
                    this.writeProgress(doneSoFar, total, questResults);
                    this.scheduleEmbedUpdate(questResults, false);
                };
                try {
                    const result = await manager.doingQuest(quest, this.signal, onProgress);
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
                        questResults[index].current = questResults[index].secondsNeeded;
                        questResults[index].percent = 100;
                        questResults[index].timeLeft = 'done';
                    }
                }
                catch (e) {
                    questResults[index].status = 'failed';
                    const errMsg = e?.message ?? 'Unknown';
                    questResults[index].error = errMsg.substring(0, 40);
                    await this.sendError(`quest · ${questResults[index].name}`, errMsg);
                }
                finally {
                    this.activeQuestOperations = Math.max(0, this.activeQuestOperations - 1);
                }
                const doneSoFar = questResults.filter(q => q.status !== 'running').length;
                this.writeProgress(doneSoFar, total, questResults);
                this.scheduleEmbedUpdate(questResults, questResults.every(q => q.status !== 'running'), true);
            }
        };
        const workers = Array.from({ length: Math.min(concurrency, total) }, () => worker());
        await Promise.all(workers);
    }
    async stop(reason = 'stopped') {
        if (this.finished)
            return;
        this.finished = true;
        this.status = this.exitCode === 0 ? 'completed' : 'stopped';
        if (!this.endReason) {
            this.endReason = reason;
        }
        if (reason === 'stopped' || this.endReason === 'stopped') {
            await this.updateStoppedEmbed().catch(() => { });
        }
        // 1. Abort signal
        try {
            this.abortController.abort();
        }
        catch (_) { }
        // 2. Clear duration timer
        if (this.durationTimeout) {
            clearTimeout(this.durationTimeout);
            this.durationTimeout = null;
        }
        // 3. Clear embed update timer
        if (this.embedUpdateTimer) {
            clearTimeout(this.embedUpdateTimer);
            this.embedUpdateTimer = null;
        }
        // 4. Destroy ClientQuest
        if (this.client) {
            try {
                await this.client.destroy();
            }
            catch (_) { }
            this.client = null;
        }
        // 5. Remove instance directory
        try {
            if (fs.existsSync(this.instanceDir)) {
                fs.rmSync(this.instanceDir, { recursive: true, force: true });
            }
        }
        catch (_) { }
        this.activeQuestOperations = 0;
        // 6. Emit end event
        this.emit('end', {
            token: this.token,
            userId: this.userId,
            channelId: this.channelId,
            exitCode: this.exitCode ?? (reason === 'stopped' ? 0 : 1),
            endReason: this.endReason,
            tokenList: this.tokenList,
            tokenIndex: this.tokenIndex,
        });
    }
}
exports.QuestSession = QuestSession;
class QuestEngine {
    static instance;
    sessions = new Map();
    maxSimultaneousUsers = 50;
    maxConcurrentQuestsPerUser = Infinity;
    static getInstance() {
        if (!QuestEngine.instance) {
            QuestEngine.instance = new QuestEngine();
        }
        return QuestEngine.instance;
    }
    startSession(options) {
        if (this.sessions.has(options.token)) {
            return this.sessions.get(options.token);
        }
        if (this.sessions.size >= this.maxSimultaneousUsers) {
            throw new Error(`Engine reached maximum simultaneous user sessions (${this.maxSimultaneousUsers})`);
        }
        const session = new QuestSession({
            ...options,
            maxConcurrentQuests: options.maxConcurrentQuests ?? this.maxConcurrentQuestsPerUser,
        });
        this.sessions.set(options.token, session);
        session.once('end', (data) => {
            this.sessions.delete(options.token);
            options.onEnd?.(session, data.exitCode, data.endReason);
        });
        session.start().catch((err) => {
            console.error(`[engine] session start error for ${options.userId}: ${err?.message}`);
            session.stop('error');
        });
        return session;
    }
    stopSession(tokenOrUserId, reason = 'stopped') {
        const session = this.sessions.get(tokenOrUserId) ||
            [...this.sessions.values()].find(s => s.userId === tokenOrUserId);
        if (!session)
            return false;
        session.stop(reason);
        return true;
    }
    stopAll(reason = 'restart') {
        for (const session of this.sessions.values()) {
            session.stop(reason);
        }
        this.sessions.clear();
    }
    has(token) {
        return this.sessions.has(token);
    }
    get(token) {
        return this.sessions.get(token);
    }
    getByUserId(userId) {
        return [...this.sessions.values()].find(s => s.userId === userId);
    }
    get activeSessionsCount() {
        return this.sessions.size;
    }
    getActiveQuestOperationsCount() {
        let total = 0;
        for (const session of this.sessions.values()) {
            total += session.activeQuestOperations;
        }
        return total;
    }
    getMetrics() {
        return metrics_1.MemoryMonitor.getMetrics(this.activeSessionsCount, this.getActiveQuestOperationsCount());
    }
}
exports.QuestEngine = QuestEngine;
exports.questEngine = QuestEngine.getInstance();
