# AGENTS.md — react-native-voice-commons

Telnyx React Native Voice Commons — a demo app + published library (`@telnyx/react-voice-commons-sdk`) that wraps `@telnyx/react-native-voice-sdk` with a high-level, state-agnostic VoIP module: RxJS state streams, CallKit/ConnectionService integration, push notifications, and a `TelnyxVoiceApp` wrapper component.

## Repo Structure

This repo contains **two things**:

1. **Demo app** (repo root) — Expo app demonstrating the commons SDK
2. **Published library** (`react-voice-commons-sdk/`) — the `@telnyx/react-voice-commons-sdk` npm package

```
react-voice-commons-sdk/   ← THE LIBRARY (published to npm)
  src/             TypeScript source (entry: src/index.ts)
    telnyx-voip-client.ts   TelnyxVoipClient — main facade
    telnyx-voice-app.tsx    TelnyxVoiceApp wrapper component
    callkit/                iOS CallKit bridge
    context/                React context providers
    hooks/                  React hooks for VoIP state
    internal/               Internal implementation
    models/                 Type definitions
    types/                  Ambient type declarations (telnyx-sdk.d.ts)
  __tests__/        Jest tests
  lib/              Build output (tsc → CommonJS)
  android/          Android native module
  ios/              iOS native module (Swift)
  scripts/          Dev tooling

app/                Demo app routes (expo-router)
components/         Demo app UI components
docs/               TypeDoc HTML docs
docs-markdown/      TypeDoc markdown docs
android/            Demo app Android project
ios/                Demo app iOS project
```

## Library (react-voice-commons-sdk/)

### Build & Dev

```bash
cd react-voice-commons-sdk

# Install (uses --legacy-peer-deps due to RN ecosystem)
npm install --legacy-peer-deps

# Build (tsc → lib/)
npm run build

# Watch mode
npm run dev

# Clean
npm run clean
```

### Testing

```bash
npm test              # Jest
npm run test:watch    # Watch mode
```

Jest config: `ts-jest` preset, node environment. Tests in `__tests__/`. Mocks for `react-native` and `@telnyx/react-native-voice-sdk` in `__mocks__/`.

### Linting & Formatting

```bash
npm run lint          # ESLint (src only, .ts/.tsx)
```

- Legacy ESLint config (`.eslintrc.js`): `eslint:recommended` + `@typescript-eslint`
- `no-console` is a warning (allowed: `warn`, `error`)

### Other Library Scripts

```bash
npm run docs           # TypeDoc HTML → docs/
npm run docs:watch     # TypeDoc in watch mode
npm run docs:markdown  # TypeDoc markdown → docs-markdown/
npm run docs:all       # HTML + markdown docs
npm run android        # expo run:android (native build)
npm run ios            # expo run:ios (native build)
npm run prepublishOnly # Switch to published SDK + install
npm run postpublish    # Switch back to local SDK + install
```

### Release Checklist

Each package is released under its own tag: `voice-sdk-vX.Y.Z` (`package/`) and `commons-sdk-vX.Y.Z` (`react-voice-commons-sdk/`). One run can release either package or both, each with its own version.

1. Run `release-01-create-pull-request` with the version for each package to release (leave the other blank). It opens a `release/...` PR that bumps `package.json` and lists the merged PRs that touched each package.
2. In that PR, add a `## [X.Y.Z] (YYYY-MM-DD)` section to each released package's `CHANGELOG.md`. `release-pr-check` blocks merging until `package.json` and `CHANGELOG.md` match the versions.
3. Merge, then run `release-03-create-gh-release` with the same versions. It tags the release PR's merge commit, creates one GitHub Release per package from its CHANGELOG section, and publishes to npm (voice-sdk first, since commons-sdk depends on it).

The release helpers live in `scripts/release/release_package.sh`. Prerelease versions (for example `1.2.0-beta.1`) become GitHub prereleases and are published to npm under their prerelease word (`beta`), not `latest`.

## Demo App (repo root)

### Build & Dev

```bash
# Install (uses --legacy-peer-deps due to RN ecosystem)
npm install --legacy-peer-deps

# Prebuild native projects (Expo CLI, not a package.json script)
npx expo prebuild

# Install iOS pods
cd ios && pod install && cd ..

# Start Expo dev server (wraps Metro)
npm run dev

# Start Expo dev server with platform flag
npm run ios       # iOS
npm run android   # Android
```

### Linting & Formatting

```bash
npm run lint          # Prettier check (all file types)
npm run lint:fix      # Prettier write
npm run lint:md       # ESLint markdown check
npm run lint:md:fix   # ESLint markdown fix
npm run quality:check # Full quality gate (format + markdown)
npm run security:check # npm audit (high+)
npm run ci:checks     # quality + security
```

- Demo app ESLint: flat config (`eslint.config.js`) with `@eslint/markdown` plugin for `.md` files
- Prettier: `semi: true`, `singleQuote: true`, `printWidth: 100`, `trailingComma: es5`
- Pre-commit hook (`.githooks/pre-commit`): runs `npm run lint`

## Conventions

- **CommonJS library** — commons SDK compiles to `lib/` (CommonJS, `module: commonjs`)
- **Strict TS** — demo app uses `strict: true`; library uses `strict: false`
- **Demo app is private** — `"private": true` in root package.json
- **Local linking** — commons SDK references `@telnyx/react-native-voice-sdk` via `file:../package` during dev, switched to published version before publish (`dev:published` / `dev:local` scripts)
- **TypeDoc** — API docs generated via `typedoc`; HTML in `docs/`, markdown in `docs-markdown/`
- **Push notifications** — handled natively (Android: `TelnyxFirebaseMessagingService`, iOS: `TelnyxVoipPushHandler`); do NOT add JS `setBackgroundMessageHandler`
- **RxJS state** — all state exposed as observables (`connectionState$`, `calls$`, `activeCall$`)
