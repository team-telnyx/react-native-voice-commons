import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { TelnyxVoipClient, createBackgroundTelnyxVoipClient } from './telnyx-voip-client';
import { TelnyxConnectionState } from './models/connection-state';
import { Call } from './models/call';
import { TelnyxVoiceProvider } from './context/TelnyxVoiceContext';

/**
 * Configuration options for TelnyxVoiceApp
 */
export interface TelnyxVoiceAppOptions {
  /** The TelnyxVoipClient instance to manage */
  voipClient: TelnyxVoipClient;

  /** Optional callback when push notification processing starts */
  onPushNotificationProcessingStarted?: () => void;

  /** Optional callback when push notification processing completes */
  onPushNotificationProcessingCompleted?: () => void;

  /** Optional callback for additional background/foreground handling */
  onAppStateChanged?: (state: AppStateStatus) => void;

  /** Whether to enable automatic login/reconnection (default: true) */
  enableAutoReconnect?: boolean;

  /** Whether to skip web platform for background detection (default: true) */
  skipWebBackgroundDetection?: boolean;

  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Props for the TelnyxVoiceApp component
 */
export interface TelnyxVoiceAppProps extends TelnyxVoiceAppOptions {
  /** The child components to render */
  children: React.ReactNode;
}

/**
 * Interface for the TelnyxVoiceApp component with static methods
 */
export interface TelnyxVoiceAppComponent extends React.FC<TelnyxVoiceAppProps> {
  initializeAndCreate: (options: {
    voipClient: TelnyxVoipClient;
    children: React.ReactNode;
    backgroundMessageHandler?: (message: any) => Promise<void>;
    onPushNotificationProcessingStarted?: () => void;
    onPushNotificationProcessingCompleted?: () => void;
    onAppStateChanged?: (state: AppStateStatus) => void;
    enableAutoReconnect?: boolean;
    skipWebBackgroundDetection?: boolean;
    debug?: boolean;
  }) => Promise<React.ComponentType>;

