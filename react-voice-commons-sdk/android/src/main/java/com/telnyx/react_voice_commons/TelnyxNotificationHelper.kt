package com.telnyx.react_voice_commons

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import android.graphics.Color
import android.util.Log

/**
 * Helper class for managing Telnyx voice call notifications
 */
class TelnyxNotificationHelper(private val context: Context) {
    companion object {
        const val CHANNEL_ID = "telnyx_voice_calls"
        const val CHANNEL_NAME = "Telnyx Voice Calls"
        const val NOTIFICATION_ID = 1001
        const val ONGOING_CALL_NOTIFICATION_ID = 1002
        private const val TAG = "TelnyxNotifications"
        
        /**
         * Static method to hide notifications from anywhere in the app
         * Useful for dismissing notifications when the app opens from Answer button
         */
        fun hideNotificationFromContext(context: Context) {
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.cancel(NOTIFICATION_ID)
            Log.d(TAG, "Dismissed Telnyx notification from static context")
        }
        
        /**
         * Static method to hide ongoing call notification from anywhere in the app
         * Should be called when a call ends to dismiss the ongoing call notification
         */
        fun hideOngoingCallNotificationFromContext(context: Context) {
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.cancel(ONGOING_CALL_NOTIFICATION_ID)
            Log.d(TAG, "Dismissed ongoing call notification from static context")
        }
    }

