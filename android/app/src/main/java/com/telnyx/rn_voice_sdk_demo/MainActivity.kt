package com.telnyx.rn_voice_sdk_demo
import expo.modules.splashscreen.SplashScreenManager

import android.content.Intent
import android.os.Build
import android.os.Bundle

import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import expo.modules.ReactActivityDelegateWrapper
import com.telnyx.react_voice_commons.TelnyxMainActivity
import com.telnyx.react_voice_commons.VoicePnManager

class MainActivity : TelnyxMainActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    // Set the theme to AppTheme BEFORE onCreate to support
    // coloring the background, status bar, and navigation bar.
    // This is required for expo-splash-screen.
    setTheme(R.style.AppTheme)
    // @generated begin expo-splashscreen - expo prebuild (DO NOT MODIFY) sync-f3ff59a738c56c9a6119210cb55f0b613eb8b6af
    SplashScreenManager.registerOnActivity(this)
    // @generated end expo-splashscreen
    super.onCreate(savedInstanceState)
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "main"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
          this,
          BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
          object : DefaultReactActivityDelegate(
              this,
              mainComponentName,
              fabricEnabled
          ){})
  }

  /**
    * Align the back button behavior with Android S
    * where moving root activities to background instead of finishing activities.
    * @see <a href="https://developer.android.com/reference/android/app/Activity#onBackPressed()">onBackPressed</a>
    */
  override fun invokeDefaultOnBackPressed() {
      if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
          if (!moveTaskToBack(false)) {
              // For non-root activities, use the default implementation to finish them.
              super.invokeDefaultOnBackPressed()
          }
          return
      }

      // Use the default back button implementation on Android S
      // because it's doing more than [Activity.moveTaskToBack] in fact.
      super.invokeDefaultOnBackPressed()
  }

  /**
   * Re-scope the push action the base activity stored from this intent.
   *
   * The base activity keeps a single "current" slot; without the call id a
   * later push could replace this call's metadata, or a rejected call's
   * metadata could be picked up by a fresh login. Answer keeps the metadata
   * for its own call, while reject/hangup abandon the flow immediately.
   */
  protected override fun onHandleIntent(intent: Intent) {
    val extras = intent.extras ?: return
    val callId = extras.getString("call_id")?.takeIf { it.isNotBlank() } ?: return
    val action = extras.getString("action")?.takeIf { it.isNotBlank() } ?: return
    val metadata = extras.getString("meta_data")

    when (action) {
      "reject", "hangup" -> {
        if (metadata != null) {
          // Tag the current slot first so clearing it cannot touch another call.
          VoicePnManager.setPendingPushAction(this, action, metadata, callId)
        }
        VoicePnManager.clearPendingPushActionForCall(this, callId)
      }
      "answer", "incoming_call" -> {
        if (metadata != null) {
          VoicePnManager.setPendingPushAction(this, action, metadata, callId)
        } else {
          val (_, retainedMetadata) = VoicePnManager.getPendingPushAction(this, callId)
          if (retainedMetadata != null) {
            VoicePnManager.setPendingPushAction(this, action, retainedMetadata, callId)
          }
        }
      }
    }
  }
}
