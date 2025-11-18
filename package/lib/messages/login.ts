import uuid from 'uuid-random';
import { SDK_VERSION } from '../env';
import { Platform } from 'react-native';

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
  sessid?: string;
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
  sessid?: string;
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
  sessid,
}: LoginWithPasswordParams) {
  const params: any = {
    userVariables,
    login,
    passwd: password,
    reconnection,
  'User-Agent': `${Platform.OS === 'android' ? 'Android' : 'iOS'}-${SDK_VERSION}`,
  };

  // Add from_push flag if this is a push-initiated connection (matching iOS SDK behavior)
  if (fromPush) {
    params.from_push = true; // Boolean value as shown in iOS SDK example
    console.log('[Login] Adding from_push parameter to login message');
  }

  // Always create loginParams since we always include attach_call
  params.loginParams = {
    attach_call: 'true', // iOS SDK uses true.description which converts to string
  };
  console.log('[Login] Adding attach_call parameter to login message');

  // Include existing session id when provided (useful for reconnection scenarios)
  if (sessid) {
    params.sessid = sessid;
    console.log('[Login] Including existing sessid in params:', sessid);
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
  sessid,
}: LoginWithTokenParams) {
  const params: any = {
    userVariables,
    login_token,
    reconnection,
    'User-Agent': `ReactNative-${SDK_VERSION}`,
  };

  // Add from_push flag if this is a push-initiated connection (matching iOS SDK behavior)
  if (fromPush) {
    params.from_push = true; // Boolean value as shown in iOS SDK example
    console.log('[Login] Adding from_push parameter to token login message');
  }

  // Always create loginParams since we always include attach_call
  params.loginParams = {
    attach_call: 'true', // iOS SDK uses true.description which converts to string
  };
  console.log('[Login] Adding attach_call parameter to token login message');

  if (sessid) {
    params.sessid = sessid;
    console.log('[Login] Including existing sessid in token login params:', sessid);
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
