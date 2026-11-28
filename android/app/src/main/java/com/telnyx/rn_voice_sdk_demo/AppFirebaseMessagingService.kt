package com.telnyx.rn_voice_sdk_demo

import com.google.firebase.messaging.RemoteMessage
import com.telnyx.react_voice_commons.TelnyxFirebaseMessagingService
import com.telnyx.react_voice_commons.VoicePnManager
import org.json.JSONObject

/**
 * App-specific FCM service that extends the Telnyx base service.
 *
 * The push metadata (including the push-carried voice_sdk_id) is retained under
 * the call id that owns it before the notification is shown. The answer/reject
 * flow can then read only its own call's metadata, even after another push has
 * arrived in the meantime.
 */
class AppFirebaseMessagingService : TelnyxFirebaseMessagingService() {

    protected override fun handleTelnyxVoicePush(remoteMessage: RemoteMessage) {
        val (callId, metadata) = extractPushIdentity(remoteMessage)

        if (isUsableCallId(callId)) {
            VoicePnManager.setPendingPushAction(this, "incoming_call", metadata, callId)
        }

        super.handleTelnyxVoicePush(remoteMessage)
    }

    protected override fun handleTelnyxMissedCall(remoteMessage: RemoteMessage) {
        val (callId, _) = extractPushIdentity(remoteMessage)

        // A missed call definitively abandons this push flow. Clear only this
        // call's retained metadata so another pending call keeps its own.
        if (isUsableCallId(callId)) {
            VoicePnManager.clearPendingPushActionForCall(this, callId)
        }

        super.handleTelnyxMissedCall(remoteMessage)
    }

    private fun isUsableCallId(callId: String): Boolean =
        callId.isNotBlank() && callId != "unknown"

    /**
     * Mirrors the base service extraction so the metadata retained here is the
     * exact string the notification's intents carry to React Native.
     */
    private fun extractPushIdentity(remoteMessage: RemoteMessage): Pair<String, String> {
        val data = remoteMessage.data
        val metadataJson = data["metadata"]

        var callId = "unknown"
        var callerName = "Unknown Caller"
        var callerNumber = ""

        if (!metadataJson.isNullOrBlank()) {
            try {
                val metadata = JSONObject(metadataJson)
                callId = metadata.optString("call_id", "unknown")
                callerName = metadata.optString("caller_name", "Unknown Caller")
                callerNumber = metadata.optString("caller_number", "")
            } catch (e: Exception) {
                // Fall through to the top-level fields, as the base service does.
            }
        }

        if (callId == "unknown") {
            callId = data["call_id"] ?: data["telnyx_call_id"] ?: "unknown"
            callerName = data["caller_id_name"] ?: data["caller_name"] ?: "Unknown Caller"
            callerNumber = data["caller_id_number"] ?: data["caller_number"] ?: ""
        }

        if (!metadataJson.isNullOrBlank()) {
            return Pair(callId, metadataJson)
        }

        val fallbackMetadata = JSONObject().apply {
            put("call_id", callId)
            put("caller_name", callerName)
            put("caller_number", callerNumber)
        }.toString()

        return Pair(callId, fallbackMetadata)
    }
}
