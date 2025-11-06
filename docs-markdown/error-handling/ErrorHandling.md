# Error Handling

Common errors, debugging techniques, and troubleshooting guide for the Telnyx React Native SDK.

## Authentication Errors

### Invalid Credentials

**Error**: `AUTH_FAILED` or `INVALID_CREDENTIALS`

**Symptoms**: Login fails with credential-based authentication.

**Solutions**:

```tsx
import { createCredentialConfig } from '@telnyx/react-voice-commons-sdk';

const handleAuthError = async (voipClient, username, password) => {
  try {
    const config = createCredentialConfig(username, password, {
      debug: true, // Enable debug logging
    });
    await voipClient.login(config);
  } catch (error) {
    if (error.code === 'AUTH_FAILED') {
      console.error('Invalid credentials provided');
      // Show user-friendly error message
      Alert.alert('Login Failed', 'Please check your username and password');
    } else if (error.code === 'NETWORK_ERROR') {
      console.error('Network connection failed');
      // Retry logic or offline handling
    }
  }
};
```

### Token Validation Errors

**Error**: `INVALID_TOKEN` or `TOKEN_EXPIRED`

**Symptoms**: JWT token authentication fails.

**Solutions**:

```tsx
import { createTokenConfig } from '@telnyx/react-voice-commons-sdk';

const handleTokenAuth = async (voipClient, token) => {
  try {
    const config = createTokenConfig(token, {
      debug: true,
    });
    await voipClient.loginWithToken(config);
  } catch (error) {
    switch (error.code) {
      case 'INVALID_TOKEN':
        console.error('Token format is invalid');
        // Request new token from your server
        break;
      case 'TOKEN_EXPIRED':
        console.error('Token has expired');
        // Refresh token and retry
        break;
      case 'TOKEN_NOT_FOUND':
        console.error('Token not provided');
        // Redirect to login
        break;
    }
  }
};
```

### Connection Errors

**Error**: `CONNECTION_FAILED` or `NETWORK_ERROR`

**Symptoms**: Cannot establish WebRTC connection.

**Solutions**:

```tsx
import NetInfo from '@react-native-community/netinfo';

const handleConnectionError = async (voipClient) => {
  // Check network connectivity
  const netInfo = await NetInfo.fetch();
  
  if (!netInfo.isConnected) {
    console.error('No network connection');
    Alert.alert('Network Error', 'Please check your internet connection');
    return;
  }

  // Implement retry logic
  const retryConnection = async (attempts = 3) => {
    for (let i = 0; i < attempts; i++) {
      try {
        await voipClient.loginFromStoredConfig();
        console.log('Reconnection successful');
        return;
      } catch (error) {
        console.warn(`Retry attempt ${i + 1} failed:`, error.message);
        
        if (i === attempts - 1) {
          console.error('All retry attempts failed');
          // Handle final failure
        } else {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
        }
      }
    }
  };

  await retryConnection();
};
```

## Call Errors

### Call Creation Failures

**Error**: `CALL_FAILED` or `INVALID_DESTINATION`

**Symptoms**: Cannot initiate outgoing calls.

**Solutions**:

```tsx
const makeCallWithErrorHandling = async (voipClient, destination) => {
  try {
    // Validate destination format
    if (!destination || destination.trim().length === 0) {
      throw new Error('INVALID_DESTINATION');
    }

    // Check connection state
    if (voipClient.currentConnectionState !== 'CONNECTED') {
      throw new Error('NOT_CONNECTED');
    }

    const call = await voipClient.newCall(destination);
    console.log('Call initiated successfully:', call.callId);
    return call;
  } catch (error) {
    switch (error.message) {
      case 'INVALID_DESTINATION':
        Alert.alert('Invalid Number', 'Please enter a valid phone number');
        break;
      case 'NOT_CONNECTED':
        Alert.alert('Connection Error', 'Please check your connection and try again');
        break;
      case 'CALL_LIMIT_EXCEEDED':
        Alert.alert('Call Limit', 'Maximum number of concurrent calls reached');
        break;
      default:
        console.error('Call failed:', error);
        Alert.alert('Call Failed', 'Unable to place call. Please try again.');
    }
  }
};
```

