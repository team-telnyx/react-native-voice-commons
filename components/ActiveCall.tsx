import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  Keyboard,
  Mic,
  MicOff,
  Pause,
  PhoneOff,
  Play,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react-native';
import { Call, TelnyxCallState } from '../react-voice-commons-sdk/src';
import { demoColors, radii, sizes, spacing } from './demoTheme';

type Props = {
  call: Call;
};

const DTMF_KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['*', '0', '#'],
];

export function ActiveCall({ call }: Props) {
  const [isMuted, setIsMuted] = useState(call.currentIsMuted);
  const [speakerOn, setSpeakerOn] = useState(false);
  const [duration, setDuration] = useState(call.currentDuration);
  const [showDialpad, setShowDialpad] = useState(false);
  const [dtmfDigits, setDtmfDigits] = useState('');

  useEffect(() => {
    const muteSubscription = call.isMuted$.subscribe(setIsMuted);
    const durationSubscription = call.duration$.subscribe(setDuration);

    return () => {
      muteSubscription.unsubscribe();
      durationSubscription.unsubscribe();
    };
  }, [call]);

  if (call.currentState !== TelnyxCallState.ACTIVE && call.currentState !== TelnyxCallState.HELD) {
    return null;
  }

  const isOnHold = call.currentState === TelnyxCallState.HELD;
  const canDtmf = call.currentState === TelnyxCallState.ACTIVE;

  const handleHangup = async () => {
    await call.hangup();
  };

  const handleMute = async () => {
    await call.toggleMute();
  };

  const handleHold = async () => {
    if (isOnHold) {
      await call.resume();
    } else {
      await call.hold();
    }
  };

  const handleDtmf = async (digit: string) => {
    if (!canDtmf) return;
    setDtmfDigits((current) => (current + digit).slice(-24));
    await call.dtmf(digit);
  };

  return (
    <View style={styles.overlay} testID="callActiveView">
      <View style={styles.content}>
        <Text style={styles.stateLabel}>{isOnHold ? 'Call on hold' : 'Active'}</Text>
        <Text style={styles.callerName}>{call.callerName || call.destination}</Text>
        <Text style={styles.callerNumber}>{call.callerNumber || call.destination}</Text>
        <Text style={styles.duration}>{formatDuration(duration)}</Text>

        <View style={styles.controls}>
          <CallControl
            testID="mute"
            label={isMuted ? 'Unmute' : 'Mute'}
            onPress={handleMute}
            icon={
              isMuted ? (
                <MicOff size={24} color={demoColors.text} />
              ) : (
                <Mic size={24} color={demoColors.text} />
              )
            }
          />
          <CallControl
            testID="loudSpeaker"
            label={speakerOn ? 'Speaker off' : 'Speaker'}
            onPress={() => setSpeakerOn((current) => !current)}
            icon={
              speakerOn ? (
                <Volume2 size={24} color={demoColors.text} />
              ) : (
                <VolumeX size={24} color={demoColors.text} />
              )
            }
          />
          <CallControl
            testID="hold"
            label={isOnHold ? 'Resume' : 'Hold'}
            onPress={handleHold}
            icon={
              isOnHold ? (
                <Play size={24} color={demoColors.text} />
              ) : (
                <Pause size={24} color={demoColors.text} />
              )
            }
          />
          <CallControl
            testID="dialpad"
            label="Dialpad"
            onPress={() => setShowDialpad(true)}
            disabled={!canDtmf}
            icon={<Keyboard size={24} color={canDtmf ? demoColors.text : demoColors.disabled} />}
          />
        </View>

        <TouchableOpacity
          style={styles.endButton}
          onPress={handleHangup}
          testID="endCall"
          accessibilityLabel="End"
        >
          <PhoneOff size={24} color={demoColors.white} />
        </TouchableOpacity>
      </View>

      <DtmfDialpad
        visible={showDialpad}
        digits={dtmfDigits}
        onKeyPress={handleDtmf}
        onClose={() => setShowDialpad(false)}
      />
    </View>
  );
}

type CallControlProps = {
  testID: string;
  label: string;
  icon: React.ReactNode;
  disabled?: boolean;
  onPress: () => void;
};

function CallControl({ testID, label, icon, disabled, onPress }: CallControlProps) {
  return (
    <TouchableOpacity
      style={[styles.controlButton, disabled && styles.controlButtonDisabled]}
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      accessibilityLabel={label}
    >
      {icon}
      <Text style={[styles.controlText, disabled && styles.controlTextDisabled]}>{label}</Text>
    </TouchableOpacity>
  );
}

type DtmfDialpadProps = {
  visible: boolean;
  digits: string;
  onKeyPress: (digit: string) => void;
  onClose: () => void;
};

function DtmfDialpad({ visible, digits, onKeyPress, onClose }: DtmfDialpadProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetScrim}>
        <View style={styles.sheet} testID="dtmfDialpad">
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>DTMF Dialpad</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              testID="dtmfClose"
              accessibilityLabel="Close"
            >
              <X size={24} color={demoColors.text} />
            </TouchableOpacity>
          </View>

          <Text style={styles.dtmfInput} testID="dtmfInput">
            {digits || ' '}
          </Text>

          <View style={styles.keypad}>
            {DTMF_KEYS.map((row) => (
              <View style={styles.keypadRow} key={row.join('')}>
                {row.map((digit) => (
                  <TouchableOpacity
                    key={digit}
                    style={styles.key}
                    onPress={() => onKeyPress(digit)}
                    testID={dtmfTestId(digit)}
                    accessibilityLabel={`DTMF ${digit}`}
                  >
                    <Text style={styles.keyText}>{digit}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function dtmfTestId(digit: string) {
  if (digit === '*') return 'dtmfKeyStar';
  if (digit === '#') return 'dtmfKeyHash';
  return `dtmfKey${digit}`;
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    backgroundColor: demoColors.background,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  content: {
    alignItems: 'center',
  },
  stateLabel: {
    color: demoColors.selectedGreen,
    fontSize: 16,
    marginBottom: spacing.xs,
  },
  callerName: {
    color: demoColors.text,
    fontSize: 24,
    fontWeight: '500',
    textAlign: 'center',
  },
  callerNumber: {
    color: demoColors.mutedText,
    fontSize: 16,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  duration: {
    color: demoColors.text,
    fontSize: 20,
    marginTop: spacing.sm,
  },
  controls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    maxWidth: 320,
  },
  controlButton: {
    width: sizes.callButton,
    height: sizes.callButton,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: demoColors.secondary,
  },
  controlButtonDisabled: {
    opacity: 0.45,
  },
  controlText: {
    display: 'none',
    color: demoColors.text,
    fontSize: 12,
    textAlign: 'center',
  },
  controlTextDisabled: {
    color: demoColors.disabled,
  },
  endButton: {
    width: sizes.callButton,
    height: sizes.callButton,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: demoColors.danger,
    marginTop: spacing.lg,
  },
  sheetScrim: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(29,29,29,0.35)',
  },
  sheet: {
    backgroundColor: demoColors.white,
    padding: spacing.lg,
    paddingBottom: spacing.lg,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sheetTitle: {
    color: demoColors.text,
    fontSize: 16,
    fontWeight: '500',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: demoColors.secondary,
  },
  dtmfInput: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: demoColors.inputOutline,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    color: demoColors.text,
    fontSize: 16,
    marginBottom: spacing.md,
  },
  keypad: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  keypadRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  key: {
    width: sizes.keypadButton,
    height: sizes.keypadButton,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: demoColors.secondary,
  },
  keyText: {
    color: demoColors.text,
    fontSize: 16,
    fontWeight: '500',
  },
});