  handleBackgroundPush: (message: any) => Promise<void>;
}

/**
 * A comprehensive wrapper component that handles all Telnyx SDK lifecycle management.
 *
 * This component automatically handles:
 * - Push notification initialization from terminated state
 * - Background/foreground lifecycle detection and auto-reconnection
 * - Login state management with automatic reconnection
 * - CallKit integration preparation
 *
 * Simply wrap your main app component with this to get full Telnyx functionality:
 * ```tsx
 * <TelnyxVoiceApp voipClient={myVoipClient}>
 *   <MyApp />
 * </TelnyxVoiceApp>
 * ```
 */
const TelnyxVoiceAppComponent: React.FC<TelnyxVoiceAppProps> = ({
  voipClient,
  children,
  onPushNotificationProcessingStarted,
  onPushNotificationProcessingCompleted,
  onAppStateChanged,
  enableAutoReconnect = true,
  skipWebBackgroundDetection = true,
  debug = false,
}) => {
  // State management
  const [processingPushOnLaunch, setProcessingPushOnLaunch] = useState(false);
  const [isHandlingForegroundCall, setIsHandlingForegroundCall] = useState(false);
  const [currentConnectionState, setCurrentConnectionState] = useState<TelnyxConnectionState>(
    voipClient.currentConnectionState
  );

  // Refs for tracking state
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const backgroundDetectorIgnore = useRef(false);

  // Static background client instance for singleton pattern
  const backgroundClientRef = useRef<TelnyxVoipClient | null>(null);

  const log = useCallback(
    (message: string, ...args: any[]) => {
      if (debug) {
        console.log(`[TelnyxVoiceApp] ${message}`, ...args);
      }
    },
    [debug]
  );

  // Handle app state changes
  const handleAppStateChange = useCallback(
    async (nextAppState: AppStateStatus) => {
      const previousAppState = appStateRef.current;
      appStateRef.current = nextAppState;

      log(`App state changed from ${previousAppState} to ${nextAppState}`);
      log(`Background detector ignore flag: ${backgroundDetectorIgnore.current}`);
      log(`Handling foreground call: ${isHandlingForegroundCall}`);

      // Call optional user callback first
      onAppStateChanged?.(nextAppState);

      // Only handle background disconnection when actually transitioning from active to background
      // Don't disconnect on background-to-background transitions (e.g., during CallKit operations)
      if (
        (nextAppState === 'background' || nextAppState === 'inactive') &&
        previousAppState === 'active'
      ) {
        log(
          `App transitioned from ${previousAppState} to ${nextAppState} - handling backgrounding`
        );
        await handleAppBackgrounded();
      } else if (nextAppState === 'background' || nextAppState === 'inactive') {
        log(
          `App state is ${nextAppState} but was already ${previousAppState} - skipping background handling`
        );
      }

      // Always check for push notifications when app becomes active (regardless of auto-reconnect setting)
      if (nextAppState === 'active' && previousAppState !== 'active') {
        log('App became active - checking for push notifications');
        await checkForInitialPushNotification(true); // Pass true for fromAppResume
      }

      // Only handle auto-reconnection if auto-reconnect is enabled
      if (enableAutoReconnect && nextAppState === 'active' && previousAppState !== 'active') {
        await handleAppResumed();
      }
    },
    [enableAutoReconnect, onAppStateChanged, isHandlingForegroundCall, log]
  );

  // Handle app going to background - disconnect like the old implementation
  const handleAppBackgrounded = useCallback(async () => {
    // Check if we should ignore background detection (e.g., during active calls)
    if (backgroundDetectorIgnore.current || isHandlingForegroundCall) {
      log(
        'Background detector ignore flag set or handling foreground call - skipping disconnection'
      );
      return;
    }

    // Check if there are any active calls that should prevent disconnection
    const activeCalls = voipClient.currentCalls;
    const hasOngoingCall =
      activeCalls.length > 0 &&
      activeCalls.some(
        (call) =>
          call.currentState === 'ACTIVE' ||
          call.currentState === 'HELD' ||
          call.currentState === 'RINGING' ||
          call.currentState === 'CONNECTING'
      );

    // Also check if there's an incoming call from push notification being processed
    let isCallFromPush = false;
    if (Platform.OS === 'ios') {
      try {
        const { callKitCoordinator } = require('./callkit/callkit-coordinator');
        isCallFromPush = callKitCoordinator.getIsCallFromPush();
      } catch (e) {
        log('Error checking isCallFromPush:', e);
      }
    }

    if (hasOngoingCall || isCallFromPush) {
      log('Active calls or push call detected - skipping background disconnection', {
        callCount: activeCalls.length,
        hasOngoingCall,
        isCallFromPush,
        callStates: activeCalls.map((call) => ({
          callId: call.callId,
          currentState: call.currentState,
          destination: call.destination,
        })),
      });
      return;
    }

    log('App backgrounded - disconnecting (matching old BackgroundDetector behavior)');

    try {
      // Always disconnect when backgrounded (matches old implementation)
      await voipClient.logout();
      log('Successfully disconnected on background');
    } catch (e) {
      log('Error disconnecting on background:', e);
    }
  }, [voipClient, isHandlingForegroundCall, log]);

  // Handle app resuming from background
  const handleAppResumed = useCallback(async () => {
    log('App resumed - checking reconnection needs');

    // IMPORTANT: Check for push notifications first when resuming from background
    // This handles the case where the user accepted a call while the app was backgrounded
    await checkForInitialPushNotification(true); // Pass true for fromAppResume

    // If we're ignoring (e.g., from push call) or handling foreground call, don't auto-reconnect
    if (backgroundDetectorIgnore.current || isHandlingForegroundCall) {
      log(
        'Background detector ignore flag set or handling foreground call - skipping reconnection'
      );
      return;
    }

    // iOS-specific: If push notification handling just initiated a connection,
    // skip auto-reconnection to prevent double login
    if (Platform.OS === 'ios') {
      // Check if connection state changed after push processing
      const connectionStateAfterPush = voipClient.currentConnectionState;
      if (
        connectionStateAfterPush === TelnyxConnectionState.CONNECTING ||
        connectionStateAfterPush === TelnyxConnectionState.CONNECTED
      ) {
        log(
          `iOS: Push handling initiated connection (${connectionStateAfterPush}), skipping auto-reconnection`
        );
        return;
      }
    }

    // Check current connection state and reconnect if needed
    const currentState = voipClient.currentConnectionState;
    log(`Current connection state: ${currentState}`);

    // If we're not connected and have stored credentials, attempt reconnection
    if (currentState !== TelnyxConnectionState.CONNECTED) {
      await attemptAutoReconnection();
    }
  }, [voipClient, isHandlingForegroundCall, log]);

  // Attempt to reconnect using stored credentials
  const attemptAutoReconnection = useCallback(async () => {
    try {
      log('Attempting auto-reconnection...');

      // Try to get stored config and reconnect
      const success = await voipClient.loginFromStoredConfig();
      log(`Auto-reconnection ${success ? 'successful' : 'failed'}`);

      // If auto-reconnection fails, redirect to login screen
      if (!success) {
        log('Auto-reconnection failed - redirecting to login screen');
        // Import router dynamically to avoid circular dependency issues
        const { router } = require('expo-router');

        // Small delay to ensure state is settled
        setTimeout(() => {
          router.replace('/');
        }, 100);
      }
    } catch (e) {
      log('Auto-reconnection error:', e);

      // On error, also redirect to login
      log('Auto-reconnection error - redirecting to login screen');
      const { router } = require('expo-router');
      setTimeout(() => {
        router.replace('/');
      }, 100);
    }
  }, [voipClient, log]);

  // Check for initial push notification when app launches
  const checkForInitialPushNotification = useCallback(
    async (fromAppResume: boolean = false) => {
      log(`checkForInitialPushNotification called${fromAppResume ? ' (from app resume)' : ''}`);

      if (processingPushOnLaunch && !fromAppResume) {
        log('Already processing push, returning early');
        return;
      }

      // Only set the flag if this is not from app resume to allow resume processing
      if (!fromAppResume) {
        setProcessingPushOnLaunch(true);
      }
      onPushNotificationProcessingStarted?.();

      try {
        let pushData: Record<string, any> | null = null;

        // Try to get push data from the native layer using our VoicePnBridge
        try {
          // Import the native bridge module dynamically
          const { NativeModules } = require('react-native');
          const VoicePnBridge = NativeModules.VoicePnBridge;

          if (VoicePnBridge) {
            log('Checking for pending push actions via VoicePnBridge');
            const pendingAction = await VoicePnBridge.getPendingPushAction();
            log('Raw pending action response:', pendingAction);

            if (pendingAction && pendingAction.action != null && pendingAction.metadata != null) {
              log('Found pending push action:', pendingAction);

              // Parse the metadata if it's a string
              let metadata = pendingAction.metadata;
              if (typeof metadata === 'string') {
                try {
                  // First try parsing as JSON
                  metadata = JSON.parse(metadata);
                  log('Parsed metadata as JSON:', metadata);
                } catch (e) {
                  // If JSON parsing fails, try parsing Android key-value format
                  // Format: "{call_id=value, action=value}"
                  log('JSON parse failed, trying Android key-value format');
                  try {
                    const cleanedString = metadata.replace(/[{}]/g, '').trim();
                    const pairs = cleanedString.split(',').map((pair) => pair.trim());
                    const parsed: Record<string, any> = {};

                    for (const pair of pairs) {
                      const [key, value] = pair.split('=').map((s) => s.trim());
                      if (key && value) {
                        parsed[key] = value;
                      }
                    }

                    metadata = parsed;
                    log('Parsed metadata as Android key-value format:', metadata);
                  } catch (parseError) {
                    log('Failed to parse metadata in any format, using as-is:', parseError);
                  }
                }
              }

              // Create push data structure that matches what the VoIP client expects
              pushData = {
                action: pendingAction.action,
                metadata: metadata,
                from_notification: true,
              };

              // Clear the pending action so it doesn't get processed again
              await VoicePnBridge.clearPendingPushAction();
              log('Cleared pending push action after retrieval');
            } else {
              log('No pending push actions found');
            }
          } else {
            log('VoicePnBridge not available - this is expected on iOS');
          }
        } catch (bridgeError) {
          log('Error accessing VoicePnBridge:', bridgeError);
        }

        // Process the push notification if found
        if (pushData) {
          log('Processing initial push notification...');

          // Check if we're already connected and handling a push - prevent duplicate processing
          const isConnected = voipClient.currentConnectionState === TelnyxConnectionState.CONNECTED;
          if (isConnected) {
            log('SKIPPING - Already connected, preventing duplicate processing');
            // Clear the stored data since we're already handling it
            // TODO: Implement clearPushMetaData
            return;
          }

          // Set flags to prevent auto-reconnection during push call
          setIsHandlingForegroundCall(true);
          backgroundDetectorIgnore.current = true;
          log(`Background detector ignore set to: true at ${new Date().toISOString()}`);
          log(`Foreground call handling flag set to: true at ${new Date().toISOString()}`);

          // Dispose any existing background client to prevent conflicts
          disposeBackgroundClient();

          // Handle the push notification using platform-specific approach
          if (Platform.OS === 'ios') {
            // On iOS, coordinate with CallKit by notifying the coordinator about the push
            const { callKitCoordinator } = require('./callkit/callkit-coordinator');

            // Extract call_id from nested metadata structure to use as CallKit UUID
            const callId = pushData.metadata?.metadata?.call_id;
            if (callId) {
              log('Notifying CallKit coordinator about push notification:', callId);
              await callKitCoordinator.handleCallKitPushReceived(callId, {
                callData: { source: 'push_notification' },
                pushData: pushData,
              });
            } else {
              log('No call_id found in push data, falling back to direct handling');
              await voipClient.handlePushNotification(pushData);
            }
          } else {
            // On other platforms, handle push notification directly
            await voipClient.handlePushNotification(pushData);
          }

          log('Initial push notification processed');
          log('Cleared stored push data to prevent duplicate processing');

          // Note: isHandlingForegroundCall will be reset when calls.length becomes 0
          // This prevents premature disconnection during CallKit answer flow
        } else {
          log('No initial push data found');
        }
      } catch (e) {
        log('Error processing initial push notification:', e);
        // Reset flags on error
        setIsHandlingForegroundCall(false);
      } finally {
        // Always reset the processing flag - it should not remain stuck
        setProcessingPushOnLaunch(false);
        onPushNotificationProcessingCompleted?.();
      }
    },
    [
      processingPushOnLaunch,
      voipClient,
      onPushNotificationProcessingStarted,
      onPushNotificationProcessingCompleted,
      log,
    ]
  );

  // Dispose background client instance when no longer needed
  const disposeBackgroundClient = useCallback(() => {
    if (backgroundClientRef.current) {
      log('Disposing background client instance');
      backgroundClientRef.current.dispose();
      backgroundClientRef.current = null;
    }
  }, [log]);

  // Create background client for push notification handling
  const createBackgroundClient = useCallback((): TelnyxVoipClient => {
    log('Creating background client instance');

    const backgroundClient = createBackgroundTelnyxVoipClient({
      debug,
    });

    return backgroundClient;
  }, [debug, log]);

  // Setup effect
  useEffect(() => {
    // Listen to connection state changes
    const connectionStateSubscription = voipClient.connectionState$.subscribe((state) => {
      setCurrentConnectionState(state);

      // Just log connection changes, let the app handle navigation
      log(`Connection state changed to: ${state}`);
    });

    // Listen to call changes to reset flags when no active calls
    const callsSubscription = voipClient.calls$.subscribe((calls) => {
      // Check if we should reset flags - only reset if:
      // 1. No active WebRTC calls AND
      // 2. No CallKit operations in progress (to prevent disconnection during CallKit answer flow)
      const hasActiveWebRTCCalls = calls.length > 0;
      let hasCallKitProcessing = false;

      // Check CallKit processing calls only on iOS
      if (Platform.OS === 'ios') {
        try {
          const { callKitCoordinator } = require('./callkit/callkit-coordinator');
          hasCallKitProcessing = callKitCoordinator.hasProcessingCalls();
          log(`CallKit processing check: hasProcessingCalls=${hasCallKitProcessing}`);
        } catch (e) {
          log('Error checking CallKit processing calls:', e);
        }
      }

      log(
        `Flag reset check: WebRTC calls=${calls.length}, CallKit processing=${hasCallKitProcessing}, isHandlingForegroundCall=${isHandlingForegroundCall}, backgroundDetectorIgnore=${backgroundDetectorIgnore.current}`
      );

      if (
        !hasActiveWebRTCCalls &&
        !hasCallKitProcessing &&
        (isHandlingForegroundCall || backgroundDetectorIgnore.current)
      ) {
        log(
          `No active calls and no CallKit processing - resetting ignore flags at ${new Date().toISOString()}`
        );
        setIsHandlingForegroundCall(false);
        backgroundDetectorIgnore.current = false;
      } else if (!hasActiveWebRTCCalls && hasCallKitProcessing) {
        log(
          `No WebRTC calls but CallKit operations in progress - keeping ignore flags active at ${new Date().toISOString()}`
        );
      } else if (hasActiveWebRTCCalls) {
        log(`WebRTC calls active - keeping ignore flags active at ${new Date().toISOString()}`);
      }

      // Also reset processingPushOnLaunch if no calls are active
      // This ensures the flag doesn't get stuck after call ends
      if (calls.length === 0 && processingPushOnLaunch) {
        log('No active calls - resetting processing push flag');
        setProcessingPushOnLaunch(false);
      }
    });

    // Add app state listener if not skipping web background detection or not on web
    // AND if app state management is enabled in the client options
    let appStateSubscription: any = null;
    if (
      (!skipWebBackgroundDetection || Platform.OS !== 'web') &&
      voipClient.options.enableAppStateManagement
    ) {
      appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
    }

    // Handle initial push notification if app was launched from terminated state
    // Only check if we're not already processing to prevent infinite loops
    const timeoutId = setTimeout(() => {
      if (!processingPushOnLaunch) {
        checkForInitialPushNotification();
      }
    }, 100);

    // Cleanup function
    return () => {
      connectionStateSubscription.unsubscribe();
      callsSubscription.unsubscribe();
      if (appStateSubscription) {
        appStateSubscription.remove();
      }
      clearTimeout(timeoutId);
      // Clean up background client instance
      disposeBackgroundClient();
    };
  }, [
    voipClient,
    handleAppStateChange,
    disposeBackgroundClient,
    skipWebBackgroundDetection,
    isHandlingForegroundCall,
    log,
  ]);

  // Simply return the children wrapped in context provider - all lifecycle management is handled internally
  return <TelnyxVoiceProvider voipClient={voipClient}>{children}</TelnyxVoiceProvider>;
};

/**
 * Static factory method that handles all common SDK initialization boilerplate.
 *
 * This is the recommended way to initialize the Telnyx Voice SDK in your app.
 * It ensures that push notifications, background handlers, and other dependencies are
 * set up correctly before the app runs.
 *
 * This method:
 * - Initializes push notification handling
 * - Registers the background push notification handler
 * - Returns a fully configured TelnyxVoiceApp component to be used in your app
 *
 * ## Usage:
 * ```tsx
 * const App = TelnyxVoiceApp.initializeAndCreate({
 *   voipClient: myVoipClient,
 *   backgroundHandler: backgroundHandler,
 *   children: <MyApp />,
 * });
 * ```
 */
const initializeAndCreate = async (options: {
  /** The TelnyxVoipClient instance that will be managed by this component */
  voipClient: TelnyxVoipClient;

  /** The main component of your application */
  children: React.ReactNode;

  /** The function that will handle background push notifications */
  backgroundMessageHandler?: (message: any) => Promise<void>;

  /** Optional callback when push notification processing starts */
  onPushNotificationProcessingStarted?: () => void;

  /** Optional callback when push notification processing completes */
  onPushNotificationProcessingCompleted?: () => void;

  /** Optional callback for app state changes */
  onAppStateChanged?: (state: AppStateStatus) => void;

  /** Whether to enable automatic reconnection (default: true) */
  enableAutoReconnect?: boolean;

  /** Whether to skip web background detection (default: true) */
  skipWebBackgroundDetection?: boolean;

  /** Enable debug logging */
  debug?: boolean;
}): Promise<React.ComponentType> => {
  const {
    voipClient,
    children,
    backgroundMessageHandler,
    onPushNotificationProcessingStarted,
    onPushNotificationProcessingCompleted,
    onAppStateChanged,
    enableAutoReconnect = true,
    skipWebBackgroundDetection = true,
    debug = false,
  } = options;

  // Initialize push notification handling for Android
  if (Platform.OS === 'android') {
    // TODO: Initialize Firebase or other push notification service
    if (debug) {
      console.log('[TelnyxVoiceApp] Android push notification initialization needed');
    }
  }

  // Register background message handler if provided
  if (backgroundMessageHandler) {
    // TODO: Register the background message handler with the push notification service
    if (debug) {
      console.log('[TelnyxVoiceApp] Background message handler registration needed');
    }
  }

  if (debug) {
    console.log('[TelnyxVoiceApp] SDK initialization complete');
  }

  // Return a component that renders TelnyxVoiceApp with the provided options
  return () => (
    <TelnyxVoiceApp
      voipClient={voipClient}
      onPushNotificationProcessingStarted={onPushNotificationProcessingStarted}
      onPushNotificationProcessingCompleted={onPushNotificationProcessingCompleted}
      onAppStateChanged={onAppStateChanged}
      enableAutoReconnect={enableAutoReconnect}
      skipWebBackgroundDetection={skipWebBackgroundDetection}
      debug={debug}
    >
      {children}
    </TelnyxVoiceApp>
  );
};

/**
 * Handles background push notifications in the background isolate.
 * This should be called from your background message handler.
 */
const handleBackgroundPush = async (message: any): Promise<void> => {
  console.log('[TelnyxVoiceApp] Background push received:', message);

  try {
    // TODO: Initialize push notification service in isolate if needed

    // Use singleton pattern for background client to prevent multiple instances
    let backgroundClient = createBackgroundTelnyxVoipClient({
      debug: true,
    });

    await backgroundClient.handlePushNotification(message);

    console.log('[TelnyxVoiceApp] Background push processed successfully');

    // Clean up the background client
    backgroundClient.dispose();
  } catch (e) {
    console.log('[TelnyxVoiceApp] Error processing background push:', e);
  }
};

// Create the component with static methods
export const TelnyxVoiceApp: TelnyxVoiceAppComponent = Object.assign(TelnyxVoiceAppComponent, {
  initializeAndCreate,
  handleBackgroundPush,
});

export default TelnyxVoiceApp;
