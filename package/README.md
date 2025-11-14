# @telnyx/react-native-voice-sdk

A comprehensive React Native SDK for Telnyx WebRTC voice calling.

## Features

- 🎯 **WebRTC Voice Calls**: High-quality voice calls using Telnyx infrastructure
- 📞 **Call Management**: Full call lifecycle management (incoming, outgoing, hold, transfer)
- 🔐 **Secure Authentication**: JWT-based authentication with SIP credentials support
- 🌐 **Network Resilience**: Automatic network change detection and reconnection
- 📊 **Event-Driven**: Comprehensive event system for real-time call state updates
- 📱 **Push Notification Ready**: Built-in support for VoIP push notifications
- 🤖 **Auto-Answer Support**: Built-in auto-answer functionality for automated workflows

## Installation

```bash
npm install @telnyx/react-native-voice-sdk
```

## Quick Start

```typescript
import { TelnyxRTC, ClientOptions } from '@telnyx/react-native-voice-sdk';

// Initialize the client
const clientOptions: ClientOptions = {
  login_token: 'your-jwt-token', // Recommended
  // OR use login/password
  // login: 'your-sip-username',
  // password: 'your-sip-password',
};

const client = new TelnyxRTC(clientOptions);

// Connect to Telnyx
await client.connect();

// Make a call
const call = await client.newCall({
  destinationNumber: '+1234567890',
  callerIdName: 'John Doe'
});

// Listen for call events
call.on('telnyx.call.state', (call, state) => {
  console.log(\`Call state: \${state}\`);
});

// Listen for client events
client.on('telnyx.client.ready', () => console.log('Ready!'));
client.on('telnyx.call.incoming', (call) => {
  call.answer(); // or call.hangup()
});
```

## API Reference

### TelnyxRTC

The main client class for managing WebRTC connections and calls.

#### Constructor

```typescript
new TelnyxRTC(options: ClientOptions)
```

#### Methods

- `connect()`: Connect to Telnyx infrastructure
- `disconnect()`: Disconnect and cleanup
- `newCall(options: CallOptions)`: Create a new outgoing call
- `processVoIPNotification(payload)`: Process VoIP push notification
- `queueAnswerFromCallKit()`: Queue answer action for push calls
- `queueEndFromCallKit()`: Queue end action for push calls

#### Events

- `telnyx.client.ready`: Client is connected and ready
- `telnyx.client.error`: Connection or authentication error
- `telnyx.call.incoming`: Incoming call received

### Call

Represents an individual voice call.

#### Methods

- `answer()`: Answer an incoming call
- `hangup()`: End the call
- `hold()`: Put call on hold
- `unhold()`: Resume call from hold
- `dtmf(digits)`: Send DTMF tones

#### Events

- `telnyx.call.state`: Call state changed ('new', 'ringing', 'active', 'ended', 'held')

## Advanced Features

### Push Notifications & Auto-Answer

```typescript
// Process push notification
client.processVoIPNotification(pushPayload);

// Enable auto-answer for next call (Android example)
import AsyncStorage from '@react-native-async-storage/async-storage';
await AsyncStorage.setItem('@auto_answer_next_call', 'true');

// Queue CallKit actions (iOS)
client.queueAnswerFromCallKit();
```

### Network Resilience

The SDK automatically handles network changes and reconnections.

```typescript
// The client will automatically reconnect on network changes
client.on('telnyx.client.ready', () => {
  console.log('Connected/Reconnected to Telnyx');
});
```

## TypeScript Support

The SDK is written in TypeScript and includes full type definitions.

```typescript
import {
  TelnyxRTC,
  ClientOptions,
  CallOptions,
  CallState,
  Call,
} from '@telnyx/react-native-voice-sdk';
```

## Example Usage

```typescript
import React, { useEffect, useState } from 'react';
import { TelnyxRTC, Call } from '@telnyx/react-native-voice-sdk';

export const VoiceApp = () => {
  const [client, setClient] = useState<TelnyxRTC | null>(null);
  const [call, setCall] = useState<Call | null>(null);

  useEffect(() => {
    const telnyxClient = new TelnyxRTC({
      login_token: 'your-jwt-token'
    });

    telnyxClient.on('telnyx.client.ready', () => {
      console.log('Ready for calls!');
    });

    telnyxClient.on('telnyx.call.incoming', (incomingCall) => {
      setCall(incomingCall);
      // Auto-answer or show incoming call UI
      incomingCall.answer();
    });

    telnyxClient.connect();
    setClient(telnyxClient);

    return () => telnyxClient.disconnect();
  }, []);

  const makeCall = async () => {
    if (client) {
      const newCall = await client.newCall({
        destinationNumber: '+1234567890'
      });
      setCall(newCall);
    }
  };

  return (
    // Your call UI here
    <></>
  );
};
```

## Requirements

- React Native 0.60+
- React 16.8+
- iOS 11.0+ / Android API 21+

## Dependencies

This package requires:

- `@react-native-community/netinfo` - Network state monitoring
- `react-native-webrtc` - WebRTC functionality
- `eventemitter3` - Event handling
- `loglevel` - Logging
- `uuid-random` - UUID generation

## License

MIT License
