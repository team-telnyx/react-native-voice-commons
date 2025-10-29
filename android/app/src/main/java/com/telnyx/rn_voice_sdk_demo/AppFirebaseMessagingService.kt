package com.telnyx.rn_voice_sdk_demo

import com.telnyx.react_voice_commons.TelnyxFirebaseMessagingService

/**
 * App-specific FCM service that extends the Telnyx base service
 */
class AppFirebaseMessagingService : TelnyxFirebaseMessagingService() {
    // All Telnyx voice push notification handling is inherited from the base class
    // Add any app-specific FCM handling here if needed
}