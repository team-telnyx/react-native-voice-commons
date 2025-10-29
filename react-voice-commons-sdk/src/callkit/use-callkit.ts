import { useState, useEffect, useCallback, useRef } from 'react';
import { Call } from '@telnyx/react-native-voice-sdk';
import CallKit, { CallEndReason, CallKitEvent } from './callkit';

interface UseCallKitOptions {
  onAnswerCall?: (callUUID: string) => void;
  onEndCall?: (callUUID: string) => void;
  onStartCall?: (callUUID: string) => void;
}

interface CallKitCall {
  uuid: string;
  handle: string;
  displayName: string;
  isActive: boolean;
  direction: 'incoming' | 'outgoing';
}

export function useCallKit(options: UseCallKitOptions = {}) {
  const { onAnswerCall, onEndCall, onStartCall } = options;
  const [activeCalls, setActiveCalls] = useState<CallKitCall[]>([]);
  const [isAvailable, setIsAvailable] = useState(false);

  // Use refs to store stable callback references and current state
  const onAnswerCallRef = useRef(onAnswerCall);
  const onEndCallRef = useRef(onEndCall);
  const onStartCallRef = useRef(onStartCall);
  const activeCallsRef = useRef(activeCalls);

  // Update refs when callbacks change
  useEffect(() => {
    onAnswerCallRef.current = onAnswerCall;
  }, [onAnswerCall]);

  useEffect(() => {
    onEndCallRef.current = onEndCall;
  }, [onEndCall]);

  useEffect(() => {
    onStartCallRef.current = onStartCall;
  }, [onStartCall]);

  // Update active calls ref
  useEffect(() => {
    activeCallsRef.current = activeCalls;
  }, [activeCalls]);

  useEffect(() => {
    setIsAvailable(CallKit.isAvailable());

    if (!CallKit.isAvailable()) {
      console.log('CallKit: Not available on this platform');
      return;
    }

    // Load existing active calls only once
    const loadActiveCalls = async () => {
      const calls = await CallKit.getActiveCalls();
      setActiveCalls(
        calls.map((call) => ({
          uuid: call.uuid,
          handle: call.handle || call.caller || 'Unknown',
          displayName: call.caller || call.displayName || 'Unknown Caller',
          isActive: true,
          direction: call.direction || 'incoming',
        }))
      );
    };

    loadActiveCalls();

    // Set up event listeners using stable refs
    const unsubscribeAnswer = CallKit.onAnswerCall((event: CallKitEvent) => {
      console.log('useCallKit: Call answered via CallKit', event);
      onAnswerCallRef.current?.(event.callUUID);
    });

    const unsubscribeEnd = CallKit.onEndCall((event: CallKitEvent) => {
      console.log('useCallKit: Call ended via CallKit', event);
      setActiveCalls((prev) => prev.filter((call) => call.uuid !== event.callUUID));
      onEndCallRef.current?.(event.callUUID);
    });

    const unsubscribeStart = CallKit.onStartCall((event: CallKitEvent) => {
      console.log('useCallKit: Call started via CallKit', event);
      onStartCallRef.current?.(event.callUUID);
    });

    return () => {
      unsubscribeAnswer();
      unsubscribeEnd();
      unsubscribeStart();
    };
  }, []); // Empty dependency array - only run once

  // Start an outgoing call
  const startOutgoingCall = useCallback(
    async (call: Call, handle?: string, displayName?: string): Promise<string | null> => {
      if (!CallKit.isAvailable()) {
        console.warn('CallKit: Not available, cannot start outgoing call');
        return null;
      }

      const callUUID = CallKit.generateCallUUID();
      const callHandle = handle || (call as any).destinationNumber || 'Unknown';
      const callDisplayName = displayName || callHandle;

      console.log('useCallKit: Starting outgoing call', {
        callUUID,
        callHandle,
        callDisplayName,
        telnyxCallId: call.callId,
      });

      const success = await CallKit.startOutgoingCall(callUUID, callHandle, callDisplayName);

      if (success) {
        const newCall: CallKitCall = {
          uuid: callUUID,
          handle: callHandle,
          displayName: callDisplayName,
          isActive: false,
          direction: 'outgoing',
        };

        setActiveCalls((prev) => [...prev, newCall]);

        // Store mapping between CallKit UUID and Telnyx call for later reference
        (call as any)._callKitUUID = callUUID;

        return callUUID;
      }

      return null;
    },
    []
  );

  // Report an incoming call
  const reportIncomingCall = useCallback(
    async (call: Call, handle?: string, displayName?: string): Promise<string | null> => {
      if (!CallKit.isAvailable()) {
        console.warn('CallKit: Not available, cannot report incoming call');
        return null;
      }

      const callUUID = CallKit.generateCallUUID();
      const callHandle = handle || (call as any).destinationNumber || call.callId || 'Unknown';
      const callDisplayName = displayName || callHandle;

      console.log('useCallKit: Reporting incoming call', {
        callUUID,
        callHandle,
        callDisplayName,
        telnyxCallId: call.callId,
      });

      const success = await CallKit.reportIncomingCall(callUUID, callHandle, callDisplayName);

      if (success) {
        const newCall: CallKitCall = {
          uuid: callUUID,
          handle: callHandle,
          displayName: callDisplayName,
          isActive: false,
          direction: 'incoming',
        };

        setActiveCalls((prev) => [...prev, newCall]);

        // Store mapping between CallKit UUID and Telnyx call for later reference
        (call as any)._callKitUUID = callUUID;

        return callUUID;
      }

      return null;
    },
    []
  );

  // End a call
  const endCall = useCallback(
    async (
      callUUID: string,
      reason: CallEndReason = CallEndReason.RemoteEnded
    ): Promise<boolean> => {
      if (!CallKit.isAvailable()) {
        return false;
      }

      console.log('useCallKit: Ending call', { callUUID, reason });

      try {
        // For incoming calls, we should use reportCallEnded (which dismisses the UI)
        // For outgoing calls, we should use endCall (which sends the end request)

        // Check if this is likely an incoming call by looking at our active calls
        const activeCall = activeCallsRef.current.find((call) => call.uuid === callUUID);
        const isIncomingCall = activeCall?.direction === 'incoming';

        if (isIncomingCall) {
          await CallKit.reportCallEnded(callUUID, reason);
        } else {
          await CallKit.endCall(callUUID);
        }

        // Update our local state
        setActiveCalls((prev) => prev.filter((call) => call.uuid !== callUUID));
        return true;
      } catch (error) {
        console.log('useCallKit: Error ending call (may already be ended):', error);

        // Still remove from our local state even if CallKit operation failed
        // This ensures our UI stays in sync
        setActiveCalls((prev) => prev.filter((call) => call.uuid !== callUUID));

        // Return true since the call is effectively ended from our perspective
        return true;
      }
    },
    []
  );

  // Report call connected
  const reportCallConnected = useCallback(async (callUUID: string): Promise<boolean> => {
    if (!CallKit.isAvailable()) {
      return false;
    }

    console.log('useCallKit: Reporting call connected', { callUUID });

    const success = await CallKit.reportCallConnected(callUUID);

    if (success) {
      // Update our local state to mark the call as active
      setActiveCalls((prev) =>
        prev.map((call) => (call.uuid === callUUID ? { ...call, isActive: true } : call))
      );
    }

    return success;
  }, []);

  // Update call information
  const updateCall = useCallback(
    async (callUUID: string, displayName: string, handle: string): Promise<boolean> => {
      if (!CallKit.isAvailable()) {
        return false;
      }

      console.log('useCallKit: Updating call', { callUUID, displayName, handle });

      const success = await CallKit.updateCall(callUUID, displayName, handle);

      if (success) {
        // Update our local state
        setActiveCalls((prev) =>
          prev.map((call) => (call.uuid === callUUID ? { ...call, displayName, handle } : call))
        );
      }

      return success;
    },
    []
  );

  // Answer a call
  const answerCall = useCallback(async (callUUID: string): Promise<boolean> => {
    if (!CallKit.isAvailable()) {
      return false;
    }

    console.log('useCallKit: Answering call', { callUUID });

    const success = await CallKit.answerCall(callUUID);

    if (success) {
      // Update our local state to mark call as active
      setActiveCalls((prev) =>
        prev.map((call) => (call.uuid === callUUID ? { ...call, isActive: true } : call))
      );
    }

    return success;
  }, []);

  // Get CallKit UUID for a Telnyx call
  const getCallKitUUID = useCallback((call: Call): string | null => {
    return (call as any)._callKitUUID || null;
  }, []);

  // Set up automatic CallKit integration for a Telnyx call
  const integrateCall = useCallback(
    async (call: Call, direction: 'incoming' | 'outgoing') => {
      if (!CallKit.isAvailable()) {
        return null;
      }

      let callUUID: string | null = null;

      if (direction === 'incoming') {
        callUUID = await reportIncomingCall(call);
      } else {
        callUUID = await startOutgoingCall(call);
      }

      if (callUUID) {
        // Set up automatic state reporting
        const handleStateChange = async (call: Call, state: string) => {
          if (state === 'active') {
            await reportCallConnected(callUUID!);
          } else if (state === 'ended' || state === 'failed') {
            const reason = state === 'failed' ? CallEndReason.Failed : CallEndReason.RemoteEnded;
            await endCall(callUUID!, reason);
          }
        };

        call.on('telnyx.call.state', handleStateChange);
      }

      return callUUID;
    },
    [reportIncomingCall, startOutgoingCall, reportCallConnected, endCall]
  );

  return {
    // State
    isAvailable,
    activeCalls,

    // Methods
    startOutgoingCall,
    reportIncomingCall,
    answerCall,
    endCall,
    reportCallConnected,
    updateCall,
    getCallKitUUID,
    integrateCall,

    // Utility
    generateCallUUID: CallKit.generateCallUUID,
  };
}
