package com.telnyx.react_voice_commons

import android.content.Context
import android.content.SharedPreferences
import android.util.Log

object VoicePnManager {
    
    private const val TAG = "VoicePnManager"
    private const val PREFS_NAME = "telnyx_voice_prefs"
    
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

    // PnModule functions
    fun setPendingPushAction(context: Context, action: String, metadata: String) {
        Log.d(TAG, "setPendingPushAction called with action: $action")
        val editor = getSharedPreferences(context).edit()
        editor.putString("pending_push_action", action)
        editor.putString("pending_push_metadata", metadata)
        editor.apply()
    }
    
    fun getPendingPushAction(context: Context): Pair<String?, String?> {
        Log.d(TAG, "getPendingPushAction called")
        val prefs = getSharedPreferences(context)
        val action = prefs.getString("pending_push_action", null)
        val metadata = prefs.getString("pending_push_metadata", null)
        return Pair(action, metadata)
    }
    
    fun clearPendingPushAction(context: Context): Boolean {
        Log.d(TAG, "clearPendingPushAction called")
        val editor = getSharedPreferences(context).edit()
        editor.remove("pending_push_action")
        editor.remove("pending_push_metadata")
        editor.apply()
        return true
    }
    
    fun checkPendingPushAction(context: Context): Boolean {
        Log.d(TAG, "checkPendingPushAction called")
        val (pendingAction, pendingMetadata) = getPendingPushAction(context)
        
        if (pendingAction != null && pendingMetadata != null) {
            Log.d(TAG, "Found pending action: $pendingAction")
            // Clear after checking
            clearPendingPushAction(context)
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