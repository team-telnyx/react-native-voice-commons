import * as pkg from '../package.json';
export const DEV_HOST = 'wss://rtcdev.telnyx.com';
export const PROD_HOST = 'wss://rtc.telnyx.com';
export const IS_DEV = process.env.NODE_ENV === 'development';
export const DEFAULT_SDK_VERSION = pkg.version;
export const SDK_VERSION = pkg.version;
export const DEFAULT_SDK_NAME = 'react_native';
export const SDK_NAME = DEFAULT_SDK_NAME;

export type SDKIdentity = Readonly<{ name: string; version: string }>;
export const DEFAULT_SDK_IDENTITY: SDKIdentity = Object.freeze({
  name: DEFAULT_SDK_NAME,
  version: DEFAULT_SDK_VERSION,
});
