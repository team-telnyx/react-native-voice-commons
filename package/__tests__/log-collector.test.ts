import { LogCollector } from '../lib/log-collector';

describe('LogCollector', () => {
  let collector: LogCollector;

  beforeEach(() => {
    collector = new LogCollector(5, 'debug');
  });

  it('adds and retrieves log entries', () => {
    collector.add('info', 'test message');
    const logs = collector.getLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].level).toBe('info');
    expect(logs[0].message).toBe('test message');
    expect(logs[0].timestamp).toBeDefined();
  });

  it('includes context when provided', () => {
    collector.add('warn', 'with context', { key: 'value' });
    const logs = collector.getLogs();
    expect(logs[0].context).toEqual({ key: 'value' });
  });

  it('respects maxEntries by dropping oldest entries', () => {
    for (let i = 0; i < 7; i++) {
      collector.add('info', `msg-${i}`);
    }
    const logs = collector.getLogs();
    expect(logs).toHaveLength(5);
    expect(logs[0].message).toBe('msg-2');
    expect(logs[4].message).toBe('msg-6');
  });

  it('filters logs below minimum level', () => {
    const warnCollector = new LogCollector(10, 'warn');
    warnCollector.add('debug', 'should be dropped');
    warnCollector.add('info', 'should be dropped too');
    warnCollector.add('warn', 'kept');
    warnCollector.add('error', 'also kept');

    const logs = warnCollector.getLogs();
    expect(logs).toHaveLength(2);
    expect(logs[0].message).toBe('kept');
    expect(logs[1].message).toBe('also kept');
  });

  it('getLogs returns a copy (non-destructive)', () => {
    collector.add('info', 'hello');
    const first = collector.getLogs();
    const second = collector.getLogs();
    expect(first).toEqual(second);
    expect(collector.count).toBe(1);
  });

  it('drain returns logs and clears the buffer', () => {
    collector.add('info', 'one');
    collector.add('info', 'two');
    expect(collector.count).toBe(2);

    const drained = collector.drain();
    expect(drained).toHaveLength(2);
    expect(collector.count).toBe(0);
    expect(collector.getLogs()).toHaveLength(0);
  });

  it('tracks count correctly', () => {
    expect(collector.count).toBe(0);
    collector.add('info', 'a');
    collector.add('error', 'b');
    expect(collector.count).toBe(2);
  });
});
