// `../lib/peer` is mapped to the manual mock in jest.config.js; this path does
// not match that mapping, so the real Peer implementation is loaded.
import { Peer } from '../lib/./peer';
import { TelnyxRTC } from '../lib/client';
import { Call } from '../lib/call';
import {
  DEFAULT_DEV_ICE_SERVERS,
  DEFAULT_PROD_ICE_SERVERS,
  TURN_TLS_443_SERVER,
  getDefaultIceServers,
} from '../lib/ice-servers';
import type { TelnyxIceServer } from '../lib/ice-servers';

jest.mock('loglevel', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  setLevel: jest.fn(),
}));
jest.mock('react-native-webrtc', () => ({
  RTCPeerConnection: jest.fn(),
  RTCSessionDescription: jest.fn(),
  MediaStream: jest.fn(),
  mediaDevices: { getUserMedia: jest.fn() },
}));
jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn().mockResolvedValue({ isConnected: true }),
  addEventListener: jest.fn(() => jest.fn()),
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('../lib/connection');
jest.mock('../lib/login-handler');
jest.mock('../lib/keep-alive-handler');
jest.mock('../lib/call', () => ({
  Call: jest.fn().mockImplementation(() => ({
    callId: 'outbound-call-id',
    invite: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
  })),
}));

const CUSTOM_SERVERS: TelnyxIceServer[] = [{ urls: 'stun:custom.example.com:3478' }];
const PER_CALL_SERVERS: TelnyxIceServer[] = [{ urls: 'stun:per-call.example.com:3478' }];

describe('default ICE servers', () => {
  it('returns the production set by default and the development set on request', () => {
    expect(getDefaultIceServers()).toBe(DEFAULT_PROD_ICE_SERVERS);
    expect(getDefaultIceServers(true)).toBe(DEFAULT_DEV_ICE_SERVERS);
  });

  it('includes a TURNS 443 fallback for restrictive networks', () => {
    expect(DEFAULT_PROD_ICE_SERVERS).toContain(TURN_TLS_443_SERVER);
  });
});

describe('Peer ICE server selection', () => {
  const peerWith = (iceServers?: TelnyxIceServer[]) =>
    new Peer({
      destinationNumber: '+155****4567',
      peerConnectionOptions: iceServers === undefined ? undefined : { iceServers },
    } as any);

  it('falls back to the Telnyx production defaults when none are configured', () => {
    expect(peerWith().getIceServers()).toBe(DEFAULT_PROD_ICE_SERVERS);
  });

  it('uses the configured ICE servers when provided', () => {
    expect(peerWith(CUSTOM_SERVERS).getIceServers()).toBe(CUSTOM_SERVERS);
  });

  it('treats an empty list as unset and uses the defaults', () => {
    expect(peerWith([]).getIceServers()).toBe(DEFAULT_PROD_ICE_SERVERS);
  });
});

describe('client iceServers for outbound calls', () => {
  const CallMock = Call as unknown as jest.Mock;

  const outboundCallIceServers = async (
    clientServers: TelnyxIceServer[] | undefined,
    perCallServers?: TelnyxIceServer[]
  ) => {
    CallMock.mockClear();
    const client = new TelnyxRTC({ login_token: 'token', iceServers: clientServers });
    (client as any).connection = { send: jest.fn() };
    (client as any).sessionId = 'session-id';
    (client as any).addCall = jest.fn();
    (client as any).updateTrackedCallId = jest.fn();

    await client.newCall({
      destinationNumber: '+155****4567',
      ...(perCallServers ? { peerConnectionOptions: { iceServers: perCallServers } } : {}),
    } as any);

    return CallMock.mock.calls[0][0].options.peerConnectionOptions.iceServers;
  };

  it('passes the client-level ICE servers to the call', async () => {
    expect(await outboundCallIceServers(CUSTOM_SERVERS)).toBe(CUSTOM_SERVERS);
  });

  it('lets an explicit per-call override win over the client setting', async () => {
    expect(await outboundCallIceServers(CUSTOM_SERVERS, PER_CALL_SERVERS)).toBe(PER_CALL_SERVERS);
  });

  it('leaves ICE servers unset when neither is configured, so the Peer uses defaults', async () => {
    expect(await outboundCallIceServers(undefined)).toBeUndefined();
  });
});
