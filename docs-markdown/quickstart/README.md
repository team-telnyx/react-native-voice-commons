# Quick Start Guide

Get up and running with the `@telnyx/react-voice-commons-sdk` in just a few minutes!

## Installation

```bash
npm install @telnyx/react-voice-commons-sdk
```

## Basic Setup

### 1. Wrap Your App

```tsx
// App.tsx
import React from 'react';
import { TelnyxVoiceApp, createTelnyxVoipClient } from '@telnyx/react-voice-commons-sdk';
import YourAppContent from './YourAppContent';

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
      <YourAppContent />
    </TelnyxVoiceApp>
  );
}
```

### 2. Create a Login Component

```tsx
// LoginScreen.tsx
import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text } from 'react-native';
import { useTelnyxVoice, createCredentialConfig } from '@telnyx/react-voice-commons-sdk';

export function LoginScreen() {
  const { voipClient } = useTelnyxVoice();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    const config = createCredentialConfig(username, password, {
      debug: true,
    });
    
    await voipClient.login(config);
  };

  return (
    <View>
      <TextInput
        placeholder="SIP Username"
        value={username}
        onChangeText={setUsername}
      />
      <TextInput
        placeholder="SIP Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <TouchableOpacity onPress={handleLogin}>
        <Text>Connect</Text>
      </TouchableOpacity>
    </View>
  );
}
```

### 3. Make Your First Call

```tsx
// DialerScreen.tsx
import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text } from 'react-native';
import { useTelnyxVoice } from '@telnyx/react-voice-commons-sdk';

export function DialerScreen() {
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
        keyboardType="phone-pad"
      />
      <TouchableOpacity onPress={makeCall}>
        <Text>Call</Text>
      </TouchableOpacity>
    </View>
  );
}
```

### 4. Listen to Connection State

```tsx
// useConnectionState.ts
import { useEffect, useState } from 'react';
import { useTelnyxVoice, TelnyxConnectionState } from '@telnyx/react-voice-commons-sdk';

export function useConnectionState() {
  const { voipClient } = useTelnyxVoice();
  const [connectionState, setConnectionState] = useState(voipClient.currentConnectionState);

  useEffect(() => {
    const subscription = voipClient.connectionState$.subscribe(setConnectionState);
    return () => subscription.unsubscribe();
  }, [voipClient]);

  return connectionState;
}
```

## That's It!

You now have a basic VoIP calling app! The SDK automatically handles:

- **Connection management** - Automatic reconnection and lifecycle
- **Call state management** - Complete call state machine
- **Background handling** - App state transitions
- **Authentication storage** - Secure credential persistence

## Next Steps

### Add Push Notifications

For incoming calls when your app is in the background:

- **[Push Notification Setup](https://developers.telnyx.com/development/webrtc/react-native-sdk/push-notification/portal-setup)** - Complete push notification guide

### Native Integration

For production apps, you'll need native integration:

- **[Android Setup](https://developers.telnyx.com/development/webrtc/react-native-sdk/push-notification/app-setup#android-implementation)** - MainActivity and Firebase setup
- **[iOS Setup](https://developers.telnyx.com/development/webrtc/react-native-sdk/push-notification/app-setup#ios-implementation)** - AppDelegate and VoIP push setup

### Advanced Features

The SDK provides extensive capabilities for building production VoIP apps:

- **Call Management** - Hold, mute, transfer, and conference calls (see [Call API](https://team-telnyx.github.io/react-native-voice-commons/classes/Call.html))
- **Error Handling** - Robust error handling patterns (see [Error Handling Guide](https://developers.telnyx.com/development/webrtc/react-native-sdk/error-handling))  
- **State Management** - RxJS observables and reactive patterns (see [TelnyxVoipClient API](https://team-telnyx.github.io/react-native-voice-commons/classes/TelnyxVoipClient.html))

## Configuration Options

### VoIP Client Options

```tsx
const voipClient = createTelnyxVoipClient({
  enableAppStateManagement: true, // Auto-handle background/foreground
  debug: true,                    // Enable debug logging
});
```

### TelnyxVoiceApp Options

```tsx
<TelnyxVoiceApp 
  voipClient={voipClient}
  enableAutoReconnect={true}        // Auto-reconnect on app launch
  debug={true}                      // Enable debug logging
  skipWebBackgroundDetection={true} // Skip web-specific detection
  onPushNotificationProcessingStarted={() => {
    console.log('Push notification processing started');
  }}
  onPushNotificationProcessingCompleted={() => {
    console.log('Push notification processing completed');
  }}
  onAppStateChanged={(state) => {
    console.log('App state changed:', state);
  }}
>
  {children}
</TelnyxVoiceApp>
```

## Authentication Options

### Credential-Based Authentication

```tsx
import { createCredentialConfig } from '@telnyx/react-voice-commons-sdk';

const config = createCredentialConfig('your_sip_username', 'your_sip_password', {
  debug: true,
});

await voipClient.login(config);
```

### Token-Based Authentication

```tsx
import { createTokenConfig } from '@telnyx/react-voice-commons-sdk';

const config = createTokenConfig('your_jwt_token', {
  debug: true,
});

await voipClient.loginWithToken(config);
```

### Auto-Reconnection

```tsx
// Automatically reconnect using stored credentials
const success = await voipClient.loginFromStoredConfig();

if (!success) {
  // Show login form
  console.log('Please log in again');
}
```

## Need Help?

- **[API Documentation](https://developers.telnyx.com/development/webrtc/react-native-sdk/classes)** - Complete API reference
- **[Push Notifications](https://developers.telnyx.com/development/webrtc/react-native-sdk/push-notifications)** - Push notification setup
- **[Troubleshooting](https://developers.telnyx.com/development/webrtc/react-native-sdk/error-handling)** - Common issues and solutions
- **[Demo App](https://github.com/team-telnyx/react-native-voice-commons/)** - Full demo application source code

## You're Ready!

Start building your VoIP application with the Telnyx React Voice Commons SDK. The SDK handles the complexity so you can focus on building great user experiences!