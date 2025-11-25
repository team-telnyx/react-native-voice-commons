# Telnyx React Native Voice Commons SDK

A high-level, state-agnostic, drop-in module for the Telnyx React Native SDK that simplifies WebRTC voice calling integration with advanced features like network reconnection and push notification support.


## 📦 Package Structure

```
/react-voice-commons-sdk/
├── src/                    # ✅ TypeScript source code
├── lib/                    # ✅ Compiled JavaScript output (built from src/)
├── ios/                    # ✅ iOS native bridge files
├── android/                # ✅ Android native bridge files (future)
├── package.json            # ✅ Package configuration with smart dependency management
├── tsconfig.json           # ✅ TypeScript configuration
└── TelnyxVoiceCommons.podspec  # ✅ iOS CocoaPods spec
```

## 🧪 Development & Testing

### Development Mode (Local Package Testing)

```bash
cd react-voice-commons-sdk
npm run dev:local        # Switch to local file:../package dependency
npm run build           # Build and test changes
npm run dev             # Watch mode for development
```

### Production Mode (Published Package Testing)

```bash
cd react-voice-commons-sdk
npm run dev:published    # Switch to npm registry dependency ^0.2.0
npm run build           # Build with published dependencies
npm run test            # Run test suite
```

### 1. Build the Package

```bash
cd react-voice-commons-sdk
npm run build
# Compiles TypeScript to JavaScript in lib/ directory
npm run lint            # Check for linting issues
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
# Should show: @telnyx/react-voice-commons-sdk@0.1.4
```

### 4. Test App Still Works

```bash
# From project root
npm run dev
# ✅ App should start successfully using the package
```

## 🚀 Smart Publishing Workflow

### ✨ Automated Dependency Management

The package automatically switches between local and published dependencies:

- **Development**: Uses `file:../package` for real-time local changes
- **Publishing**: Auto-switches to `^0.2.0` npm version before publish
- **Post-Publish**: Auto-switches back to local development mode

### Quick Release (Recommended)

```bash
cd react-voice-commons-sdk
npm run build          # Build and verify everything works
npm version patch      # Bump version (0.1.4 → 0.1.5)
npm publish            # 🎯 Automatic dependency switching!
```

**What happens automatically:**
1. `prepublishOnly` → Switches to published dependency + npm install
2. `npm publish` → Publishes with correct npm dependencies
3. `postpublish` → Switches back to local dependency + npm install

### Manual Control

```bash
# Switch to published mode manually
npm run dev:published
npm version minor      # 0.1.4 → 0.2.0
npm publish

# Switch back to development mode manually
npm run dev:local
```

### Test Before Publishing

```bash
cd react-voice-commons-sdk
npm run dev:published   # Switch to published dependencies
npm run build          # Build with published deps
npm pack               # Creates .tgz file for testing
npm publish --dry-run  # Preview what would be published
npm publish            # Actually publish (switches back automatically)
```

## 💡 Usage Examples

### Basic Setup

```typescript
import { TelnyxVoiceProvider, useTelnyxVoice } from '@telnyx/react-voice-commons-sdk';

function App() {
  return (
    <TelnyxVoiceProvider>
      <YourCallScreen />
    </TelnyxVoiceProvider>
  );
}
```

### Call Management with Network Resilience

```typescript
function CallScreen() {
  const { client, connect, call, callState, currentCall } = useTelnyxVoice();

  const handleConnect = async () => {
    await connect({
      login_token: 'your-jwt-token',
    });
  };

  const handleCall = async () => {
    const newCall = await call('+1234567890');
    // Call automatically handles network transitions
  };

  // Render different UI based on call state
  return (
    <View>
      {callState === 'CONNECTING' && <Text>Connecting...</Text>}
      {callState === 'RINGING' && <Text>Ringing...</Text>}
      {callState === 'ACTIVE' && <Text>Call Active</Text>}
      {callState === 'DROPPED' && <Text>Reconnecting...</Text>}
      {callState === 'ENDED' && <Text>Call Ended</Text>}
      
      <Button title="Connect" onPress={handleConnect} />
      <Button title="Call" onPress={handleCall} />
    </View>
  );
}
```

