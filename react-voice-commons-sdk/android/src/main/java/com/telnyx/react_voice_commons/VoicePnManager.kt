package com.telnyx.react_voice_commons

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import org.json.JSONObject

object VoicePnManager {
    
    private const val TAG = "VoicePnManager"
    private const val PREFS_NAME = "telnyx_voice_prefs"
    private const val MISSED_CALL_NOTIFICATIONS_ENABLED = "telnyx_enable_missed_call_notifications"
    private const val INCOMING_CALL_RINGTONE_RESOURCE = "telnyx_incoming_call_ringtone_resource"

    private const val PENDING_PUSH_ACTION = "pending_push_action"
    private const val PENDING_PUSH_METADATA = "pending_push_metadata"
    private const val PENDING_PUSH_CALL_ID = "pending_push_call_id"
    private const val PENDING_PUSH_TIMESTAMP = "pending_push_timestamp"
    // Per-call flows. The "current" keys above remain for the JavaScript bridge,
    // but a push's metadata must also stay reachable by its own call id so a
    // later push cannot replace or clear it before that flow consumes it.
    private const val PENDING_PUSH_FLOWS = "pending_push_flows"
    private const val PENDING_PUSH_MAX_AGE_MS = 10 * 60 * 1000L

    private val pushStateLock = Any()

    private data class PendingPushFlow(
        val action: String,
        val metadata: String,
        val timestamp: Long
    )
    