### Call Control Errors

**Error**: `CALL_NOT_FOUND` or `INVALID_STATE`

**Symptoms**: Call control operations fail.

**Solutions**:

```tsx
const safeCallOperation = async (call, operation, operationName) => {
  try {
    if (!call) {
      throw new Error('CALL_NOT_FOUND');
    }

    // Check call state before operation
    const validStates = {
      answer: ['ringing'],
      hold: ['active'],
      unhold: ['held'],
      hangup: ['ringing', 'active', 'held'],
    };

    if (validStates[operation] && !validStates[operation].includes(call.state)) {
      throw new Error('INVALID_STATE');
    }

    await call[operation]();
    console.log(`${operationName} successful`);
  } catch (error) {
    switch (error.message) {
      case 'CALL_NOT_FOUND':
        console.error('Call no longer exists');
        break;
      case 'INVALID_STATE':
        console.error(`Cannot ${operationName} call in state: ${call.state}`);
        break;
      default:
        console.error(`${operationName} failed:`, error);
    }
  }
};

// Usage examples
await safeCallOperation(call, 'answer', 'Answer call');
await safeCallOperation(call, 'hold', 'Hold call');
await safeCallOperation(call, 'hangup', 'End call');
```

## Audio and Media Errors

### Audio Permission Errors

**Error**: `MICROPHONE_PERMISSION_DENIED`

**Symptoms**: No audio in calls, microphone access denied.

**Solutions**:

```tsx
import { PermissionsAndroid, Platform } from 'react-native';

const requestAudioPermissions = async () => {
  try {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'Microphone Permission',
          message: 'This app needs microphone access for voice calls',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );
      
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        throw new Error('MICROPHONE_PERMISSION_DENIED');
      }
    }
    
    return true;
  } catch (error) {
    console.error('Audio permission error:', error);
    Alert.alert(
      'Microphone Permission Required',
      'Please grant microphone permission in device settings to make calls',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Settings', onPress: () => Linking.openSettings() },
      ]
    );
    return false;
  }
};
```

### Audio Routing Issues

**Error**: `AUDIO_ROUTING_FAILED`

**Symptoms**: Audio plays through wrong device (speaker/earpiece).

**Solutions**:

```tsx
// Audio routing is handled automatically by the SDK
// For custom audio routing, you can listen to call state changes
const handleAudioRouting = (call) => {
  call.callState$.subscribe((state) => {
    switch (state) {
      case 'active':
        console.log('Call active - audio should route to earpiece by default');
        break;
      case 'held':
        console.log('Call on hold - audio routing paused');
        break;
    }
  });
};
```

## Push Notification Errors

### Token Registration Errors

**Error**: `PUSH_TOKEN_INVALID` or `PUSH_REGISTRATION_FAILED`

**Symptoms**: Push notifications not working.

**Solutions**:

```tsx
import messaging from '@react-native-firebase/messaging';

const handlePushTokenError = async () => {
  try {
    // Clear and regenerate FCM token
    await messaging().deleteToken();
    const newToken = await messaging().getToken();
    
    if (!newToken) {
      throw new Error('PUSH_TOKEN_GENERATION_FAILED');
    }
    
    console.log('New push token:', newToken);
    return newToken;
  } catch (error) {
    console.error('Push token error:', error);
    
    // Fallback: Continue without push notifications
    Alert.alert(
      'Push Notifications',
      'Unable to setup push notifications. You may miss calls when the app is closed.',
      [{ text: 'OK' }]
    );
  }
};
```

### Background Processing Errors

**Error**: `BACKGROUND_PROCESSING_FAILED`

**Symptoms**: Incoming calls not handled when app is backgrounded.

**Solutions**:

