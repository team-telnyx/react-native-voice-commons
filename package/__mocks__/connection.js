// Mock for connection module
module.exports = {
  Connection: jest.fn(() => ({
    send: jest.fn(),
    close: jest.fn(),
    isConnected: true,
  })),
};