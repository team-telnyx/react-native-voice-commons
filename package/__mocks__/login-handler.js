// Mock for login-handler module
module.exports = {
  LoginHandler: jest.fn(() => ({
    login: jest.fn(),
    logout: jest.fn(),
  })),
};