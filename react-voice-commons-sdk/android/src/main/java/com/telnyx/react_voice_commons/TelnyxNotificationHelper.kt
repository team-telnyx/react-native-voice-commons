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
        mainActivityClass: Class<*>? = null,
        actionReceiverClass: Class<*>? = null
    ): Notification {
        val displayName = callerName ?: callerNumber ?: "Unknown Caller"
        val displayNumber = if (callerName != null && callerNumber != null) callerNumber else ""

        // Use provided MainActivity class or try to find it dynamically
        val activityClass = mainActivityClass ?: try {
            Class.forName("${context.packageName}.MainActivity")
        } catch (e: Exception) {
            Log.w(TAG, "Could not find MainActivity class, using context class", e)
            context.javaClass
        }

        // Use provided ActionReceiver class or try to find it dynamically
        val receiverClass = actionReceiverClass ?: try {
            // First try to find the app's receiver class (which should extend TelnyxNotificationActionReceiver)
            Class.forName("${context.packageName}.AppNotificationActionReceiver")
        } catch (e: Exception) {
            try {
                // Fallback to any other receiver in the app package
                Class.forName("${context.packageName}.TelnyxNotificationActionReceiver")
            } catch (e2: Exception) {
                Log.w(TAG, "Could not find notification action receiver class", e2)
                null
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
        }
        val answerPendingIntent = PendingIntent.getActivity(
            context, 1, answerActivityIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Reject action - store action and dismiss (no activity needed)
        if (receiverClass != null) {
            val rejectIntent = Intent(context, receiverClass).apply {
                action = "REJECT_CALL"
                putExtra("call_id", callId)
            }
            val rejectPendingIntent = PendingIntent.getBroadcast(
                context, 2, rejectIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            
            builder.addAction(android.R.drawable.ic_menu_call, "Answer", answerPendingIntent)
            builder.addAction(android.R.drawable.ic_menu_close_clear_cancel, "Reject", rejectPendingIntent)
        } else {
            // If no receiver class, still add Answer action
            builder.addAction(android.R.drawable.ic_menu_call, "Answer", answerPendingIntent)
        }

        return builder.build()
    }

    fun showIncomingCallNotification(
        callerName: String?, 
        callerNumber: String?, 
        callId: String,
        mainActivityClass: Class<*>? = null,
        actionReceiverClass: Class<*>? = null
    ) {
        // First, hide any existing notification to avoid conflicts
        hideIncomingCallNotification()
        
        val notification = createIncomingCallNotification(callerName, callerNumber, callId, mainActivityClass, actionReceiverClass)
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

    fun hideIncomingCallNotification() {
        notificationManager.cancel(NOTIFICATION_ID)
        Log.d(TAG, "Hid incoming call notification")
    }
}