    private fun getSharedPreferences(context: Context): SharedPreferences {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    private fun normalizeCallId(callId: String?): String? =
        callId?.trim()?.takeIf { it.isNotEmpty() }

    private fun isExpired(timestamp: Long, now: Long = System.currentTimeMillis()): Boolean =
        timestamp > 0L && now - timestamp > PENDING_PUSH_MAX_AGE_MS

    /**
     * Recovers the owning call id from push metadata for callers that only pass
     * the legacy (action, metadata) pair. Without this, the base service and
     * activity could only ever write to the single "current" slot.
     */
    private fun extractCallIdFromMetadata(metadata: String?): String? {
        if (metadata.isNullOrBlank()) return null

        try {
            val json = JSONObject(metadata)
            val directCallId = normalizeCallId(json.optString("call_id", ""))
            if (directCallId != null && directCallId != "unknown") {
                return directCallId
            }

            val nested = json.optString("metadata", "")
            if (nested.isNotEmpty()) {
                val nestedCallId = normalizeCallId(JSONObject(nested).optString("call_id", ""))
                if (nestedCallId != null && nestedCallId != "unknown") {
                    return nestedCallId
                }
            }
        } catch (e: Exception) {
            // Fall through to the tolerant patterns below.
        }

        val jsonCallId = Regex("\"call_id\"\\s*:\\s*\"([^\"]+)\"")
            .find(metadata)
            ?.groupValues
            ?.getOrNull(1)
        if (jsonCallId != null && jsonCallId != "unknown") {
            return normalizeCallId(jsonCallId)
        }

        val mapCallId = Regex("call_id=([^,}\\s]+)")
            .find(metadata)
            ?.groupValues
            ?.getOrNull(1)
        return normalizeCallId(mapCallId)?.takeIf { it != "unknown" }
    }

    private fun readPushFlows(prefs: SharedPreferences): MutableMap<String, PendingPushFlow> {
        val flows = mutableMapOf<String, PendingPushFlow>()
        val encoded = prefs.getString(PENDING_PUSH_FLOWS, null) ?: return flows

        try {
            val json = JSONObject(encoded)
            for (callId in json.keys()) {
                val flow = json.optJSONObject(callId) ?: continue
                val action = flow.optString("action", "")
                val metadata = flow.optString("metadata", "")
                if (action.isEmpty() || metadata.isEmpty()) continue
                flows[callId] = PendingPushFlow(
                    action = action,
                    metadata = metadata,
                    timestamp = flow.optLong("timestamp", 0L)
                )
            }
        } catch (e: Exception) {
            Log.w(TAG, "Discarding unreadable pending push flows", e)
        }

        return flows
    }

    private fun writePushFlows(
        editor: SharedPreferences.Editor,
        flows: Map<String, PendingPushFlow>
    ) {
        val json = JSONObject()
        for ((callId, flow) in flows) {
            json.put(
                callId,
                JSONObject()
                    .put("action", flow.action)
                    .put("metadata", flow.metadata)
                    .put("timestamp", flow.timestamp)
            )
        }
        editor.putString(PENDING_PUSH_FLOWS, json.toString())
    }

    private fun pruneExpiredFlows(
        flows: MutableMap<String, PendingPushFlow>,
        now: Long
    ) {
        flows.entries.removeAll { isExpired(it.value.timestamp, now) }
    }

    private fun clearCurrentPushFlow(editor: SharedPreferences.Editor) {
        editor.remove(PENDING_PUSH_ACTION)
        editor.remove(PENDING_PUSH_METADATA)
        editor.remove(PENDING_PUSH_CALL_ID)
        editor.remove(PENDING_PUSH_TIMESTAMP)
    }
    
    // UserDefaults equivalent functions
    fun getVoipToken(context: Context): String? {
        Log.d(TAG, "getVoipToken called")
        return getSharedPreferences(context).getString("voip_token", null)
    }
    
    fun setVoipToken(context: Context, token: String?) {
        Log.d(TAG, "setVoipToken called with: $token")
        val editor = getSharedPreferences(context).edit()
        if (token != null) {
            editor.putString("voip_token", token)
        } else {
            editor.remove("voip_token")
        }
        editor.apply()
    }

    fun getPendingVoipPush(context: Context): String? {
        Log.d(TAG, "getPendingVoipPush called")
        return getSharedPreferences(context).getString("pending_voip_push", null)
    }
    
    fun setPendingVoipPush(context: Context, push: String?) {
        Log.d(TAG, "setPendingVoipPush called with: $push")
        val editor = getSharedPreferences(context).edit()
        if (push != null) {
            editor.putString("pending_voip_push", push)
        } else {
            editor.remove("pending_voip_push")
        }
        editor.apply()
    }

    fun clearPendingVoipPush(context: Context): Boolean {
        Log.d(TAG, "clearPendingVoipPush called")
        val editor = getSharedPreferences(context).edit()
        editor.remove("pending_voip_push")
        editor.apply()
        return true
    }

    fun getPendingVoipAction(context: Context): String? {
        Log.d(TAG, "getPendingVoipAction called")
        return getSharedPreferences(context).getString("pending_voip_action", null)
    }
    
    fun setPendingVoipAction(context: Context, action: String?) {
        Log.d(TAG, "setPendingVoipAction called with: $action")
        val editor = getSharedPreferences(context).edit()
        if (action != null) {
            editor.putString("pending_voip_action", action)
        } else {
            editor.remove("pending_voip_action")
        }
        editor.apply()
    }

    fun clearPendingVoipAction(context: Context): Boolean {
        Log.d(TAG, "clearPendingVoipAction called")
        val editor = getSharedPreferences(context).edit()
        editor.remove("pending_voip_action")
        editor.apply()
        return true
    }

    fun setMissedCallNotificationsEnabled(context: Context, enabled: Boolean): Boolean {
        Log.d(TAG, "setMissedCallNotificationsEnabled called with: $enabled")
        getSharedPreferences(context)
            .edit()
            .putBoolean(MISSED_CALL_NOTIFICATIONS_ENABLED, enabled)
            .apply()
        return true
    }

    fun getMissedCallNotificationsEnabled(context: Context): Boolean {
        Log.d(TAG, "getMissedCallNotificationsEnabled called")
        return getSharedPreferences(context)
            .getBoolean(MISSED_CALL_NOTIFICATIONS_ENABLED, true)
    }

    fun setIncomingCallRingtoneResource(context: Context, resourceName: String?): Boolean {
        getSharedPreferences(context)
            .edit()
            .apply {
                if (resourceName.isNullOrBlank()) {
                    remove(INCOMING_CALL_RINGTONE_RESOURCE)
                } else {
                    putString(INCOMING_CALL_RINGTONE_RESOURCE, resourceName)
                }
            }
            .apply()
        return true
    }

    fun getIncomingCallRingtoneResource(context: Context): String? {
        return getSharedPreferences(context).getString(INCOMING_CALL_RINGTONE_RESOURCE, null)
    }

    // PnModule functions
    /**
     * Records the push action for the flow handling it. When [callId] is present the
     * metadata is retained under that call id as well, so a later push for another
     * call can neither overwrite nor clear it.
     */
    fun setPendingPushAction(
        context: Context,
        action: String,
        metadata: String,
        callId: String? = null
    ) {
        val normalizedCallId = normalizeCallId(callId) ?: extractCallIdFromMetadata(metadata)
        Log.d(TAG, "setPendingPushAction called with action: $action, callId: $normalizedCallId")

        synchronized(pushStateLock) {
            val prefs = getSharedPreferences(context)
            val now = System.currentTimeMillis()
            val editor = prefs.edit()

            if (normalizedCallId != null) {
                val flows = readPushFlows(prefs)
                pruneExpiredFlows(flows, now)
                flows[normalizedCallId] = PendingPushFlow(action, metadata, now)
                writePushFlows(editor, flows)
                editor.putString(PENDING_PUSH_CALL_ID, normalizedCallId)
            } else {
                // No call id could be resolved; keep the entry only in the
                // current slot so it cannot be mistaken for a per-call flow.
                editor.remove(PENDING_PUSH_CALL_ID)
            }

            editor.putString(PENDING_PUSH_ACTION, action)
            editor.putString(PENDING_PUSH_METADATA, metadata)
            editor.putLong(PENDING_PUSH_TIMESTAMP, now)
            editor.apply()
        }
    }
    
    /**
     * Returns the push flow for [callId] when one is provided, otherwise the most
     * recent flow. A call id that does not own the stored flow never receives it,
     * which keeps a fresh login from inheriting another call's voice_sdk_id.
     */
    fun getPendingPushAction(
        context: Context,
        callId: String? = null
    ): Pair<String?, String?> {
        val normalizedCallId = normalizeCallId(callId)
        Log.d(TAG, "getPendingPushAction called for callId: $normalizedCallId")

        synchronized(pushStateLock) {
            val prefs = getSharedPreferences(context)
            val now = System.currentTimeMillis()

            if (normalizedCallId != null) {
                val flows = readPushFlows(prefs)
                val flow = flows[normalizedCallId]
                if (flow != null && !isExpired(flow.timestamp, now)) {
                    return Pair(flow.action, flow.metadata)
                }
                if (flow != null) {
                    Log.d(TAG, "Discarding expired push flow for callId: $normalizedCallId")
                    flows.remove(normalizedCallId)
                    val editor = prefs.edit()
                    writePushFlows(editor, flows)
                    editor.apply()
                }

                val currentCallId = normalizeCallId(prefs.getString(PENDING_PUSH_CALL_ID, null))
                val currentTimestamp = prefs.getLong(PENDING_PUSH_TIMESTAMP, 0L)
                if (
                    currentCallId != null &&
                    currentCallId.equals(normalizedCallId, ignoreCase = true) &&
                    !isExpired(currentTimestamp, now)
                ) {
                    return Pair(
                        prefs.getString(PENDING_PUSH_ACTION, null),
                        prefs.getString(PENDING_PUSH_METADATA, null)
                    )
                }

                return Pair(null, null)
            }

            val action = prefs.getString(PENDING_PUSH_ACTION, null)
            val metadata = prefs.getString(PENDING_PUSH_METADATA, null)
            if (action == null || metadata == null) {
                return Pair(null, null)
            }

            val timestamp = prefs.getLong(PENDING_PUSH_TIMESTAMP, 0L)
            if (isExpired(timestamp, now)) {
                Log.d(TAG, "Discarding expired pending push action")
                clearPendingPushAction(context)
                return Pair(null, null)
            }

            return Pair(action, metadata)
        }
    }

    /**
     * Call id of the most recent push flow, or null when there is none.
     */
    fun getPendingPushActionCallId(context: Context): String? {
        synchronized(pushStateLock) {
            val prefs = getSharedPreferences(context)
            val callId = normalizeCallId(prefs.getString(PENDING_PUSH_CALL_ID, null))
            val timestamp = prefs.getLong(PENDING_PUSH_TIMESTAMP, 0L)
            if (callId == null || isExpired(timestamp)) {
                return null
            }
            return callId
        }
    }
    
    /**
     * Clears the most recent flow only. Other calls' retained flows survive so
     * answering one push cannot drop another push that is still pending.
     */
    fun clearPendingPushAction(context: Context): Boolean {
        Log.d(TAG, "clearPendingPushAction called")

        synchronized(pushStateLock) {
            val prefs = getSharedPreferences(context)
            val currentCallId = normalizeCallId(prefs.getString(PENDING_PUSH_CALL_ID, null))
            val editor = prefs.edit()

            if (currentCallId != null) {
                val flows = readPushFlows(prefs)
                if (flows.remove(currentCallId) != null) {
                    writePushFlows(editor, flows)
                }
            }

            clearCurrentPushFlow(editor)
            editor.apply()
            return true
        }
    }

    /**
     * Clears only the flow owned by [callId]. Returns true when that call had a
     * retained flow. No other call's pending flow is touched.
     */
    fun clearPendingPushActionForCall(context: Context, callId: String?): Boolean {
        val normalizedCallId = normalizeCallId(callId)
        if (normalizedCallId == null) {
            Log.d(TAG, "clearPendingPushActionForCall ignored without a callId")
            return false
        }

        Log.d(TAG, "clearPendingPushActionForCall called for callId: $normalizedCallId")

        synchronized(pushStateLock) {
            val prefs = getSharedPreferences(context)
            val editor = prefs.edit()
            var cleared = false

            val flows = readPushFlows(prefs)
            if (flows.remove(normalizedCallId) != null) {
                writePushFlows(editor, flows)
                cleared = true
            }

            val currentCallId = normalizeCallId(prefs.getString(PENDING_PUSH_CALL_ID, null))
            if (currentCallId != null && currentCallId.equals(normalizedCallId, ignoreCase = true)) {
                clearCurrentPushFlow(editor)
                cleared = true
            }

            editor.apply()
            return cleared
        }
    }
    
    fun checkPendingPushAction(context: Context, callId: String? = null): Boolean {
        Log.d(TAG, "checkPendingPushAction called for callId: $callId")
        val (pendingAction, pendingMetadata) = getPendingPushAction(context, callId)
        
        if (pendingAction != null && pendingMetadata != null) {
            Log.d(TAG, "Found pending action: $pendingAction")
            if (normalizeCallId(callId) != null) {
                clearPendingPushActionForCall(context, callId)
            } else {
                clearPendingPushAction(context)
            }
            return true
        } else {
            Log.d(TAG, "No pending action found")
            return false
        }
    }

    // Call action management (using same pattern as push actions)
    fun setPendingCallAction(context: Context, action: String, callId: String?, timestamp: Long) {
        Log.d(TAG, "setPendingCallAction called with action: $action, callId: $callId")
        val editor = getSharedPreferences(context).edit()
        editor.putString("pending_call_action", action)
        editor.putString("pending_call_id", callId)
        editor.putLong("pending_call_timestamp", timestamp)
        editor.apply()
    }
    
    fun getPendingCallAction(context: Context): Triple<String?, String?, Long?> {
        Log.d(TAG, "getPendingCallAction called")
        val prefs = getSharedPreferences(context)
        val action = prefs.getString("pending_call_action", null)
        val callId = prefs.getString("pending_call_id", null)
        val timestamp = if (prefs.contains("pending_call_timestamp")) {
            prefs.getLong("pending_call_timestamp", 0)
        } else {
            null
        }
        return Triple(action, callId, timestamp)
    }
    
    fun clearPendingCallAction(context: Context): Boolean {
        Log.d(TAG, "clearPendingCallAction called")
        val editor = getSharedPreferences(context).edit()
        editor.remove("pending_call_action")
        editor.remove("pending_call_id")
        editor.remove("pending_call_timestamp")
        editor.apply()
        return true
    }
}
