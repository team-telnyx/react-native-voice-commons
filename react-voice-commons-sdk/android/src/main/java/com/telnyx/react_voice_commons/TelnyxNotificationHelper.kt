package com.telnyx.react_voice_commons

import android.Manifest
import android.annotation.SuppressLint
import android.app.ActivityOptions
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.Ringtone
import android.media.RingtoneManager
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat

/**
 * Helper class for managing Telnyx voice call notifications
 */
class TelnyxNotificationHelper(private val context: Context) {
    companion object {
        const val INCOMING_CALL_CHANNEL_ID = "telnyx_voice_incoming_calls_v2"
        const val ONGOING_CALL_CHANNEL_ID = "telnyx_voice_ongoing_calls"
        const val MISSED_CALL_CHANNEL_ID = "telnyx_voice_missed_calls"
        const val INCOMING_CALL_CHANNEL_NAME = "Incoming Telnyx Voice Calls"
        const val ONGOING_CALL_CHANNEL_NAME = "Ongoing Telnyx Voice Calls"
        const val MISSED_CALL_CHANNEL_NAME = "Missed Telnyx Voice Calls"
        const val NOTIFICATION_ID = 1001
        const val ONGOING_CALL_NOTIFICATION_ID = 1002
        private const val TAG = "TelnyxNotifications"
        private val ringtoneLock = Any()
        private var incomingCallRingtone: Ringtone? = null

        /**
         * Notifications can produce only a short alert (and some OEMs suppress it when
         * a full-screen call notification immediately launches the app). Keep the
         * device's selected phone ringtone playing until the incoming call is handled.
         */
        private fun startIncomingCallRingtone(context: Context) {
            synchronized(ringtoneLock) {
                if (incomingCallRingtone?.isPlaying == true) return

                val ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
                val ringtone = RingtoneManager.getRingtone(context.applicationContext, ringtoneUri)
                if (ringtone == null) {
                    Log.w(TAG, "No default phone ringtone is configured")
                    return
                }

                try {
                    ringtone.audioAttributes = AudioAttributes.Builder()
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                        .build()
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                        ringtone.isLooping = true
                    }
                    ringtone.play()
                    incomingCallRingtone = ringtone
                    Log.d(TAG, "Started incoming call ringtone")
                } catch (e: RuntimeException) {
                    Log.e(TAG, "Failed to start incoming call ringtone", e)
                    ringtone.stop()
                }
            }
        }

        private fun stopIncomingCallRingtone() {
            synchronized(ringtoneLock) {
                incomingCallRingtone?.let { ringtone ->
                    try {
                        ringtone.stop()
                    } catch (e: RuntimeException) {
                        Log.w(TAG, "Failed to stop incoming call ringtone", e)
                    }
                }
                incomingCallRingtone = null
            }
        }
        
        /**
         * Static method to hide notifications from anywhere in the app
         * Useful for dismissing notifications when the app opens from Answer button
         */
        fun hideNotificationFromContext(context: Context) {
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.cancel(NOTIFICATION_ID)
            stopIncomingCallRingtone()
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
    private val defaultRingtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)

    init {
        createNotificationChannels()
    }

    private fun getNotificationBlockReason(channelId: String): String? {
        if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            return "POST_NOTIFICATIONS permission is denied"
        }

