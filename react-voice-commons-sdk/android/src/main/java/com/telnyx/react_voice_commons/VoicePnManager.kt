package com.telnyx.react_voice_commons

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject

object VoicePnManager {
    
    private const val TAG = "VoicePnManager"
    private const val PREFS_NAME = "telnyx_voice_prefs"
    private const val MISSED_CALL_NOTIFICATIONS_ENABLED = "telnyx_enable_missed_call_notifications"
    private const val INCOMING_CALL_RINGTONE_RESOURCE = "telnyx_incoming_call_ringtone_resource"
    
    private fun getSharedPreferences(context: Context): SharedPreferences {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
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
    //
    // Push state is kept per call instead of in a single global slot. Each
    // received/actioned push keeps its own action, metadata and voice_sdk_id
    // until that specific flow consumes or abandons it, so a later push cannot
    // inherit stale metadata and clearing one flow cannot clear another.
    const val DEFAULT_PENDING_PUSH_TTL_MS: Long = 10 * 60 * 1000L

    private const val PENDING_PUSH_ENTRIES = "pending_push_entries"
    private const val PENDING_PUSH_CURRENT_ID = "pending_push_current_id"
    private const val PENDING_PUSH_LAST_DELIVERED_ID = "pending_push_last_delivered_id"
    private const val LEGACY_PENDING_PUSH_ACTION = "pending_push_action"
    private const val LEGACY_PENDING_PUSH_METADATA = "pending_push_metadata"
    private const val INCOMING_PUSH_ENTRIES = "incoming_push_entries"
    private const val INCOMING_PUSH_TTL_MS: Long = DEFAULT_PENDING_PUSH_TTL_MS

    private val pushStateLock = Any()

    data class PendingPushEntry(
        val id: String,
        val callId: String?,
        val action: String,
        val metadata: String,
        val createdAt: Long,
        val deliveredAt: Long? = null
    )

    data class PendingPushSnapshot(
        val action: String?,
        val metadata: String?,
        val callId: String?
    )

    private data class RememberedPush(
        val callId: String,
        val metadata: String,
        val receivedAt: Long
    )

    /**
     * Extract the call identifier from either a direct metadata JSON object or
     * the FCM data string form (metadata={"call_id":...}, message=...).
     */
    fun extractCallIdFromMetadata(metadata: String?): String? {
        if (metadata.isNullOrBlank()) {
            return null
        }

        try {
            val json = JSONObject(metadata)
            val callId = if (json.isNull("call_id")) "" else json.optString("call_id", "")
            if (callId.isNotEmpty()) {
                return callId
            }
        } catch (_: Exception) {
            // Not a direct JSON object; fall through to the string forms below.
        }

        Regex("\"call_id\"\\s*:\\s*\"([^\"]+)\"").find(metadata)?.let { match ->
            val callId = match.groupValues.getOrNull(1)
            if (!callId.isNullOrEmpty()) {
                return callId
            }
        }

        Regex("call_id\\s*=\\s*([^,}\\s]+)").find(metadata)?.let { match ->
            val callId = match.groupValues.getOrNull(1)?.trim('\'', '"')
            if (!callId.isNullOrEmpty()) {
                return callId
            }
        }

        return null
    }

    /**
     * Push-carried voice_sdk_id, when present. Kept with the metadata so it can
     * be verified per push instead of being applied to every later connection.
     */
    fun extractVoiceSdkIdFromMetadata(metadata: String?): String? {
        if (metadata.isNullOrBlank()) {
            return null
        }

        try {
            val json = JSONObject(metadata)
            val voiceSdkId = if (json.isNull("voice_sdk_id")) "" else json.optString("voice_sdk_id", "")
            if (voiceSdkId.isNotEmpty()) {
                return voiceSdkId
            }
        } catch (_: Exception) {
            // Not a direct JSON object; fall through to the string forms below.
        }

        Regex("\"voice_sdk_id\"\\s*:\\s*\"([^\"]+)\"").find(metadata)?.let { match ->
            val voiceSdkId = match.groupValues.getOrNull(1)
            if (!voiceSdkId.isNullOrEmpty()) {
                return voiceSdkId
            }
        }

        Regex("voice_sdk_id\\s*=\\s*([^,}\\s]+)").find(metadata)?.let { match ->
            val voiceSdkId = match.groupValues.getOrNull(1)?.trim('\'', '"')
            if (!voiceSdkId.isNullOrEmpty()) {
                return voiceSdkId
            }
        }

        return null
    }

    private fun syntheticFlowId(metadata: String): String {
        return "flow-" + Integer.toHexString(metadata.hashCode())
    }

    private fun createPushEntry(
        action: String,
        metadata: String,
        callId: String?,
        now: Long
    ): PendingPushEntry {
        val effectiveCallId = callId ?: extractCallIdFromMetadata(metadata)
        val id = effectiveCallId ?: syntheticFlowId(metadata)
        return PendingPushEntry(id, effectiveCallId, action, metadata, now)
    }

    private fun parsePushEntries(prefs: SharedPreferences, now: Long): MutableList<PendingPushEntry> {
        val raw = prefs.getString(PENDING_PUSH_ENTRIES, null) ?: return mutableListOf()
        val entries = mutableListOf<PendingPushEntry>()

        try {
            val array = JSONArray(raw)
            for (index in 0 until array.length()) {
                val obj = array.optJSONObject(index) ?: continue
                val metadata = obj.optString("metadata", "")
                val storedCallId = if (obj.isNull("callId")) null else obj.optString("callId", "")
                val callId = storedCallId?.takeIf { it.isNotEmpty() }
                    ?: extractCallIdFromMetadata(metadata)
                val fallbackId = callId ?: syntheticFlowId(metadata)
                val createdAt = obj.optLong("createdAt", 0L).takeIf { it > 0L } ?: now
                val deliveredAt = if (obj.isNull("deliveredAt")) {
                    null
                } else {
                    obj.optLong("deliveredAt", 0L).takeIf { it > 0L }
                }

                entries.add(
                    PendingPushEntry(
                        id = obj.optString("id", "").takeIf { it.isNotEmpty() } ?: fallbackId,
                        callId = callId,
                        action = obj.optString("action", ""),
                        metadata = metadata,
                        createdAt = createdAt,
                        deliveredAt = deliveredAt
                    )
                )
            }
        } catch (e: Exception) {
            Log.w(TAG, "Could not read pending push entries; starting empty", e)
            return mutableListOf()
        }

        return entries
    }

    private fun loadPushEntries(prefs: SharedPreferences, now: Long): MutableList<PendingPushEntry> {
        val entries = parsePushEntries(prefs, now)

        // Migrate the pre-scoping single-slot values the first time they are seen.
        if (entries.isEmpty()) {
            val legacyAction = prefs.getString(LEGACY_PENDING_PUSH_ACTION, null)
            val legacyMetadata = prefs.getString(LEGACY_PENDING_PUSH_METADATA, null)
            if (!legacyAction.isNullOrEmpty() && !legacyMetadata.isNullOrEmpty()) {
                entries.add(createPushEntry(legacyAction, legacyMetadata, null, now))
            }
        }

        return entries
    }

    private fun expireEntries(entries: MutableList<PendingPushEntry>, now: Long, maxAgeMs: Long): Int {
        val before = entries.size
        entries.removeAll { entry -> now - entry.createdAt > maxAgeMs }
        return before - entries.size
    }

    private fun writePushEntries(
        prefs: SharedPreferences,
        entries: List<PendingPushEntry>,
        currentId: String?,
        lastDeliveredId: String?
    ) {
        val array = JSONArray()
        entries.forEach { entry ->
            val obj = JSONObject()
            obj.put("id", entry.id)
            obj.put("callId", entry.callId ?: JSONObject.NULL)
            obj.put("action", entry.action)
            obj.put("metadata", entry.metadata)
            obj.put("createdAt", entry.createdAt)
            obj.put("deliveredAt", entry.deliveredAt ?: JSONObject.NULL)
            array.put(obj)
        }

        val validCurrentId = currentId?.takeIf { id -> entries.any { it.id == id } }
        val validDeliveredId = lastDeliveredId?.takeIf { id -> entries.any { it.id == id } }
        val currentEntry = entries.firstOrNull { it.id == validCurrentId } ?: entries.lastOrNull()

        val editor = prefs.edit()
        editor.putString(PENDING_PUSH_ENTRIES, array.toString())
        if (validCurrentId != null) {
            editor.putString(PENDING_PUSH_CURRENT_ID, validCurrentId)
        } else {
            editor.remove(PENDING_PUSH_CURRENT_ID)
        }
        if (validDeliveredId != null) {
            editor.putString(PENDING_PUSH_LAST_DELIVERED_ID, validDeliveredId)
        } else {
            editor.remove(PENDING_PUSH_LAST_DELIVERED_ID)
        }

        // Keep the legacy keys pointing at the current entry so older readers
        // continue to work while the scoped store owns the real state.
        if (currentEntry != null) {
            editor.putString(LEGACY_PENDING_PUSH_ACTION, currentEntry.action)
            editor.putString(LEGACY_PENDING_PUSH_METADATA, currentEntry.metadata)
        } else {
            editor.remove(LEGACY_PENDING_PUSH_ACTION)
            editor.remove(LEGACY_PENDING_PUSH_METADATA)
        }
        editor.apply()
    }

    private fun parseRememberedPushes(prefs: SharedPreferences): MutableList<RememberedPush> {
        val raw = prefs.getString(INCOMING_PUSH_ENTRIES, null) ?: return mutableListOf()
        val entries = mutableListOf<RememberedPush>()

        try {
            val array = JSONArray(raw)
            for (index in 0 until array.length()) {
                val obj = array.optJSONObject(index) ?: continue
                val callId = obj.optString("callId", "")
                val metadata = obj.optString("metadata", "")
                if (callId.isEmpty() || metadata.isEmpty()) {
                    continue
                }
                entries.add(RememberedPush(callId, metadata, obj.optLong("receivedAt", 0L)))
            }
        } catch (e: Exception) {
            Log.w(TAG, "Could not read remembered push metadata; starting empty", e)
            return mutableListOf()
        }

        return entries
    }

    private fun loadRememberedPushes(prefs: SharedPreferences, now: Long): MutableList<RememberedPush> {
        val entries = parseRememberedPushes(prefs)
        entries.removeAll { it.receivedAt <= 0L || now - it.receivedAt > INCOMING_PUSH_TTL_MS }
        return entries
    }

    private fun writeRememberedPushes(prefs: SharedPreferences, entries: List<RememberedPush>) {
        val array = JSONArray()
        entries.forEach { entry ->
            val obj = JSONObject()
            obj.put("callId", entry.callId)
            obj.put("metadata", entry.metadata)
            obj.put("receivedAt", entry.receivedAt)
            array.put(obj)
        }
        prefs.edit().putString(INCOMING_PUSH_ENTRIES, array.toString()).apply()
    }

    private fun removeRememberedPush(prefs: SharedPreferences, callId: String?) {
        if (callId.isNullOrEmpty()) {
            return
        }
        val entries = loadRememberedPushes(prefs, System.currentTimeMillis())
        entries.removeAll { it.callId == callId }
        writeRememberedPushes(prefs, entries)
    }

    /**
     * Merge the voice_sdk_id captured at push receipt into metadata that reaches
     * the pending-action stage. The id stays keyed to this call only.
     */
    private fun enrichMetadataWithRememberedPush(
        prefs: SharedPreferences,
        callId: String?,
        metadata: String
    ): String {
        if (callId.isNullOrEmpty() || metadata.contains("voice_sdk_id")) {
            return metadata
        }

        val remembered = loadRememberedPushes(prefs, System.currentTimeMillis())
            .lastOrNull { it.callId == callId }
            ?: return metadata
        if (!remembered.metadata.contains("voice_sdk_id")) {
            return metadata
        }

        return try {
            val merged = JSONObject(remembered.metadata)
            val incoming = JSONObject(metadata)
            val keys = incoming.keys()
            while (keys.hasNext()) {
                val key = keys.next()
                merged.put(key, incoming.get(key))
            }
            merged.toString()
        } catch (_: Exception) {
            // FCM key/value form cannot be merged safely; use the full original
            // metadata because it belongs to the same call.
            remembered.metadata
        }
    }

    /**
     * Android FCM receipt hook: remember the push metadata for its call before
     * a notification action or fallback launch can consume it.
     */
    fun rememberIncomingPush(
        context: Context,
        metadata: String,
        callId: String? = extractCallIdFromMetadata(metadata)
    ) {
        if (metadata.isBlank() || callId.isNullOrEmpty()) {
            return
        }

        synchronized(pushStateLock) {
            val prefs = getSharedPreferences(context)
            val now = System.currentTimeMillis()
            val entries = loadRememberedPushes(prefs, now)
            entries.removeAll { it.callId == callId }
            entries.add(RememberedPush(callId, metadata, now))
            writeRememberedPushes(prefs, entries)
            Log.d(TAG, "Remembered push metadata for call: $callId")
        }
    }

    /**
     * Store an action for the push flow that belongs to [callId]. Existing
     * metadata for that call is preserved; metadata from another call is never
     * borrowed.
     */
    fun setPendingPushActionForCall(
        context: Context,
        action: String,
        metadata: String,
        callId: String?
    ) {
        Log.d(TAG, "setPendingPushActionForCall called with action: $action, callId: $callId")

        synchronized(pushStateLock) {
            val prefs = getSharedPreferences(context)
            val now = System.currentTimeMillis()
            val entries = loadPushEntries(prefs, now)
            expireEntries(entries, now, DEFAULT_PENDING_PUSH_TTL_MS)

            val effectiveCallId = callId?.takeIf { it.isNotEmpty() }
                ?: extractCallIdFromMetadata(metadata)
            val enrichedMetadata = enrichMetadataWithRememberedPush(prefs, effectiveCallId, metadata)
            val entry = createPushEntry(action, enrichedMetadata, effectiveCallId, now)

            // Replace the same flow only; entries for other calls stay intact.
            entries.removeAll { it.id == entry.id }
            entries.add(entry)

            writePushEntries(
                prefs,
                entries,
                entry.id,
                prefs.getString(PENDING_PUSH_LAST_DELIVERED_ID, null)
            )
        }
    }

    fun setPendingPushAction(context: Context, action: String, metadata: String) {
        setPendingPushActionForCall(context, action, metadata, extractCallIdFromMetadata(metadata))
    }

    fun getPendingPushAction(context: Context): Pair<String?, String?> {
        Log.d(TAG, "getPendingPushAction called")

        synchronized(pushStateLock) {
            val prefs = getSharedPreferences(context)
            val now = System.currentTimeMillis()
            val entries = loadPushEntries(prefs, now)
            val expired = expireEntries(entries, now, DEFAULT_PENDING_PUSH_TTL_MS)

            val currentId = prefs.getString(PENDING_PUSH_CURRENT_ID, null)
            val entry = entries.firstOrNull { it.id == currentId } ?: entries.lastOrNull()

            if (entry == null) {
                if (expired > 0 || prefs.contains(LEGACY_PENDING_PUSH_ACTION)) {
                    writePushEntries(prefs, entries, null, null)
                }
                return Pair(null, null)
            }

            // Reading no longer deletes the flow: the push-answer connection may
            // still need the metadata to attach the pending call.
            val markedEntry = if (entry.deliveredAt == null) entry.copy(deliveredAt = now) else entry
            entries.removeAt(entries.indexOf(entry))
            entries.add(markedEntry)
            writePushEntries(prefs, entries, markedEntry.id, markedEntry.id)

            return Pair(markedEntry.action, markedEntry.metadata)
        }
    }

    fun getPendingPushActionForCall(context: Context, callId: String): Pair<String?, String?> {
        if (callId.isEmpty()) {
            return Pair(null, null)
        }

        synchronized(pushStateLock) {
            val prefs = getSharedPreferences(context)
            val now = System.currentTimeMillis()
            val entries = loadPushEntries(prefs, now)
            val expired = expireEntries(entries, now, DEFAULT_PENDING_PUSH_TTL_MS)
            val entry = entries.firstOrNull { it.callId == callId || it.id == callId }

            if (entry == null) {
                if (expired > 0) {
                    writePushEntries(
                        prefs,
                        entries,
                        prefs.getString(PENDING_PUSH_CURRENT_ID, null),
                        prefs.getString(PENDING_PUSH_LAST_DELIVERED_ID, null)
                    )
                }
                return Pair(null, null)
            }

            val markedEntry = if (entry.deliveredAt == null) entry.copy(deliveredAt = now) else entry
            entries.removeAt(entries.indexOf(entry))
            entries.add(markedEntry)
            // Reading one call's flow must not steal the "current" pointer from
            // a newer flow that is still active.
            val currentId = prefs.getString(PENDING_PUSH_CURRENT_ID, null)
                ?.takeIf { id -> entries.any { it.id == id } }
                ?: markedEntry.id
            writePushEntries(prefs, entries, currentId, markedEntry.id)
            return Pair(markedEntry.action, markedEntry.metadata)
        }
    }

    fun getPendingVoiceSdkIdForCall(context: Context, callId: String): String? {
        if (callId.isEmpty()) {
            return null
        }

        synchronized(pushStateLock) {
            val prefs = getSharedPreferences(context)
            val now = System.currentTimeMillis()
            val entries = loadPushEntries(prefs, now)
            val expired = expireEntries(entries, now, DEFAULT_PENDING_PUSH_TTL_MS)
            val entry = entries.firstOrNull { it.callId == callId || it.id == callId }

            if (expired > 0) {
                writePushEntries(
                    prefs,
                    entries,
                    prefs.getString(PENDING_PUSH_CURRENT_ID, null),
                    prefs.getString(PENDING_PUSH_LAST_DELIVERED_ID, null)
                )
            }
            return entry?.let { extractVoiceSdkIdFromMetadata(it.metadata) }
        }
    }

    fun hasPendingPushActionForCall(context: Context, callId: String): Boolean {
        if (callId.isEmpty()) {
            return false
        }

        synchronized(pushStateLock) {
            val prefs = getSharedPreferences(context)
            val now = System.currentTimeMillis()
            val entries = loadPushEntries(prefs, now)
            val expired = expireEntries(entries, now, DEFAULT_PENDING_PUSH_TTL_MS)
            if (expired > 0) {
                writePushEntries(
                    prefs,
                    entries,
                    prefs.getString(PENDING_PUSH_CURRENT_ID, null),
                    prefs.getString(PENDING_PUSH_LAST_DELIVERED_ID, null)
                )
            }
            return entries.any { it.callId == callId || it.id == callId }
        }
    }

    /**
     * Atomic get-and-remove for a push flow. Prefer this over get + clear so a
     * push that arrives in between cannot be cleared by mistake.
     */
    fun consumePendingPushAction(context: Context, callId: String?): PendingPushSnapshot {
        synchronized(pushStateLock) {
            val prefs = getSharedPreferences(context)
            val now = System.currentTimeMillis()
            val entries = loadPushEntries(prefs, now)
            expireEntries(entries, now, DEFAULT_PENDING_PUSH_TTL_MS)

            val currentId = prefs.getString(PENDING_PUSH_CURRENT_ID, null)
            val lastDeliveredId = prefs.getString(PENDING_PUSH_LAST_DELIVERED_ID, null)
            val entry = when {
                !callId.isNullOrEmpty() -> entries.firstOrNull {
                    it.callId == callId || it.id == callId
                }
                lastDeliveredId != null -> entries.firstOrNull { it.id == lastDeliveredId }
                else -> entries.firstOrNull { it.id == currentId } ?: entries.lastOrNull()
            }

            if (entry == null) {
                writePushEntries(prefs, entries, currentId, lastDeliveredId)
                return PendingPushSnapshot(null, null, callId)
            }

            entries.removeAll { it.id == entry.id }
            val nextCurrentId = if (currentId == entry.id) entries.lastOrNull()?.id else currentId
            writePushEntries(prefs, entries, nextCurrentId, null)
            removeRememberedPush(prefs, entry.callId)
            Log.d(TAG, "Consumed pending push action for call: ${entry.callId ?: entry.id}")
            return PendingPushSnapshot(entry.action, entry.metadata, entry.callId)
        }
    }

    fun clearPendingPushAction(context: Context): Boolean {
        Log.d(TAG, "clearPendingPushAction called")

        synchronized(pushStateLock) {
            val prefs = getSharedPreferences(context)
            val now = System.currentTimeMillis()
            val entries = loadPushEntries(prefs, now)
            val expired = expireEntries(entries, now, DEFAULT_PENDING_PUSH_TTL_MS)

            val currentId = prefs.getString(PENDING_PUSH_CURRENT_ID, null)
            val lastDeliveredId = prefs.getString(PENDING_PUSH_LAST_DELIVERED_ID, null)
            val targetId = lastDeliveredId?.takeIf { id -> entries.any { it.id == id } }
                ?: currentId?.takeIf { id -> entries.any { it.id == id } }

            if (targetId == null) {
                if (expired > 0 || prefs.contains(LEGACY_PENDING_PUSH_ACTION)) {
                    writePushEntries(
                        prefs,
                        entries,
                        entries.lastOrNull()?.id,
                        null
                    )
                }
                return true
            }

            val target = entries.firstOrNull { it.id == targetId }
            entries.removeAll { it.id == targetId }
            val nextCurrentId = if (currentId == targetId) entries.lastOrNull()?.id else currentId
            writePushEntries(prefs, entries, nextCurrentId, null)
            removeRememberedPush(prefs, target?.callId)
            return true
        }
    }

    /**
     * Clear only the flow for [callId]. Other active push flows are untouched.
     */
    fun clearPendingPushActionForCall(context: Context, callId: String): Boolean {
        if (callId.isEmpty()) {
            return false
        }

        Log.d(TAG, "clearPendingPushActionForCall called for: $callId")

        synchronized(pushStateLock) {
            val prefs = getSharedPreferences(context)
            val now = System.currentTimeMillis()
            val entries = loadPushEntries(prefs, now)
            expireEntries(entries, now, DEFAULT_PENDING_PUSH_TTL_MS)

            val matches = entries.filter { it.callId == callId || it.id == callId }
            if (matches.isEmpty()) {
                writePushEntries(
                    prefs,
                    entries,
                    prefs.getString(PENDING_PUSH_CURRENT_ID, null),
                    prefs.getString(PENDING_PUSH_LAST_DELIVERED_ID, null)
                )
                removeRememberedPush(prefs, callId)
                return false
            }

            val currentId = prefs.getString(PENDING_PUSH_CURRENT_ID, null)
            entries.removeAll { it.callId == callId || it.id == callId }
            val nextCurrentId = if (matches.any { it.id == currentId }) {
                entries.lastOrNull()?.id
            } else {
                currentId
            }
            writePushEntries(
                prefs,
                entries,
                nextCurrentId,
                prefs.getString(PENDING_PUSH_LAST_DELIVERED_ID, null)
            )
            removeRememberedPush(prefs, callId)
            return true
        }
    }

    fun clearAllPendingPushActions(context: Context): Boolean {
        synchronized(pushStateLock) {
            val prefs = getSharedPreferences(context)
            writePushEntries(prefs, mutableListOf(), null, null)
            writeRememberedPushes(prefs, mutableListOf())
            return true
        }
    }

    /**
     * A fresh login must not inherit any push flow from a previous connection,
     * including its voice_sdk_id and pending-call attach state.
     */
    fun resetPushStateForFreshLogin(context: Context): Boolean {
        Log.d(TAG, "resetPushStateForFreshLogin called")
        return clearAllPendingPushActions(context)
    }

    /**
     * Timeout/abandonment cleanup. Expired push flows are removed without
     * touching flows that are still within their handling window.
     */
    fun expireStalePendingPushActions(
        context: Context,
        now: Long = System.currentTimeMillis(),
        maxAgeMs: Long = DEFAULT_PENDING_PUSH_TTL_MS
    ): Int {
        synchronized(pushStateLock) {
            val prefs = getSharedPreferences(context)
            val entries = loadPushEntries(prefs, now)
            val removedEntries = expireEntries(entries, now, maxAgeMs)

            val rememberedBefore = parseRememberedPushes(prefs)
            val remembered = rememberedBefore
                .filter { it.receivedAt > 0L && now - it.receivedAt <= maxAgeMs }
                .toMutableList()
            val removedRemembered = rememberedBefore.size - remembered.size

            writePushEntries(
                prefs,
                entries,
                prefs.getString(PENDING_PUSH_CURRENT_ID, null),
                prefs.getString(PENDING_PUSH_LAST_DELIVERED_ID, null)
            )
            writeRememberedPushes(prefs, remembered)

            val removed = removedEntries + removedRemembered
            if (removed > 0) {
                Log.d(TAG, "Expired $removed stale push state entries")
            }
            return removed
        }
    }

    fun checkPendingPushAction(context: Context): Boolean {
        Log.d(TAG, "checkPendingPushAction called")

        synchronized(pushStateLock) {
            val prefs = getSharedPreferences(context)
            val now = System.currentTimeMillis()
            val entries = loadPushEntries(prefs, now)
            val expired = expireEntries(entries, now, DEFAULT_PENDING_PUSH_TTL_MS)
            if (expired > 0) {
                writePushEntries(
                    prefs,
                    entries,
                    prefs.getString(PENDING_PUSH_CURRENT_ID, null),
                    prefs.getString(PENDING_PUSH_LAST_DELIVERED_ID, null)
                )
            }

            // This used to clear the flow just for being observed, which lost
            // metadata before the pending call could attach. Presence only.
            return entries.isNotEmpty()
        }
    }

    /**
     * Attach the answered/rejected action to the call that owns that flow. If
     * the current entry belongs to a different call, a minimal entry is created
     * instead of borrowing another push's voice_sdk_id.
     */
    fun bindPendingPushActionToCall(context: Context, callId: String, action: String) {
        if (callId.isEmpty()) {
            return
        }

        synchronized(pushStateLock) {
            val prefs = getSharedPreferences(context)
            val now = System.currentTimeMillis()
            val entries = loadPushEntries(prefs, now)
            expireEntries(entries, now, DEFAULT_PENDING_PUSH_TTL_MS)

            val direct = entries.firstOrNull { it.callId == callId || it.id == callId }
            if (direct != null) {
                val updated = direct.copy(
                    id = callId,
                    callId = callId,
                    action = action,
                    deliveredAt = null
                )
                entries.removeAll { it.id == direct.id || it.id == callId }
                entries.add(updated)
                writePushEntries(prefs, entries, updated.id, null)
                return
            }

            val currentId = prefs.getString(PENDING_PUSH_CURRENT_ID, null)
            val current = entries.firstOrNull { it.id == currentId } ?: entries.lastOrNull()
            if (current != null && (current.callId == null || current.callId == callId)) {
                val updated = current.copy(
                    id = callId,
                    callId = callId,
                    action = action,
                    deliveredAt = null
                )
                entries.removeAll { it.id == current.id || it.id == callId }
                entries.add(updated)
                writePushEntries(prefs, entries, updated.id, null)
                return
            }

            // Never borrow metadata (and therefore voice_sdk_id) from a
            // different call's push flow.
            val metadata = JSONObject().apply {
                put("call_id", callId)
                put("action", action)
            }.toString()
            val entry = createPushEntry(action, metadata, callId, now)
            entries.removeAll { it.id == entry.id }
            entries.add(entry)
            writePushEntries(prefs, entries, entry.id, null)
        }
    }

    /**
     * Verification hook for pushes, fresh logins and sequential-push handling.
     * Returns the scoped store without exposing it to the connection path.
     */
    fun getPendingPushState(context: Context): String {
        synchronized(pushStateLock) {
            val prefs = getSharedPreferences(context)
            val now = System.currentTimeMillis()
            val entries = loadPushEntries(prefs, now)
            expireEntries(entries, now, DEFAULT_PENDING_PUSH_TTL_MS)

            val currentId = prefs.getString(PENDING_PUSH_CURRENT_ID, null)
                ?.takeIf { id -> entries.any { it.id == id } }
                ?: entries.lastOrNull()?.id
            val lastDeliveredId = prefs.getString(PENDING_PUSH_LAST_DELIVERED_ID, null)
                ?.takeIf { id -> entries.any { it.id == id } }

            val array = JSONArray()
            entries.forEach { entry ->
                val obj = JSONObject()
                obj.put("id", entry.id)
                obj.put("callId", entry.callId ?: JSONObject.NULL)
                obj.put("action", entry.action)
                obj.put("metadata", entry.metadata)
                obj.put("createdAt", entry.createdAt)
                obj.put("deliveredAt", entry.deliveredAt ?: JSONObject.NULL)
                obj.put("voiceSdkId", extractVoiceSdkIdFromMetadata(entry.metadata) ?: JSONObject.NULL)
                array.put(obj)
            }

            val root = JSONObject()
            root.put("version", 2)
            root.put("now", now)
            root.put("ttlMs", DEFAULT_PENDING_PUSH_TTL_MS)
            root.put("currentId", currentId ?: JSONObject.NULL)
            root.put("lastDeliveredId", lastDeliveredId ?: JSONObject.NULL)
            root.put("entries", array)

            val rememberedArray = JSONArray()
            loadRememberedPushes(prefs, now).forEach { remembered ->
                val obj = JSONObject()
                obj.put("callId", remembered.callId)
                obj.put("voiceSdkId", extractVoiceSdkIdFromMetadata(remembered.metadata) ?: JSONObject.NULL)
                obj.put("receivedAt", remembered.receivedAt)
                rememberedArray.put(obj)
            }
            root.put("remembered", rememberedArray)

            writePushEntries(prefs, entries, currentId, lastDeliveredId)
            return root.toString()
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
