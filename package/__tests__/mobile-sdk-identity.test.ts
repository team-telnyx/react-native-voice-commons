import { TelnyxRTC } from '../lib/client';
import { setSDKIdentity } from '../lib/env';
import { createAttachCallMessage, createAttachMessage } from '../lib/messages/attach';
import { createAnswerMessage, createInviteMessage } from '../lib/messages/call';
import { createPasswordLoginMessage, createTokenLoginMessage } from '../lib/messages/login';

const coreIdentity = { mobile_sdk_name: 'react_native', mobile_sdk_version: '1.1.0' };

describe('mobile SDK identity signaling', () => {
  beforeEach(() => setSDKIdentity('react_native', '1.1.0'));

  const expectCoreIdentity = (message: { params: Record<string, unknown> }) => {
    expect(message.params).toEqual(expect.objectContaining(coreIdentity));
  };

  it('serializes core identity on password and token login', () => {
    expectCoreIdentity(createPasswordLoginMessage({ login: 'user', password: 'secret' }));
    expectCoreIdentity(createTokenLoginMessage({ login_token: 'token' }));
  });

  it('serializes core identity on invite, answer, attach, and attach calls', () => {
    expectCoreIdentity(
      createInviteMessage({
        sessionId: 'session',
        sdp: 'sdp',
        attach: false,
        callId: 'call',
        callOptions: { destinationNumber: '18005550100' },
      })
    );
    expectCoreIdentity(
      createAnswerMessage({
        dialogParams: {},
        sdp: 'sdp',
        sessionId: 'session',
        callId: 'call',
        telnyxLegId: 'leg',
        telnyxSessionId: 'telnyx-session',
      })
    );
    expectCoreIdentity(createAttachMessage({ callId: 'call', sessionId: 'session', sdp: 'sdp' }));
    expectCoreIdentity(createAttachCallMessage());
  });

  it('applies wrapper identity atomically without changing User-Agent format', () => {
    setSDKIdentity('react_native_commons', '2.3.4');
    const message = createTokenLoginMessage({ login_token: 'token' });
    expect(message.params).toEqual(
      expect.objectContaining({
        mobile_sdk_name: 'react_native_commons',
        mobile_sdk_version: '2.3.4',
        'User-Agent': 'ReactNative-2.3.4',
      })
    );
  });

  it('rejects partial identity overrides', () => {
    expect(() => new TelnyxRTC({ login_token: 'token', sdkName: 'react_native_commons' })).toThrow(
      'sdkName and sdkVersion must be provided together'
    );
    expect(() => new TelnyxRTC({ login_token: 'token', sdkVersion: '2.3.4' })).toThrow(
      'sdkName and sdkVersion must be provided together'
    );
  });
});
