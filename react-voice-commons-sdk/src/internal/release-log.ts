// LOCAL-DEBUG ONLY — do not ship in a release branch.
// Routes JS log entries through the native CallKitBridge.publicLog method
// so they land in os_log with %{public}@ formatting and show up in
// Console.app even in release iOS builds. Falls back to console on
// non-iOS or when the bridge is unavailable.

import { NativeModules, Platform } from 'react-native';

type Level = 'info' | 'warn' | 'error';

const bridge: any = Platform.OS === 'ios' ? NativeModules.CallKitBridge : null;

function write(level: Level, tag: string, message: string): void {
  const prefix = `[TX:${tag}]`;
  if (level === 'error') console.error(prefix, message);
  else if (level === 'warn') console.warn(prefix, message);
  else console.log(prefix, message);

  if (bridge && typeof bridge.publicLog === 'function') {
    try {
      bridge.publicLog(tag, level, message).catch(() => {});
    } catch {
      /* swallow */
    }
  }
}

export const txlog = {
  info: (tag: string, message: string) => write('info', tag, message),
  warn: (tag: string, message: string) => write('warn', tag, message),
  error: (tag: string, message: string) => write('error', tag, message),
};
