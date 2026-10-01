import { createAnswerMessage } from '../lib/messages/call';
import {
  createLoginUserVariables,
  createPasswordLoginMessage,
  createTokenLoginMessage,
} from '../lib/messages/login';

describe('push-when-active signaling', () => {
  it.each(['password', 'token'])(
    'adds active push routing flags to %s login userVariables',
    (loginType) => {
      const userVariables = createLoginUserVariables({
        pushDeviceToken: 'push-token',
        pushNotificationProvider: 'ios',
        pushNotificationEnvironment: 'debug',
        pushWhenActive: true,
      });
      const message =
        loginType === 'password'
          ? createPasswordLoginMessage({
              login: 'sip-user',
              password: 'sip-password',
              userVariables,
            })
          : createTokenLoginMessage({
              login_token: 'credential-token',
              userVariables,
            });

      expect(message.params.userVariables).toEqual(
        expect.objectContaining({
          push_device_token: 'push-token',
          push_when_active: 'true',
          pn_late_fanout: 'true',
        })
      );
    }
  );

  it('omits active push routing flags by default', () => {
    const userVariables = createLoginUserVariables({
      pushDeviceToken: 'push-token',
      pushNotificationProvider: 'ios',
      pushNotificationEnvironment: 'debug',
    });
    const message = createPasswordLoginMessage({
      login: 'sip-user',
      password: 'sip-password',
      userVariables,
    });

    expect(message.params.userVariables).not.toHaveProperty('push_when_active');
    expect(message.params.userVariables).not.toHaveProperty('pn_late_fanout');
  });

  it('identifies the answering PushKit device only when opted in', () => {
    const baseParams = {
      callId: 'call-id',
      dialogParams: {},
      sdp: 'answer-sdp',
      telnyxLegId: 'leg-id',
      telnyxSessionId: 'telnyx-session-id',
      sessionId: 'session-id',
    };

    const enabled = createAnswerMessage({
      ...baseParams,
      pushWhenActive: true,
      pushDeviceToken: 'push-token',
    });
    const disabled = createAnswerMessage({
      ...baseParams,
      pushWhenActive: false,
      pushDeviceToken: 'push-token',
    });
    const blankToken = createAnswerMessage({
      ...baseParams,
      pushWhenActive: true,
      pushDeviceToken: '   ',
    });

    expect(enabled.params.answered_device_token).toBe('push-token');
    expect(disabled.params).not.toHaveProperty('answered_device_token');
    expect(blankToken.params).not.toHaveProperty('answered_device_token');
  });
});
