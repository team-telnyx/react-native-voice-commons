import uuid from 'uuid-random';
import { DEFAULT_SDK_IDENTITY, SDK_VERSION, type SDKIdentity } from '../env';

export type LoginUserVariables = {
  push_device_token?: string;
  push_notification_provider?: string;
  push_notification_environment?: string;
  push_when_active?: 'true';
  pn_late_fanout?: 'true';
};

export function createLoginUserVariables({
  pushDeviceToken,
  pushNotificationProvider,
  pushNotificationEnvironment,
  pushWhenActive = false,
}: {
  pushDeviceToken?: string;
  pushNotificationProvider?: string;
  pushNotificationEnvironment?: string;
  pushWhenActive?: boolean;
}): LoginUserVariables {
  const userVariables: LoginUserVariables = {
    push_device_token: pushDeviceToken,
    push_notification_provider: pushNotificationProvider,
    push_notification_environment: pushNotificationEnvironment,
  };

  if (pushWhenActive) {
    userVariables.push_when_active = 'true';
    userVariables.pn_late_fanout = 'true';
  }

  return userVariables;
}

function userAgent(enableMissedCallNotifications: boolean = false, sdkVersion: string = SDK_VERSION) {
  return `ReactNative${enableMissedCallNotifications ? '-mpn' : ''}-${sdkVersion}`;
}

export type LoginWithPasswordParams = {
  login: string;
  password: string;
  reconnection?: boolean;
  attachCall?: boolean;
  fromPush?: boolean;
  enableMissedCallNotifications?: boolean;
  userVariables?: LoginUserVariables;
  sessid?: string;
};

export type LoginWithTokenParams = {
  login_token: string;
  reconnection?: boolean;
  attachCall?: boolean;
  fromPush?: boolean;
  enableMissedCallNotifications?: boolean;
  userVariables?: LoginUserVariables;
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
  enableMissedCallNotifications = false,
  userVariables,
  sessid,
}: LoginWithPasswordParams, sdkIdentity: SDKIdentity = DEFAULT_SDK_IDENTITY) {
  const params: any = {
    userVariables,
    login,
    passwd: password,
    reconnection,
    'User-Agent': userAgent(enableMissedCallNotifications, sdkIdentity.version),
    mobile_sdk_name: sdkIdentity.name,
    mobile_sdk_version: sdkIdentity.version,
  };

  // Add from_push flag if this is a push-initiated connection (matching iOS SDK behavior)
  if (fromPush) {
    params.from_push = true; // Boolean value as shown in iOS SDK example
    console.log('[Login] Adding from_push parameter to login message');
  }

  // Only advertise pending-call attachment for a push or a reconnect that
  // owns calls to reclaim. A fresh login must not ask the gateway to attach
  // calls from an unrelated session.
  if (attachCall) {
    params.loginParams = {
      attach_call: 'true', // iOS SDK uses true.description which converts to string
    };
    console.log('[Login] Adding attach_call parameter to login message');
  }

  // Include an existing session id only when explicitly reattaching or
  // reconnecting that session. Fresh logins must not inherit stale identity.
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
  enableMissedCallNotifications = false,
  sessid,
}: LoginWithTokenParams, sdkIdentity: SDKIdentity = DEFAULT_SDK_IDENTITY) {
  const params: any = {
    userVariables,
    login_token,
    reconnection,
    'User-Agent': userAgent(enableMissedCallNotifications, sdkIdentity.version),
    mobile_sdk_name: sdkIdentity.name,
    mobile_sdk_version: sdkIdentity.version,
  };

  // Add from_push flag if this is a push-initiated connection (matching iOS SDK behavior)
  if (fromPush) {
    params.from_push = true; // Boolean value as shown in iOS SDK example
    console.log('[Login] Adding from_push parameter to token login message');
  }

  // Only advertise pending-call attachment for a push or a reconnect that
  // owns calls to reclaim. A fresh login must not ask the gateway to attach
  // calls from an unrelated session.
  if (attachCall) {
    params.loginParams = {
      attach_call: 'true', // iOS SDK uses true.description which converts to string
    };
    console.log('[Login] Adding attach_call parameter to token login message');
  }

  // Include an existing session id only when explicitly reattaching or
  // reconnecting that session. Fresh logins must not inherit stale identity.
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
