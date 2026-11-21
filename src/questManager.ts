import { ClientQuest } from './client';
import type { AllQuestsResponse, QuestTaskConfigType } from './interface';
import { Quest } from './quest';
import chalk from 'chalk';

// ── pink palette ─────────────────────────────────────────────
const pink     = chalk.hex('#ffb6c1');
const hotpink  = chalk.hex('#ff69b4');
const blush    = chalk.hex('#ffccd5');
const lavender = chalk.hex('#e8b4d8');
const mint     = chalk.hex('#c8f0e0');
const peach    = chalk.hex('#ffd6a5');
const rose     = chalk.hex('#ff4d6d');
const dim      = chalk.hex('#d4a0b0').dim;
const tag      = (t: string) => hotpink(`[${t}]`);
const sep      = () => console.log(dim('  · · · · · · · · · · · · · · · · · · ·'));

// ============================================================

export type ProgressCallback = (current: number, target: number, minsLeft?: number) => void;

export class QuestManager implements Iterable<Quest> {
	private readonly quests = new Map<string, Quest>();
	public client: ClientQuest | null;

	constructor(client: ClientQuest, quests: Quest[] = []) {
		this.client = client;
		quests.forEach((quest) => this.quests.set(quest.id, quest));
	}

	static fromResponse(client: ClientQuest, response: AllQuestsResponse): QuestManager {
		return new QuestManager(client, response.quests.map((quest) => Quest.create(quest)));
	}

	[Symbol.iterator](): IterableIterator<Quest> { return this.quests.values(); }

	get size(): number   { return this.quests.size; }
	list(): Quest[]      { return Array.from(this.quests.values()); }
	get(id: string)      { return this.quests.get(id); }
	upsert(quest: Quest) { this.quests.set(quest.id, quest); }
	remove(id: string)   { return this.quests.delete(id); }
	clear()              { this.quests.clear(); }

	getExpired(date: Date = new Date()) { return this.list().filter(q => q.isExpired(date)); }
	getCompleted()                       { return this.list().filter(q => q.isCompleted()); }
	getClaimable()                       { return this.list().filter(q => q.isCompleted() && !q.hasClaimedRewards()); }
	hasQuest(id: string)                 { return this.quests.has(id); }

	filterQuestsValid() {
		return this.list().filter(q =>
			q.id !== '1412491570820812933' &&
			!q.isCompleted() &&
			!q.isExpired()
		);
	}

	getApplicationData(ids: string[]) {
		if (!this.client) return Promise.reject(new Error('Client unavailable'));
		const query = new URLSearchParams();
		ids.forEach(id => query.append('application_ids', id));
		return this.client.rest.get('/applications/public', { query }) as Promise<{
			id: string; name: string; icon: string; description: string;
			executables: { os: string; name: string; is_launcher: boolean }[];
		}[]>;
	}

	acceptQuest(questId: string) {
		if (!this.client) return Promise.reject(new Error('Client unavailable'));
		return this.client.rest
			.post(`/quests/${questId}/enroll`, {
				body: { location: 11, is_targeted: false, metadata_raw: null },
			})
			.then(r => {
				const quest = this.get(questId);
				quest?.updateUserStatus(r as any);
				return quest;
			});
	}

	private timeout(ms: number, signal?: AbortSignal): Promise<void> {
		if (signal?.aborted) return Promise.reject(new Error('Session aborted'));
		return new Promise<void>((resolve, reject) => {
			const timer = setTimeout(() => {
				if (signal) signal.removeEventListener('abort', onAbort);
				resolve();
			}, ms);
			const onAbort = () => {
				clearTimeout(timer);
				reject(new Error('Session aborted'));
			};
			if (signal) {
				signal.addEventListener('abort', onAbort, { once: true });
			}
		});
	}

