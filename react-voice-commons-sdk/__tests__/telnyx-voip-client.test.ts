jest.mock('../src/internal/session/session-manager');
jest.mock('../src/internal/calls/call-state-controller');
jest.mock('../src/internal/voice-pn-bridge');

import { TelnyxVoipClient } from '../src/telnyx-voip-client';

describe('TelnyxVoipClient dispose ordering (VSDK-339)', () => {
  it('disposes the SessionManager before the CallStateController', () => {
    const client = new TelnyxVoipClient({ debug: false });

    const smDispose = jest.fn();
    const cscDispose = jest.fn();
    (client as any)._sessionManager.dispose = smDispose;
    (client as any)._callStateController.dispose = cscDispose;

    client.dispose();

    expect(smDispose).toHaveBeenCalledTimes(1);
    expect(cscDispose).toHaveBeenCalledTimes(1);
    // Session/client cleanup must run BEFORE call-state streams are completed
    // so the onDisconnect -> clearAllCalls() callback fires while the
    // controller is still active and observers see cleanup transitions first.
    expect(smDispose.mock.invocationCallOrder[0]).toBeLessThan(
      cscDispose.mock.invocationCallOrder[0]
    );
  });

  it('is idempotent — repeated dispose() does not re-dispose sub-components', () => {
    const client = new TelnyxVoipClient({ debug: false });

    const smDispose = jest.fn();
    const cscDispose = jest.fn();
    (client as any)._sessionManager.dispose = smDispose;
    (client as any)._callStateController.dispose = cscDispose;

    client.dispose();
    client.dispose();

    expect(smDispose).toHaveBeenCalledTimes(1);
    expect(cscDispose).toHaveBeenCalledTimes(1);
  });
});
