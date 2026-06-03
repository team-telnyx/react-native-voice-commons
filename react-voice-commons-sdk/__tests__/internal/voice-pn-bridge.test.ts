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
});
