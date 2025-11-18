package com.telnyx.react_voice_commons

import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.util.Log
import androidx.annotation.RequiresApi
import com.facebook.react.ReactActivity
import com.facebook.react.ReactApplication

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
    @RequiresApi(Build.VERSION_CODES.O)
    private fun handleIntent(intent: Intent) {
        Log.d(TAG, "Handling intent: ${intent.action}")
        
        val extras = intent.extras
        if (extras != null) {
            Log.d(TAG, "Intent extras found: ${extras.keySet()}")

            
            // Handle push notification data
            val callId = extras.getString("call_id")
            val action = extras.getString("action")
            val fromNotificationAction = extras.getBoolean("from_notification_action", false)
            val metadata = extras.getString("meta_data")
            if (callId != null && action != null) {
                Log.d(TAG, "Found push notification data - callId: $callId, action: $action, fromNotificationAction: $fromNotificationAction")
                
                // If this was opened from a notification action, handle it appropriately
                if (fromNotificationAction) {
                    Log.d(TAG, "App opened from notification action - action: $action")
                    
                    when (action) {
                        "answer" -> {
                            Log.d(TAG, "User answered call - showing ongoing call notification")
                            // Dismiss incoming call notification
                            TelnyxNotificationHelper.hideNotificationFromContext(this)
                            
                            // Show ongoing call notification to keep app alive
                            val callerName = extras.getString("caller_name") ?: extras.getString("caller_id_name") ?: "Unknown Caller"
                            val callerNumber = extras.getString("caller_number") ?: extras.getString("caller_id_number") ?: ""
                            
                            val notificationHelper = TelnyxNotificationHelper(this)
                            notificationHelper.showOngoingCallNotification(callerName, callerNumber, callId)
                            
                            // Start foreground service to keep WebRTC connection alive
                            try {
                                val serviceIntent = Intent(this, CallForegroundService::class.java).apply {
                                    setAction(CallForegroundService.ACTION_START_FOREGROUND_SERVICE)
                                    putExtra(CallForegroundService.EXTRA_CALLER_NAME, callerName)
                                    putExtra(CallForegroundService.EXTRA_CALLER_NUMBER, callerNumber)
                                    putExtra(CallForegroundService.EXTRA_CALL_ID, callId)
                                }
                                
                                // Use startForegroundService for API 26+, startService for older versions
                                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                                    startForegroundService(serviceIntent)
                                } else {
                                    startService(serviceIntent)
                                }
                                Log.d(TAG, "Started CallForegroundService for answered call")
                            } catch (e: Exception) {
                                Log.e(TAG, "Failed to start CallForegroundService", e)
                                // Continue without foreground service if it fails
                            }
                        }
                        "reject", "hangup" -> {
                            Log.d(TAG, "User rejected/ended call - dismissing all notifications")
                            // Dismiss any call notifications
                            TelnyxNotificationHelper.hideNotificationFromContext(this)
                        }
                        else -> {
                            Log.d(TAG, "Unknown notification action, dismissing notification")
                            TelnyxNotificationHelper.hideNotificationFromContext(this)
                        }
                    }
                }
                
                // Store the push action for when React Native is ready
                pendingPushAction = action
                pendingPushMetadata = metadata
                
                // Store the call action for React Native to retrieve
                notifyReactNativeOfCallAction(action!!, callId!!)
                
                // Also store as push action for backward compatibility
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
     * Notify React Native of call actions that happen from notification buttons
     */
    private fun notifyReactNativeOfCallAction(action: String, callId: String) {
        try {
            Log.d(TAG, "Notifying React Native of call action: $action for callId: $callId")
            
            // Store the call action using VoicePnManager for reliable retrieval (fallback)
            VoicePnManager.setPendingCallAction(this, action, callId, System.currentTimeMillis())
            
            // Send immediate event to React Native if available (for active calls)
            try {
                val reactApplication = application as? ReactApplication
                val reactContext = reactApplication?.reactNativeHost?.reactInstanceManager?.currentReactContext
                
                if (reactContext != null) {
                    Log.d(TAG, "React Native context available, emitting immediate call action event")
                    
                    // Use VoicePnBridgeModule to emit the event
                    val bridgeModule = reactContext.getNativeModule(VoicePnBridgeModule::class.java)
                    bridgeModule?.emitCallActionEvent(action, callId)
                } else {
                    Log.d(TAG, "React Native context not available, action stored for later retrieval")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error emitting immediate call action event", e)
                // Action is still stored in VoicePnManager as fallback
            }
            
            Log.d(TAG, "Call action notification completed: $action")
        } catch (e: Exception) {
            Log.e(TAG, "Error notifying React Native of call action", e)
        }
    }

    /**
     * Override this method in your MainActivity to handle additional intent processing
     */
    protected open fun onHandleIntent(intent: Intent) {
        // Default implementation does nothing
    }
}