```tsx
// Ensure proper background handler setup
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  try {
    console.log('Background message received:', remoteMessage);
    await TelnyxVoiceApp.handleBackgroundPush(remoteMessage.data);
  } catch (error) {
    console.error('Background processing failed:', error);
    
    // Log error for debugging
    crashlytics().recordError(error);
  }
});
```

## Network and Connectivity Errors

### WebRTC Connection Issues

**Error**: `WEBRTC_CONNECTION_FAILED` or `ICE_CONNECTION_FAILED`

**Symptoms**: Calls connect but no audio, or connection drops frequently.

**Solutions**:

```tsx
const diagnoseNetworkIssues = async () => {
  const netInfo = await NetInfo.fetch();
  
  console.log('Network diagnostics:', {
    isConnected: netInfo.isConnected,
    type: netInfo.type,
    isInternetReachable: netInfo.isInternetReachable,
    details: netInfo.details,
  });

  // Check for specific network issues
  if (netInfo.type === 'cellular' && netInfo.details?.cellularGeneration === '2g') {
    Alert.alert(
      'Network Warning',
      'Your connection may be too slow for voice calls. Try connecting to Wi-Fi.'
    );
  }

  if (!netInfo.isInternetReachable) {
    Alert.alert(
      'Connection Issue',
      'Unable to reach the internet. Please check your connection.'
    );
  }
};
```

### Firewall and NAT Issues

**Error**: `NAT_TRAVERSAL_FAILED` or `FIREWALL_BLOCKED`

**Symptoms**: Cannot connect to WebRTC servers, especially on corporate networks.

**Solutions**:

```tsx
const checkNetworkRestrictions = () => {
  console.log('If experiencing connection issues on corporate networks:');
  console.log('- Ensure UDP traffic is allowed');
  console.log('- Check if STUN/TURN servers are accessible');
  console.log('- Verify WebSocket connections are permitted');
  
  Alert.alert(
    'Network Configuration',
    'If you\'re on a corporate network, please contact your IT administrator to ensure VoIP traffic is allowed.',
    [{ text: 'OK' }]
  );
};
```

## Memory and Performance Errors

### Memory Leaks

**Error**: `MEMORY_WARNING` or app crashes

**Symptoms**: App becomes slow or crashes after extended use.

**Solutions**:

```tsx
// Proper cleanup of subscriptions
const useCallSubscription = (call) => {
  useEffect(() => {
    if (!call) return;

    const subscription = call.callState$.subscribe((state) => {
      console.log('Call state:', state);
    });

    // Critical: Always unsubscribe
    return () => {
      subscription.unsubscribe();
    };
  }, [call]);
};

// Cleanup client resources
const cleanupVoipClient = (voipClient) => {
  useEffect(() => {
    return () => {
      // Cleanup when component unmounts
      voipClient.logout().catch(console.error);
    };
  }, [voipClient]);
};
```

### Performance Issues

**Error**: Slow UI, delayed call operations

**Solutions**:

```tsx
// Optimize state updates
const useOptimizedCallState = (voipClient) => {
  const [calls, setCalls] = useState([]);

  useEffect(() => {
    // Throttle rapid state updates
    const subscription = voipClient.calls$
      .pipe(
        throttleTime(100), // Limit updates to once per 100ms
        distinctUntilChanged() // Only update when actually changed
      )
      .subscribe(setCalls);

    return () => subscription.unsubscribe();
  }, [voipClient]);

  return calls;
};
```

## Debugging Tools

### Enable Debug Logging

```tsx
import { createTelnyxVoipClient } from '@telnyx/react-voice-commons-sdk';

// Enable comprehensive debug logging
const voipClient = createTelnyxVoipClient({
  debug: true, // Enable detailed logging
});

// Custom error logging
const logError = (context, error) => {
  console.error(`[${context}] Error:`, {
    message: error.message,
    code: error.code,
    stack: error.stack,
    timestamp: new Date().toISOString(),
  });
};
```

