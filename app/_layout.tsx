import '~/global.css';

import { DarkTheme, DefaultTheme, Theme, ThemeProvider } from '@react-navigation/native';
import { PortalHost } from '@rn-primitives/portal';
import { Slot, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as React from 'react';
import { Appearance, Platform } from 'react-native';
import { setAndroidNavigationBar } from '~/lib/ui/android-navigation-bar';
import { NAV_THEME } from '~/lib/theme/constants';
import { useColorScheme } from '~/lib/theme/useColorScheme';
import { TelnyxVoiceApp, createTelnyxVoipClient } from '../react-voice-commons-sdk/src';
import { CallManager } from '~/components/CallManager';
import log from 'loglevel';

// Enable debug logging for the Telnyx SDK
// if (__DEV__) {
//   log.setLevel('debug');
//   // Set global debug flag for main SDK package
//   (global as any).__TELNYX_DEBUG__ = true;
//   console.log('🔧 Global log level set to debug for ALL SDK components (including main TelnyxRTC)');
// }

const LIGHT_THEME: Theme = {
  ...DefaultTheme,
  colors: NAV_THEME.light,
};
const DARK_THEME: Theme = {
  ...DarkTheme,
  colors: NAV_THEME.dark,
};

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

const usePlatformSpecificSetup = Platform.select({
  web: useSetWebBackgroundClassName,
  android: useSetAndroidNavigationBar,
  default: noop,
});

// Create the VoIP client instance
const voipClient = createTelnyxVoipClient({
  enableAppStateManagement: true,
  debug: true,
});

export default function RootLayout() {
  usePlatformSpecificSetup();
  const { isDarkColorScheme } = useColorScheme();

  return (
    <TelnyxVoiceApp voipClient={voipClient} enableAutoReconnect={false} debug={true}>
      <ThemeProvider value={isDarkColorScheme ? DARK_THEME : LIGHT_THEME}>
        <StatusBar style="dark" backgroundColor="#ffffff" />
        <Stack
          screenOptions={{
            headerShown: false,
          }}
        />
        <CallManager debug={true} />
        <PortalHost />
      </ThemeProvider>
    </TelnyxVoiceApp>
  );
}

const useIsomorphicLayoutEffect =
  Platform.OS === 'web' && typeof window === 'undefined' ? React.useEffect : React.useLayoutEffect;

function useSetWebBackgroundClassName() {
  useIsomorphicLayoutEffect(() => {
    // Adds the background color to the html element to prevent white background on overscroll.
    document.documentElement.classList.add('bg-background');
  }, []);
}

function useSetAndroidNavigationBar() {
  React.useLayoutEffect(() => {
    // Always use light theme for consistent white appearance
    setAndroidNavigationBar('light');
  }, []);
}

function noop() {}
