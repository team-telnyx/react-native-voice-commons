import { TelnyxRTC } from '../lib/client';
import { Call } from '../lib/call';
import { createAttachCallMessage, createAttachMessage } from '../lib/messages/attach';
import { createAnswerMessage, createInviteMessage } from '../lib/messages/call';
import { createPasswordLoginMessage, createTokenLoginMessage } from '../lib/messages/login';

const coreIdentity = { mobile_sdk_name: 'webrtc-react-native', mobile_sdk_version: '1.1.0' };

describe('mobile SDK identity signaling', () => {
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
    const message = createTokenLoginMessage(
      { login_token: 'token' },
      { name: 'webrtc-react-native-commons', version: '2.3.4' }
    );
    expect(message.params).toEqual(
      expect.objectContaining({
        mobile_sdk_name: 'webrtc-react-native-commons',
        mobile_sdk_version: '2.3.4',
        'User-Agent': 'ReactNative-2.3.4',
      })
    );
  });

  it('keeps identity isolated between client instances', () => {
    const commons = new TelnyxRTC({
      login_token: 'commons',
      sdkName: 'webrtc-react-native-commons',
      sdkVersion: '2.3.4',
    });
    const core = new TelnyxRTC({ login_token: 'core' });

    expect((commons as any).sdkIdentity).toEqual({
      name: 'webrtc-react-native-commons',
      version: '2.3.4',
    });
    expect((core as any).sdkIdentity).toEqual({ name: 'webrtc-react-native', version: '1.1.0' });
  });

  it('uses the per-client SDK version in call reports', () => {
    const call = new Call({
      connection: {
        addListener: jest.fn(),
        removeListener: jest.fn(),
      } as any,
      options: { destinationNumber: '18005550100' },
      sessionId: 'session',
      direction: 'outbound',
      callId: 'call',
      telnyxLegId: null,
      telnyxSessionId: null,
      sdkIdentity: { name: 'webrtc-react-native-commons', version: '2.3.4' },
    });

    expect((call as any).buildReportSummary('active').sdkVersion).toBe('2.3.4');
  });

  it('rejects partial identity overrides', () => {
    expect(() => new TelnyxRTC({ login_token: 'token', sdkName: 'webrtc-react-native-commons' })).toThrow(
      'sdkName and sdkVersion must be provided together'
    );
    expect(() => new TelnyxRTC({ login_token: 'token', sdkVersion: '2.3.4' })).toThrow(
      'sdkName and sdkVersion must be provided together'
    );
  });
});