### Network Request Monitoring

```tsx
// Monitor all network requests
const originalFetch = global.fetch;
global.fetch = (...args) => {
  console.log('Network request:', args[0]);
  return originalFetch(...args)
    .then(response => {
      console.log('Network response:', response.status, response.statusText);
      return response;
    })
    .catch(error => {
      console.error('Network error:', error);
      throw error;
    });
};
```

### Call State Debugging

```tsx
const debugCallState = (call) => {
  call.callState$.subscribe((state) => {
    console.log('Call State Debug:', {
      callId: call.callId,
      state: state,
      destination: call.destination,
      isIncoming: call.isIncoming,
      duration: call.duration,
      timestamp: new Date().toISOString(),
    });
  });
};
```

## Error Recovery Strategies

### Automatic Recovery

```tsx
const createResilientVoipClient = () => {
  const voipClient = createTelnyxVoipClient({
    debug: __DEV__,
  });

  // Auto-recovery for connection issues
  voipClient.connectionState$.subscribe((state) => {
    if (state === 'DISCONNECTED') {
      console.log('Connection lost, attempting recovery...');
      
      setTimeout(async () => {
        try {
          await voipClient.loginFromStoredConfig();
          console.log('Auto-recovery successful');
        } catch (error) {
          console.error('Auto-recovery failed:', error);
        }
      }, 5000); // Wait 5 seconds before retry
    }
  });

  return voipClient;
};
```

### Graceful Degradation

```tsx
const handleGracefulDegradation = (error) => {
  switch (error.code) {
    case 'PUSH_NOTIFICATIONS_UNAVAILABLE':
      // Continue without push notifications
      console.warn('Push notifications disabled, app must stay foreground');
      break;
    
    case 'MICROPHONE_PERMISSION_DENIED':
      // Disable calling features
      console.warn('Microphone access denied, calling disabled');
      break;
    
    case 'NETWORK_UNREACHABLE':
      // Show offline mode
      console.warn('Network unreachable, entering offline mode');
      break;
    
    default:
      // General error handling
      console.error('Unhandled error, continuing with limited functionality');
  }
};
```

## Best Practices

### Error Handling Patterns

1. **Always wrap async operations in try-catch**
2. **Provide user-friendly error messages**
3. **Log detailed error information for debugging**
4. **Implement retry logic for transient failures**
5. **Gracefully degrade functionality when possible**

### Monitoring and Analytics

```tsx
// Error tracking with analytics
const trackError = (error, context) => {
  // Send to your analytics service
  analytics().logEvent('voip_error', {
    error_code: error.code,
    error_message: error.message,
    context: context,
    platform: Platform.OS,
    app_version: DeviceInfo.getVersion(),
  });
};
```

### Testing Error Scenarios

```tsx
// Test error handling in development
const testErrorScenarios = async (voipClient) => {
  if (__DEV__) {
    // Test invalid credentials
    try {
      await voipClient.login(createCredentialConfig('invalid', 'invalid'));
    } catch (error) {
      console.log('✓ Invalid credentials handled correctly');
    }

    // Test network disconnection
    // (manually disconnect network to test)
    
    // Test invalid phone numbers
    try {
      await voipClient.newCall('invalid_number');
    } catch (error) {
      console.log('✓ Invalid destination handled correctly');
    }
  }
};
```

## Getting Help

When encountering persistent issues:

1. **Enable debug logging** and collect detailed logs
2. **Document reproduction steps** clearly
3. **Include device and OS information**
4. **Check the error handling guides** for your specific issue
5. **Contact Telnyx Support** with comprehensive information

## See Also

- **[Push Notification Setup](pathname:///development/webrtc/react-native-sdk/push-notification/portal-setup)**: Push notification configuration
- **[Quickstart Guide](pathname:///development/webrtc/react-native-sdk/quickstart)**: Setup and configuration
- **[API Reference](pathname:///development/webrtc/react-native-sdk/classes)**: Detailed method documentation