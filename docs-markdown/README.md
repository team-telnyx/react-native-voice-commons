**@telnyx/react-voice-commons-sdk v0.1.2**

***

# Telnyx React Native Voice SDK Demo

A comprehensive demo application showcasing the **@telnyx/react-voice-commons-sdk** library - a high-level, state-agnostic, drop-in module for the Telnyx React Native SDK that simplifies WebRTC voice calling integration.

## Overview

This demo app demonstrates how to integrate the `@telnyx/react-voice-commons-sdk` library to create a fully functional VoIP calling application with native call UI support, push notifications, and background handling.

### Key Features Demonstrated

- **TelnyxVoiceApp Integration**: Automatic lifecycle management and push notification handling
- **Native Call UI**: CallKit (iOS) and ConnectionService (Android) integration
- **Background Handling**: Seamless app state transitions and background call processing
- **Push Notifications**: Firebase (Android) and APNs (iOS) integration
- **Reactive State Management**: RxJS-based state streams for real-time UI updates
- **Modern UI Components**: Built with NativeWind v4 and react-native-reusables
- **Dark/Light Mode**: Persistent theme support with system navigation bar matching

## About @telnyx/react-voice-commons-sdk

The `@telnyx/react-voice-commons-sdk` library provides:

- **Headless Operation**: Core library that can establish and manage call state programmatically
- **Reactive Streams**: All state exposed via RxJS observables for easy integration
- **Simplified API**: Single facade class (`TelnyxVoipClient`) that hides underlying complexity
- **Automatic Lifecycle Management**: Background/foreground handling with `TelnyxVoiceApp` component
- **Call State Management**: Central state machine for managing multiple calls
- **Session Management**: Automatic connection lifecycle with reconnection logic
- **Push Notification Support**: Built-in handling for background push notifications
- **TypeScript Support**: Full TypeScript definitions for better developer experience

## Quick Start

Ready to get started? Check out our **[Quick Start Guide](./quickstart/README.md)** to build your first VoIP app in minutes!

The quickstart covers:
- **Installation** - Get the SDK installed
- **Basic Setup** - Wrap your app and create a client
- **Make Your First Call** - Simple dialer implementation
- **Authentication** - Login with credentials or tokens
- **Next Steps** - Push notifications and native integration

## Core Components Used in Demo

#### 1. VoIP Client Configuration

```tsx
const voipClient = createTelnyxVoipClient({
  enableAppStateManagement: true, // Optional: Enable automatic app state management (default: true)
  debug: true, // Optional: Enable debug logging
});
```

**Configuration Options Explained:**

