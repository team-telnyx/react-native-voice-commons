# Push Notification Portal Setup

This guide covers the Telnyx portal configuration required to enable push notifications for the `@telnyx/react-voice-commons-sdk`.

## Overview

Before your React Native application can receive push notifications for incoming calls, you need to configure push notification credentials in your Telnyx portal. This involves:

- **Android**: Uploading Firebase Cloud Messaging (FCM) server key
- **iOS**: Uploading Apple Push Notification Service (APNs) VoIP certificates

## Android Setup

The Telnyx React Voice Commons SDK uses Firebase Cloud Messaging (FCM) to deliver push notifications for Android devices. To enable notifications for incoming calls on your Android mobile device, you need to set up Firebase Cloud Messaging in your application.

### Prerequisites

1. **Firebase Project**: A Firebase project with FCM enabled
2. **google-services.json**: Downloaded from your Firebase project
3. **FCM Server Key**: Found in your Firebase project settings

### Step 1: Firebase Project Configuration

1. **Create or Access Firebase Project**:
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Create a new project or select an existing one
   - Enable Cloud Messaging in the project

2. **Add Android App**:
   - Click "Add app" and select Android
   - Enter your Android package name (e.g., `com.yourcompany.yourapp`)
   - Download the `google-services.json` file
   - Place the file in your project root directory

3. **Get FCM Server Key**:
   - Go to Project Settings → Cloud Messaging
   - Copy the "Server key" (legacy format)
   - If legacy server key is not available, use the newer "Private key" JSON format

### Step 2: Telnyx Portal Configuration