    private val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    init {
        createNotificationChannel()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifications for incoming Telnyx voice calls"
                enableLights(true)
                lightColor = Color.GREEN
                enableVibration(true)
                setSound(null, null) // Disable sound, CallKit will handle audio
            }
            notificationManager.createNotificationChannel(channel)
            Log.d(TAG, "Created notification channel: $CHANNEL_ID")
        }
    }

    fun createIncomingCallNotification(
        callerName: String?,
        callerNumber: String?,
        callId: String,
        metadata: String,
        mainActivityClass: Class<*>? = null
    ): Notification {
        val displayName = callerName ?: callerNumber ?: "Unknown Caller"
        val displayNumber = if (callerName != null && callerNumber != null) callerNumber else ""

        // Use provided MainActivity class or try to find it dynamically
        val activityClass = mainActivityClass ?: try {
            // Try TelnyxMainActivity first (apps should extend this)
            Class.forName("${context.packageName}.TelnyxMainActivity")
        } catch (e1: Exception) {
            try {
                // Fallback to MainActivity
                Class.forName("${context.packageName}.MainActivity")
            } catch (e2: Exception) {
                Log.w(TAG, "Could not find TelnyxMainActivity or MainActivity, using context class", e2)
                context.javaClass
            }
        }

        // Intent to open the app when notification is tapped
        val appIntent = Intent(context, activityClass).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("call_id", callId)
            putExtra("action", "open_call")
        }
        val appPendingIntent = PendingIntent.getActivity(
            context, 0, appIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setContentTitle("Incoming Call")
            .setContentText("$displayName")
            .setSmallIcon(android.R.drawable.ic_menu_call)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setAutoCancel(true)
            .setOngoing(true)
            .setFullScreenIntent(appPendingIntent, true)
            .setContentIntent(appPendingIntent)
            .setColor(Color.GREEN)

        // Add action buttons - use direct activity PendingIntents to avoid trampoline restrictions
        // Answer action - direct activity launch to avoid BAL restrictions
        val answerActivityIntent = Intent(context, activityClass).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("call_id", callId)
            putExtra("action", "answer")
            putExtra("from_notification_action", true)
            putExtra("meta_data", metadata)
            putExtra("caller_name", callerName)
            putExtra("caller_number", callerNumber)
        }
        val answerPendingIntent = PendingIntent.getActivity(
            context, 1, answerActivityIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Reject action - direct activity launch to avoid BAL restrictions
        val rejectActivityIntent = Intent(context, activityClass).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("call_id", callId)
            putExtra("action", "reject")
            putExtra("from_notification_action", true)
            putExtra("meta_data",metadata)
        }
        val rejectPendingIntent = PendingIntent.getActivity(
            context, 2, rejectActivityIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        builder.addAction(android.R.drawable.ic_menu_call, "Answer", answerPendingIntent)
        builder.addAction(android.R.drawable.ic_menu_close_clear_cancel, "Reject", rejectPendingIntent)

        return builder.build()
    }

    fun showIncomingCallNotification(
        callerName: String?, 
        callerNumber: String?, 
        callId: String,
        metadata: String,
        mainActivityClass: Class<*>? = null,
    ) {
        // First, hide any existing notification to avoid conflicts
        hideIncomingCallNotification()
        
        val notification = createIncomingCallNotification(callerName, callerNumber, callId,metadata, mainActivityClass)
        notificationManager.notify(NOTIFICATION_ID, notification)
        Log.d(TAG, "Showed incoming call notification for: $callerName ($callerNumber)")
    }

    fun showMissedCallNotification(
        callerName: String?,
        callerNumber: String?,
        callId: String
    ) {
        // Hide any existing incoming call notification first
        hideIncomingCallNotification()
        
        val displayName = callerName ?: callerNumber ?: "Unknown Caller"
        val displayNumber = if (callerName != null && callerNumber != null) callerNumber else ""
        
        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setContentTitle("Missed Call")
            .setContentText("$displayName${if (displayNumber.isNotEmpty()) "\n$displayNumber" else ""}")
            .setSmallIcon(android.R.drawable.ic_menu_call)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setAutoCancel(true)
            .setOngoing(false) // Not ongoing for missed calls
            .setColor(Color.RED)
            .build()
            
        notificationManager.notify(NOTIFICATION_ID, notification)
        Log.d(TAG, "Showed missed call notification for: $callerName ($callerNumber)")
    }

    fun showOngoingCallNotification(
        callerName: String?,
        callerNumber: String?,
        callId: String,
        mainActivityClass: Class<*>? = null
    ) {
        val notification = createOngoingCallNotification(callerName, callerNumber, callId, mainActivityClass)
        notificationManager.notify(ONGOING_CALL_NOTIFICATION_ID, notification)
        Log.d(TAG, "Showed ongoing call notification for: $callerName ($callerNumber)")
    }

    /**
     * Create ongoing call notification (for foreground services)
     * Returns the notification object instead of showing it directly
     */
    fun createOngoingCallNotification(
        callerName: String?,
        callerNumber: String?,
        callId: String,
        mainActivityClass: Class<*>? = null
    ): Notification {
        val displayName = callerName ?: callerNumber ?: "Unknown Caller"
        val displayNumber = if (callerName != null && callerNumber != null) callerNumber else ""

        // Use provided MainActivity class or try to find it dynamically
        val activityClass = mainActivityClass ?: try {
            // Try TelnyxMainActivity first (apps should extend this)
            Class.forName("${context.packageName}.TelnyxMainActivity")
        } catch (e1: Exception) {
            try {
                // Fallback to MainActivity
                Class.forName("${context.packageName}.MainActivity")
            } catch (e2: Exception) {
                Log.w(TAG, "Could not find TelnyxMainActivity or MainActivity, using context class", e2)
                context.javaClass
            }
        }

        // Intent to open the app when notification is tapped
        val appIntent = Intent(context, activityClass).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("call_id", callId)
            putExtra("action", "return_to_call")
        }
        val appPendingIntent = PendingIntent.getActivity(
            context, 0, appIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // End call action
        val endCallIntent = Intent(context, activityClass).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("call_id", callId)
            putExtra("action", "hangup")
            putExtra("from_notification_action", true)
        }
        val endCallPendingIntent = PendingIntent.getActivity(
            context, 3, endCallIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(context, CHANNEL_ID)
            .setContentTitle("Ongoing Call")
            .setContentText("$displayName${if (displayNumber.isNotEmpty()) " ($displayNumber)" else ""}")
            .setSmallIcon(android.R.drawable.ic_menu_call)
            .setPriority(NotificationCompat.PRIORITY_LOW) // Low priority for ongoing calls
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setAutoCancel(false) // Don't auto-cancel ongoing call notifications
            .setOngoing(true) // This is the key - makes it persistent and keeps app alive
            .setContentIntent(appPendingIntent)
            .setColor(Color.GREEN)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "End Call", endCallPendingIntent)
            .build()
    }

    fun hideIncomingCallNotification() {
        notificationManager.cancel(NOTIFICATION_ID)
        Log.d(TAG, "Hid incoming call notification")
    }

    fun hideOngoingCallNotification() {
        notificationManager.cancel(ONGOING_CALL_NOTIFICATION_ID)
        Log.d(TAG, "Hid ongoing call notification")
    }
}