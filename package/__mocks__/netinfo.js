const mockState = {
  type: 'wifi',
  isConnected: true,
  isInternetReachable: true,
  details: {
    strength: 99,
    ssid: 'MockWiFi',
  }
};

const mockFetch = jest.fn(() => Promise.resolve(mockState));
const mockAddEventListener = jest.fn(() => jest.fn());

// Create the main NetInfo object
const mockNetInfoFunctions = {
  addEventListener: mockAddEventListener,
  fetch: mockFetch,
};

// Create a separate default object that doesn't have circular reference
const defaultExport = {
  addEventListener: mockAddEventListener,
  fetch: mockFetch,
};

// Export as both default and named exports to handle all import patterns
module.exports = mockNetInfoFunctions;
module.exports.default = defaultExport;
module.exports.addEventListener = mockAddEventListener;
module.exports.fetch = mockFetch;
