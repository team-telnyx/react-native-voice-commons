package com.telnyx.rn_voice_sdk_demo

import android.util.Log
import com.google.firebase.messaging.RemoteMessage
import com.telnyx.react_voice_commons.TelnyxFirebaseMessagingService
import com.telnyx.react_voice_commons.VoicePnManager

/**
 * App-specific FCM service that extends the Telnyx base service
 */
class AppFirebaseMessagingService : TelnyxFirebaseMessagingService() {
    private val tag = "AppFCMService"

    /**
     * Capture the metadata for the call that this push belongs to before the
     * notification or fallback launch consumes it. The store is keyed by
     * call_id, so sequential pushes keep separate voice_sdk_id values.
     */
    override fun handleTelnyxVoicePush(remoteMessage: RemoteMessage) {
        val metadata = remoteMessage.data["metadata"]
        if (!metadata.isNullOrBlank()) {
            try {
                VoicePnManager.rememberIncomingPush(this, metadata)
            } catch (e: Exception) {
                Log.e(tag, "Failed to remember push metadata for this call", e)
            }
        }

        super.handleTelnyxVoicePush(remoteMessage)
    }
}
