package com.telnyx.react_voice_commons

import android.util.Log
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

/**
 * FCM Service for handling Telnyx voice push notifications
 * This service should be extended by the main app's FCM service
 */
open class TelnyxFirebaseMessagingService : FirebaseMessagingService() {
    private val tag = "TelnyxFCMService"

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)
        
        Log.d(tag, "FCM message received from: ${remoteMessage.from}")
        Log.d(tag, "FCM message data: ${remoteMessage.data}")

        // Check if this is a Telnyx voice push notification
        val isTelnyxVoiceMessage = remoteMessage.data.containsKey("metadata") ||
                                  remoteMessage.data.containsKey("caller_id_name") ||
                                  remoteMessage.data.containsKey("caller_name") ||
                                  remoteMessage.data.containsKey("call_id") ||
                                  remoteMessage.data.containsKey("telnyx_call_id") ||
                                  remoteMessage.data.get("message_type") == "voice" ||
                                  remoteMessage.data.get("message") == "Incoming call!" ||
                                  remoteMessage.data.get("message") == "Missed call!"

        if (isTelnyxVoiceMessage) {
            Log.d(tag, "Handling as Telnyx voice push notification")
            
            // Check if this is a missed call notification
            val isMissedCall = remoteMessage.data.get("message") == "Missed call!"
            if (isMissedCall) {
                handleTelnyxMissedCall(remoteMessage)
            } else {
                handleTelnyxVoicePush(remoteMessage)
            }
        } else {
            Log.d(tag, "Non-Telnyx message, delegating to handleNonTelnyxMessage")
            handleNonTelnyxMessage(remoteMessage)
        }
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d(tag, "FCM token refreshed: $token")
        handleTokenRefresh(token)
    }

    /**
     * Handle Telnyx missed call notifications
     */
    protected open fun handleTelnyxMissedCall(remoteMessage: RemoteMessage) {
        try {
            Log.d(tag, "Processing Telnyx missed call notification")
            
            // Extract caller information from metadata or top-level data
            var callId = "unknown"
            var callerName = "Unknown Caller"
            var callerNumber = ""
            
            // First try to parse metadata JSON if it exists
            val metadataJson = remoteMessage.data["metadata"]
            if (metadataJson != null) {
                try {
                    Log.d(tag, "Parsing missed call metadata JSON: $metadataJson")
                    val metadata = org.json.JSONObject(metadataJson)
                    callId = metadata.optString("call_id", "unknown")
                    callerName = metadata.optString("caller_name", "Unknown Caller")
                    callerNumber = metadata.optString("caller_number", "")
                    Log.d(tag, "Extracted from metadata - callId: $callId, callerName: $callerName, callerNumber: $callerNumber")
                } catch (e: Exception) {
                    Log.e(tag, "Error parsing missed call metadata JSON", e)
                }
            }
            
            // Fallback to top-level data if metadata parsing failed or doesn't exist
            if (callId == "unknown") {
                callId = remoteMessage.data["call_id"] ?: remoteMessage.data["telnyx_call_id"] ?: "unknown"
                callerName = remoteMessage.data["caller_id_name"] ?: remoteMessage.data["caller_name"] ?: "Unknown Caller"
                callerNumber = remoteMessage.data["caller_id_number"] ?: remoteMessage.data["caller_number"] ?: ""
                Log.d(tag, "Using top-level data for missed call - callId: $callId, callerName: $callerName, callerNumber: $callerNumber")
            }
            
            // Show missed call notification (this will hide any existing incoming call notification)
            val notificationHelper = TelnyxNotificationHelper(this)
            notificationHelper.showMissedCallNotification(callerName, callerNumber, callId)
            
            Log.d(tag, "Telnyx missed call notification processed successfully")
        } catch (e: Exception) {
            Log.e(tag, "Error handling Telnyx missed call notification", e)
        }
    }

    /**
     * Handle Telnyx voice push notifications
     */
    protected open fun handleTelnyxVoicePush(remoteMessage: RemoteMessage) {
        try {
            Log.d(tag, "Processing Telnyx voice push using VoicePnManager")
            
            // Extract caller information from metadata or top-level data
            var callId = "unknown"
            var callerName = "Unknown Caller"
            var callerNumber = ""
            
            // First try to parse metadata JSON if it exists
            val metadataJson = remoteMessage.data["metadata"]
            if (metadataJson != null) {
                try {
                    Log.d(tag, "Parsing metadata JSON: $metadataJson")
                    val metadata = org.json.JSONObject(metadataJson)
                    callId = metadata.optString("call_id", "unknown")
                    callerName = metadata.optString("caller_name", "Unknown Caller")
                    callerNumber = metadata.optString("caller_number", "")
                    Log.d(tag, "Extracted from metadata - callId: $callId, callerName: $callerName, callerNumber: $callerNumber")
                } catch (e: Exception) {
                    Log.e(tag, "Error parsing metadata JSON", e)
                    // Fall back to top-level data if metadata parsing fails
                }
            }
            
            // Fallback to top-level data if metadata parsing failed or doesn't exist
            if (callId == "unknown") {
                callId = remoteMessage.data["call_id"] ?: remoteMessage.data["telnyx_call_id"] ?: "unknown"
                callerName = remoteMessage.data["caller_id_name"] ?: remoteMessage.data["caller_name"] ?: "Unknown Caller"
                callerNumber = remoteMessage.data["caller_id_number"] ?: remoteMessage.data["caller_number"] ?: ""
                Log.d(tag, "Using top-level data - callId: $callId, callerName: $callerName, callerNumber: $callerNumber")
            }
            

            var metadata = ""
            
            // Extract metadata using the same approach as official Telnyx service
            try {
                val params = remoteMessage.data
                val objects = org.json.JSONObject(params as Map<*, *>)
                metadata = objects.getString( "metadata")
                
                Log.d(tag, "Extracted FCM metadata string: $metadata")
            } catch (e: Exception) {
                Log.e(tag, "Error extracting metadata from FCM data: ${e.message}")

                // Fallback to simple JSON if metadata extraction fails
                metadata = org.json.JSONObject().apply {
                    put("call_id", callId)
                    put("caller_name", callerName)
                    put("caller_number", callerNumber)
                }.toString()
                
                Log.d(tag, "Using fallback metadata: $metadata")
            }
            //VoicePnManager.setPendingPushAction(this, "incoming_call", metadata)

            // Show notification using dynamic class resolution
            val notificationHelper = TelnyxNotificationHelper(this)
            notificationHelper.showIncomingCallNotification(callerName, callerNumber, callId, metadata)
            Log.d(tag, "Telnyx voice push processed successfully")
        } catch (e: Exception) {
            Log.e(tag, "Error handling Telnyx voice push notification", e)
        }
    }

    /**
     * Handle non-Telnyx messages - override this in your app's FCM service if needed
     */
    protected open fun handleNonTelnyxMessage(remoteMessage: RemoteMessage) {
        Log.d(tag, "Default non-Telnyx message handler - override this method if needed")
    }

    /**
     * Handle FCM token refresh - override this in your app's FCM service if needed
     */
    protected open fun handleTokenRefresh(token: String) {
        Log.d(tag, "Default token refresh handler - override this method if needed")
    }
}