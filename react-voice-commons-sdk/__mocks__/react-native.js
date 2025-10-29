module.exports = {
  Platform: {
    OS: 'ios',
    select: jest.fn((obj) => obj.ios),
  },
  NativeModules: {},
  NativeEventEmitter: jest.fn(() => ({
    addListener: jest.fn(),
    removeListener: jest.fn(),
    removeAllListeners: jest.fn(),
  })),
};
