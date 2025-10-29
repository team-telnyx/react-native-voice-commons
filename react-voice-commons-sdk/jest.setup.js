// Jest setup file for react-voice-commons

// Mock RxJS timers for testing
jest.mock('rxjs', () => {
  const actual = jest.requireActual('rxjs');
  return {
    ...actual,
    timer: jest.fn(() => actual.of(0)),
    interval: jest.fn(() => actual.of(0)),
  };
});

// Global test timeout
jest.setTimeout(10000);
