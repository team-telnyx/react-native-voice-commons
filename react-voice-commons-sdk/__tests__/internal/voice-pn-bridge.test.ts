describe('VoicePnBridge speaker controls', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const loadBridge = async () => {
    jest.resetModules();
    const { NativeModules } = require('react-native');
    NativeModules.VoicePnBridge = {
      setSpeakerEnabled: jest.fn().mockResolvedValue(true),
      isSpeakerEnabled: jest.fn().mockResolvedValue(false),
    };

    const { VoicePnBridge } = await import('../../src/internal/voice-pn-bridge');
    return { VoicePnBridge, nativeBridge: NativeModules.VoicePnBridge };
  };

  it('sets the native speaker route', async () => {
    const { VoicePnBridge, nativeBridge } = await loadBridge();

    await expect(VoicePnBridge.setSpeakerEnabled(true)).resolves.toBe(true);
    expect(nativeBridge.setSpeakerEnabled).toHaveBeenCalledWith(true);
  });

  it('reads the native speaker route', async () => {
    const { VoicePnBridge, nativeBridge } = await loadBridge();
    nativeBridge.isSpeakerEnabled.mockResolvedValue(true);

    await expect(VoicePnBridge.isSpeakerEnabled()).resolves.toBe(true);
  });

  it('toggles the native speaker route', async () => {
    const { VoicePnBridge, nativeBridge } = await loadBridge();

    await expect(VoicePnBridge.toggleSpeaker()).resolves.toBe(true);
    expect(nativeBridge.setSpeakerEnabled).toHaveBeenCalledWith(true);
  });

  it('toggles the native speaker route off when currently enabled', async () => {
    const { VoicePnBridge, nativeBridge } = await loadBridge();
    nativeBridge.isSpeakerEnabled.mockResolvedValue(true);

    await expect(VoicePnBridge.toggleSpeaker()).resolves.toBe(true);
    expect(nativeBridge.setSpeakerEnabled).toHaveBeenCalledWith(false);
  });

  it('rejects when setting the native speaker route fails', async () => {
    const { VoicePnBridge, nativeBridge } = await loadBridge();
    const error = new Error('native set failed');
    nativeBridge.setSpeakerEnabled.mockRejectedValue(error);

    await expect(VoicePnBridge.setSpeakerEnabled(true)).rejects.toThrow('native set failed');
  });

  it('rejects when reading the native speaker route fails', async () => {
    const { VoicePnBridge, nativeBridge } = await loadBridge();
    const error = new Error('native read failed');
    nativeBridge.isSpeakerEnabled.mockRejectedValue(error);

    await expect(VoicePnBridge.isSpeakerEnabled()).rejects.toThrow('native read failed');
  });

  it('rejects when toggling cannot read the current speaker route', async () => {
    const { VoicePnBridge, nativeBridge } = await loadBridge();
    const error = new Error('native toggle read failed');
    nativeBridge.isSpeakerEnabled.mockRejectedValue(error);

    await expect(VoicePnBridge.toggleSpeaker()).rejects.toThrow('native toggle read failed');
    expect(nativeBridge.setSpeakerEnabled).not.toHaveBeenCalled();
  });

  describe('addSpeakerStateListener', () => {
    const loadWithEmitter = async () => {
      const loaded = await loadBridge();
      const reactNative = require('react-native');
      const remove = jest.fn();
      const addListener = jest.fn(() => ({ remove }));
      reactNative.NativeEventEmitter.mockImplementation(() => ({ addListener }));
      reactNative.NativeModules.CallKitBridge = {};
      return { ...loaded, reactNative, addListener, remove };
    };

    it('forwards native route changes and removes the subscription', async () => {
      const { VoicePnBridge, addListener, remove } = await loadWithEmitter();
      const listener = jest.fn();

      const unsubscribe = VoicePnBridge.addSpeakerStateListener(listener);
      const [eventName, nativeHandler] = addListener.mock.calls[0] as unknown as [
        string,
        (event: { isSpeakerEnabled: boolean }) => void,
      ];
      nativeHandler({ isSpeakerEnabled: true });

      expect(eventName).toBe('AudioRouteChanged');
      expect(listener).toHaveBeenCalledWith(true);

      unsubscribe();
      expect(remove).toHaveBeenCalledTimes(1);
    });

    it('does nothing on Android', async () => {
      const { VoicePnBridge, reactNative, addListener } = await loadWithEmitter();
      reactNative.Platform.OS = 'android';

      try {
        const unsubscribe = VoicePnBridge.addSpeakerStateListener(jest.fn());
        unsubscribe();
        expect(addListener).not.toHaveBeenCalled();
      } finally {
        reactNative.Platform.OS = 'ios';
      }
    });
  });
});