	// ── video-progress loop ──────────────────────────────────────────
	private async runVideoProgress(
		quest: Quest,
		secondsNeeded: number,
		signal?: AbortSignal,
		onProgress?: ProgressCallback
	): Promise<boolean> {
		const maxFuture = 10;
		const speed     = 7;
		const interval  = 1;

		const rawEnrolledAt = new Date(quest.userStatus?.enrolled_at as any).getTime();
		const enrolledAt    = Number.isFinite(rawEnrolledAt) ? rawEnrolledAt : Date.now();
		const questName     = quest.config?.messages?.quest_name?.trim() ?? quest.id;

		let completed    = false;
		let current      = quest.userStatus?.progress?.['WATCH_VIDEO']?.value ?? 0;
		let videoRetries = 0;

		onProgress?.(current, secondsNeeded, Math.ceil(Math.max(0, secondsNeeded - current) / 60));

		while (true) {
			if (signal?.aborted || !this.client || this.client.destroyed) return false;

			const maxAllowed = Math.floor((Date.now() - enrolledAt) / 1000) + maxFuture;
			const timestamp  = current + speed;

			if (maxAllowed - current >= speed) {
				try {
					const res = await this.client.rest.post(`/quests/${quest.id}/video-progress`, {
						body: { timestamp: Math.min(secondsNeeded, timestamp + Math.random()) },
					}) as any;
					completed    = res.completed_at != null;
					current      = Math.min(secondsNeeded, timestamp);
					videoRetries = 0;

					const minsLeft = Math.ceil(Math.max(0, secondsNeeded - current) / 60);
					onProgress?.(current, secondsNeeded, minsLeft);

					// Progress log
					console.log('  ' + pink(`♡ [${questName}] ${current}/${secondsNeeded}s`));
				} catch (e: any) {
					if (signal?.aborted) return false;
					console.error('  ' + rose(`✗ video-progress failed: ${e?.message}`));
					videoRetries++;
					if (videoRetries > 5) {
						console.error('  ' + rose('✗ too many video-progress failures — aborting quest'));
						return false;
					}
					// Back off 3s before retrying
					await this.timeout(3000, signal).catch(() => {});
				}
			} else {
				// Not enough real-time has passed yet — wait 1s and retry
				await this.timeout(interval * 1000, signal).catch(() => {});
				continue;
			}

			if (completed || timestamp >= secondsNeeded) break;
			await this.timeout(interval * 1000, signal).catch(() => {});
		}

		// Final confirmation push if not yet marked completed
		if (!completed && !signal?.aborted && this.client && !this.client.destroyed) {
			try {
				await this.client.rest.post(`/quests/${quest.id}/video-progress`, {
					body: { timestamp: secondsNeeded },
				});
				onProgress?.(secondsNeeded, secondsNeeded, 0);
			} catch (_) {}
		} else if (completed) {
			onProgress?.(secondsNeeded, secondsNeeded, 0);
		}

		return true;
	}

