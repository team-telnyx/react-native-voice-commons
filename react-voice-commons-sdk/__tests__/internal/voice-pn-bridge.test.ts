describe('VoicePnBridge speaker controls', () => {
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
});
