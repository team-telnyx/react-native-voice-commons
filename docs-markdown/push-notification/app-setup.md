# Push Notification App Setup

This guide covers the complete setup required in your React Native application to enable push notifications for incoming calls using the `@telnyx/react-voice-commons-sdk`.

## Overview

The Telnyx React Voice Commons SDK provides comprehensive push notification support for both iOS and Android platforms:

- **iOS**: Uses Apple Push Notification Service (APNs) with VoIP certificates for instant call delivery
- **Android**: Uses Firebase Cloud Messaging (FCM) for background call notifications
- **Background Handling**: Automatic call processing when app is in background or terminated
- **Native Call UI**: Integration with CallKit (iOS) and ConnectionService (Android)
- **Multidevice Support**: Up to 5 devices can receive push notifications for the same user

## Multidevice Push Notifications

Telnyx WebRTC supports multidevice push notifications. A single user can have up to 5 device tokens (either iOS - APNs or Android - FCM). When a user logs into the socket and provides a push token, our services will register this token to that user - allowing it to receive push notifications for incoming calls. If a 6th registration is made, the least recently used token will be removed. This effectively means that you can have up to 5 devices that can receive push notifications for the same incoming call.

## Prerequisites

Before implementing push notifications, ensure you have:

1. **Telnyx Portal Configuration**: Push certificates and FCM keys configured in your Telnyx portal
2. **Development Environment**: React Native development environment set up for both platforms
3. **Firebase Project** (Android): Firebase project created with FCM enabled
4. **Apple Developer Account** (iOS): VoIP push certificates configured

> **Note**: For portal configuration instructions, see [Portal Setup](./portal-setup.md).

## Application Setup

### 1. Install Dependencies

The SDK requires specific dependencies for push notification handling:

```bash
# iOS VoIP push notifications
npm install react-native-voip-push-notification

# Expo notifications for Android FCM token (if using Expo)
npx expo install expo-notifications

# Note: Firebase messaging is handled natively on Android
# No @react-native-firebase/messaging dependency required
```

### 2. Firebase Configuration (Android)

### Step 1: Download Configuration File

1. Download the `google-services.json` file from your Firebase project console
2. Place it in your project root directory (same level as `package.json`)

```txt
your-project/
├── google-services.json  ← Place here
├── package.json
├── android/
└── ios/
```

### Step 2: Configure Firebase in Android Manifest

Ensure your `android/app/src/main/AndroidManifest.xml` includes Firebase services:

```xml
<application>
    <!-- Your existing application configuration -->

    <!-- Firebase Messaging Service -->
    <service
        android:name=".AppFirebaseMessagingService"
        android:exported="false">
        <intent-filter>
            <action android:name="com.google.firebase.MESSAGING_EVENT" />
        </intent-filter>
    </service>

    <!-- Telnyx Notification Action Receiver -->
    <receiver
        android:name=".AppNotificationActionReceiver"
        android:exported="false">
        <intent-filter>
            <action android:name="com.telnyx.rn_voice_sdk_demo.ANSWER_CALL" />
            <action android:name="com.telnyx.rn_voice_sdk_demo.REJECT_CALL" />
        </intent-filter>
    </receiver>
</application>
```

### 3. Native Implementation

### Android Implementation

### Step 1: Extend TelnyxMainActivity

Your app's `MainActivity` should extend `TelnyxMainActivity` for automatic push notification handling:

```kotlin
// android/app/src/main/java/com/yourpackage/MainActivity.kt
package com.yourpackage

import com.telnyx.react_voice_commons.TelnyxMainActivity
import android.content.Intent
import android.os.Bundle

class MainActivity : TelnyxMainActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Your app-specific initialization
    }

    override fun onHandleIntent(intent: Intent) {
        super.onHandleIntent(intent)
        // Handle any additional intent processing if needed
    }
}
```

**Key Features Provided by TelnyxMainActivity:**

- Automatic push notification intent handling
- Call action processing (Answer/Decline from notifications)
- Proper lifecycle management for VoIP functionality
- Integration with `VoicePnManager` for push notification state

### Step 2: Create Firebase Messaging Service

Create a Firebase messaging service that extends `TelnyxFirebaseMessagingService`:

```kotlin
// android/app/src/main/java/com/yourpackage/AppFirebaseMessagingService.kt
package com.yourpackage

import com.telnyx.react_voice_commons.TelnyxFirebaseMessagingService

/**
 * App-specific FCM service that extends the Telnyx base service
 */
class AppFirebaseMessagingService : TelnyxFirebaseMessagingService() {
    // All Telnyx voice push notification handling is inherited from the base class
    // Add any app-specific FCM handling here if needed
}
```

### Step 3: Create Notification Action Receiver

Create a notification action receiver for handling notification actions:

