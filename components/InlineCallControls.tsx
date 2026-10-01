import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ArrowLeftRight, Pause, Phone, PhoneOff, Play } from 'lucide-react-native';
import { Call, TelnyxCallState } from '../react-voice-commons-sdk/src';
import { demoColors, radii, spacing } from './demoTheme';

type InlineCallControlsProps = {
  activeCall: Call | null;
  calls: Call[];
  activeCallState: TelnyxCallState | null;
  destination: string;
  isStartingCall: boolean;
  onAnswer: () => void;
  onEnd: () => void;
  onSwap: (heldCall: Call) => Promise<void>;
};

export function InlineCallControls({
  activeCall,
  calls,
  activeCallState,
  destination,
  isStartingCall,
  onAnswer,
  onEnd,
  onSwap,
}: InlineCallControlsProps) {
  const [isChangingHold, setIsChangingHold] = useState(false);
  const [swappingCallId, setSwappingCallId] = useState<string | null>(null);
  const showIncomingActions = activeCall?.isIncoming && activeCallState === TelnyxCallState.RINGING;
  const isOnHold = activeCallState === TelnyxCallState.HELD;
  const canChangeHold =
    !!activeCall &&
    (activeCallState === TelnyxCallState.ACTIVE || activeCallState === TelnyxCallState.HELD);
  const otherCalls = calls.filter(
    (call) => call.callId !== activeCall?.callId && isVisibleCallState(call.currentState)
  );
  const stateLabel = isStartingCall ? 'Connecting' : callStateLabel(activeCallState);

  const handleHoldChange = async () => {
    if (!activeCall || !canChangeHold || isChangingHold) return;

    setIsChangingHold(true);
    try {
      if (isOnHold) {
        await activeCall.resume();
      } else {
        await activeCall.hold();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown call-control error';
      Alert.alert(isOnHold ? 'Resume Failed' : 'Hold Failed', message);
    } finally {
      setIsChangingHold(false);
    }
  };

  const handleSwap = async (heldCall: Call) => {
    if (swappingCallId || activeCallState !== TelnyxCallState.ACTIVE) return;

    setSwappingCallId(heldCall.callId);
    try {
      await onSwap(heldCall);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown call-swap error';
      Alert.alert('Swap Failed', message);
    } finally {
      setSwappingCallId(null);
    }
  };

  return (
    <View style={[styles.callCard, isOnHold && styles.callCardHeld]} testID="callConnectingView">
      <View style={styles.callHeader}>
        <View style={[styles.stateBadge, isOnHold && styles.stateBadgeHeld]}>
          <View style={[styles.stateDot, isOnHold && styles.stateDotHeld]} />
          <Text
            style={[styles.stateBadgeText, isOnHold && styles.stateBadgeTextHeld]}
            testID="callStateText"
            accessibilityLiveRegion="assertive"
          >
            {stateLabel}
          </Text>
        </View>
        <Text style={styles.callDirection}>{activeCall?.isIncoming ? 'Incoming' : 'Outgoing'}</Text>
      </View>

      <View style={styles.callIdentity}>
        <Text style={styles.callTitle}>
          {isOnHold ? 'Call on hold' : callTitle(activeCallState)}
        </Text>
        <Text style={styles.callDestination} numberOfLines={1}>
          {callDisplayName(activeCall, destination)}
        </Text>
      </View>

      {isOnHold && (
        <View
          style={styles.heldNotice}
          testID="heldIndicator"
          accessibilityRole="text"
          accessibilityLiveRegion="assertive"
        >
          <Pause size={18} color={demoColors.selectedGreen} pointerEvents="none" />
          <View style={styles.heldNoticeText}>
            <Text style={styles.heldNoticeTitle}>This call is on hold</Text>
            <Text style={styles.heldNoticeDescription}>Tap Resume to return to the call.</Text>
          </View>
        </View>
      )}

      {showIncomingActions ? (
        <View style={styles.callActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.endButton]}
            onPress={onEnd}
            testID="callReject"
            accessibilityRole="button"
            accessibilityLabel="Reject"
            activeOpacity={0.75}
          >
            <PhoneOff size={20} color={demoColors.white} pointerEvents="none" />
            <Text style={styles.lightActionText}>Reject</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.answerButton]}
            onPress={onAnswer}
            testID="callAnswer"
            accessibilityRole="button"
            accessibilityLabel="Answer"
            activeOpacity={0.75}
          >
            <Phone size={20} color={demoColors.text} pointerEvents="none" />
            <Text style={styles.darkActionText}>Answer</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.callActions}>
          {canChangeHold && (
            <TouchableOpacity
              style={[styles.actionButton, styles.holdButton, isChangingHold && styles.disabled]}
              onPress={handleHoldChange}
              disabled={isChangingHold}
              testID="holdButton"
              accessibilityRole="button"
              accessibilityLabel={isOnHold ? 'Resume call' : 'Hold call'}
              accessibilityState={{ disabled: isChangingHold }}
              activeOpacity={0.75}
            >
              {isOnHold ? (
                <Play size={20} color={demoColors.text} pointerEvents="none" />
              ) : (
                <Pause size={20} color={demoColors.text} pointerEvents="none" />
              )}
              <Text style={styles.darkActionText}>
                {isChangingHold
                  ? isOnHold
                    ? 'Resuming…'
                    : 'Holding…'
                  : isOnHold
                    ? 'Resume'
                    : 'Hold'}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.actionButton, styles.endButton]}
            onPress={onEnd}
            testID="hangupButton"
            accessibilityRole="button"
            accessibilityLabel="End call"
            activeOpacity={0.75}
          >
            <PhoneOff size={20} color={demoColors.white} pointerEvents="none" />
            <Text style={styles.lightActionText}>Hangup</Text>
          </TouchableOpacity>
        </View>
      )}

      {otherCalls.length > 0 && (
        <View style={styles.otherCalls} testID="otherCallsStatus">
          <Text style={styles.otherCallsHeading}>Other calls</Text>
          {otherCalls.map((call) => {
            const held = call.currentState === TelnyxCallState.HELD;
            return (
              <View key={call.callId} style={[styles.otherCall, held && styles.otherCallHeld]}>
                <View style={[styles.otherCallDot, held && styles.otherCallDotHeld]} />
                <View style={styles.otherCallIdentity}>
                  <Text style={styles.otherCallName} numberOfLines={1}>
                    {callDisplayName(call, '')}
                  </Text>
                  <Text style={[styles.otherCallState, held && styles.otherCallStateHeld]}>
                    {held ? 'On hold' : callStateLabel(call.currentState)}
                  </Text>
                </View>
                {held && activeCallState === TelnyxCallState.ACTIVE && (
                  <TouchableOpacity
                    style={[styles.swapButton, swappingCallId && styles.disabled]}
                    onPress={() => handleSwap(call)}
                    disabled={swappingCallId !== null}
                    testID={`swapCall-${call.callId}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Swap to ${callDisplayName(call, 'held call')}`}
                    activeOpacity={0.75}
                  >
                    <ArrowLeftRight size={16} color={demoColors.text} pointerEvents="none" />
                    <Text style={styles.swapButtonText}>
                      {swappingCallId === call.callId ? 'Swapping…' : 'Swap'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

function callDisplayName(call: Call | null, fallback: string) {
  return (
    call?.callerName || call?.callerNumber || call?.destination || fallback.trim() || 'Unknown'
  );
}

function callTitle(callState: TelnyxCallState | null) {
  switch (callState) {
    case TelnyxCallState.ACTIVE:
      return 'Call active';
    case TelnyxCallState.RINGING:
      return 'Incoming call';
    case TelnyxCallState.CONNECTING:
      return 'Connecting call';
    case TelnyxCallState.DROPPED:
      return 'Call interrupted';
    case TelnyxCallState.FAILED:
      return 'Call failed';
    default:
      return 'Call';
  }
}

function isVisibleCallState(callState: TelnyxCallState) {
  return (
    callState === TelnyxCallState.RINGING ||
    callState === TelnyxCallState.CONNECTING ||
    callState === TelnyxCallState.ACTIVE ||
    callState === TelnyxCallState.HELD
  );
}

function callStateLabel(callState: TelnyxCallState | null) {
  switch (callState) {
    case TelnyxCallState.RINGING:
      return 'Ringing';
    case TelnyxCallState.CONNECTING:
      return 'Connecting';
    case TelnyxCallState.ACTIVE:
      return 'Active';
    case TelnyxCallState.HELD:
      return 'Held';
    case TelnyxCallState.DROPPED:
      return 'Dropped';
    case TelnyxCallState.FAILED:
      return 'Error';
    case TelnyxCallState.ENDED:
    default:
      return 'Done';
  }
}

const styles = StyleSheet.create({
  callCard: {
    width: '100%',
    borderWidth: 2,
    borderColor: demoColors.selectedGreen,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.md,
    backgroundColor: demoColors.white,
  },
  callCardHeld: {
    borderColor: demoColors.selectedGreen,
    backgroundColor: demoColors.secondarySurface,
  },
  callHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: demoColors.selectedGreen,
  },
  stateBadgeHeld: {
    backgroundColor: demoColors.secondary,
  },
  stateDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: demoColors.white,
  },
  stateDotHeld: {
    backgroundColor: demoColors.selectedGreen,
  },
  stateBadgeText: {
    color: demoColors.white,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  stateBadgeTextHeld: {
    color: demoColors.selectedGreen,
  },
  callDirection: {
    color: demoColors.mutedText,
    fontSize: 13,
  },
  callIdentity: {
    gap: 3,
  },
  callTitle: {
    color: demoColors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  callDestination: {
    color: demoColors.mutedText,
    fontSize: 16,
  },
  heldNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: demoColors.selectedGreen,
    borderRadius: radii.md,
    padding: spacing.sm,
    backgroundColor: demoColors.white,
  },
  heldNoticeText: {
    flex: 1,
  },
  heldNoticeTitle: {
    color: demoColors.selectedGreen,
    fontSize: 15,
    fontWeight: '700',
  },
  heldNoticeDescription: {
    color: demoColors.mutedText,
    fontSize: 13,
    marginTop: 2,
  },
  callActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    minWidth: 112,
    height: 48,
    borderRadius: radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  endButton: {
    backgroundColor: demoColors.danger,
  },
  answerButton: {
    backgroundColor: demoColors.telnyxGreen,
  },
  holdButton: {
    borderWidth: 1,
    borderColor: demoColors.outline,
    backgroundColor: demoColors.secondary,
  },
  disabled: {
    opacity: 0.5,
  },
  lightActionText: {
    color: demoColors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  darkActionText: {
    color: demoColors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  otherCalls: {
    borderTopWidth: 1,
    borderTopColor: demoColors.outline,
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  otherCallsHeading: {
    color: demoColors.mutedText,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  otherCall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: demoColors.secondarySurface,
  },
  otherCallHeld: {
    borderWidth: 1,
    borderColor: demoColors.selectedGreen,
  },
  otherCallDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: demoColors.ringing,
  },
  otherCallDotHeld: {
    backgroundColor: demoColors.selectedGreen,
  },
  otherCallIdentity: {
    flex: 1,
  },
  otherCallName: {
    color: demoColors.text,
    fontSize: 15,
    fontWeight: '500',
  },
  otherCallState: {
    color: demoColors.mutedText,
    fontSize: 13,
    marginTop: 2,
  },
  otherCallStateHeld: {
    color: demoColors.selectedGreen,
    fontWeight: '700',
  },
  swapButton: {
    minWidth: 88,
    height: 38,
    borderWidth: 1,
    borderColor: demoColors.outline,
    borderRadius: radii.pill,
    backgroundColor: demoColors.secondary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  swapButtonText: {
    color: demoColors.text,
    fontSize: 14,
    fontWeight: '700',
  },
});
