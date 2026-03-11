import type { CallReportLog } from './call-report-models';

const LOG_LEVELS: Record<string, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export class LogCollector {
  private buffer: CallReportLog[] = [];
  private maxEntries: number;
  private minLevel: number;

  constructor(maxEntries: number = 1000, minLogLevel: string = 'debug') {
    this.maxEntries = maxEntries;
    this.minLevel = LOG_LEVELS[minLogLevel] ?? 0;
  }

  add(level: 'debug' | 'info' | 'warn' | 'error', message: string, context?: Record<string, unknown>): void {
    if ((LOG_LEVELS[level] ?? 0) < this.minLevel) return;

    if (this.buffer.length >= this.maxEntries) {
      this.buffer.shift();
    }

    this.buffer.push({
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
    });
  }

  /** Non-destructive read of all logs */
  getLogs(): CallReportLog[] {
    return [...this.buffer];
  }

  /** Destructive read — removes and returns all logs (for intermediate flushes) */
  drain(): CallReportLog[] {
    const logs = this.buffer;
    this.buffer = [];
    return logs;
  }

  get count(): number {
    return this.buffer.length;
  }
}
