package com.telnyx.rn_voice_sdk_demo

import android.content.Context
import com.telnyx.react_voice_commons.TelnyxNotificationActionReceiver
import com.telnyx.react_voice_commons.VoicePnManager

/**
 * App-specific notification action receiver that extends the Telnyx base receiver
 */
class AppNotificationActionReceiver : TelnyxNotificationActionReceiver() {
    /**
     * Bind the answer action to the call the user actually answered. This keeps
     * the push's own voice_sdk_id with that connection and never borrows
     * metadata from a different pending push.
     */
    override fun handleAnswerCall(context: Context, callId: String) {
        super.handleAnswerCall(context, callId)
        VoicePnManager.bindPendingPushActionToCall(context, callId, "answer")
    }

    /**
     * Keep the rejection scoped to this call as well. The stored reject action
     * is consumed (and cleared) by the JS layer, so it must not be discarded
     * here; only the other flow's metadata must never be reused.
     */
    override fun handleRejectCall(context: Context, callId: String) {
        super.handleRejectCall(context, callId)
        VoicePnManager.bindPendingPushActionToCall(context, callId, "reject")
    }
}
