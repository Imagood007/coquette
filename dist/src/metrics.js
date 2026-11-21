"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryMonitor = void 0;
class MemoryMonitor {
    static toMB(bytes) {
        return Math.round((bytes / 1024 / 1024) * 100) / 100;
    }
    static getMetrics(activeSessions = 0, activeQuestOperations = 0) {
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
    static formatSummary(metrics) {
        return [
            `RAM: RSS ${metrics.rssMB} MB | Heap: ${metrics.heapUsedMB}/${metrics.heapTotalMB} MB`,
            `Ext: ${metrics.externalMB} MB | ArrayBuf: ${metrics.arrayBuffersMB} MB`,
            `Active: ${metrics.activeSessions} session(s), ${metrics.activeQuestOperations} quest op(s)`,
        ].join('\n');
    }
}
exports.MemoryMonitor = MemoryMonitor;