describe('VoicePnBridge pending push cleanup', () => {
  const loadBridge = async (clearPendingVoipPushIfMatches: jest.Mock) => {
    jest.resetModules();
    const { NativeModules } = require('react-native');
    NativeModules.VoicePnBridge = { clearPendingVoipPushIfMatches };

    const { VoicePnBridge } = await import('../../src/internal/voice-pn-bridge');
    return VoicePnBridge;
  };

  it('asks native to clear the push only if it matches', async () => {
    const nativeClear = jest.fn().mockResolvedValue(false);
    const VoicePnBridge = await loadBridge(nativeClear);

    await expect(VoicePnBridge.clearPendingVoipPushIfMatches('callkit-a')).resolves.toBe(false);
    expect(nativeClear).toHaveBeenCalledWith('callkit-a');
  });

  it('reports nothing cleared when native fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const VoicePnBridge = await loadBridge(jest.fn().mockRejectedValue(new Error('native failed')));

    await expect(VoicePnBridge.clearPendingVoipPushIfMatches('callkit-a')).resolves.toBe(false);
    jest.restoreAllMocks();
  });
});

describe('VoicePnBridge scoped pending push actions', () => {
  const loadAndroidBridge = async (overrides: Record<string, jest.Mock> = {}) => {
    jest.resetModules();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const reactNative = require('react-native');
    reactNative.Platform.OS = 'android';
    const nativeBridge: Record<string, jest.Mock> = {
      getPendingPushActionForCall: jest.fn(),
      getPendingVoiceSdkIdForCall: jest.fn(),
      hasPendingPushActionForCall: jest.fn(),
      consumePendingPushAction: jest.fn(),
      setPendingPushActionForCall: jest.fn(),
      clearPendingPushActionForCall: jest.fn(),
      clearAllPendingPushActions: jest.fn(),
      resetPushStateForFreshLogin: jest.fn(),
      completePushFlow: jest.fn(),
      expireStalePendingPushActions: jest.fn(),
      getPendingPushState: jest.fn(),
      ...overrides,
    };
    reactNative.NativeModules.VoicePnBridge = nativeBridge;

    const { VoicePnBridge } = await import('../../src/internal/voice-pn-bridge');
    return { VoicePnBridge, nativeBridge, reactNative };
  };

  afterEach(() => {
    require('react-native').Platform.OS = 'ios';
    jest.restoreAllMocks();
  });

  it('reads one call flow without falling back to another call', async () => {
    const { VoicePnBridge, nativeBridge } = await loadAndroidBridge();
    nativeBridge.getPendingPushActionForCall.mockResolvedValue({
      action: 'answer',
      metadata: '{"call_id":"call-a","voice_sdk_id":"voice-a"}',
      callId: 'call-a',
      found: true,
    });

    await expect(VoicePnBridge.getPendingPushActionForCall('call-a')).resolves.toEqual({
      action: 'answer',
      metadata: '{"call_id":"call-a","voice_sdk_id":"voice-a"}',
      callId: 'call-a',
      found: true,
    });
    expect(nativeBridge.getPendingPushActionForCall).toHaveBeenCalledWith('call-a');
  });

  it('returns the voice_sdk_id scoped to the requested call', async () => {
    const { VoicePnBridge, nativeBridge } = await loadAndroidBridge();
    nativeBridge.getPendingVoiceSdkIdForCall.mockResolvedValue('voice-a');

    await expect(VoicePnBridge.getPendingVoiceSdkIdForCall('call-a')).resolves.toBe('voice-a');
    expect(nativeBridge.getPendingVoiceSdkIdForCall).toHaveBeenCalledWith('call-a');
  });

  it('consumes exactly the requested call flow', async () => {
    const { VoicePnBridge, nativeBridge } = await loadAndroidBridge();
    nativeBridge.consumePendingPushAction.mockResolvedValue({
      action: 'reject',
      metadata: '{"call_id":"call-b"}',
      callId: 'call-b',
      consumed: true,
    });

    await expect(VoicePnBridge.consumePendingPushAction('call-b')).resolves.toEqual({
      action: 'reject',
      metadata: '{"call_id":"call-b"}',
      callId: 'call-b',
      consumed: true,
    });
    expect(nativeBridge.consumePendingPushAction).toHaveBeenCalledWith('call-b');
  });

  it('completes only the push flow for the given call', async () => {
    const { VoicePnBridge, nativeBridge } = await loadAndroidBridge();
    nativeBridge.completePushFlow.mockResolvedValue(true);

    await expect(VoicePnBridge.completePushFlow('call-a', 'reject')).resolves.toBe(true);
    expect(nativeBridge.completePushFlow).toHaveBeenCalledWith('call-a', 'reject');
  });

  it('resets native push state only for a fresh login', async () => {
    const { VoicePnBridge, nativeBridge } = await loadAndroidBridge();
    nativeBridge.resetPushStateForFreshLogin.mockResolvedValue(true);

    await expect(VoicePnBridge.resetPushStateForFreshLogin()).resolves.toBe(true);
    expect(nativeBridge.resetPushStateForFreshLogin).toHaveBeenCalledTimes(1);
  });

  it('clears a single call flow without clearing all flows', async () => {
    const { VoicePnBridge, nativeBridge } = await loadAndroidBridge();
    nativeBridge.clearPendingPushActionForCall.mockResolvedValue(true);

    await expect(VoicePnBridge.clearPendingPushActionForCall('call-a')).resolves.toBe(true);
    expect(nativeBridge.clearPendingPushActionForCall).toHaveBeenCalledWith('call-a');
    expect(nativeBridge.clearAllPendingPushActions).not.toHaveBeenCalled();
  });

  it('does not call the Android-only store on iOS', async () => {
    const { VoicePnBridge, nativeBridge } = await loadAndroidBridge();
    require('react-native').Platform.OS = 'ios';

    await expect(VoicePnBridge.getPendingPushActionForCall('call-a')).resolves.toEqual({
      found: false,
    });
    await expect(VoicePnBridge.completePushFlow('call-a', 'reject')).resolves.toBe(false);
    expect(nativeBridge.getPendingPushActionForCall).not.toHaveBeenCalled();
    expect(nativeBridge.completePushFlow).not.toHaveBeenCalled();
  });
});

