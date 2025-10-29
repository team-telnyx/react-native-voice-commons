package com.telnyx.react_voice_commons

import android.util.Log
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.Arguments

class VoicePnBridgeModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    
    override fun getName(): String {
        return "VoicePnBridge"
    }
    
    @ReactMethod
    fun getPendingPushAction(promise: Promise) {
        try {
            val (action, metadata) = VoicePnManager.getPendingPushAction(reactApplicationContext)
            
            Log.d("VoicePnBridgeModule", "Retrieved pending action: '$action'")
            Log.d("VoicePnBridgeModule", "Retrieved metadata: '$metadata'")
            Log.d("VoicePnBridgeModule", "Metadata length: ${metadata?.length ?: 0}")
            
            val result = Arguments.createMap()
            result.putString("action", action)
            result.putString("metadata", metadata)
            
            promise.resolve(result)
        } catch (e: Exception) {
            Log.e("VoicePnBridgeModule", "Error getting pending push action", e)
            promise.reject("GET_PENDING_PUSH_ACTION_ERROR", e.message, e)
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
}