```kotlin
// android/app/src/main/java/com/yourpackage/AppNotificationActionReceiver.kt
package com.yourpackage

import com.telnyx.react_voice_commons.TelnyxNotificationActionReceiver

/**
 * App-specific notification action receiver
 */
class AppNotificationActionReceiver : TelnyxNotificationActionReceiver() {
    // All notification action handling is inherited from the base class
    // Add any app-specific notification handling here if needed
}
```

### iOS Implementation

### Step 1: Configure AppDelegate

Your `AppDelegate` should implement `PKPushRegistryDelegate` and delegate to `TelnyxVoipPushHandler`:

```swift
// ios/YourApp/AppDelegate.swift
import UIKit
import PushKit
import TelnyxVoiceCommons

@UIApplicationMain
public class AppDelegate: ExpoAppDelegate, PKPushRegistryDelegate {

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // Your existing setup...

    // Initialize VoIP push registry via react-voice-commons
    TelnyxVoipPushHandler.initializeVoipRegistration()

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  // MARK: - VoIP Push Notifications
  public func pushRegistry(
    _ registry: PKPushRegistry,
    didUpdate pushCredentials: PKPushCredentials,
    for type: PKPushType
  ) {
    TelnyxVoipPushHandler.shared.handleVoipTokenUpdate(pushCredentials, type: type)
  }

  public func pushRegistry(
    _ registry: PKPushRegistry,
    didReceiveIncomingPushWith payload: PKPushPayload,
    for type: PKPushType,
    completion: @escaping () -> Void
  ) {
    TelnyxVoipPushHandler.shared.handleVoipPush(payload, type: type, completion: completion)
  }
}
```

**Important Notes:**

- CallKit integration is automatically handled by the internal `CallBridge` component
- You don't need to implement any CallKit delegate methods manually
- Audio session management is automatically handled
- The `TelnyxVoipPushHandler` manages all VoIP push notification processing

### Step 2: Configure Info.plist

Add the required background modes to your `ios/YourApp/Info.plist`:

```xml
<key>UIBackgroundModes</key>
<array>
    <string>voip</string>
    <string>background-processing</string>
</array>
```

### 4. JavaScript/TypeScript Integration

### Step 1: Configure TelnyxVoiceApp

Wrap your app with `TelnyxVoiceApp` for automatic lifecycle management:

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

### Step 2: No Background Handler Required

**Android push notifications are handled automatically by the SDK's native components.** You don't need to register any background message handlers in your JavaScript code.

The SDK handles everything natively through:

- `TelnyxMainActivity` (extends your MainActivity)
- `TelnyxFirebaseMessagingService` (extends your FCM service)

Simply extend these classes as shown in the native implementation steps above, and push notifications will work automatically.

### Step 3: Token Registration (Optional)

Push tokens are handled automatically by the SDK during authentication. For most apps, you don't need to do anything additional.

If you want to handle push tokens manually (for logging or custom logic), you can use the `VoipTokenFetcher` component:

```tsx
import { VoipTokenFetcher } from './VoipTokenFetcher';

export function YourLoginComponent() {
  const handleTokenReceived = (token: string) => {
    console.log('Push token received:', token);
    // Store or use the token as needed
  };

  return (
    <View>
      <VoipTokenFetcher onTokenReceived={handleTokenReceived} debug={true} />
      {/* Your login form here */}
    </View>
  );
}
```

The `VoipTokenFetcher` component automatically:

- Requests notification permissions
- Retrieves FCM tokens (Android) and VoIP tokens (iOS)
- Handles platform-specific token registration

### Step 4: Authentication

Include push tokens in your login configuration:

```tsx
// Login with automatic push token handling
import { createCredentialConfig } from '@telnyx/react-voice-commons-sdk';

const handleLogin = async (username: string, password: string) => {
  const config = createCredentialConfig(username, password, {
    debug: true,
    // Push tokens are automatically retrieved and registered by the SDK
  });

  await voipClient.login(config);
};
```

## Configuration Options

### TelnyxVoiceApp Configuration

```tsx
<TelnyxVoiceApp
  voipClient={voipClient}
  enableAutoReconnect={true}        // Enable automatic reconnection
  debug={true}                      // Enable debug logging
  skipWebBackgroundDetection={true} // Skip web-specific background detection
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

### VoIP Client Configuration

```tsx
const voipClient = createTelnyxVoipClient({
  enableAppStateManagement: true, // Enable automatic app state management
  debug: true,                    // Enable debug logging
});
```

**Configuration Options Explained:**

- **`enableAppStateManagement: true`**: Enables automatic background/foreground app state management. When enabled, the library automatically disconnects when the app goes to background (unless there's an active call) and handles reconnection logic.
- **`debug: true`**: Enables detailed logging for connection states, call transitions, and push notification processing.

### Authentication with Push Tokens

Push tokens are automatically handled by the SDK. You only need to include the SDK and authenticate normally:

### Credential-Based Authentication

```tsx
import { createCredentialConfig } from '@telnyx/react-voice-commons-sdk';

