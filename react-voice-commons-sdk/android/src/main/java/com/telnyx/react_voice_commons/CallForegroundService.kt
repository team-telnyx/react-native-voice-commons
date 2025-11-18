package com.telnyx.react_voice_commons

import android.app.Service
import android.content.Intent
import android.os.IBinder
import android.util.Log

/**
 * Foreground service to keep WebRTC connections alive during calls
 * This service prevents the system from killing the app during active calls
 */
class CallForegroundService : Service() {
    companion object {
        private const val TAG = "CallForegroundService"
        const val ACTION_START_FOREGROUND_SERVICE = "START_FOREGROUND_SERVICE"
        const val ACTION_STOP_FOREGROUND_SERVICE = "STOP_FOREGROUND_SERVICE"
        
        const val EXTRA_CALLER_NAME = "caller_name"
        const val EXTRA_CALLER_NUMBER = "caller_number"
        const val EXTRA_CALL_ID = "call_id"
    }

    override fun onBind(intent: Intent?): IBinder? {
        return null
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START_FOREGROUND_SERVICE -> {
                Log.d(TAG, "Starting foreground service for call")
                startAsForegroundService(intent)
            }
            ACTION_STOP_FOREGROUND_SERVICE -> {
                Log.d(TAG, "Stopping foreground service")
                stopAsForegroundService()
            }
        }
        
        // Restart the service if it's killed by the system
        return START_STICKY
    }

    private fun startAsForegroundService(intent: Intent) {
        val callerName = intent.getStringExtra(EXTRA_CALLER_NAME) ?: "Unknown Caller"
        val callerNumber = intent.getStringExtra(EXTRA_CALLER_NUMBER) ?: ""
        val callId = intent.getStringExtra(EXTRA_CALL_ID) ?: "unknown"

        try {
            // Create ongoing call notification
            val notificationHelper = TelnyxNotificationHelper(this)
            val notification = notificationHelper.createOngoingCallNotification(callerName, callerNumber, callId)
            
            // Start foreground service with the notification
            startForeground(TelnyxNotificationHelper.ONGOING_CALL_NOTIFICATION_ID, notification)
            
            Log.d(TAG, "Foreground service started with ongoing call notification")
        } catch (e: Exception) {
            Log.e(TAG, "Error starting foreground service", e)
            // Stop the service if we can't create the notification
            stopSelf()
        }
    }

    private fun stopAsForegroundService() {
        try {
            // Hide the ongoing call notification
            TelnyxNotificationHelper.hideOngoingCallNotificationFromContext(this)
            
            // Stop foreground service
            stopForeground(true)
            stopSelf()
            
            Log.d(TAG, "Foreground service stopped")
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping foreground service", e)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        Log.d(TAG, "CallForegroundService destroyed")
    }
}