'use strict';
// LOCAL-DEBUG ONLY — do not ship in a release branch.
// Routes JS log entries through the native CallKitBridge.publicLog method
// so they land in os_log with %{public}@ formatting and show up in
// Console.app even in release iOS builds. Falls back to console on
// non-iOS or when the bridge is unavailable.
Object.defineProperty(exports, '__esModule', { value: true });
exports.txlog = void 0;
const react_native_1 = require('react-native');
const bridge =
  react_native_1.Platform.OS === 'ios' ? react_native_1.NativeModules.CallKitBridge : null;
function write(level, tag, message) {
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
exports.txlog = {
  info: (tag, message) => write('info', tag, message),
  warn: (tag, message) => write('warn', tag, message),
  error: (tag, message) => write('error', tag, message),
};