        if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) {
            return "app notifications are disabled"
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = notificationManager.getNotificationChannel(channelId)
            if (channel?.importance == NotificationManager.IMPORTANCE_NONE) {
                return "incoming-call notification channel is blocked"
            }

            val channelGroupId = channel?.group
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P && channelGroupId != null) {
                val channelGroup = notificationManager.getNotificationChannelGroup(channelGroupId)
                if (channelGroup?.isBlocked == true) {
                    return "incoming-call notification channel group is blocked"
                }
            }
        }

        return null
    }

    @SuppressLint("MissingPermission")
    private fun notifyIfPermitted(
        notificationId: Int,
        notification: Notification,
        channelId: String,
    ): String? {
        val blockReason = getNotificationBlockReason(channelId)
        if (blockReason != null) {
            Log.w(TAG, "Skipping notification $notificationId because $blockReason")
            return blockReason
        }

        notificationManager.notify(notificationId, notification)
        return null
    }

    private fun launchFullScreenIntentFallback(
        notification: Notification,
        callId: String,
        metadata: String,
        blockReason: String,
    ) {
        val fullScreenIntent = notification.fullScreenIntent
        if (fullScreenIntent == null) {
            Log.w(TAG, "Notifications unavailable ($blockReason); no full-screen fallback available for call: $callId")
            return
        }

        try {
            VoicePnManager.setPendingPushAction(context, "incoming_call", metadata)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to preserve incoming-call metadata before fallback launch for call: $callId", e)
        }

        try {
            sendFullScreenIntent(fullScreenIntent)
            Log.w(TAG, "Notifications unavailable ($blockReason); launched full-screen incoming call fallback for call: $callId")
        } catch (e: PendingIntent.CanceledException) {
            Log.e(TAG, "Notifications unavailable ($blockReason); failed to launch full-screen incoming call fallback for call: $callId", e)
            clearFallbackPushAction(callId)
        } catch (e: RuntimeException) {
            Log.e(TAG, "Notifications unavailable ($blockReason); background fallback launch failed for call: $callId", e)
            clearFallbackPushAction(callId)
        }
    }

    private fun clearFallbackPushAction(callId: String) {
        try {
            VoicePnManager.clearPendingPushAction(context)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to clear preserved incoming-call metadata after fallback launch failure for call: $callId", e)
        }
    }

    private fun sendFullScreenIntent(fullScreenIntent: PendingIntent) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            val options = ActivityOptions.makeBasic().apply {
                setPendingIntentBackgroundActivityStartMode(ActivityOptions.MODE_BACKGROUND_ACTIVITY_START_ALLOWED)
            }.toBundle()

            fullScreenIntent.send(context, 0, null, null, null, null, options)
        } else {
            fullScreenIntent.send()
        }
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // New ID: Android preserves a channel's sound after it is created, so the
            // prior silent channel cannot be updated for existing installations.
            val incomingCallChannel = NotificationChannel(
                INCOMING_CALL_CHANNEL_ID,
                INCOMING_CALL_CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifications for incoming Telnyx voice calls"
                enableLights(true)
                lightColor = Color.GREEN
                enableVibration(true)
                setSound(
                    defaultRingtoneUri,
                    AudioAttributes.Builder()
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                        .build()
                )
            }
            val ongoingCallChannel = NotificationChannel(
                ONGOING_CALL_CHANNEL_ID,
                ONGOING_CALL_CHANNEL_NAME,
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Notifications for ongoing Telnyx voice calls"
            }
            val missedCallChannel = NotificationChannel(
                MISSED_CALL_CHANNEL_ID,
                MISSED_CALL_CHANNEL_NAME,
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Notifications for missed Telnyx voice calls"
            }

            notificationManager.createNotificationChannels(
                listOf(incomingCallChannel, ongoingCallChannel, missedCallChannel)
            )
            Log.d(TAG, "Created Telnyx voice notification channels")
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
            putExtra("action", "incoming_call")
            putExtra("meta_data", metadata)
            putExtra("caller_name", callerName)
            putExtra("caller_number", callerNumber)
        }
        val appPendingIntent = PendingIntent.getActivity(
            context, 0, appIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder = NotificationCompat.Builder(context, INCOMING_CALL_CHANNEL_ID)
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

        // Android 21-25 has no notification channels, so configure the
        // ringtone directly on the incoming-call notification.
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            @Suppress("DEPRECATION")
            builder.setSound(defaultRingtoneUri, AudioManager.STREAM_RING)
        }

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
        val blockReason = notifyIfPermitted(
            NOTIFICATION_ID,
            notification,
            INCOMING_CALL_CHANNEL_ID,
        )
        if (blockReason == null) {
            startIncomingCallRingtone(context)
            Log.d(TAG, "Showed incoming call notification for: $callerName ($callerNumber)")
        } else {
            launchFullScreenIntentFallback(notification, callId, metadata, blockReason)
        }
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
        
        val notification = NotificationCompat.Builder(context, MISSED_CALL_CHANNEL_ID)
            .setContentTitle("Missed Call")
            .setContentText("$displayName${if (displayNumber.isNotEmpty()) "\n$displayNumber" else ""}")
            .setSmallIcon(android.R.drawable.ic_menu_call)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setAutoCancel(true)
            .setOngoing(false) // Not ongoing for missed calls
            .setColor(Color.RED)
            .build()
            
        val blockReason = notifyIfPermitted(
            NOTIFICATION_ID,
            notification,
            MISSED_CALL_CHANNEL_ID,
        )
        if (blockReason == null) {
            Log.d(TAG, "Showed missed call notification for: $callerName ($callerNumber)")
        } else {
            Log.w(TAG, "Skipped missed call notification because $blockReason")
        }
    }

    fun showOngoingCallNotification(
        callerName: String?,
        callerNumber: String?,
        callId: String,
        mainActivityClass: Class<*>? = null
    ) {
        val notification = createOngoingCallNotification(callerName, callerNumber, callId, mainActivityClass)
        val blockReason = notifyIfPermitted(
            ONGOING_CALL_NOTIFICATION_ID,
            notification,
            ONGOING_CALL_CHANNEL_ID,
        )
        if (blockReason == null) {
            Log.d(TAG, "Showed ongoing call notification for: $callerName ($callerNumber)")
        } else {
            Log.w(TAG, "Skipped ongoing call notification because $blockReason")
        }
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

        return NotificationCompat.Builder(context, ONGOING_CALL_CHANNEL_ID)
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
        stopIncomingCallRingtone()
        Log.d(TAG, "Hid incoming call notification")
    }

    fun hideOngoingCallNotification() {
        notificationManager.cancel(ONGOING_CALL_NOTIFICATION_ID)
        Log.d(TAG, "Hid ongoing call notification")
    }
}
