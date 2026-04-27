#!/usr/bin/env node
// Rewrites this package's `@telnyx/react-native-voice-sdk` dependency
// constraint to ">=<sibling version>" right before publishing.
//
// Used by the `dev:published` npm script. Implemented in Node (not POSIX
// shell substitution) so it works on both POSIX runners and Windows, where
// npm scripts execute under `cmd.exe`.

import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const siblingPkgPath = path.resolve(__dirname, '..', '..', 'package', 'package.json');

let version;
try {
  const sibling = JSON.parse(readFileSync(siblingPkgPath, 'utf8'));
  version = sibling.version;
} catch (err) {
  console.error(`[set-voice-sdk-floor] Failed to read ${siblingPkgPath}:`, err.message);
  process.exit(1);
}

if (typeof version !== 'string' || version.length === 0) {
  console.error(`[set-voice-sdk-floor] Missing or invalid "version" in ${siblingPkgPath}`);
  process.exit(1);
}

const range = `>=${version}`;
console.log(`[set-voice-sdk-floor] Setting @telnyx/react-native-voice-sdk to "${range}"`);

execSync(`npm pkg set "dependencies.@telnyx/react-native-voice-sdk"="${range}"`, {
  stdio: 'inherit',
});