1. **Access Push Credentials**:
   - Log in to [Telnyx Portal](https://portal.telnyx.com/)
   - Navigate to Voice → WebRTC → Push Credentials
   - Click "Add Push Credential"

2. **Configure Android Credential**:
   - **Platform**: Select "Android"
   - **Application Name**: Enter a descriptive name for your app
   - **FCM Server Key**: Paste your Firebase server key
   - **Package Name**: Enter your Android package name (must match Firebase configuration)

3. **Save Configuration**:
   - Click "Save" to store the credentials
   - Note the credential ID for reference

### Step 3: Verification

To verify your Android push notification setup:

1. **Test with Firebase Console**:
   - Use Firebase Console → Cloud Messaging → Send test message
   - Target your app and verify notifications are received

2. **Test with Telnyx**:
   - Make a test call to your configured SIP user
   - Verify that push notifications are delivered when app is in background

For detailed Firebase setup instructions, visit the [Firebase Documentation](https://firebase.google.com/docs/cloud-messaging/android/client).

## iOS Setup

The Telnyx React Voice Commons SDK uses Apple Push Notification Service (APNs) with VoIP certificates to deliver push notifications for iOS devices. VoIP push notifications provide instant call delivery and automatic app activation.

### Prerequisites

1. **Apple Developer Account**: Active Apple Developer Program membership
2. **App ID**: Configured with Push Notifications capability
3. **VoIP Certificate**: Generated from Apple Developer portal

### Step 1: Apple Developer Portal Configuration

1. **Configure App ID**:
   - Go to [Apple Developer Portal](https://developer.apple.com/account/)
   - Navigate to Certificates, Identifiers & Profiles → Identifiers
   - Select your App ID or create a new one
   - Enable "Push Notifications" capability
   - Save the configuration

2. **Create VoIP Certificate**:
   - Navigate to Certificates, Identifiers & Profiles → Keys
   - Click "+" to create a new key
   - Enter a name for your key (e.g., "YourApp VoIP Push Key")
   - Check "Apple Push Notifications service (APNs)"
   - Click "Continue" and then "Register"
   - Download the `.p8` file and note the Key ID

3. **Alternative - Certificate Method**:
   - If using certificates instead of keys:
   - Navigate to Certificates, Identifiers & Profiles → Certificates
   - Click "+" to create a new certificate
   - Select "VoIP Services Certificate"
   - Choose your App ID
   - Upload a Certificate Signing Request (CSR)
   - Download the generated certificate

### Step 2: Telnyx Portal Configuration

#### Option A: Using APNs Key (Recommended)

1. **Access Push Credentials**:
   - Log in to [Telnyx Portal](https://portal.telnyx.com/)
   - Navigate to Voice → WebRTC → Push Credentials
   - Click "Add Push Credential"

2. **Configure iOS Credential**:
   - **Platform**: Select "iOS"
   - **Application Name**: Enter a descriptive name for your app
   - **Bundle ID**: Enter your iOS bundle identifier
   - **APNs Key ID**: Enter the Key ID from Apple Developer portal
   - **Team ID**: Enter your Apple Developer Team ID
   - **APNs Key**: Upload the `.p8` file downloaded from Apple
   - **Environment**: Select "development" or "production"

#### Option B: Using APNs Certificate

1. **Configure iOS Credential**:
   - **Platform**: Select "iOS"
   - **Application Name**: Enter a descriptive name for your app
   - **Bundle ID**: Enter your iOS bundle identifier
   - **APNs Certificate**: Upload the VoIP certificate (`.p12` or `.pem` format)
   - **Certificate Password**: Enter the password if certificate is password-protected
   - **Environment**: Select "development" or "production"

3. **Save Configuration**:
   - Click "Save" to store the credentials
   - Note the credential ID for reference

### Step 3: Certificate Conversion (if needed)

If you have a `.cer` certificate file, you may need to convert it to `.p12` format:

1. **Download Certificate**:
   - Download the VoIP certificate from Apple Developer portal
   - Double-click to install in Keychain Access

2. **Export as .p12**:
   - Open Keychain Access
   - Find your VoIP certificate
   - Right-click and select "Export"
   - Choose "Personal Information Exchange (.p12)" format
   - Set a password (optional but recommended)

3. **Convert to .pem** (alternative):
   ```bash
   # Convert .p12 to .pem
   openssl pkcs12 -in certificate.p12 -out certificate.pem -nodes
   ```

### Step 4: Verification

To verify your iOS push notification setup:

1. **Test with Development Build**:
   - Build and install your app in development mode
   - Ensure VoIP push notifications are properly registered
   - Check device logs for push token registration

2. **Test with Telnyx**:
   - Make a test call to your configured SIP user
   - Verify that push notifications are delivered and CallKit UI appears
   - Test both foreground and background scenarios

For detailed iOS push notification setup, visit the [Apple Developer Documentation](https://developer.apple.com/documentation/pushkit).

## Configuration Management

### Multiple Applications

If you have multiple applications (development, staging, production):

1. **Create Separate Credentials**:
   - Create separate push credentials for each environment
   - Use different bundle IDs / package names
   - Use appropriate certificate environments (development/production)

2. **Environment-Specific Configuration**:
   - Development: Use development certificates and FCM test keys
   - Production: Use production certificates and production FCM keys

### Credential Rotation

For security best practices:

1. **Regular Rotation**:
   - Rotate FCM server keys and APNs certificates regularly
   - Update Telnyx portal with new credentials
   - Test thoroughly before deploying to production

2. **Multiple Credentials**:
   - Telnyx supports multiple credentials per application
   - Useful for gradual rollout of new certificates
   - Provides fallback options during rotation

## Testing and Validation

### Test Scenarios

Test the following scenarios to ensure proper push notification setup:

1. **App States**:
   - Foreground: App is active and visible
   - Background: App is in background but running
   - Terminated: App is completely closed

2. **Network Conditions**:
   - WiFi connection
   - Cellular connection
   - Poor network conditions

3. **Device States**:
   - Device locked vs unlocked
   - Do Not Disturb mode
   - Battery optimization settings

### Debugging Tools

Use these tools to debug push notification issues:

1. **Firebase Console** (Android):
   - Send test messages to verify FCM setup
   - Check delivery reports and analytics

2. **Apple Push Notification Tool** (iOS):
   - Use command-line tools to test APNs delivery
   - Verify certificate validity and expiration

3. **Telnyx Portal**:
   - Check push credential status
   - Review delivery logs and error reports

## Troubleshooting

### Common Issues

#### Android Issues

**Push notifications not received**:
- Verify `google-services.json` is correct and in project root
- Check FCM server key in Telnyx portal
- Ensure package name matches between Firebase and Telnyx
- Verify app is not in battery optimization mode

**Invalid FCM server key**:
- Ensure you're using the correct server key format
- Check that FCM is enabled in Firebase project
- Verify key has not expired or been rotated

#### iOS Issues

**VoIP push notifications not received**:
- Verify VoIP certificate is uploaded correctly
- Check bundle ID matches between certificate and Telnyx portal
- Ensure certificate environment (development/production) is correct
- Verify App ID has Push Notifications capability enabled

**Certificate errors**:
- Check certificate expiration date
- Verify certificate is specifically for VoIP (not regular push notifications)
- Ensure certificate format is correct (.p12 or .pem)

#### General Issues

**Credential validation failed**:
- Double-check all credential details in Telnyx portal
- Verify environment settings (development vs production)
- Ensure certificates and keys are not expired

**Delivery delays**:
- Check network connectivity
- Verify push notification priorities are set correctly
- Review device-specific notification settings

### Getting Help

If you continue to experience issues:

1. **Telnyx Support**:
   - Contact Telnyx support with your credential ID
   - Provide detailed error messages and logs
   - Include test scenarios and device information

2. **Platform Documentation**:
   - [Firebase Cloud Messaging Documentation](https://firebase.google.com/docs/cloud-messaging)
   - [Apple Push Notification Service Documentation](https://developer.apple.com/documentation/usernotifications)

3. **SDK Documentation**:
   - Review the [App Setup Guide](./app-setup.md)
   - Check the [API Documentation](../README.md)

## Next Steps

After completing portal setup:

1. **App Implementation**: Follow the [App Setup Guide](./app-setup.md) to implement push notifications in your React Native application
2. **Testing**: Thoroughly test push notifications in all app states and scenarios
3. **Production Deployment**: Update to production certificates and keys before deploying
4. **Monitoring**: Implement logging and monitoring to track push notification delivery and issues

