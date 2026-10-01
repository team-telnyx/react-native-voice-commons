import { Call } from '../lib/call';
import type { Connection } from '../lib/connection';

function modifyAnswer(holdState: 'held' | 'active' | 'unheld') {
  return {
    id: 'modify-id',
    jsonrpc: '2.0',
    result: {
      action: holdState === 'held' ? 'hold' : 'unhold',
      callID: 'signaling-call-id',
      holdState,
      sessid: 'session-id',
    },
    voice_sdk_id: 'voice-sdk-id',
  };
}

describe('Call repeated hold and unhold', () => {
  let call: Call;
  let connection: jest.Mocked<Connection>;

  beforeEach(() => {
    connection = {
      addListener: jest.fn(),
      sendAndWait: jest.fn(),
      send: jest.fn(),
    } as any;
    call = new Call({
      connection,
      options: { destinationNumber: '+15551234567' },
      sessionId: 'session-id',
      direction: 'inbound',
      telnyxSessionId: 'telnyx-session-id',
      telnyxLegId: 'telnyx-leg-id',
      callId: 'signaling-call-id',
      callState: 'active',
    });
  });

  it('completes three consecutive hold/unhold cycles', async () => {
    connection.sendAndWait
      .mockResolvedValueOnce(modifyAnswer('held'))
      .mockResolvedValueOnce(modifyAnswer('active'))
      .mockResolvedValueOnce(modifyAnswer('held'))
      .mockResolvedValueOnce(modifyAnswer('active'))
      .mockResolvedValueOnce(modifyAnswer('held'))
      .mockResolvedValueOnce(modifyAnswer('active'));

    for (let cycle = 0; cycle < 3; cycle += 1) {
      await call.hold();
      expect(call.state).toBe('held');
      await call.unhold();
      expect(call.state).toBe('active');
    }
  });

  it('keeps HELD after a failed unhold response and allows a retry', async () => {
    call.state = 'held';
    connection.sendAndWait
      .mockResolvedValueOnce(modifyAnswer('held'))
      .mockResolvedValueOnce(modifyAnswer('active'));

    await expect(call.unhold()).rejects.toThrow('Unhold action failed');
    expect(call.state).toBe('held');

    await expect(call.unhold()).resolves.toBeUndefined();
    expect(call.state).toBe('active');
  });

  it('accepts the legacy unheld response for backwards compatibility', async () => {
    call.state = 'held';
    connection.sendAndWait.mockResolvedValueOnce(modifyAnswer('unheld'));

    await expect(call.unhold()).resolves.toBeUndefined();
    expect(call.state).toBe('active');
  });
});