- **`enableAppStateManagement: true`** - **Optional (default: true)**: Enables automatic background/foreground app state management. When enabled, the library automatically disconnects when the app goes to background (unless there's an active call) and handles reconnection logic. Set to `false` if you want to handle app lifecycle manually.
- **`debug: true`** - **Optional**: Enables detailed logging for connection states, call transitions, and push notification processing. Useful for development and troubleshooting.

#### 2. TelnyxVoiceApp Wrapper

The `TelnyxVoiceApp` component handles:

- Automatic background/foreground lifecycle management
- Push notification processing from terminated state
- Login state management with automatic reconnection
- Background client management for push notifications

#### 3. Reactive State Management

```tsx
// Listen to connection state
voipClient.connectionState$.subscribe((state) => {
  console.log('Connection state:', state);
});

// Listen to active calls
voipClient.calls$.subscribe((calls) => {
  console.log('Active calls:', calls);
});

// Handle individual call state
call.callState$.subscribe((state) => {
  console.log('Call state:', state);
});
```

#### 4. Call Management

```tsx
// Make a call
const call = await voipClient.newCall('1234567890');

// Answer incoming call
await call.answer();

// Control call
await call.mute();
await call.hold();
await call.hangup();
```

### Authentication & Persistent Storage

The library supports both credential-based and token-based authentication with automatic persistence for seamless reconnection.

#### Authentication Methods

##### 1. Credential-Based Authentication

```tsx
import { createCredentialConfig } from '@telnyx/react-voice-commons-sdk';

const config = createCredentialConfig('your_sip_username', 'your_sip_password', {
  debug: true,
  pushNotificationDeviceToken: 'your_device_token',
});

await voipClient.login(config);
```

##### 2. Token-Based Authentication

```tsx
import { createTokenConfig } from '@telnyx/react-voice-commons-sdk';

const config = createTokenConfig('your_jwt_token', {
  debug: true,
  pushNotificationDeviceToken: 'your_device_token',
});

await voipClient.loginWithToken(config);
```

#### Automatic Storage & Reconnection

The library automatically stores authentication data securely for seamless reconnection. **You don't need to manually manage these storage keys** - the library handles everything internally.

##### Internal Storage (Managed Automatically)

The library uses these AsyncStorage keys internally:

- `@telnyx_username` - SIP username (credential auth)
- `@telnyx_password` - SIP password (credential auth)
- `@credential_token` - JWT authentication token (token auth)
- `@push_token` - Push notification device token

**Note**: These are managed automatically by the library. You only need to call `login()` once, and the library will handle storage and future reconnections.

##### Auto-Reconnection

```tsx
// Automatically reconnects using internally stored credentials or token
const success = await voipClient.loginFromStoredConfig();

if (!success) {
  // No stored authentication data found, show login UI
  console.log('Please log in again');
}
```

**When Auto-Reconnection Happens:**

- App launches from background/terminated state
- Push notification received while disconnected
- Network reconnection after connectivity loss
- App state changes (foreground/background transitions)

**Demo App Note**: The demo app's `TelnyxLoginForm` component does additional storage for UI convenience (pre-filling the login form). This is separate from the library's internal authentication storage and is not required for production apps.

##### Manual Storage Management (Advanced Use Only)

If you need to clear stored authentication data manually:

```tsx
import AsyncStorage from '@react-native-async-storage/async-storage';

// Clear all Telnyx authentication data
await AsyncStorage.multiRemove([
  '@telnyx_username',
  '@telnyx_password',
  '@credential_token',
  '@push_token',
]);
```

**Important**: This is typically not needed. The library manages authentication storage automatically. Only use this for advanced scenarios like implementing a "logout" feature that clears all stored data.

### Native Integration

The demo app shows complete native integration for both platforms. These integrations are required for production apps using the library.

#### Android Integration

##### 1. MainActivity Setup

Your app's MainActivity should extend `TelnyxMainActivity` for automatic push notification handling:

```kotlin
// In your app's MainActivity.kt
import com.telnyx.react_voice_commons.TelnyxMainActivity

class MainActivity : TelnyxMainActivity() {
    // Your app-specific code

    override fun onHandleIntent(intent: Intent) {
        super.onHandleIntent(intent)
        // Handle any additional intent processing
    }
}
```

The `TelnyxMainActivity` provides:

- Automatic push notification intent handling
- Call action processing (Answer/Decline from notifications)
- Proper lifecycle management for VoIP functionality
- Integration with `VoicePnManager` for push notification state

##### 2. Push Notification Setup

1. Place `google-services.json` in the project root
2. Register background message handler:

```tsx
import messaging from '@react-native-firebase/messaging';
import { TelnyxVoiceApp } from '@telnyx/react-voice-commons-sdk';

messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  await TelnyxVoiceApp.handleBackgroundPush(remoteMessage.data);
});
```

#### iOS Integration

##### 1. AppDelegate Setup

Your AppDelegate only needs to implement `PKPushRegistryDelegate` for VoIP push notifications. CallKit integration is automatically handled by CallBridge:

```swift
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
  public func pushRegistry(_ registry: PKPushRegistry, didUpdate pushCredentials: PKPushCredentials, for type: PKPushType) {
    TelnyxVoipPushHandler.shared.handleVoipTokenUpdate(pushCredentials, type: type)
  }

  public func pushRegistry(_ registry: PKPushRegistry, didReceiveIncomingPushWith payload: PKPushPayload, for type: PKPushType, completion: @escaping () -> Void) {
    TelnyxVoipPushHandler.shared.handleVoipPush(payload, type: type, completion: completion)
  }
}
```

**Note**: CallKit integration (CXProvider, CXProviderDelegate, audio session management) is automatically handled by the internal CallBridge component. You don't need to implement any CallKit delegate methods manually.

##### 2. VoIP Push Certificate Setup

- Configure VoIP push certificates in your Apple Developer account
- The `TelnyxVoipPushHandler` automatically handles token registration and push processing
- CallKit integration is automatically managed by CallBridge - no manual setup required

#### Key Native Features Integrated

1. **Push Notification Handling**: Both platforms handle background push notifications properly
2. **Native Call UI**: CallKit (iOS, managed by CallBridge) and ConnectionService (Android) integration
3. **Audio Session Management**: Automatic audio session handling for VoIP calls via CallBridge
4. **Background Processing**: Seamless app state transitions and background call handling
5. **Intent Processing**: Android intent handling for notification actions (Answer/Decline)
6. **Token Management**: Automatic push token registration and updates

## Running the Demo Application

### Prerequisites

- Node.js and npm
- Expo CLI
- iOS development: Xcode
- Android development: Android Studio

### Installation and Setup

1. **Remove global Expo CLI** (if previously installed):

   ```bash
   npm uninstall -g expo
   ```

2. **Install dependencies** (including local Expo):

   ```bash
   npm install
   ```

3. **Run Expo install** to ensure all dependencies are properly configured:

   ```bash
   npx expo install
   ```

4. **Configure Firebase for Android**:
   - Download the `google-services.json` file from your Firebase project
   - Place it in the root directory of the project

5. **Prebuild the project**:

   ```bash
   npx expo prebuild
   ```

6. **Install iOS dependencies** (required for iOS):
   ```bash
   cd ios && pod install && cd ..
   ```

### Running the Application

1. **Start Metro bundler** (in a separate terminal):

   ```bash
   npx expo start --clear --reset-cache
   ```

2. **Run on iOS**:

   ```bash
   npx expo run:ios
   ```

3. **Run on Android**:
   ```bash
   npx expo run:android
   ```

> **Note**: Make sure you have the necessary development environment set up for iOS (Xcode) or Android (Android Studio) before running the respective commands.

### Demo App Features

Once running, the demo app provides:

- **Login Form**: Enter your Telnyx SIP credentials or token
- **Dialer Interface**: Make outgoing calls with a native dialer UI
- **Call Management**: Answer, decline, hold, mute, and transfer calls
- **Native Call UI**: Integrated CallKit (iOS) and ConnectionService (Android)
- **Push Notifications**: Receive calls when app is in background or terminated
- **Multiple Call Support**: Handle multiple simultaneous calls
- **Background Handling**: Seamless app state transitions

### Configuration

The demo app includes debug logging enabled by default:

```tsx
// Enable debug logging for the Telnyx SDK
if (__DEV__) {
  log.setLevel('debug');
  (global as any).__TELNYX_DEBUG__ = true;
}
```

This provides detailed logging for:

- Connection state changes
- Call state transitions
- Push notification processing
- Background lifecycle events

## Troubleshooting

### iOS Connection Issues (First Run)

If you encounter network connection errors on iOS:

```bash
# Try clearing cache and resetting
npx expo start --clear --reset-cache

# Or use tunnel mode
npx expo start --tunnel

# Or specify host explicitly
npx expo start --host lan
```

### iOS VoIP Push Notification Issues

If you see VoIP-related crashes on iOS, ensure your AppDelegate.swift includes the VoIP push notification delegate methods. The project includes these by default, but if you encounter issues, rebuild the iOS project:

```bash
npx expo prebuild --platform ios --clean
npx expo run:ios
```

### Common Integration Issues

#### Double Login

Ensure you're not calling login methods manually when using `TelnyxVoiceApp` with auto-reconnection enabled.

#### Background Disconnection

Check if `enableAutoReconnect` is set appropriately for your use case in the `TelnyxVoiceApp` configuration.

#### Push Notifications Not Working

- **Android**:
  - Verify `google-services.json` is in the correct location and Firebase is properly configured
  - Ensure your MainActivity extends `TelnyxMainActivity`
  - Check that `VoicePnManager` is properly handling push actions
- **iOS**:
  - Ensure VoIP push certificates are configured in your Apple Developer account
  - Verify AppDelegate implements `PKPushRegistryDelegate` and delegates to `TelnyxVoipPushHandler`
  - Check that `TelnyxVoipPushHandler.initializeVoipRegistration()` is called in `didFinishLaunchingWithOptions`
- **Both**: Check that background message handlers are properly registered

#### Native Integration Issues

- **Android**: Ensure MainActivity extends `TelnyxMainActivity` for proper intent handling
- **iOS**: Verify AppDelegate implements `PKPushRegistryDelegate` and delegates to `TelnyxVoipPushHandler`
- **CallKit**: On iOS, CallKit integration is automatically handled by CallBridge - no manual setup required

#### Audio Issues

- **iOS**: Audio session management is automatically handled by CallBridge
- **Android**: Verify ConnectionService is properly configured for audio routing
- **Both**: Ensure proper audio permissions are granted

#### Memory Leaks

Ensure you're unsubscribing from RxJS observables in your React components:

```tsx
useEffect(() => {
  const subscription = voipClient.connectionState$.subscribe(handleStateChange);
  return () => subscription.unsubscribe();
}, []);
}, []);
```


## License

MIT License - see LICENSE file for details.
