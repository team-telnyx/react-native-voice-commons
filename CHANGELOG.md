# CHANGELOG.md

## [0.1.6](https://github.com/team-telnyx/react-native-voice-commons/releases/tag/0.1.6) (2025-12-09)

### Enhancement

• Added Android native components to npm package for proper distribution
• Complete Android native integration support for Firebase messaging and call management

### Bug Fixing

• Fixed missing Android directory in npm package files array
• Resolved native component availability issues for Android integrations

## [0.1.5](https://github.com/team-telnyx/react-native-voice-commons/releases/tag/0.1.5) (2025-12-08)

### Enhancement

• Updated to use @telnyx/react-native-voice-sdk@0.3.0 with advanced media events support

## [0.1.4](https://github.com/team-telnyx/react-native-voice-commons/releases/tag/0.1.4) (2025-11-25)

### Enhancement

• Enhanced 4G/WiFi reconnection mechanism for better network handling
• iOS version integration improvements

## [0.1.3](https://github.com/team-telnyx/react-native-voice-commons/releases/tag/0.1.3) (2025-11-20)

### Enhancement

• Fixed background answer functionality for iOS
• Added connecting state to Telnyx client
• Improved reconnection logic for Android using foreground service implementation

## [0.1.2](https://github.com/team-telnyx/react-native-voice-commons/releases/tag/0.1.2) (2025-11-04)

### Enhancement

• Comprehensive package README with integration examples
• Documentation for credential-based and token-based authentication
• Native integration guides for Android (MainActivity) and iOS (AppDelegate)
• Examples for push notification setup
• Troubleshooting section

### Bug Fixing

• Package metadata and npm publishing configuration

## [0.1.1](https://github.com/team-telnyx/react-native-voice-commons/releases/tag/0.1.1) (2025-11-02)

### Enhancement

• Initial npm package release
• Core VoIP client (`TelnyxVoipClient`)
• TelnyxVoiceApp component for React Native lifecycle management
• CallKit integration for iOS native call UI
• Android ConnectionService support
• Push notification handling (FCM for Android, APNs for iOS)
• Reactive state streams with RxJS
• Call management APIs (make, answer, hold, mute, transfer, hangup)
• Connection state management
• Call state machine
• Automatic reconnection logic
• Session management
• TypeScript type definitions

## [0.1.0](https://github.com/team-telnyx/react-native-voice-commons/releases/tag/0.1.0) (2025-11-01)

### Enhancement

• Initial development version
• Basic VoIP functionality
• Call management
• State management interfaces
