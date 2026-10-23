// `../lib/peer` is mapped to the manual mock in jest.config.js; this path
// does not match that mapping, so the real Peer implementation is loaded.
import { Peer } from '../lib/./peer';

jest.mock('loglevel', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

type Listener = () => void;

class MockRTCPeerConnection {
  public iceConnectionState = 'new';
  public connectionState = 'new';
  private listeners = new Map<string, Listener[]>();

  addEventListener(type: string, listener: Listener) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  removeEventListener() {}

  close() {}

  dispatch(type: string) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener();
    }
  }
}

let mockLastPeerConnection: MockRTCPeerConnection | null = null;

jest.mock('react-native-webrtc', () => ({
  RTCPeerConnection: jest.fn().mockImplementation(() => {
    mockLastPeerConnection = new MockRTCPeerConnection();
    return mockLastPeerConnection;
  }),
  RTCSessionDescription: jest.fn(),
  MediaStream: jest.fn(),
  mediaDevices: { getUserMedia: jest.fn() },
}));

function createPeer() {
  const peer = new Peer({ destinationNumber: '+155****4567' } as any).createPeerConnection();
  const onIceStateChange = jest.fn();
  const onPeerConnectionStateChange = jest.fn();
  peer.onIceStateChange = onIceStateChange;
  peer.onPeerConnectionStateChange = onPeerConnectionStateChange;
  return { peer, pc: mockLastPeerConnection!, onIceStateChange, onPeerConnectionStateChange };
}

describe('Peer state callbacks (SignalingHealthMonitor inputs)', () => {
  it('reports peer connection state only through onPeerConnectionStateChange', () => {
    const { pc, onIceStateChange, onPeerConnectionStateChange } = createPeer();

    // A DTLS-level failure: the peer connection fails while ICE stays connected.
    pc.iceConnectionState = 'connected';
    pc.connectionState = 'failed';
    pc.dispatch('connectionstatechange');

    expect(onPeerConnectionStateChange).toHaveBeenCalledWith('failed');
    expect(onIceStateChange).not.toHaveBeenCalled();
  });

  it('reports ICE connection state only through onIceStateChange', () => {
    const { pc, onIceStateChange, onPeerConnectionStateChange } = createPeer();

    pc.iceConnectionState = 'failed';
    pc.dispatch('iceconnectionstatechange');

    expect(onIceStateChange).toHaveBeenCalledWith('failed');
    expect(onPeerConnectionStateChange).not.toHaveBeenCalled();
  });

  it('exposes both live states to the monitor', () => {
    const { peer, pc } = createPeer();
    pc.iceConnectionState = 'connected';
    pc.connectionState = 'failed';

    expect(peer.getIceConnectionState()).toBe('connected');
    expect(peer.getConnectionState()).toBe('failed');
  });
});
