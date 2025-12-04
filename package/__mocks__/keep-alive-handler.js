// Mock for keep-alive-handler module
module.exports = {
  KeepAliveHandler: jest.fn(() => ({
    start: jest.fn(),
    stop: jest.fn(),
  })),
};