/**
 * Android launch/notification path for `TelnyxVoiceApp`.
 *
 * The component itself is not mounted here; the exported launch-read helper is
 * the piece that owns the push-store contract, so it is exercised directly.
 */

type NativePushBridge = Record<string, jest.Mock>;

const installAndroidBridge = () => {
  jest.resetModules();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  const reactNative = require('react-native');
  reactNative.Platform.OS = 'android';

  const nativeBridge: NativePushBridge = {
    getPendingCallAction: jest.fn().mockResolvedValue(null),
    clearPendingCallAction: jest.fn().mockResolvedValue(true),
    getPendingPushAction: jest.fn().mockResolvedValue(null),
    getPendingPushActionForCall: jest.fn().mockResolvedValue({ found: false }),
    getPendingVoiceSdkIdForCall: jest.fn().mockResolvedValue(null),
    completePushFlow: jest.fn().mockResolvedValue(true),
    clearPendingPushAction: jest.fn().mockResolvedValue(true),
    clearAllPendingPushActions: jest.fn().mockResolvedValue(true),
    consumePendingPushAction: jest.fn().mockResolvedValue({ consumed: false }),
  };
  reactNative.NativeModules.VoicePnBridge = nativeBridge;

  const appModule: any = require('../src/telnyx-voice-app');
  return { appModule, nativeBridge, reactNative };
};

const noopLog = () => {};

describe('getAndroidPushData launch reads', () => {
  afterEach(() => {
    require('react-native').Platform.OS = 'ios';
    jest.restoreAllMocks();
  });

  it('returns the scoped call without clearing or consuming the flow', async () => {
    const { appModule, nativeBridge } = installAndroidBridge();
    nativeBridge.getPendingPushAction.mockResolvedValue({
      action: 'answer',
      metadata: '{"call_id":"call-a","voice_sdk_id":"voice-a"}',
      callId: 'call-a',
    });
    nativeBridge.getPendingPushActionForCall.mockResolvedValue({
      action: 'answer',
      metadata: '{"call_id":"call-a","voice_sdk_id":"voice-a"}',
      callId: 'call-a',
      found: true,
    });

    const voipClient = { currentActiveCall: null };
    const result = await appModule.getAndroidPushData(voipClient, noopLog);

    expect(result).toEqual({
      earlyReturn: false,
      pushData: {
        action: 'answer',
        metadata: { call_id: 'call-a', voice_sdk_id: 'voice-a' },
        from_notification: true,
        callId: 'call-a',
      },
    });

    // The push-answer connection still needs this metadata to attach the
    // pending INVITE, and a sequential push must keep its own flow.
    expect(nativeBridge.clearPendingPushAction).not.toHaveBeenCalled();
    expect(nativeBridge.clearAllPendingPushActions).not.toHaveBeenCalled();
    expect(nativeBridge.consumePendingPushAction).not.toHaveBeenCalled();
    expect(nativeBridge.completePushFlow).not.toHaveBeenCalled();
  });

  it('keeps a terminally rejected flow available for the client to complete', async () => {
    const { appModule, nativeBridge } = installAndroidBridge();
    nativeBridge.getPendingPushAction.mockResolvedValue({
      action: 'reject',
      metadata: { call_id: 'call-reject', voice_sdk_id: 'voice-reject' },
      callId: 'call-reject',
    });
    nativeBridge.getPendingPushActionForCall.mockResolvedValue({
      action: 'reject',
      metadata: { call_id: 'call-reject', voice_sdk_id: 'voice-reject' },
      callId: 'call-reject',
      found: true,
    });

    const result = await appModule.getAndroidPushData({ currentActiveCall: null }, noopLog);

    expect(result.pushData).toEqual(
      expect.objectContaining({ action: 'reject', callId: 'call-reject' })
    );
    expect(nativeBridge.completePushFlow).not.toHaveBeenCalled();
  });

  it('ends the notification hangup for exactly its call', async () => {
    const { appModule, nativeBridge } = installAndroidBridge();
    nativeBridge.getPendingCallAction.mockResolvedValue({ action: 'hangup', callId: 'call-a' });

    const hangup = jest.fn().mockResolvedValue(undefined);
    const result = await appModule.getAndroidPushData(
      { currentActiveCall: { callId: 'call-a', hangup } },
      noopLog
    );

    expect(result).toEqual({ pushData: null, earlyReturn: true });
    expect(hangup).toHaveBeenCalledTimes(1);
    expect(nativeBridge.clearPendingCallAction).toHaveBeenCalledTimes(1);
    expect(nativeBridge.completePushFlow).toHaveBeenCalledWith('call-a', 'hangup');
    expect(nativeBridge.clearAllPendingPushActions).not.toHaveBeenCalled();
  });

  it('does not fail the launch when the native bridge is missing', async () => {
    const { appModule, reactNative } = installAndroidBridge();
    reactNative.NativeModules.VoicePnBridge = undefined;

    await expect(
      appModule.getAndroidPushData({ currentActiveCall: null }, noopLog)
    ).resolves.toEqual({ pushData: null, earlyReturn: false });
  });
});