	// returns: reward string | 'skipped' | 'failed'
	async doingQuest(
		quest: Quest,
		signal?: AbortSignal,
		onProgress?: ProgressCallback
	): Promise<string | 'skipped' | 'failed'> {
		const questName  = quest.config?.messages?.quest_name?.trim() ?? quest.id;
		const taskConfig = (quest.config as any)?.task_config_v2 ?? quest.config?.task_config;
		const tasks      = taskConfig?.tasks;

		sep();
		console.log('  ' + hotpink('✦') + ' ' + pink(questName));

		try {
			if (signal?.aborted) return 'failed';

			// ── enroll if needed ──────────────────────────────────────
			if (!quest.isEnrolledQuest()) {
				console.log('  ' + lavender('↳ enrolling...'));
				let enrollAttempts = 0;
				while (true) {
					if (signal?.aborted) return 'failed';
					try {
						await this.acceptQuest(quest.id);
						console.log('  ' + mint('✓ enrolled'));
						// Give Discord 1s to process enrollment before we start posting progress
						await this.timeout(1000, signal);
						break;
					} catch (e: any) {
						if (signal?.aborted) return 'failed';
						enrollAttempts++;
						console.error('  ' + rose(`✗ enroll attempt ${enrollAttempts} failed: ${e?.message}`));
						if (enrollAttempts >= 3) {
							console.error('  ' + rose('✗ giving up on enroll'));
							return 'failed';
						}
						await this.timeout(2000, signal);
					}
				}
			}

			// ── no task_config — try video-progress (new quest format) ─
			if (!tasks) {
				console.log('  ' + lavender('↳ no task_config — trying video-progress...'));
				const secondsNeeded = 30;
				const ok = await this.runVideoProgress(quest, secondsNeeded, signal, onProgress);
				if (!ok) return 'failed';
				console.log('  ' + mint('✓ done!'));
				sep();
				return quest.config?.rewards_config?.rewards?.[0]?.messages?.name ?? 'reward';
			}

			// ── find supported task ───────────────────────────────────
			const SUPPORTED = [
				'WATCH_VIDEO',
				'PLAY_ON_DESKTOP',
				'STREAM_ON_DESKTOP',
				'PLAY_ACTIVITY',
				'WATCH_VIDEO_ON_MOBILE',
			];

			const taskName = SUPPORTED.find(x => tasks[x as QuestTaskConfigType] != null) as QuestTaskConfigType | undefined;

			if (!taskName) {
				console.log('  ' + peach(`⚠ task "${Object.keys(tasks).join(', ')}" can't be automated — skip`));
				sep();
				return 'skipped';
			}

			const secondsNeeded = tasks[taskName].target;
			const initialCur    = (quest.userStatus?.progress?.[taskName]?.value as number) || 0;
			const initialMins   = Math.ceil(Math.max(0, secondsNeeded - initialCur) / 60);
			onProgress?.(initialCur, secondsNeeded, initialMins);

			// ── WATCH_VIDEO / WATCH_VIDEO_ON_MOBILE ───────────────────
			if (taskName === 'WATCH_VIDEO' || taskName === 'WATCH_VIDEO_ON_MOBILE') {
				console.log('  ' + lavender('↳ spoofing video...'));
				const ok = await this.runVideoProgress(quest, secondsNeeded, signal, onProgress);
				if (!ok) return 'failed';
				console.log('  ' + mint('✓ done!'));
				sep();
				return quest.config?.rewards_config?.rewards?.[0]?.messages?.name ?? 'reward';

			// ── PLAY_ON_DESKTOP / STREAM_ON_DESKTOP / PLAY_ACTIVITY ───
			} else if (
				taskName === 'PLAY_ON_DESKTOP' ||
				taskName === 'STREAM_ON_DESKTOP' ||
				taskName === 'PLAY_ACTIVITY'
			) {
				console.log('  ' + lavender(`↳ running ${taskName}... (updates every 60s)`));

				let heartbeatRetries = 0;
				while (!quest.isCompleted()) {
					if (signal?.aborted || !this.client || this.client.destroyed) return 'failed';

					const cur      = (quest.userStatus?.progress?.[taskName]?.value as number) || 0;
					const minsLeft = Math.ceil(Math.max(0, secondsNeeded - cur) / 60);
					onProgress?.(cur, secondsNeeded, minsLeft);

					try {
						const res = await this.client.rest.post(`/quests/${quest.id}/heartbeat`, {
							body: { application_id: quest.config.application.id, terminal: false },
						});
						quest.updateUserStatus(res as any);
						heartbeatRetries = 0;
					} catch (e: any) {
						if (signal?.aborted) return 'failed';
						console.error('  ' + rose(`✗ heartbeat failed: ${e?.message}`));
						heartbeatRetries++;
						if (heartbeatRetries > 3) {
							console.error('  ' + rose('✗ too many heartbeat failures — aborting quest'));
							return 'failed';
						}
						// Back off before retrying
						await this.timeout(10000, signal).catch(() => {});
						continue;
					}

					const updatedCur = (quest.userStatus?.progress?.[taskName]?.value as number) || cur;
					const updatedMinsLeft = Math.ceil(Math.max(0, secondsNeeded - updatedCur) / 60);
					console.log('  ' + pink(`♡ [${questName}] ${updatedCur}/${secondsNeeded}s`) + dim(`  ~${updatedMinsLeft} min left`));

					// If Discord marked the quest complete OR progress reached target, immediately report 100% and break without waiting 60s
					if (quest.isCompleted() || updatedCur >= secondsNeeded) {
						onProgress?.(secondsNeeded, secondsNeeded, 0);
						break;
					}

					onProgress?.(updatedCur, secondsNeeded, updatedMinsLeft);

					await this.timeout(60 * 1000, signal).catch(() => {});
				}

				const finalCur = (quest.userStatus?.progress?.[taskName]?.value as number) || 0;
				if (quest.isCompleted() || finalCur >= secondsNeeded) {
					onProgress?.(secondsNeeded, secondsNeeded, 0);
					if (!signal?.aborted && this.client && !this.client.destroyed) {
						try {
							const res = await this.client.rest.post(`/quests/${quest.id}/heartbeat`, {
								body: { application_id: quest.config.application.id, terminal: true },
							});
							quest.updateUserStatus(res as any);
						} catch (_) {}
					}
					console.log('  ' + mint(`✓ [${questName}] done!`));
					sep();
					return quest.config?.rewards_config?.rewards?.[0]?.messages?.name ?? 'reward';
				} else {
					console.log('  ' + peach('⚠ exited without completing'));
					sep();
					return 'failed';
				}

			} else {
				console.log('  ' + peach(`⚠ "${taskName}" not supported`));
				sep();
				return 'skipped';
			}

		} catch (e: any) {
			if (signal?.aborted || e?.message === 'Session aborted') {
				console.log('  ' + peach('⚠ quest aborted'));
				sep();
				return 'failed';
			}
			console.error(rose(`  ✗ uncaught in doingQuest: ${e?.message}`));
			console.error(rose(`  stack: ${e?.stack}`));
			sep();
			return 'failed';
		}
	}
}
