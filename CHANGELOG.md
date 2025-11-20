# CHANGELOG.md

## [0.1.3](https://www.npmjs.com/package/@telnyx/react-voice-commons-sdk/v/0.1.3) (2025-11-20)

### Enhancement

• Enhanced `newCall()` method with additional parameters (callerName, callerNumber, customHeaders)
• Invite custom headers support for outgoing calls
• Call reconnection functionality for network stability
• Improved network reconnection handling with automatic call reattachment
• Enhanced caller ID handling with smart fallback logic
• Fixed React version compatibility issues for local development
• Session management improvements for reliable reconnection

### Bug Fixes

• Fixed React version conflicts between 19.0.0 and 19.2.0
• Resolved notification lifecycle management with proper foreground service handling
• Enhanced call state transitions during network reconnection
• Improved authentication storage and auto-reconnection reliability

## [0.1.2](https://www.npmjs.com/package/@telnyx/react-voice-commons-sdk/v/0.1.2) (2025-11-04)

### Enhancement

• Automated documentation generation workflow (manual trigger)
• HTML documentation output in `docs/` folder
• Markdown documentation output in `docs-markdown/` folder
• TypeDoc configuration for both HTML and Markdown formats
• Package README with comprehensive integration guide
• Documentation for authentication methods (credential and token-based)
• Native integration examples for Android and iOS

## [0.1.1](https://www.npmjs.com/package/@telnyx/react-voice-commons-sdk/v/0.1.1) (2025-11-02)

### Enhancement

• Initial package setup
• Core VoIP client functionality
• CallKit integration for iOS
• ConnectionService support for Android
• Push notification handling
• Reactive state management with RxJS

## [0.1.0](https://www.npmjs.com/package/@telnyx/react-voice-commons-sdk/v/0.1.0) (2025-11-01)

### Enhancement

• Initial release of react-voice-commons-sdk
• TelnyxVoipClient for managing VoIP connections
• TelnyxVoiceApp component for automatic lifecycle management
• Call management (make, answer, hold, mute, transfer, hangup)
• Connection state management
• Call state machine
• TypeScript definitions
