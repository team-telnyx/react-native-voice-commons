module.exports = {
  expo: {
    name: 'telnyx-react-native-voice-sdk-demo',
    slug: 'telnyx-react-native-voice-sdk-demo',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'myapp',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    splash: {
      image: './assets/images/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    assetBundlePatterns: ['**/*'],
    linking: {
      scheme: 'myapp',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.telnyx.rn-voice-sdk-demo',
      bitcode: false,
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/images/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      statusBar: {
        barStyle: 'dark-content',
        backgroundColor: '#ffffff',
      },
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './android/app/google-services.json',
      package: 'com.telnyx.rn_voice_sdk_demo',
      permissions: [
        'android.permission.ACCESS_NETWORK_STATE',
        'android.permission.CAMERA',
        'android.permission.INTERNET',
        'android.permission.MODIFY_AUDIO_SETTINGS',
        'android.permission.RECORD_AUDIO',
        'android.permission.SYSTEM_ALERT_WINDOW',
        'android.permission.WAKE_LOCK',
        'android.permission.BLUETOOTH',
      ],
    },
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    plugins: ['expo-router', '@config-plugins/react-native-webrtc'],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      router: {},
      eas: {
        projectId: 'ef93bce4-41cb-4c39-97b3-736dee17b164',
      },
    },
  },
};
