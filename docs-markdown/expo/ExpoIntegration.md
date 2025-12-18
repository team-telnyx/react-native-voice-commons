# Telnyx React Voice Commons SDK Integration Guide

This guide provides step-by-step instructions for integrating the Telnyx React Voice Commons SDK into an Expo React Native project.

## Prerequisites

Before you begin, ensure you have the following:

### Required Tools

- **Node.js** (LTS version recommended)
- **npm** or **yarn** package manager
- **Expo CLI** (`npm install -g expo-cli`)
- **macOS** (for iOS development) or **Windows/Linux** (for Android development)

### Telnyx Account

- A Telnyx account ([Sign up here](https://telnyx.com/sign-up))
- SIP Connection credentials from your Telnyx Portal
- A Telnyx phone number (optional, for outbound calls)

### Development Environment

- **iOS**: Xcode 12.0 or later (macOS only)
- **Android**: Android Studio with Android SDK

> **IMPORTANT:** The Telnyx React Native Voice SDK requires native modules and **cannot run in Expo Go**. You must use a development build created with `expo prebuild`.

## Installation

### Step 1: Create a New Expo Project

```bash
# Create a new Expo project with TypeScript template
npx create-expo-app@latest my-telnyx-app --template blank-typescript

# Navigate to the project directory
cd my-telnyx-app
```

### Step 2: Install Telnyx SDK Packages

```bash
# Install the Telnyx Voice SDK packages
npm install @telnyx/react-native-voice-sdk @telnyx/react-voice-commons-sdk --legacy-peer-deps
```

> **NOTE:** The `--legacy-peer-deps` flag is required due to React version peer dependency conflicts between Expo and the Telnyx SDK.

### Step 3: Configure Permissions

Update your `app.json` to include necessary permissions for microphone access and VoIP functionality.

### iOS Configuration

Add the following to the `ios` section in `app.json`:

```json
{
  "expo": {
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.yourcompany.telnyxvoice",
      "infoPlist": {
        "NSMicrophoneUsageDescription": "This app needs access to your microphone to make voice calls.",
        "UIBackgroundModes": ["voip"]
      }
    }
  }
}
```

### Android Configuration

Add the following to the `android` section in `app.json`:

```json
{
  "expo": {
    "android": {
      "package": "com.yourcompany.telnyxvoice",
      "permissions": [
        "RECORD_AUDIO",
        "INTERNET",
        "ACCESS_NETWORK_STATE",
        "MODIFY_AUDIO_SETTINGS"
      ]
    }
  }
}
```

## Configuration

### Step 1: Create Configuration File

Create a configuration file to store your Telnyx credentials:

**File:** `src/config/telnyx.config.ts`

```typescript
export interface TelnyxConfig {
  username: string;
  password: string;
  callerName?: string;
  callerNumber?: string;
}

export const telnyxConfig: TelnyxConfig = {
  username: 'YOUR_TELNYX_SIP_USERNAME',
  password: 'YOUR_TELNYX_SIP_PASSWORD',
  callerName: 'My App',
  callerNumber: 'YOUR_TELNYX_PHONE_NUMBER',
};
```

### Step 2: Obtain Telnyx Credentials

1. Log in to your [Telnyx Portal](https://portal.telnyx.com/)
2. Navigate to **Voice** → **SIP Connections**
3. Create a new SIP Connection or select an existing one
4. Copy the **Username** and **Password** from the connection credentials
5. Update the `telnyx.config.ts` file with your credentials

> **WARNING - Security Best Practice:** For production apps, use environment variables or secure storage (like `expo-secure-store`) instead of hardcoding credentials.

## Implementation

### Step 1: Use the Telnyx Hook

The SDK provides a `useTelnyxVoice` hook that gives you access to the VoIP client and call management:

```typescript
import { useTelnyxVoice } from '@telnyx/react-voice-commons-sdk';

export function MyComponent() {
  const { voipClient } = useTelnyxVoice();
  
  // Now you can use voipClient.login(), voipClient.newCall(), etc.
}
```

This hook provides access to:

- **voipClient**: The main VoIP client instance for connection management
- Connection management to Telnyx servers
- Call state management
- Event handling for incoming/outgoing calls
- Call control functions (mute, hold, hangup)

> **Note:** The `useTelnyxVoice` hook is only available when your components are wrapped with `TelnyxVoiceApp`. Make sure to use the wrapper component in your main App component.

### Step 2: Create UI Component

Create a UI component for the voice calling interface:

**File:** `src/components/VoiceCallUI.tsx`

```typescript
import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text } from 'react-native';
import { useTelnyxVoice, createCredentialConfig } from '@telnyx/react-voice-commons-sdk';

export function VoiceCallUI() {
  const { voipClient } = useTelnyxVoice();
  const [phoneNumber, setPhoneNumber] = useState('');
  
  const makeCall = async () => {
    const call = await voipClient.newCall(phoneNumber);
    console.log('Call initiated:', call);
  };

  return (
    <View>
      <TextInput
        placeholder="Enter phone number"
        value={phoneNumber}
        onChangeText={setPhoneNumber}
      />
      <TouchableOpacity onPress={makeCall}>
        <Text>📞 Call</Text>
      </TouchableOpacity>
    </View>
  );
}
```

This component provides:

- Connection status display
- Phone number input and dialer
- Call controls (answer, hangup, mute, hold)
- Visual feedback for call states

> **Note:** This is a basic example. You should implement comprehensive UI components that fit your app's design and handle all call states properly.

### Step 3: Update Main App Component

Update your `App.tsx` to use the Telnyx integration with the required `TelnyxVoiceApp` wrapper:

```typescript
import React from 'react';
import { StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-or';
import { TelnyxVoiceApp, createTelnyxVoipClient } from '@telnyx/react-voice-commons-sdk';
import { VoiceCallUI } from './src/components/VoiceCallUI';

// Create the VoIP client instance
const voipClient = createTelnyxVoipClient({
  enableAppStateManagement: true, // Enable automatic app state management
  debug: true, // Enable debug logging
});

export default function App() {
  return (
    <TelnyxVoiceApp
      voipClient={voipClient}
      enableAutoReconnect={true}
      debug={true}
    >
      <SafeAreaView style={styles.container}>
        <StatusBar style="auto" />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <VoiceCallUI />
        </ScrollView>
      </SafeAreaView>
    </TelnyxVoiceApp>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
});
```

> **Important:** The `TelnyxVoiceApp` wrapper component is required to provide the Telnyx context to your entire app. All components that use the `useTelnyxVoice` hook must be descendants of this wrapper.
```

## Usage

### Running the Application

### Step 1: Prebuild Native Projects

Since the Telnyx SDK uses native modules, you need to generate native iOS and Android projects:

```bash
npx expo prebuild
```

This command creates `ios/` and `android/` directories with the native project files.

### Step 2: Run on iOS

```bash
# Run on iOS simulator
npx expo run:ios

# Or run on a physical device
npx expo run:ios --device
```

### Step 3: Run on Android

```bash
# Run on Android emulator
npx expo run:android

# Or run on a physical device (with USB debugging enabled)
npx expo run:android --device
```

### Making a Call

1. **Connect to Telnyx**: Tap the "Connect to Telnyx" button
2. **Wait for Connection**: The status badge will turn green when connected
3. **Enter Phone Number**: Type the destination phone number (include country code, e.g., +1234567890)
4. **Initiate Call**: Tap the "📞 Call" button
5. **Use Call Controls**: During the call, you can:
   - **Mute/Unmute**: Toggle microphone
   - **Hold/Resume**: Put the call on hold
   - **Hang Up**: End the call

### Receiving a Call

1. Ensure you're connected to Telnyx
2. When an incoming call arrives, you'll see the "Incoming Call" screen
3. Tap "✓ Answer" to accept or "✗ Decline" to reject

## Testing

### Test Checklist

- App builds successfully for iOS
- App builds successfully for Android
- Connection to Telnyx succeeds with valid credentials
- Connection fails gracefully with invalid credentials
- Can make outbound calls
- Can receive incoming calls
- Mute/unmute functionality works
- Hold/resume functionality works
- Call hangup works correctly
- UI updates reflect call state changes

### Testing Without Real Calls

For initial testing without making actual calls:

1. Verify the app builds and runs
2. Test the connection to Telnyx (should succeed with valid credentials)
3. Check that the UI responds to connection state changes
4. Verify error handling with invalid credentials

## Troubleshooting

### Common Issues

### Issue: Unable to resolve dependency tree" during npm install

**Solution:** Use the `--legacy-peer-deps` flag:
```bash
npm install @telnyx/react-native-voice-sdk @telnyx/react-voice-commons-sdk --legacy-peer-deps
```

### Issue: App crashes on startup

**Possible Causes:**

- Native modules not properly linked
- Missing permissions

**Solution:**

1. Clean and rebuild:
   ```bash
   # iOS
   cd ios && pod install && cd ..
   npx expo run:ios

   # Android
   cd android && ./gradlew clean && cd ..
   npx expo run:android
   ```

2. Verify permissions are correctly set in `app.json`

### Issue: "Connection failed" or "Authentication error"

**Possible Causes:**

- Invalid Telnyx credentials
- Network connectivity issues
- Firewall blocking WebRTC traffic

**Solution:**

1. Verify credentials in `src/config/telnyx.config.ts`
2. Check internet connection


### Issue: No audio during call

**Possible Causes:**

- Microphone permissions not granted
- Audio routing issues

**Solution:**

1. Check that microphone permissions are granted
2. On iOS, check Settings → Privacy → Microphone
3. On Android, check App Settings → Permissions

### Issue: Cannot run in Expo Go

**This is expected behavior.** The Telnyx SDK requires native modules and cannot run in Expo Go.

**Solution:** Use development builds:
```bash
npx expo prebuild
npx expo run:ios  # or npx expo run:android
```

### Debug Logging

To enable detailed logging, check the console output when running the app. The `useTelnyxVoice` hook includes console.log statements for:

- Connection events
- Call state changes
- Errors

## API Reference

### `useTelnyxVoice` Hook

### Return Values

| Property | Type | Description |
|----------|------|-------------|
| `voipClient` | `VoipClient` | Main VoIP client instance for managing connections and calls |

### VoipClient Methods

| Method | Parameters | Description |
|--------|------------|-------------|
| `login` | `config: CredentialConfig` | Connect to Telnyx with SIP credentials |
| `logout` | None | Disconnect from Telnyx |
| `newCall` | `destination: string` | Make an outbound call |

### Call Instance (from `voipClient.newCall()`)

| Property/Method | Type | Description |
|-----------------|------|-------------|
| `callId` | `string` | Unique identifier for the call |
| `state` | `TelnyxCallState` | Current call state |
| `remoteNumber` | `string` | Phone number of the remote party |
| `answer()` | `() => void` | Answer an incoming call |
| `hangup()` | `() => void` | End the call |
| `mute()` | `() => void` | Mute the call |
| `unmute()` | `() => void` | Unmute the call |
| `hold()` | `() => void` | Put the call on hold |
| `unhold()` | `() => void` | Resume the call from hold |

### TelnyxCallState Enum

```typescript
enum TelnyxCallState {
  NEW = 'new',
  RINGING = 'ringing', 
  ACTIVE = 'active',
  HELD = 'held',
  DONE = 'done'
}
```

### Telnyx SDK Events

The SDK emits various events that are handled internally by the hook:

- `telnyx.ready` - Client is connected and ready
- `telnyx.error` - An error occurred
- `telnyx.socket.close` - Connection closed
- `telnyx.notification` - Incoming call or call update

## Additional Resources

- [Telnyx Developer Documentation](https://developers.telnyx.com/)
- [Telnyx React Native Voice SDK on npm](https://www.npmjs.com/package/@telnyx/react-native-voice-sdk)
- [Expo Documentation](https://docs.expo.dev/)
- [Expo Development Builds](https://docs.expo.dev/develop/development-builds/introduction/)