const config = createCredentialConfig('your_sip_username', 'your_sip_password', {
  debug: true,
  // Push tokens are automatically managed by the SDK
});

await voipClient.login(config);
```

### Token-Based Authentication

```tsx
import { createTokenConfig } from '@telnyx/react-voice-commons-sdk';

const config = createTokenConfig('your_jwt_token', {
  debug: true,
  // Push tokens are automatically managed by the SDK
});

await voipClient.loginWithToken(config);
```

## What Happens Automatically

The SDK handles push notifications automatically once you:

1. **Android**: Extend `TelnyxMainActivity` and `TelnyxFirebaseMessagingService`
2. **iOS**: Implement `PKPushRegistryDelegate` and delegate to `TelnyxVoipPushHandler`
3. **Both**: Wrap your app with `TelnyxVoiceApp` and authenticate with the SDK

### Android Automatic Features

- FCM token registration with Telnyx servers
- Background push notification processing
- Incoming call notifications with Answer/Decline buttons
- App launching from terminated state
- Call connection and audio setup

### iOS Automatic Features

- VoIP token registration with Telnyx servers
- CallKit integration for native call UI
- Background call processing
- App launching from terminated state
- Audio session management

## Advanced Configuration

### Custom FCM Message Handling (Android)

If you need to handle additional FCM messages beyond Telnyx voice calls, extend the service:

```kotlin
// android/app/src/main/java/com/yourpackage/AppFirebaseMessagingService.kt
class AppFirebaseMessagingService : TelnyxFirebaseMessagingService() {

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        // Let Telnyx handle voice notifications first
        super.onMessageReceived(remoteMessage)

        // Handle your app's other notifications
        if (remoteMessage.data.containsKey("your_app_notification_type")) {
            // Handle your custom notifications
        }
    }
}
```

### Push Notification Debugging

Enable comprehensive debugging for push notification issues:

```tsx
// Enable global debug logging
if (__DEV__) {
  (global as any).__TELNYX_DEBUG__ = true;
}

const voipClient = createTelnyxVoipClient({
  debug: true, // Enable SDK debug logging
});
```

## Troubleshooting

### Common Issues

### Push Notifications Not Received

**Android:**

- Verify `google-services.json` is in the correct location
- Check Firebase project configuration and FCM keys in Telnyx portal
- Ensure `AppFirebaseMessagingService` is properly registered in AndroidManifest.xml
- Verify app is not in battery optimization/doze mode

**iOS:**

- Ensure VoIP push certificates are configured in Apple Developer account
- Verify certificates are uploaded to Telnyx portal
- Check that `TelnyxVoipPushHandler.initializeVoipRegistration()` is called
- Ensure app has proper VoIP background modes configured

### App Not Launching from Push

**Android:**

- Verify `MainActivity` extends `TelnyxMainActivity`
- Check intent filters in AndroidManifest.xml
- Ensure `onHandleIntent` is properly implemented

**iOS:**

- Verify AppDelegate implements `PKPushRegistryDelegate`
- Ensure proper delegation to `TelnyxVoipPushHandler`
- Check VoIP background modes in Info.plist

### Call Connection Issues

- Verify authentication is successful before push notification
- Check network connectivity and Telnyx service availability
- Ensure proper error handling in push notification flow
- Verify call state management in `TelnyxVoiceApp`

### Debug Logging

Enable detailed logging to troubleshoot issues:

```tsx
// In your main component
useEffect(() => {
  // Listen to connection states
  const connectionSub = voipClient.connectionState$.subscribe((state) => {
    console.log('Connection state:', state);
  });

  // Listen to call states
  const callsSub = voipClient.calls$.subscribe((calls) => {
    console.log('Active calls:', calls.length);
    calls.forEach((call, index) => {
      console.log(`Call ${index}:`, call.currentState);
    });
  });

  return () => {
    connectionSub.unsubscribe();
    callsSub.unsubscribe();
  };
}, []);
```

## Security Considerations

1. **Token Storage**: Push tokens are automatically stored securely by the SDK
2. **Certificate Management**: Keep VoIP certificates and FCM keys secure
3. **Authentication**: Ensure proper authentication before accepting calls
4. **Network Security**: Use secure connections for all Telnyx communications

## Next Steps

After completing the app setup:

1. **Test Push Notifications**: Test with both foreground and background scenarios
2. **Call Flow Testing**: Verify complete call flow from push to termination
3. **Production Deployment**: Configure production certificates and keys
4. **Monitoring**: Implement logging and monitoring for production use

For additional configuration and troubleshooting, see:

- [Portal Setup Guide](./portal-setup.md)
- [API Documentation](../README.md)
- [Telnyx Developer Portal](https://developers.telnyx.com)


