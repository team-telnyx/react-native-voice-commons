import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Phone, PhoneOff } from 'lucide-react-native';
import { Call, TelnyxCallState } from '../react-voice-commons-sdk/src';
import { demoColors, radii, spacing } from './demoTheme';

type InlineCallControlsProps = {
  activeCall: Call | null;
  activeCallState: TelnyxCallState | null;
  destination: string;
  isStartingCall: boolean;
  onAnswer: () => void;
  onEnd: () => void;
};

export function InlineCallControls({
  activeCall,
  activeCallState,
  destination,
  isStartingCall,
  onAnswer,
  onEnd,
}: InlineCallControlsProps) {
  const showIncomingActions = activeCall?.isIncoming && activeCallState === TelnyxCallState.RINGING;

  return (
    <View style={styles.inlineCallState} testID="callConnectingView">
      <View style={styles.inlineCallText}>
        <Text style={styles.inlineCallLabel}>
          {isStartingCall ? 'Connecting' : callStateLabel(activeCallState)}
        </Text>
        <Text style={styles.inlineCallDestination} numberOfLines={1}>
          {activeCall?.callerName || activeCall?.callerNumber || destination.trim()}
        </Text>
      </View>

      {showIncomingActions ? (
        <View style={styles.inlineCallActions}>
          <TouchableOpacity
            style={styles.inlineEndButton}
            onPress={onEnd}
            testID="callReject"
            accessibilityRole="button"
            accessibilityLabel="Reject"
            activeOpacity={0.75}
          >
            <PhoneOff size={20} color={demoColors.white} pointerEvents="none" />
            <Text style={styles.callActionText}>Reject</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.inlineAnswerButton}
            onPress={onAnswer}
            testID="callAnswer"
            accessibilityRole="button"
            accessibilityLabel="Answer"
            activeOpacity={0.75}
          >
            <Phone size={20} color={demoColors.text} pointerEvents="none" />
            <Text style={styles.answerActionText}>Answer</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.inlineEndButton}
          onPress={onEnd}
          testID="hangupButton"
          accessibilityRole="button"
          accessibilityLabel="End"
          activeOpacity={0.75}
        >
          <PhoneOff size={20} color={demoColors.white} pointerEvents="none" />
          <Text style={styles.callActionText}>Hangup</Text>
        </TouchableOpacity>
      )}
    </View>
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
  inlineCallState: {
    width: '100%',
    minHeight: 64,
    borderWidth: 1,
    borderColor: demoColors.outline,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: demoColors.white,
  },
  inlineCallText: {
    flex: 1,
    marginRight: spacing.md,
  },
  inlineCallLabel: {
    color: demoColors.mutedText,
    fontSize: 14,
    marginBottom: 2,
  },
  inlineCallDestination: {
    color: demoColors.text,
    fontSize: 16,
    fontWeight: '500',
  },
  inlineCallActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  inlineEndButton: {
    minWidth: 104,
    height: 48,
    borderRadius: radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: demoColors.danger,
  },
  inlineAnswerButton: {
    minWidth: 104,
    height: 48,
    borderRadius: radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: demoColors.telnyxGreen,
  },
  callActionText: {
    color: demoColors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  answerActionText: {
    color: demoColors.text,
    fontSize: 15,
    fontWeight: '700',
  },
});
