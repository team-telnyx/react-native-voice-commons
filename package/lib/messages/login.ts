import uuid from 'uuid-random';
import { SDK_VERSION } from '../env';

export type LoginWithPasswordParams = {
  login: string;
  password: string;
  reconnection?: boolean;
  attachCall?: boolean;
  fromPush?: boolean;
  userVariables?: {
    push_device_token?: string;
    push_notification_provider?: string;
  };
};

export type LoginWithTokenParams = {
  login_token: string;
  reconnection?: boolean;
  attachCall?: boolean;
  fromPush?: boolean;
  userVariables?: {
    push_device_token?: string;
    push_notification_provider?: string;
  };
};

export type LoginSuccessResponse = {
  id: string;
  result: {
    message: string;
    sessid: string;
  };
  voice_sdk_id: string;
};

export function createPasswordLoginMessage({
  login,
  password,
  reconnection = false,
  attachCall = false,
  fromPush = false,
  userVariables,
}: LoginWithPasswordParams) {
  const params: any = {
    userVariables,
    login,
    passwd: password,
    reconnection,
    'User-Agent': {
      sdkVersion: SDK_VERSION,
      platform: 'react-native',
    },
  };

  // Add from_push flag if this is a push-initiated connection (matching iOS SDK behavior)
  if (fromPush) {
    params.from_push = true; // Boolean value as shown in iOS SDK example
    console.log('[Login] Adding from_push parameter to login message');
  }

  // Add loginParams with attach_call if specified (matching iOS SDK behavior)
  if (attachCall) {
    params.loginParams = {
      attach_call: 'true', // iOS SDK uses true.description which converts to string
    };
    console.log('[Login] Adding attach_call parameter to login message');
  }

  return {
    id: uuid(),
    jsonrpc: '2.0',
    method: 'login',
    params,
  };
}

export function createTokenLoginMessage({
  login_token,
  userVariables,
  reconnection = false,
  attachCall = false,
  fromPush = false,
}: LoginWithTokenParams) {
  const params: any = {
    userVariables,
    login_token,
    reconnection,
    'User-Agent': {
      sdkVersion: SDK_VERSION,
      platform: 'react-native',
    },
  };

  // Add from_push flag if this is a push-initiated connection (matching iOS SDK behavior)
  if (fromPush) {
    params.from_push = true; // Boolean value as shown in iOS SDK example
    console.log('[Login] Adding from_push parameter to token login message');
  }

  // Add loginParams with attach_call if specified (matching iOS SDK behavior)
  if (attachCall) {
    params.loginParams = {
      attach_call: 'true', // iOS SDK uses true.description which converts to string
    };
    console.log('[Login] Adding attach_call parameter to token login message');
  }

  return {
    id: uuid(),
    jsonrpc: '2.0',
    method: 'login',
    params,
  };
}

export function isLoginSuccessResponse(response: unknown): response is LoginSuccessResponse {
  if (!response) {
    return false;
  }

  const temp = response as Partial<LoginSuccessResponse>;
  return !!temp.result?.message && !!temp.result?.sessid && temp.result.message === 'logged in';
}
