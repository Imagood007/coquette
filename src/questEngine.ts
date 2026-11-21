import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { GatewayDispatchEvents, GatewayCloseCodes } from 'discord-api-types/v10';
import { ClientQuest } from './client';
import { Quest } from './quest';
import { getQuestData, QuestResult, QuestStatus } from './questDb';
import { MemoryMonitor, MemoryMetrics } from './metrics';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { buildQuestProgressComponents } = require(
	fs.existsSync(path.join(process.cwd(), 'embeds.js'))
		? path.join(process.cwd(), 'embeds.js')
		: path.resolve(__dirname, '../../embeds.js')
);

// ── pink palette ─────────────────────────────────────────────
const pink    = chalk.hex('#ffb6c1');
const hotpink = chalk.hex('#ff69b4');
const blush   = chalk.hex('#ffccd5');
const mint    = chalk.hex('#c8f0e0');
const peach   = chalk.hex('#ffd6a5');
const rose    = chalk.hex('#ff4d6d');
const dim     = chalk.hex('#d4a0b0').dim;

export interface SessionOptions {
	token: string;
	userId: string;
	channelId: string;
	embedMessageId?: string | null;
	tokenList?: string[];
	tokenIndex?: number;
	maxQuests?: number;
	targetQuestId?: string | string[] | null;
	durationMs?: number;
	managerToken: string;
	logChannelId?: string;
	maxConcurrentQuests?: number;
	restApiUrl?: string;
	gatewayUrl?: string;
	onProgress?: (session: QuestSession) => void;
	onEnd?: (session: QuestSession, exitCode: number | null, reason: string | null) => void;
}

function sanitizeToken(t: string): string {
	return t.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 32);
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error(message)), ms);
		promise.then(
			(value) => {
				clearTimeout(timer);
				resolve(value);
			},
			(error) => {
				clearTimeout(timer);
				reject(error);
			},
		);
	});
}

export class QuestSession extends EventEmitter {
	public readonly token: string;
	public readonly userId: string;
	public readonly channelId: string;
	public readonly embedMessageId: string | null;
	public readonly tokenList: string[];
	public readonly tokenIndex: number;
	public readonly maxQuests: number;
	public readonly durationMs: number;
	public readonly managerToken: string;
	public readonly logChannelId: string;
	public readonly maxConcurrentQuests: number;
	public readonly startTime: number;
	public readonly instanceDir: string;
	public readonly restApiUrl?: string;
	public readonly gatewayUrl?: string;
	public readonly targetQuestId: string | string[] | null;

	public status: 'starting' | 'running' | 'completed' | 'stopped' | 'failed' = 'starting';
	public endReason: string | null = null;
	public exitCode: number | null = null;
	public quests: QuestResult[] = [];
	public activeQuestOperations = 0;
	public client: ClientQuest | null = null;

	private abortController = new AbortController();
	private durationTimeout: NodeJS.Timeout | null = null;
	private embedUpdateTimer: NodeJS.Timeout | null = null;
	private lastEmbedUpdate = 0;
	private pendingQuestsUpdate: QuestResult[] | null = null;
	private pendingDoneUpdate: boolean | null = null;
	private finished = false;

	// Compatibility object for existing command stop (.stop calls instance.process.kill('SIGINT'))
	public readonly process = {
		kill: (sig?: string) => {
			this.endReason = sig === 'SIGINT' ? 'stopped' : 'killed';
			this.stop(this.endReason);
		},
	};

	constructor(options: SessionOptions) {
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

	public get signal(): AbortSignal {
		return this.abortController.signal;
	}

	public async patchEmbed(body: object): Promise<void> {
		if (!this.channelId || !this.embedMessageId || !this.managerToken) return;
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
		} catch (e: any) {
			console.error(rose(`  [embed] patch error: ${e?.message}`));
		}
	}

	public async updateEmbed(quests: QuestResult[], done: boolean, stopped = false): Promise<void> {
		const container = buildQuestProgressComponents(quests, done, this.maxQuests, stopped);
		await this.patchEmbed({ components: [container.toJSON ? container.toJSON() : container], flags: 32768 });
	}

	public async updateStoppedEmbed(): Promise<void> {
		await this.updateEmbed(this.quests || [], true, true).catch(() => {});
	}

	public scheduleEmbedUpdate(quests: QuestResult[], done: boolean, immediate = false): void {
		this.pendingQuestsUpdate = quests;
		this.pendingDoneUpdate = done;

		if (immediate || done) {
			if (this.embedUpdateTimer) {
				clearTimeout(this.embedUpdateTimer);
				this.embedUpdateTimer = null;
			}
			this.lastEmbedUpdate = Date.now();
			this.updateEmbed(quests, done).catch(() => {});
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
			this.updateEmbed(quests, done).catch(() => {});
		} else if (!this.embedUpdateTimer) {
			this.embedUpdateTimer = setTimeout(() => {
				this.embedUpdateTimer = null;
				this.lastEmbedUpdate = Date.now();
				if (this.pendingQuestsUpdate && this.pendingDoneUpdate !== null) {
					this.updateEmbed(this.pendingQuestsUpdate, this.pendingDoneUpdate).catch(() => {});
				}
			}, MIN_UPDATE_INTERVAL - timeSinceLast);
		}
	}

