package com.telnyx.react_voice_commons

import android.content.Intent
import android.os.Build
import android.util.Log
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule

class VoicePnBridgeModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    
    companion object {
        private const val TAG = "VoicePnBridgeModule"
    }
    
    override fun getName(): String {
        return "VoicePnBridge"
    }
    
    @ReactMethod
    fun getPendingPushAction(promise: Promise) {
        try {
            val (action, metadata) = VoicePnManager.getPendingPushAction(reactApplicationContext)
            
            Log.d(TAG, "Retrieved pending action: '$action'")
            Log.d(TAG, "Retrieved metadata: '$metadata'")
            Log.d(TAG, "Metadata length: ${metadata?.length ?: 0}")
            
            val result = Arguments.createMap()
            result.putString("action", action)
            result.putString("metadata", metadata)
            
            promise.resolve(result)
        } catch (e: Exception) {
            Log.e(TAG, "Error getting pending push action", e)
            promise.reject("GET_PENDING_PUSH_ACTION_ERROR", e.message, e)
        }
    }
    
    @ReactMethod
    fun setPendingPushAction(action: String, metadata: String, promise: Promise) {
        try {
            Log.d(TAG, "Setting pending push action: '$action' with metadata length: ${metadata.length}")
            val result = VoicePnManager.setPendingPushAction(reactApplicationContext, action, metadata)
            promise.resolve(result)
        } catch (e: Exception) {
            Log.e(TAG, "Error setting pending push action", e)
            promise.reject("SET_PENDING_PUSH_ACTION_ERROR", e.message, e)
        }
    }
    
    @ReactMethod
    fun clearPendingPushAction(promise: Promise) {
        try {
            val result = VoicePnManager.clearPendingPushAction(reactApplicationContext)
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("CLEAR_PENDING_PUSH_ACTION_ERROR", e.message, e)
        }
    }

    /**
     * React Native → Android: Get any pending call action from notification buttons
     * Uses the same reliable pattern as getPendingPushAction
     */
    @ReactMethod
    fun getPendingCallAction(promise: Promise) {
        try {
            val (action, callId, timestamp) = VoicePnManager.getPendingCallAction(reactApplicationContext)
            
            Log.d(TAG, "Retrieved pending call action: '$action' for callId: '$callId'")
            
            val result = Arguments.createMap()
            result.putString("action", action)
            result.putString("callId", callId)
            result.putDouble("timestamp", timestamp?.toDouble() ?: 0.0)
            
            promise.resolve(result)
        } catch (e: Exception) {
            Log.e(TAG, "Error getting pending call action", e)
            promise.reject("GET_PENDING_CALL_ACTION_ERROR", e.message, e)
        }
    }

    /**
     * React Native → Android: Clear any pending call action
     */
    @ReactMethod
    fun clearPendingCallAction(promise: Promise) {
        try {
            val result = VoicePnManager.clearPendingCallAction(reactApplicationContext)
            promise.resolve(result)
        } catch (e: Exception) {
            Log.e(TAG, "Error clearing pending call action", e)
            promise.reject("CLEAR_PENDING_CALL_ACTION_ERROR", e.message, e)
        }
    }
    
    /**
     * React Native → Android: End/hang up the current call
     */
    @ReactMethod
    fun endCall(callId: String?, promise: Promise) {
        try {
            Log.d(TAG, "endCall called from React Native for callId: $callId")
            
            // Hide any ongoing call notification and stop the foreground service
            TelnyxNotificationHelper.hideOngoingCallNotificationFromContext(reactApplicationContext)
            
            // Stop the foreground service that's keeping the notification alive
            try {
                val serviceIntent = Intent(reactApplicationContext, CallForegroundService::class.java).apply {
                    setAction(CallForegroundService.ACTION_STOP_FOREGROUND_SERVICE)
                }
                reactApplicationContext.startService(serviceIntent)
                Log.d(TAG, "Stopped CallForegroundService from endCall")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to stop CallForegroundService from endCall", e)
                // Don't fail the call end if service stop fails
            }
            
            // Store the call action for any listeners (using same pattern)
            VoicePnManager.setPendingCallAction(reactApplicationContext, "call_ended_from_rn", callId, System.currentTimeMillis())
            
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Error ending call", e)
            promise.reject("END_CALL_ERROR", e.message, e)
        }
    }
    
    /**
     * React Native → Android: Show ongoing call notification
     */
    @ReactMethod
    fun showOngoingCallNotification(callerName: String?, callerNumber: String?, callId: String?, promise: Promise) {
        try {
            Log.d(TAG, "showOngoingCallNotification called from React Native")
            
            val notificationHelper = TelnyxNotificationHelper(reactApplicationContext)
            notificationHelper.showOngoingCallNotification(
                callerName ?: "Unknown Caller",
                callerNumber ?: "",
                callId ?: "unknown"
            )
            
            // Also start the foreground service to keep the WebRTC connection alive
            try {
                val serviceIntent = Intent(reactApplicationContext, CallForegroundService::class.java).apply {
                    setAction(CallForegroundService.ACTION_START_FOREGROUND_SERVICE)
                    putExtra(CallForegroundService.EXTRA_CALLER_NAME, callerName ?: "Unknown Caller")
                    putExtra(CallForegroundService.EXTRA_CALLER_NUMBER, callerNumber ?: "")
                    putExtra(CallForegroundService.EXTRA_CALL_ID, callId ?: "unknown")
                }
                
                // Use startForegroundService for API 26+, startService for older versions
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    reactApplicationContext.startForegroundService(serviceIntent)
                } else {
                    reactApplicationContext.startService(serviceIntent)
                }
                Log.d(TAG, "Started CallForegroundService for ongoing call")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to start CallForegroundService", e)
                // Don't fail the notification if service start fails
            }
            
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Error showing ongoing call notification", e)
            promise.reject("SHOW_ONGOING_NOTIFICATION_ERROR", e.message, e)
        }
    }
    
    /**
     * React Native → Android: Hide ongoing call notification
     */
    @ReactMethod
    fun hideOngoingCallNotification(promise: Promise) {
        try {
            Log.d(TAG, "hideOngoingCallNotification called from React Native")
            
            TelnyxNotificationHelper.hideOngoingCallNotificationFromContext(reactApplicationContext)
            
            // Also stop the foreground service
            try {
                val serviceIntent = Intent(reactApplicationContext, CallForegroundService::class.java).apply {
                    setAction(CallForegroundService.ACTION_STOP_FOREGROUND_SERVICE)
                }
                reactApplicationContext.startService(serviceIntent)
                Log.d(TAG, "Stopped CallForegroundService")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to stop CallForegroundService", e)
                // Don't fail the notification hiding if service stop fails
            }
            
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Error hiding ongoing call notification", e)
            promise.reject("HIDE_ONGOING_NOTIFICATION_ERROR", e.message, e)
        }
    }
    
    /**
     * React Native → Android: Hide any incoming call notification
     */
    @ReactMethod
    fun hideIncomingCallNotification(promise: Promise) {
        try {
            Log.d(TAG, "hideIncomingCallNotification called from React Native")
            
            TelnyxNotificationHelper.hideNotificationFromContext(reactApplicationContext)
            
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Error hiding incoming call notification", e)
            promise.reject("HIDE_INCOMING_NOTIFICATION_ERROR", e.message, e)
        }
    }
    
    /**
     * Emit call action event to React Native (for immediate notification)
     * Called from TelnyxMainActivity when user taps notification action
     */
    fun emitCallActionEvent(action: String, callId: String) {
        try {
            Log.d(TAG, "Emitting call action event to React Native: action=$action, callId=$callId")
            
            val params = Arguments.createMap()
            params.putString("action", action)
            params.putString("callId", callId)
            params.putDouble("timestamp", System.currentTimeMillis().toDouble())
            
            reactApplicationContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                ?.emit("TelnyxCallAction", params)
                
            Log.d(TAG, "Call action event emitted successfully")
        } catch (e: Exception) {
            Log.e(TAG, "Error emitting call action event", e)
        }
    }
}