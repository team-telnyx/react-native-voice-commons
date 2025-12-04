// Mock for peer module  
const mockPeerInstance = {
  createPeerConnection: jest.fn(),
  setRemoteDescription: jest.fn(),
  createOffer: jest.fn(),
  createAnswer: jest.fn(),
  close: jest.fn(),
  attachLocalStream: jest.fn().mockReturnThis(),
  waitForIceGatheringComplete: jest.fn().mockReturnThis(),
  localDescription: { sdp: 'mock-sdp' },
  instance: {
    connectionState: 'connected',
    iceConnectionState: 'connected',
  },
};

const PeerMock = jest.fn(() => mockPeerInstance);

// Add static methods
PeerMock.createOffer = jest.fn();

module.exports = {
  Peer: PeerMock,
};