	public async updateEmbedNoQuests(username: string): Promise<void> {
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

	public async sendError(label: string, message: string): Promise<void> {
		if (!this.managerToken || !this.logChannelId) return;
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
		} catch (_) {}
	}

	public writeProgress(done: number, total: number, quests?: QuestResult[]): void {
		try {
			if (!fs.existsSync(this.instanceDir)) {
				fs.mkdirSync(this.instanceDir, { recursive: true });
			}
			fs.writeFileSync(
				path.join(this.instanceDir, 'progress.json'),
				JSON.stringify({ done, total, quests }),
				'utf-8',
			);
		} catch { /* ignore */ }
	}

	public async start(): Promise<void> {
		this.status = 'running';

		// Set maximum duration timeout
		this.durationTimeout = setTimeout(() => {
			this.endReason = 'duration';
			this.stop('duration');
		}, this.durationMs);

		this.client = new ClientQuest(this.token, {
			api: this.restApiUrl,
			gatewayUrl: this.gatewayUrl,
		});

		// Suppress noisy error crash
		(this.client as any).on?.('error', () => {});
		this.client.websocketManager?.on?.('error', () => {});

		// Auth failure detection
		const onDisconnect = (event: { code: number }) => {
			const INVALID_CODES = [
				GatewayCloseCodes.AuthenticationFailed, // 4004
				GatewayCloseCodes.InvalidShard,
				GatewayCloseCodes.ShardingRequired,
			];
			if (INVALID_CODES.includes(event?.code)) {
				this.exitCode = 401;
				this.endReason = 'auth_failed';
				this.stop('auth_failed');
			}
		};
		(this.client as any).on?.('disconnect', onDisconnect);

		const onShardClose = (code: number) => {
			if (code === 4004) {
				this.exitCode = 401;
				this.endReason = 'auth_failed';
				this.stop('auth_failed');
			}
		};
		this.client.websocketManager?.on?.('shardClose', onShardClose);

		this.client.once(
			GatewayDispatchEvents.Ready,
			async ({ data }: { data: { user: { username: string; id: string } } }) => {
				if (this.finished || this.signal.aborted) return;
				const { username } = data.user;

				console.log('');
				console.log(pink('  ♡ ──────────────────── ♡'));
				console.log(hotpink(`     coquettes autoquest [shared engine]`));
				console.log(blush(`     `) + dim(username) + dim(` (user: ${this.userId})`));
				console.log(pink('  ♡ ──────────────────── ♡'));
				console.log('');

				const fetchingResult: QuestResult[] = [{ name: 'Fetching quests', reward: '-', status: 'running' }];
				this.quests = fetchingResult;
				this.writeProgress(0, 1, fetchingResult);
				await this.updateEmbed(fetchingResult, false);

				try {
					await withTimeout(this.client!.fetchQuests(), 45_000, 'fetch quests timed out after 45 seconds');
				} catch (e: any) {
					if (this.finished || this.signal.aborted) return;
					const message = e?.message ?? String(e);
					const failedResult: QuestResult[] = [{ name: 'Fetch quests', reward: '-', status: 'failed', error: message.substring(0, 40) }];
					this.quests = failedResult;
					console.error(rose(`  [bot:${this.userId}] fetch quests failed: ${message}`));
					this.writeProgress(0, 1, failedResult);
					await this.updateEmbed(failedResult, true);
					await this.sendError('fetchQuests', message);
					this.exitCode = 1;
					this.stop('fetch_failed');
					return;
				}

				if (this.finished || this.signal.aborted) return;

				const manager = this.client?.questManager;
				let validQuests = manager?.filterQuestsValid() ?? [];
				const targetList: string[] = Array.isArray(this.targetQuestId)
					? this.targetQuestId
					: (this.targetQuestId && this.targetQuestId !== 'all' ? [this.targetQuestId] : []);

				if (targetList.length > 0 && !targetList.includes('all')) {
					const matched = validQuests.filter(q => targetList.includes(q.id));
					if (matched.length > 0) {
						validQuests = matched;
					} else {
						const direct = targetList
							.map(id => manager?.get(id))
							.filter((q): q is Quest => Boolean(q && !q.isCompleted() && !q.isExpired()));
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

				const questResults: QuestResult[] = validQuests.map((quest) => {
					const d = getQuestData(quest);
					const target = d.duration ?? 900;
					return {
						name: d.name,
						reward: d.reward,
						status: 'running' as QuestStatus,
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
				await this.executeQuests(validQuests, manager!, questResults);

				if (this.finished || this.signal.aborted) return;

				const done = questResults.filter(q => q.status === 'done').length;
				const failed = questResults.filter(q => q.status === 'failed').length;

				this.writeProgress(done, validQuests.length, questResults);
				await this.updateEmbed(questResults, true).catch(() => {});

				console.log('');
				console.log(pink('  ♡ ──────────────────── ♡'));
				console.log(mint(`     ✓ ${done} done`) + (failed ? rose(`  ✗ ${failed} failed`) : ''));
				console.log(pink('  ♡ ──────────────────── ♡'));
				console.log('');

				this.exitCode = 0;
				this.stop('completed');
			},
		);

		this.client.connect().catch((err: any) => {
			if (err?.message?.includes('Authentication failed')) {
				this.exitCode = 401;
				this.endReason = 'auth_failed';
				this.stop('auth_failed');
			}
		});
	}

	private async executeQuests(
		validQuests: Quest[],
		manager: any,
		questResults: QuestResult[]
	): Promise<void> {
		const total = validQuests.length;
		if (total === 0) return;

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

				const onProgress = (cur: number, target: number, minsLeft?: number) => {
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
					} else if (result === 'failed') {
						questResults[index].status = 'failed';
						questResults[index].error = 'quest execution failed';
					} else {
						questResults[index].status = 'done';
						questResults[index].reward = String(result ?? questResults[index].reward);
						questResults[index].current = questResults[index].secondsNeeded;
						questResults[index].percent = 100;
						questResults[index].timeLeft = 'done';
					}
				} catch (e: any) {
					questResults[index].status = 'failed';
					const errMsg = e?.message ?? 'Unknown';
					questResults[index].error = errMsg.substring(0, 40);
					await this.sendError(`quest · ${questResults[index].name}`, errMsg);
				} finally {
					this.activeQuestOperations = Math.max(0, this.activeQuestOperations - 1);
				}

				const doneSoFar = questResults.filter(q => q.status !== 'running').length;
				this.writeProgress(doneSoFar, total, questResults);
				this.scheduleEmbedUpdate(questResults, questResults.every(q => q.status !== 'running'), true);
			}
		};

		const workers = Array.from(
			{ length: Math.min(concurrency, total) },
			() => worker()
		);
		await Promise.all(workers);
	}

	public async stop(reason = 'stopped'): Promise<void> {
		if (this.finished) return;
		this.finished = true;
		this.status = this.exitCode === 0 ? 'completed' : 'stopped';
		if (!this.endReason) {
			this.endReason = reason;
		}

		if (reason === 'stopped' || this.endReason === 'stopped') {
			await this.updateStoppedEmbed().catch(() => {});
		}

		// 1. Abort signal
		try { this.abortController.abort(); } catch (_) {}

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
			} catch (_) {}
			this.client = null;
		}

		// 5. Remove instance directory
		try {
			if (fs.existsSync(this.instanceDir)) {
				fs.rmSync(this.instanceDir, { recursive: true, force: true });
			}
		} catch (_) {}

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

export class QuestEngine {
	private static instance: QuestEngine;
	public readonly sessions = new Map<string, QuestSession>();
	public maxSimultaneousUsers = 50;
	public maxConcurrentQuestsPerUser = Infinity;

	public static getInstance(): QuestEngine {
		if (!QuestEngine.instance) {
			QuestEngine.instance = new QuestEngine();
		}
		return QuestEngine.instance;
	}

	public startSession(options: SessionOptions): QuestSession {
		if (this.sessions.has(options.token)) {
			return this.sessions.get(options.token)!;
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

	public stopSession(tokenOrUserId: string, reason = 'stopped'): boolean {
		const session = this.sessions.get(tokenOrUserId) ||
			[...this.sessions.values()].find(s => s.userId === tokenOrUserId);
		if (!session) return false;
		session.stop(reason);
		return true;
	}

	public stopAll(reason = 'restart'): void {
		for (const session of this.sessions.values()) {
			session.stop(reason);
		}
		this.sessions.clear();
	}

	public has(token: string): boolean {
		return this.sessions.has(token);
	}

	public get(token: string): QuestSession | undefined {
		return this.sessions.get(token);
	}

	public getByUserId(userId: string): QuestSession | undefined {
		return [...this.sessions.values()].find(s => s.userId === userId);
	}

	public get activeSessionsCount(): number {
		return this.sessions.size;
	}

	public getActiveQuestOperationsCount(): number {
		let total = 0;
		for (const session of this.sessions.values()) {
			total += session.activeQuestOperations;
		}
		return total;
	}

	public getMetrics(): MemoryMetrics {
		return MemoryMonitor.getMetrics(this.activeSessionsCount, this.getActiveQuestOperationsCount());
	}
}

export const questEngine = QuestEngine.getInstance();
