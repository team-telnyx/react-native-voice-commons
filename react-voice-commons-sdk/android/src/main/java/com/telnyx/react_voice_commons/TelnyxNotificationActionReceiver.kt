package com.telnyx.react_voice_commons

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import org.json.JSONObject

/**
 * Base broadcast receiver for handling notification actions for Telnyx voice calls (Answer/Reject)
 * Your app should extend this class to customize behavior if needed
 */
open class TelnyxNotificationActionReceiver : BroadcastReceiver() {
    private val tag = "TelnyxNotification"

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        val callId = intent.getStringExtra("call_id")

        Log.d(tag, "Received notification action: $action for call: $callId")

        if (callId == null) {
            Log.e(tag, "No call ID provided in notification action")
            return
        }

        when (action) {
            "ANSWER_CALL" -> {
                Log.d(tag, "Answer action triggered for call: $callId")
                handleAnswerCall(context, callId)
            }
            "REJECT_CALL" -> {
                Log.d(tag, "Reject action triggered for call: $callId")
                handleRejectCall(context, callId)
            }
            else -> {
                Log.w(tag, "Unknown notification action: $action")
            }
        }

        // Hide the notification after action
        val notificationHelper = TelnyxNotificationHelper(context)
        notificationHelper.hideIncomingCallNotification()
    }

    protected open fun handleAnswerCall(context: Context, callId: String) {
        try {
            Log.d(tag, "Processing answer action through VoicePnManager")
            
            // Get the existing metadata from VoicePnManager (contains original FCM data including voice_sdk_id)
            val (existingAction, existingMetadata) = VoicePnManager.getPendingPushAction(context)
            
            Log.d(tag, "Existing action: '$existingAction'")
            Log.d(tag, "Existing metadata: '$existingMetadata'")
            Log.d(tag, "Existing metadata length: ${existingMetadata?.length ?: 0}")
            
            var finalMetadata: String
            
            if (existingMetadata != null && existingMetadata.isNotEmpty()) {
                // Try to parse existing metadata and add action info
                try {
                    Log.d(tag, "Attempting to preserve original metadata")
                    
                    // The existing metadata from FCM service is the raw FCM data string
                    // It looks like: {metadata={"call_id":"...","voice_sdk_id":"..."}, message=...}
                    if (existingMetadata.contains("\"voice_sdk_id\"")) {
                        // Extract just the JSON part that contains the voice_sdk_id
                        val startIndex = existingMetadata.indexOf("{\"call_id\"")
                        val endIndex = existingMetadata.lastIndexOf("}") + 1
                        
                        if (startIndex in 0..<endIndex) {
                            val originalJson = existingMetadata.substring(startIndex, endIndex)
                            Log.d(tag, "Extracted original JSON: $originalJson")
                            
                            // Parse and add action
                            val metadata = JSONObject(originalJson)
                            metadata.put("action", "answer")
                            finalMetadata = metadata.toString()
                            
                            Log.d(tag, "Enhanced metadata with action: $finalMetadata")
                        } else {
                            throw Exception("Could not extract JSON from FCM data")
                        }
                    } else {
                        // Try to parse as direct JSON and add action
                        val metadata = JSONObject(existingMetadata)
                        metadata.put("action", "answer")
                        finalMetadata = metadata.toString()
                        
                        Log.d(tag, "Updated existing JSON metadata with action: $finalMetadata")
                    }
                } catch (e: Exception) {
                    Log.w(tag, "Could not parse existing metadata, creating new one", e)
                    // Fallback to simple metadata
                    finalMetadata = JSONObject().apply {
                        put("call_id", callId)
                        put("action", "answer")
                    }.toString()
                    Log.d(tag, "Created fallback metadata: $finalMetadata")
                }
            } else {
                // No existing metadata, create simple one
                Log.d(tag, "No existing metadata found, creating simple metadata")
                finalMetadata = JSONObject().apply {
                    put("call_id", callId)
                    put("action", "answer")
                }.toString()
                Log.d(tag, "Created simple metadata: $finalMetadata")
            }
            
            VoicePnManager.setPendingPushAction(context, "answer", finalMetadata)
            
            Log.d(tag, "Answer action stored - app should open via direct PendingIntent")
        } catch (e: Exception) {
            Log.e(tag, "Error handling answer call action", e)
        }
    }

    protected open fun handleRejectCall(context: Context, callId: String) {
        try {
            Log.d(tag, "Processing reject action through VoicePnManager")
            
            // Get the existing metadata from VoicePnManager (contains original FCM data including voice_sdk_id)
            val (existingAction, existingMetadata) = VoicePnManager.getPendingPushAction(context)
            
            var finalMetadata: String
            
            if (existingMetadata != null && existingMetadata.isNotEmpty()) {
                // Try to parse existing metadata and add action info
                try {
                    // The existing metadata might be FCM data string or JSON
                    if (existingMetadata.startsWith("{") && existingMetadata.contains("metadata=")) {
                        // This is FCM data string format: {metadata={"call_id":"...","voice_sdk_id":"..."}, message=...}
                        // Extract the JSON part from metadata field
                        val metadataStart = existingMetadata.indexOf("metadata=") + 9
                        val metadataEnd = existingMetadata.indexOf("}", metadataStart) + 1
                        val metadataJson = existingMetadata.substring(metadataStart, metadataEnd)
                        
                        // Parse and add action
                        val metadata = JSONObject(metadataJson)
                        metadata.put("action", "reject")
                        finalMetadata = metadata.toString()
                        
                        Log.d(tag, "Preserved original FCM metadata with action: $finalMetadata")
                    } else {
                        // Try to parse as direct JSON
                        val metadata = JSONObject(existingMetadata)
                        metadata.put("action", "reject")
                        finalMetadata = metadata.toString()
                        
                        Log.d(tag, "Updated existing JSON metadata with action: $finalMetadata")
                    }
                } catch (e: Exception) {
                    Log.w(tag, "Could not parse existing metadata, creating new one", e)
                    // Fallback to simple metadata
                    finalMetadata = mapOf(
                        "call_id" to callId,
                        "action" to "reject"
                    ).toString()
                }
            } else {
                // No existing metadata, create simple one
                Log.d(tag, "No existing metadata found, creating simple metadata")
                finalMetadata = mapOf(
                    "call_id" to callId,
                    "action" to "reject"
                ).toString()
            }
            
            VoicePnManager.setPendingPushAction(context, "reject", finalMetadata)
            
            Log.d(tag, "Reject action processed successfully")
        } catch (e: Exception) {
            Log.e(tag, "Error handling reject call action", e)
        }
    }
}