import { Client, APIGatewayBotInfo } from '@discordjs/core';
import { RequestInit, Agent, setGlobalDispatcher } from 'undici';
import { REST, DefaultRestOptions, ResponseLike } from '@discordjs/rest';
import { WebSocketManager, WebSocketShard } from '@discordjs/ws';
import { GatewaySendPayload, GatewayOpcodes } from 'discord-api-types/v10';
import { QuestManager } from './questManager';
import { AllQuestsResponse } from './interface';
import { Constants } from './constants';

// Shared undici agent for high performance & connection reuse across sessions
const sharedAgent = new Agent({
	keepAliveTimeout: 15_000,
	keepAliveMaxTimeout: 60_000,
	connections: 50,
	pipelining: 1,
});
setGlobalDispatcher(sharedAgent);

// Pre-compute base64 properties once to avoid repeated serialization & allocations
const SUPER_PROPERTIES_BASE64 = Buffer.from(
	JSON.stringify(Constants.Properties),
).toString('base64');

async function makeRequest(
	url: string,
	init: RequestInit,
): Promise<ResponseLike> {
	if (init.headers) {
		const myHeaders = new Headers(init.headers as any);
		if (myHeaders.has('User-Agent')) {
			myHeaders.set('User-Agent', Constants.USER_AGENT);
		}
		if (myHeaders.has('Authorization')) {
			myHeaders.set(
				'Authorization',
				myHeaders.get('Authorization')!.replace('Bot ', ''),
			);
		}
		myHeaders.append('accept-language', 'en-US');
		myHeaders.append('origin', 'https://discord.com');
		myHeaders.append('pragma', 'no-cache');
		myHeaders.append('priority', 'u=1, i');
		myHeaders.append('referer', 'https://discord.com/channels/@me');
		myHeaders.append(
			'sec-ch-ua',
			'"Not)A;Brand";v="8", "Chromium";v="148"',
		);
		myHeaders.append('sec-ch-ua-mobile', '?0');
		myHeaders.append('sec-ch-ua-platform', '"Windows"');
		myHeaders.append('sec-fetch-dest', 'empty');
		myHeaders.append('sec-fetch-mode', 'cors');
		myHeaders.append('sec-fetch-site', 'same-origin');
		myHeaders.append('x-debug-options', 'bugReporterEnabled');
		myHeaders.append('x-discord-locale', 'en-US');
		myHeaders.append('x-discord-timezone', 'Asia/Saigon');
		myHeaders.append('x-super-properties', SUPER_PROPERTIES_BASE64);
		init.headers = myHeaders as unknown as RequestInit['headers'];
	}
	return DefaultRestOptions.makeRequest(url, init);
}

// Guard against multiple prototype patches in shared runtime
// ONLY transform Identify payloads for user quest clients (__isUserQuestManager === true).
// MUST NOT interfere with the Discord bot manager client's own intents and Identify payload!
if (!(WebSocketShard.prototype as any).__sendPatched) {
	const originalSend = WebSocketShard.prototype.send;
	WebSocketShard.prototype.send = async function (payload: GatewaySendPayload) {
		const isUserQuest = (this as any)?.strategy?.manager?.__isUserQuestManager === true;
		if (isUserQuest && payload.op === GatewayOpcodes.Identify) {
			payload.d = {
				token: payload.d.token,
				properties: {
					...Constants.Properties,
					is_fast_connect: false,
					gateway_connect_reasons: 'AppSkeleton',
				},
				capabilities: 0,
				presence: payload.d.presence,
				compress: payload.d.compress,
				client_state: {
					guild_versions: {},
				},
			} as any;
		}
		return originalSend.call(this, payload);
	};
	(WebSocketShard.prototype as any).__sendPatched = true;
}

export interface ClientQuestOptions {
	api?: string;
	gatewayUrl?: string;
}

export class ClientQuest extends Client {
	public questManager: QuestManager | null = null;
	public websocketManager: WebSocketManager | null = null;
	public destroyed = false;

	constructor(token: string, options?: ClientQuestOptions) {
		const rest = new REST({
			version: '10',
			api: options?.api ?? 'https://discord.com/api',
			makeRequest,
		}).setToken(token);

		const gateway = new WebSocketManager({
			token: token,
			intents: 0,
			rest,
		});
		// Mark this manager so the shard knows it's a selfbot user client
		(gateway as any).__isUserQuestManager = true;

		gateway.fetchGatewayInformation = (
			force?: boolean,
		): Promise<APIGatewayBotInfo> => {
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
			const normalized: AllQuestsResponse = Array.isArray(response)
				? { quests: response as any, excluded_quests: [], quest_enrollment_blocked_until: null }
				: response as AllQuestsResponse;
			this.questManager = QuestManager.fromResponse(this, normalized);
			return this.questManager;
		});
	}

	async destroy() {
		if (this.destroyed) return;
		this.destroyed = true;

		try {
			if (this.websocketManager) {
				await this.websocketManager.destroy({ code: 1000, reason: 'Session closed' });
			}
		} catch (_) {}
		this.websocketManager = null;

		try {
			this.questManager?.clear();
			this.questManager = null;
		} catch (_) {}

		try {
			(this as any).removeAllListeners?.();
		} catch (_) {}
	}
}
