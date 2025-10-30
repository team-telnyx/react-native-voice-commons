# Telnyx React Native Voice Commons Package

## 📦 Package Structure

```
/react-voice-commons-sdk/
├── src/                    # ✅ TypeScript source code
├── lib/                    # ✅ Compiled JavaScript output
├── ios/                    # ✅ iOS native bridge files
├── android/                # ✅ Android native bridge files
├── package.json            # ✅ Package configuration
├── tsconfig.json           # ✅ TypeScript configuration
└── TelnyxVoiceCommons.podspec  # ✅ iOS CocoaPods spec
```

## 🧪 Testing Locally

### 1. Build the Package

```bash
cd react-voice-commons-sdk
npm run build
# Compiles TypeScript to JavaScript in lib/ directory
```

### 2. Test Package Creation

```bash
cd react-voice-commons-sdk
npm pack --dry-run --ignore-scripts
# Shows what files will be included without creating archive
```

### 3. Test Installation in Main App

The package is already installed and working in the main app:

```bash
# From project root
npm list @telnyx/react-voice-commons-sdk
```

### 4. Test App Still Works

```bash
# From project root
npm run dev
# ✅ App should start successfully using the package
```

## 🚀 Easy Deployment

### Option 1: Quick npm Publish

```bash
cd react-voice-commons-sdk
npm run build          # Build the package first
npm login              # Login to your npm account
npm publish            # Publish to npm registry
```

### Option 2: Test Before Publishing

```bash
cd react-voice-commons-sdk
npm run build          # Build the package first
npm pack              # Creates .tgz file for testing
npm publish --dry-run # Preview what would be published
npm publish           # Actually publish
```

### Option 3: Private Registry

```bash
cd react-voice-commons-sdk
npm run build          # Build the package first
npm publish --registry https://your-private-registry.com
```

## 💡 Usage Preview

```typescript
import { TelnyxVoiceProvider, useTelnyxVoice } from '@telnyx/react-voice-commons-sdk';

// Wrap your app with the provider
function App() {
  return (
    <TelnyxVoiceProvider>
      <YourAppContent />
    </TelnyxVoiceProvider>
  );
}

// Use the hook in your components
function CallComponent() {
  const { client, connect, call, callState } = useTelnyxVoice();

  const handleConnect = () => {
    connect({
      login_token: 'your-jwt-token',
    });
  };

  const handleCall = () => {
    call('+1234567890');
  };

  return (
    <div>
      <button onClick={handleConnect}>Connect</button>
      <button onClick={handleCall}>Call</button>
      <p>Call State: {callState}</p>
    </div>
  );
}
```

## 📋 Dependencies

This package depends on:

- `@telnyx/react-native-voice-sdk` - The core SDK (now from npm)
- React Native WebRTC for call functionality
- React Native VOIP Push Notifications for iOS CallKit integration
