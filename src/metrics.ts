export interface MemoryMetrics {
	rss: number;
	rssMB: number;
	heapUsed: number;
	heapUsedMB: number;
	heapTotal: number;
	heapTotalMB: number;
	external: number;
	externalMB: number;
	arrayBuffers: number;
	arrayBuffersMB: number;
	activeSessions: number;
	activeQuestOperations: number;
}

export class MemoryMonitor {
	private static toMB(bytes: number): number {
		return Math.round((bytes / 1024 / 1024) * 100) / 100;
	}

	public static getMetrics(activeSessions = 0, activeQuestOperations = 0): MemoryMetrics {
		const mem = process.memoryUsage();
		return {
			rss: mem.rss,
			rssMB: MemoryMonitor.toMB(mem.rss),
			heapUsed: mem.heapUsed,
			heapUsedMB: MemoryMonitor.toMB(mem.heapUsed),
			heapTotal: mem.heapTotal,
			heapTotalMB: MemoryMonitor.toMB(mem.heapTotal),
			external: mem.external,
			externalMB: MemoryMonitor.toMB(mem.external),
			arrayBuffers: mem.arrayBuffers,
			arrayBuffersMB: MemoryMonitor.toMB(mem.arrayBuffers),
			activeSessions,
			activeQuestOperations,
		};
	}

	public static formatSummary(metrics: MemoryMetrics): string {
		return [
			`RAM: RSS ${metrics.rssMB} MB | Heap: ${metrics.heapUsedMB}/${metrics.heapTotalMB} MB`,
			`Ext: ${metrics.externalMB} MB | ArrayBuf: ${metrics.arrayBuffersMB} MB`,
			`Active: ${metrics.activeSessions} session(s), ${metrics.activeQuestOperations} quest op(s)`,
		].join('\n');
	}
}
