# Telnyx Voice Commons - iOS Integration

This document explains how to integrate the iOS CallKit and VoIP push notification functionality into your React Native app.

## 📋 **Prerequisites**

1. iOS deployment target 13.0 or higher
2. Valid Apple Developer account with VoIP push notification entitlements
3. Telnyx account with Voice SDK access

## 🚀 **Installation**

1. Install the react-voice-commons package
2. Add VoIP background mode to your Info.plist
3. Set up your AppDelegate

## ⚙️ **Setup**

### 1. Info.plist Configuration

Add the following to your iOS app's `Info.plist`:

```xml
<key>UIBackgroundModes</key>
<array>
    <string>voip</string>
</array>

<key>NSMicrophoneUsageDescription</key>
<string>This app needs microphone access to make voice calls</string>
```

### 2. AppDelegate Integration

### Option A: Easy Integration (Recommended)

Import and use the `TelnyxVoiceAppDelegate` protocol:

```swift
import TelnyxVoiceCommons

class AppDelegate: ExpoAppDelegate, TelnyxVoiceAppDelegate {
    // Required properties for TelnyxVoiceAppDelegate
    var voipRegistry: PKPushRegistry?
    var callKitProvider: CXProvider?
    var callKitController: CXCallController?
    var activeCalls: [UUID: [String: Any]] = [:]

    override func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        // Your existing setup code...

        // Add Telnyx Voice setup
        setupTelnyxVoice()

        return super.application(application, didFinishLaunchingWithOptions: launchOptions)
    }

    // Optionally customize CallKit configuration
    override func customCallKitConfiguration() -> CXProviderConfiguration {
        let configuration = CXProviderConfiguration(localizedName: "My App Voice")
        configuration.supportsVideo = false
        configuration.maximumCallGroups = 1
        configuration.maximumCallsPerCallGroup = 1
        configuration.supportedHandleTypes = [.phoneNumber, .generic]
        configuration.includesCallsInRecents = true
        return configuration
    }
}

// Automatically get PKPushRegistryDelegate methods
extension AppDelegate: PKPushRegistryDelegate {}

// Automatically get CXProviderDelegate methods
extension AppDelegate: CXProviderDelegate {}
```

### Option B: Manual Integration

If you prefer to implement the delegates manually:

```swift
import PushKit
import CallKit
import AVFoundation

class AppDelegate: ExpoAppDelegate {
    var voipRegistry: PKPushRegistry?
    var callKitProvider: CXProvider?
    var callKitController: CXCallController?
    var activeCalls: [UUID: [String: Any]] = [:]

    override func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        // Your existing setup...

        setupVoIPPushNotifications()
        setupCallKit()

        return super.application(application, didFinishLaunchingWithOptions: launchOptions)
    }

    private func setupVoIPPushNotifications() {
        voipRegistry = PKPushRegistry(queue: DispatchQueue.main)
        voipRegistry?.delegate = self
        voipRegistry?.desiredPushTypes = [PKPushType.voIP]
    }

    private func setupCallKit() {
        let configuration = CXProviderConfiguration(localizedName: "Voice Call")
        configuration.supportsVideo = false
        configuration.maximumCallGroups = 1
        configuration.maximumCallsPerCallGroup = 1
        configuration.supportedHandleTypes = [.phoneNumber, .generic]
        configuration.includesCallsInRecents = true

        callKitProvider = CXProvider(configuration: configuration)
        callKitProvider?.setDelegate(self, queue: nil)
        callKitController = CXCallController()
    }
}

extension AppDelegate: PKPushRegistryDelegate {
    // Implement push notification methods...
    // (See TelnyxVoiceAppDelegate.swift for full implementation)
}

extension AppDelegate: CXProviderDelegate {
    // Implement CallKit delegate methods...
    // (See TelnyxVoiceAppDelegate.swift for full implementation)
}
```

## 🔧 **iOS Project Configuration**

### 1. Enable VoIP Background Mode

In Xcode:

1. Select your project target
2. Go to "Signing & Capabilities"
3. Add "Background Modes" capability
4. Check "Voice over IP"

### 2. Add Push Notification Entitlement

1. Add "Push Notifications" capability
2. Ensure VoIP push notifications are enabled in your Apple Developer account

## 📱 **Usage in React Native**

After setting up the iOS native code, use the library in your React Native code:

```typescript
import { createTelnyxVoipClient } from '@telnyx/react-voice-commons-sdk';

const voipClient = createTelnyxVoipClient({
  enableNativeUI: true, // Enable CallKit integration
  enableBackgroundHandling: true,
  debug: true,
});

// Login and make calls as usual
await voipClient.login({
  sipUser: 'your-sip-user',
  sipPassword: 'your-password',
  debug: true,
});
```

## 🎯 **Features**

With this setup, your app will automatically get:

- ✅ Native iOS CallKit interface for incoming/outgoing calls
- ✅ VoIP push notifications for incoming calls
- ✅ Background call handling
- ✅ Call history integration
- ✅ Native call controls (answer, end, hold)
- ✅ Audio session management
- ✅ Automatic CallKit synchronization

## 🐛 **Troubleshooting**

### Common Issues:

1. **CallKit not showing**: Ensure VoIP background mode is enabled in Info.plist
2. **Push notifications not working**: Check that VoIP push entitlements are properly configured
3. **Audio issues**: Verify microphone permissions and audio session setup
4. **Build errors**: Make sure iOS deployment target is 13.0+

### Debug Logs:

Enable debug logging to see detailed CallKit integration logs:

```swift
// In your AppDelegate setup
setupTelnyxVoice()
```

Look for logs prefixed with `TelnyxVoice:` in the Xcode console.

## 📚 **Additional Resources**

- [Apple CallKit Documentation](https://developer.apple.com/documentation/callkit)
- [VoIP Push Notifications Guide](https://developer.apple.com/documentation/pushkit)
- [Telnyx Voice API Documentation](https://developers.telnyx.com/docs/v2/voice)
