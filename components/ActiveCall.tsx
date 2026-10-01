import React, { useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
import { Call, TelnyxCallState, VoicePnBridge } from '../react-voice-commons-sdk/src';
import { demoColors, radii, sizes, spacing } from './demoTheme';

type CallStatsSnapshot = NonNullable<Call['currentStats']>;

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
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [duration, setDuration] = useState(call.currentDuration);
  const [showDialpad, setShowDialpad] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [callStats, setCallStats] = useState(call.currentStats);
  const [dtmfDigits, setDtmfDigits] = useState('');

  useEffect(() => {
    const muteSubscription = call.isMuted$.subscribe(setIsMuted);
    const durationSubscription = call.duration$.subscribe(setDuration);

    return () => {
      muteSubscription.unsubscribe();
      durationSubscription.unsubscribe();
    };
  }, [call]);

  useEffect(() => {
    VoicePnBridge.isSpeakerEnabled()
      .then(setIsSpeakerOn)
      .catch(() => setIsSpeakerOn(false));
  }, [call]);

  useEffect(() => {
    setCallStats(call.currentStats);
    const statsTimer = setInterval(() => {
      setCallStats(call.currentStats);
    }, 1000);

    return () => clearInterval(statsTimer);
  }, [call]);

  if (call.currentState !== TelnyxCallState.ACTIVE && call.currentState !== TelnyxCallState.HELD) {
    return null;
  }

  const isOnHold = call.currentState === TelnyxCallState.HELD;
  const canDtmf = call.currentState === TelnyxCallState.ACTIVE;

  const handleHangup = async () => {
    try {
      await call.hangup();
    } catch (error) {
      showCallActionError('End Call Failed', error);
    }
  };

  const handleMute = async () => {
    try {
      await call.toggleMute();
    } catch (error) {
      showCallActionError('Mute Failed', error);
    }
  };

  const handleHold = async () => {
    try {
      if (isOnHold) {
        await call.resume();
      } else {
        await call.hold();
      }
    } catch (error) {
      showCallActionError(isOnHold ? 'Resume Failed' : 'Hold Failed', error);
    }
  };

  const handleSpeaker = async () => {
    try {
      const enabled = await VoicePnBridge.toggleSpeaker();
      setIsSpeakerOn(enabled);
    } catch (error) {
      setIsSpeakerOn(false);
      showCallActionError('Speaker Failed', error);
    }
  };

  const handleDtmf = async (digit: string) => {
    if (!canDtmf) return;
    setDtmfDigits((current) => (current + digit).slice(-24));
    try {
      await call.dtmf(digit);
    } catch (error) {
      showCallActionError('DTMF Failed', error);
    }
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
            testID="speaker"
            label={isSpeakerOn ? 'Speaker Off' : 'Speaker'}
            onPress={handleSpeaker}
            icon={
              isSpeakerOn ? (
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
          <CallControl
            testID="callStats"
            label="Stats"
            onPress={() => setShowStats(true)}
            disabled={!callStats}
            icon={
              <Text style={[styles.statsIcon, !callStats && styles.controlTextDisabled]}>ms</Text>
            }
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
      <CallStatsSheet visible={showStats} stats={callStats} onClose={() => setShowStats(false)} />
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

type CallStatsSheetProps = {
  visible: boolean;
  stats: CallStatsSnapshot | null;
  onClose: () => void;
};

function CallStatsSheet({ visible, stats, onClose }: CallStatsSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetScrim}>
        <View style={styles.sheet} testID="callStatsSheet">
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Call Stats</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              testID="callStatsClose"
              accessibilityLabel="Close call stats"
            >
              <X size={24} color={demoColors.text} />
            </TouchableOpacity>
          </View>

          {stats ? (
            <ScrollView style={styles.statsScroll} testID="callStatsContent">
              <StatsSection title="Connection">
                <StatsRow
                  label="RTT"
                  value={formatSecondsAsMs(stats.connection?.roundTripTimeAvg)}
                />
                <StatsRow label="Sent" value={formatCount(stats.connection?.packetsSent)} />
                <StatsRow label="Received" value={formatCount(stats.connection?.packetsReceived)} />
              </StatsSection>

              <StatsSection title="Inbound Audio">
                <StatsRow
                  label="Packets"
                  value={formatCount(stats.audio.inbound?.packetsReceived)}
                />
                <StatsRow label="Lost" value={formatCount(stats.audio.inbound?.packetsLost)} />
                <StatsRow label="Jitter" value={formatMs(stats.audio.inbound?.jitterAvg)} />
                <StatsRow label="Bitrate" value={formatBitrate(stats.audio.inbound?.bitrateAvg)} />
                <StatsRow
                  label="Audio Level"
                  value={formatDecimal(stats.audio.inbound?.audioLevelAvg)}
                />
              </StatsSection>

              <StatsSection title="Outbound Audio">
                <StatsRow label="Packets" value={formatCount(stats.audio.outbound?.packetsSent)} />
                <StatsRow label="Bitrate" value={formatBitrate(stats.audio.outbound?.bitrateAvg)} />
                <StatsRow
                  label="Audio Level"
                  value={formatDecimal(stats.audio.outbound?.audioLevelAvg)}
                />
              </StatsSection>

              <StatsSection title="ICE / Transport">
                <StatsRow
                  label="ICE State"
                  value={stats.transport?.iceState || stats.ice?.state || '—'}
                />
                <StatsRow label="DTLS State" value={stats.transport?.dtlsState || '—'} />
                <StatsRow label="Local Candidate" value={stats.ice?.local?.candidateType || '—'} />
                <StatsRow
                  label="Remote Candidate"
                  value={stats.ice?.remote?.candidateType || '—'}
                />
              </StatsSection>
            </ScrollView>
          ) : (
            <Text style={styles.statsEmpty}>
              Stats will appear after the first collection interval.
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

type StatsSectionProps = {
  title: string;
  children: React.ReactNode;
};

function StatsSection({ title, children }: StatsSectionProps) {
  return (
    <View style={styles.statsSection}>
      <Text style={styles.statsSectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function StatsRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statsRow}>
      <Text style={styles.statsLabel}>{label}</Text>
      <Text style={styles.statsValue}>{value}</Text>
    </View>
  );
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatMs(value: number | null | undefined) {
  if (value == null) return '—';
  return `${value.toFixed(2)} ms`;
}

function formatSecondsAsMs(value: number | null | undefined) {
  if (value == null) return '—';
  return `${(value * 1000).toFixed(2)} ms`;
}

function formatBitrate(value: number | null | undefined) {
  if (value == null) return '—';
  return `${Math.round(value / 1000)} kbps`;
}

function formatCount(value: number | null | undefined) {
  if (value == null) return '—';
  return value.toLocaleString();
}

function formatDecimal(value: number | null | undefined) {
  if (value == null) return '—';
  return value.toFixed(4);
}

function showCallActionError(title: string, error: unknown) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
  Alert.alert(title, errorMessage);
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
  statsIcon: {
    color: demoColors.text,
    fontSize: 16,
    fontWeight: '700',
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
  statsScroll: {
    maxHeight: 440,
  },
  statsEmpty: {
    color: demoColors.mutedText,
    fontSize: 14,
  },
  statsSection: {
    borderBottomWidth: 1,
    borderBottomColor: demoColors.secondary,
    paddingBottom: spacing.sm,
    marginBottom: spacing.sm,
  },
  statsSectionTitle: {
    color: demoColors.text,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: 3,
  },
  statsLabel: {
    color: demoColors.mutedText,
    fontSize: 13,
  },
  statsValue: {
    color: demoColors.text,
    flex: 1,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
});