describe('Android push-flow scoping helpers', () => {
  const loadHelpers = async (overrides: Record<string, jest.Mock> = {}) => {
    jest.resetModules();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const reactNative = require('react-native');
    reactNative.Platform.OS = 'android';
    const nativeBridge: Record<string, jest.Mock> = {
      getPendingPushAction: jest.fn(),
      getPendingPushActionForCall: jest.fn(),
      getPendingVoiceSdkIdForCall: jest.fn().mockResolvedValue(null),
      completePushFlow: jest.fn().mockResolvedValue(true),
      clearPendingPushAction: jest.fn().mockResolvedValue(true),
      clearAllPendingPushActions: jest.fn().mockResolvedValue(true),
      consumePendingPushAction: jest.fn().mockResolvedValue({ consumed: false }),
      ...overrides,
    };
    reactNative.NativeModules.VoicePnBridge = nativeBridge;

    // Required through `any` so this file stays loadable against a revision
    // that predates the per-call push store.
    const bridgeModule: any = require('../../src/internal/voice-pn-bridge');
    return { bridgeModule, nativeBridge, reactNative };
  };

  afterEach(() => {
    require('react-native').Platform.OS = 'ios';
    jest.restoreAllMocks();
  });

  it('reads the launch push without clearing or consuming it', async () => {
    const { bridgeModule, nativeBridge } = await loadHelpers();
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

    await expect(bridgeModule.readPendingAndroidPush()).resolves.toEqual({
      action: 'answer',
      metadata: { call_id: 'call-a', voice_sdk_id: 'voice-a' },
      from_notification: true,
      callId: 'call-a',
    });

    // The pending INVITE still needs this metadata to attach after the launch
    // read, so nothing may be dropped here.
    expect(nativeBridge.clearPendingPushAction).not.toHaveBeenCalled();
    expect(nativeBridge.clearAllPendingPushActions).not.toHaveBeenCalled();
    expect(nativeBridge.consumePendingPushAction).not.toHaveBeenCalled();
    expect(nativeBridge.completePushFlow).not.toHaveBeenCalled();
  });

  it('returns the flow scoped to the call instead of whichever flow is current', async () => {
    const { bridgeModule, nativeBridge } = await loadHelpers();
    // The store currently points at a newer sequential push.
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

    const wake = await bridgeModule.readPendingAndroidPush();

    expect(nativeBridge.getPendingPushActionForCall).toHaveBeenCalledWith('call-a');
    expect(wake).toEqual(
      expect.objectContaining({
        callId: 'call-a',
        metadata: expect.objectContaining({ voice_sdk_id: 'voice-a' }),
      })
    );
  });

  it('falls back to the wrapper snapshot when the scoped lookup misses', async () => {
    const { bridgeModule, nativeBridge } = await loadHelpers();
    nativeBridge.getPendingPushAction.mockResolvedValue({
      action: 'answer',
      metadata: { call_id: 'call-a', voice_sdk_id: 'voice-a' },
      callId: 'call-a',
    });
    nativeBridge.getPendingPushActionForCall.mockResolvedValue({ found: false });

    await expect(bridgeModule.readPendingAndroidPush()).resolves.toEqual({
      action: 'answer',
      metadata: { call_id: 'call-a', voice_sdk_id: 'voice-a' },
      from_notification: true,
      callId: 'call-a',
    });
  });

  it('stamps the call-scoped voice_sdk_id when metadata lost it', async () => {
    const { bridgeModule, nativeBridge } = await loadHelpers();
    nativeBridge.getPendingPushAction.mockResolvedValue({
      action: 'answer',
      metadata: { call_id: 'call-a' },
      callId: 'call-a',
    });
    nativeBridge.getPendingPushActionForCall.mockResolvedValue({
      action: 'answer',
      metadata: { call_id: 'call-a' },
      callId: 'call-a',
      found: true,
    });
    nativeBridge.getPendingVoiceSdkIdForCall.mockResolvedValue('voice-a');

    await expect(bridgeModule.readPendingAndroidPush()).resolves.toEqual({
      action: 'answer',
      metadata: { call_id: 'call-a', voice_sdk_id: 'voice-a' },
      from_notification: true,
      callId: 'call-a',
    });
    expect(nativeBridge.getPendingVoiceSdkIdForCall).toHaveBeenCalledWith('call-a');
  });

  it('does not borrow another call voice_sdk_id', async () => {
    const { bridgeModule, nativeBridge } = await loadHelpers();
    nativeBridge.getPendingPushAction.mockResolvedValue({
      action: 'answer',
      metadata: { call_id: 'call-a', voice_sdk_id: 'voice-a' },
      callId: 'call-a',
    });
    nativeBridge.getPendingPushActionForCall.mockResolvedValue({
      action: 'answer',
      metadata: { call_id: 'call-a', voice_sdk_id: 'voice-a' },
      callId: 'call-a',
      found: true,
    });

    const wake = await bridgeModule.readPendingAndroidPush();

    expect(wake.metadata.voice_sdk_id).toBe('voice-a');
    // Already scoped: no need to consult the store again.
    expect(nativeBridge.getPendingVoiceSdkIdForCall).not.toHaveBeenCalled();
  });

  it('returns null when no push is pending', async () => {
    const { bridgeModule } = await loadHelpers();

    await expect(bridgeModule.readPendingAndroidPush()).resolves.toBeNull();
  });

  it('completes the flow owned by metadata.call_id and no other flow', async () => {
    const { bridgeModule, nativeBridge } = await loadHelpers();

    await expect(
      bridgeModule.completeAndroidPushFlow(
        { action: 'reject', metadata: { call_id: 'call-a' } },
        'reject'
      )
    ).resolves.toBe(true);

    expect(nativeBridge.completePushFlow).toHaveBeenCalledWith('call-a', 'reject');
    expect(nativeBridge.clearAllPendingPushActions).not.toHaveBeenCalled();
    expect(nativeBridge.clearPendingPushAction).not.toHaveBeenCalled();
  });

  it('prefers an explicit callId over metadata for completion', async () => {
    const { bridgeModule, nativeBridge } = await loadHelpers();

    await bridgeModule.completeAndroidPushFlow(
      { callId: 'call-explicit', metadata: { call_id: 'call-metadata' } },
      'failure'
    );

    expect(nativeBridge.completePushFlow).toHaveBeenCalledWith('call-explicit', 'failure');
  });

  it('does not touch the Android push store on iOS', async () => {
    const { bridgeModule, nativeBridge, reactNative } = await loadHelpers();
    reactNative.Platform.OS = 'ios';

    await expect(
      bridgeModule.completeAndroidPushFlow({ metadata: { call_id: 'call-a' } }, 'reject')
    ).resolves.toBe(false);
    expect(nativeBridge.completePushFlow).not.toHaveBeenCalled();
  });

  it.each([
    ['reject', true],
    ['decline', true],
    ['hangup', true],
    ['end', true],
    ['answer', false],
    ['incoming_call', false],
    [undefined, false],
  ])('classifies %s as terminal=%s', async (action, expected) => {
    const { bridgeModule } = await loadHelpers();
    expect(bridgeModule.isTerminalPushAction(action)).toBe(expected);
  });
});
