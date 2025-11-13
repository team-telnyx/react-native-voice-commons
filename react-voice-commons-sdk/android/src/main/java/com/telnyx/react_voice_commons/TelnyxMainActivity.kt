package com.telnyx.react_voice_commons

import android.content.Intent
import android.os.Bundle
import android.util.Log
import com.facebook.react.ReactActivity

/**
 * Base MainActivity class that provides Telnyx voice push notification handling
 * Your app's MainActivity should extend this class to get Telnyx functionality
 */
abstract class TelnyxMainActivity : ReactActivity() {
    companion object {
        private const val TAG = "TelnyxMainActivity"
    }

    // Store pending push notification data
    private var pendingPushAction: String? = null
    private var pendingPushMetadata: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Handle any intent extras (from push notifications or deep links)
        handleIntent(intent)
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        Log.d(TAG, "onNewIntent called")
        intent?.let { handleIntent(it) }
    }

    override fun onResume() {
        super.onResume()
        Log.d(TAG, "onResume called")
        // Check and send any pending push actions when app resumes
        checkAndSendPendingPushAction()
    }

    /**
     * Handle incoming intent data (from push notifications, deep links, etc.)
     */
    private fun handleIntent(intent: Intent) {
        Log.d(TAG, "Handling intent: ${intent.action}")
        
        val extras = intent.extras
        if (extras != null) {
            Log.d(TAG, "Intent extras found:")
            for (key in extras.keySet()) {
                Log.d(TAG, "  $key: ${extras.getString(key) ?: extras.get(key)}")
            }
            
            // Handle push notification data
            val callId = extras.getString("call_id")
            val action = extras.getString("action")
            val fromNotificationAction = extras.getBoolean("from_notification_action", false)
            
            if (callId != null && action != null) {
                Log.d(TAG, "Found push notification data - callId: $callId, action: $action, fromNotificationAction: $fromNotificationAction")
                
                // If this was opened from a notification action (Answer button), dismiss the notification
                if (fromNotificationAction) {
                    Log.d(TAG, "App opened from notification action - dismissing notification")
                    TelnyxNotificationHelper.hideNotificationFromContext(this)
                }
                
                // Store the push action for when React Native is ready
                pendingPushAction = action
                pendingPushMetadata = createPushMetadata(callId, action, extras)
                
                // Try to send immediately if React Native is already loaded
                checkAndSendPendingPushAction()
            }
        }
        
        // Allow subclasses to handle additional intent processing
        onHandleIntent(intent)
    }

    /**
     * Create push metadata string from intent extras
     */
    private fun createPushMetadata(callId: String, action: String, extras: Bundle): String {
        val metadata = mutableMapOf<String, String>()
        metadata["call_id"] = callId
        metadata["action"] = action
        
        // Add any other relevant extras
        extras.getString("caller_name")?.let { metadata["caller_name"] = it }
        extras.getString("caller_number")?.let { metadata["caller_number"] = it }
        extras.getString("caller_id_name")?.let { metadata["caller_id_name"] = it }
        extras.getString("caller_id_number")?.let { metadata["caller_id_number"] = it }
        
        return metadata.toString()
    }

    /**
     * Check and send pending push action to React Native via VoicePnModule
     * This method is called via reflection from VoicePnModule
     */
    fun checkAndSendPendingPushAction(): Boolean {
        Log.d(TAG, "checkAndSendPendingPushAction called")
        
        // First, check if we have FCM metadata (from push notification)
        val (fcmAction, fcmMetadata) = VoicePnManager.getPendingPushAction(this)
        
        if (fcmAction != null && fcmMetadata != null) {
            Log.d(TAG, "Found FCM push action: $fcmAction")
            Log.d(TAG, "FCM metadata: $fcmMetadata")
            
            try {
                // The FCM metadata is now clean JSON - just validate it parses
                val metadata = org.json.JSONObject(fcmMetadata)
                Log.d(TAG, "Successfully validated FCM metadata JSON")
                
                // FCM data already contains everything we need including voice_sdk_id
                Log.d(TAG, "Using FCM metadata directly")
                return true
            } catch (e: Exception) {
                Log.e(TAG, "Error parsing FCM metadata JSON: ${e.message}")
                VoicePnManager.clearPendingPushAction(this)
            }
        }
        
        // Fallback: handle instance variables (from intent extras)
        if (pendingPushAction != null && pendingPushMetadata != null) {
            Log.d(TAG, "Found instance push action: $pendingPushAction")
            
            try {
                // Store the intent-based action in VoicePnManager
                VoicePnManager.setPendingPushAction(this, pendingPushAction!!, pendingPushMetadata!!)
                
                // Clear the pending action
                pendingPushAction = null
                pendingPushMetadata = null
                
                Log.d(TAG, "Instance push action stored successfully")
                return true
            } catch (e: Exception) {
                Log.e(TAG, "Error storing instance push action", e)
            }
        }
        
        Log.d(TAG, "No pending push action found")
        return false
    }

    /**
     * Override this method in your MainActivity to handle additional intent processing
     */
    protected open fun onHandleIntent(intent: Intent) {
        // Default implementation does nothing
    }
}