### Push Notification Integration (iOS)

```typescript
// The SDK automatically handles VoIP push notifications
function MyApp() {
  const { client, processPushNotification } = useTelnyxVoice();

  useEffect(() => {
    // Process push notification when app starts from push
    if (pushPayload) {
      client.processVoIPNotification(pushPayload);
    }
  }, []);

  // CallKit integration works automatically
  return <TelnyxVoiceProvider>{/* Your app */}</TelnyxVoiceProvider>;
}
```

## 📋 Dependencies & Architecture

### Core Dependencies

- **`@telnyx/react-native-voice-sdk`** (^0.2.0) - Enhanced core SDK with network reconnection
- **React Native WebRTC** (^124.0.5) - WebRTC call functionality
- **React Native VoIP Push Notification** (^3.3.3) - iOS CallKit integration
- **NetInfo** - Network state monitoring for seamless transitions
- **AsyncStorage** - Push notification state persistence

### Smart Dependency Management

```json
{
  "scripts": {
    "dev:local": "npm pkg set dependencies.@telnyx/react-native-voice-sdk=file:../package",
    "dev:published": "npm pkg set dependencies.@telnyx/react-native-voice-sdk=^0.2.0",
    "prepublishOnly": "npm run dev:published && npm install",
    "postpublish": "npm run dev:local && npm install"
  }
}
```

### Peer Dependencies

Users need these in their app:
- React Native (^0.79.0)
- React (19.0.0)
- Expo Router (^5.1.0) - for navigation integration
- AsyncStorage (^2.1.0) - for state persistence

## 🔧 Development Scripts

```bash
# Building & Development
npm run build          # Compile TypeScript → JavaScript
npm run dev           # Watch mode for development
npm run clean         # Remove lib/ directory

# Testing & Quality
npm run test          # Run Jest test suite
npm run test:watch    # Watch mode testing
npm run lint          # ESLint code checking

# Documentation
npm run docs          # Generate TypeDoc documentation
npm run docs:watch    # Watch mode documentation
npm run docs:markdown # Generate markdown docs
npm run docs:all      # Generate both HTML and markdown

# Dependency Management
npm run dev:local     # Switch to local development
npm run dev:published # Switch to published dependencies

# Platform Testing
npm run android       # Test on Android
npm run ios          # Test on iOS
```

## 📚 Documentation & Resources

### Live Documentation
- **API Docs**: https://team-telnyx.github.io/react-native-voice-commons/
- **GitHub Repository**: https://github.com/team-telnyx/react-native-voice-commons
- **npm Package**: https://www.npmjs.com/package/@telnyx/react-voice-commons-sdk

### Auto-Generated Documentation
- TypeDoc generates comprehensive API documentation from `src/` comments
- Updates automatically via GitHub Actions on every push to main
- Available in both HTML and Markdown formats

### Local Documentation Development

```bash
cd react-voice-commons-sdk
npm run docs        # Generate HTML docs → docs/ folder
npm run docs:watch  # Watch for changes and regenerate
npm run docs:markdown # Generate markdown docs
open docs/index.html # View locally
```

## 🔄 Version History

- **v0.1.4** - Network reconnection UI, enhanced call state management
- **v0.1.3** - Push notification improvements, CallKit integration
- **v0.1.2** - Initial release with basic call functionality
- **v0.1.1** - Bug fixes and stability improvements
- **v0.1.0** - First public release

## 🎯 Roadmap

### Upcoming Features
- [ ] Android native bridge implementation
- [ ] Advanced call controls (hold, transfer, conference)
- [ ] Call recording integration
- [ ] Enhanced error handling and retry logic
- [ ] Performance optimizations for large-scale deployments

### Current Focus
- ✅ Network resilience and reconnection
- ✅ iOS push notification integration
- ✅ Automated development workflow
- ✅ Comprehensive documentation
