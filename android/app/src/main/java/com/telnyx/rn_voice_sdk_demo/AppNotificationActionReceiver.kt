package com.telnyx.rn_voice_sdk_demo

import android.content.Context
import com.telnyx.react_voice_commons.TelnyxNotificationActionReceiver
import com.telnyx.react_voice_commons.VoicePnManager
import org.json.JSONObject

/**
 * App-specific notification action receiver.
 *
 * Answer actions are resolved against the metadata retained for the call that
 * was tapped, never against whichever push happened to arrive last. Reject is
 * a terminal outcome, so its push metadata is cleared immediately instead of
 * remaining available to a later fresh login.
 */
class AppNotificationActionReceiver : TelnyxNotificationActionReceiver() {

    protected override fun handleAnswerCall(context: Context, callId: String) {
        val (_, callMetadata) = VoicePnManager.getPendingPushAction(context, callId)
        val metadata = withAction(callMetadata, callId, "answer")

        VoicePnManager.setPendingPushAction(context, "answer", metadata, callId)
    }

    protected override fun handleRejectCall(context: Context, callId: String) {
        VoicePnManager.clearPendingPushActionForCall(context, callId)
    }

    private fun withAction(metadata: String?, callId: String, action: String): String {
        if (!metadata.isNullOrBlank()) {
            try {
                return JSONObject(metadata).put("action", action).toString()
            } catch (e: Exception) {
                // Not direct JSON; older flows may have wrapped it in FCM data.
            }

            // Some retained flows are the raw FCM data string with the call JSON
            // embedded under "metadata". Preserve that JSON (voice_sdk_id included).
            val start = metadata.indexOf("{\"call_id\"")
            val end = metadata.lastIndexOf('}') + 1
            if (start >= 0 && end > start) {
                try {
                    val embedded = metadata.substring(start, end)
                    return JSONObject(embedded).put("action", action).toString()
                } catch (e: Exception) {
                    // Fall through to the minimal, safe fallback.
                }
            }
        }

        return JSONObject().apply {
            put("call_id", callId)
            put("action", action)
        }.toString()
    }
}
