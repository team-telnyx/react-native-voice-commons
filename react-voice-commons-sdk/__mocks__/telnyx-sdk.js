module.exports = {
  TelnyxRTC: jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    newCall: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
  })),
  Call: jest.fn(() => ({
    id: 'mock-call-id',
    answer: jest.fn(),
    hangup: jest.fn(),
    hold: jest.fn(),
    unhold: jest.fn(),
    muteAudio: jest.fn(),
    unmuteAudio: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
  })),
  CallState: {
    NEW: 'new',
    RINGING: 'ringing',
    ACTIVE: 'active',
    HELD: 'held',
    ENDED: 'ended',
  },
};
