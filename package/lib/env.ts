import * as pkg from '../package.json';
export const DEV_HOST = 'wss://rtcdev.telnyx.com';
export const PROD_HOST = 'wss://rtc.telnyx.com';
export const IS_DEV = process.env.NODE_ENV === 'development';
export const DEFAULT_SDK_VERSION = pkg.version;
export let SDK_VERSION = pkg.version;
export const DEFAULT_SDK_NAME = 'react_native';
export let SDK_NAME = DEFAULT_SDK_NAME;

export function setSDKIdentity(name: string, version: string) {
  SDK_NAME = name;
  SDK_VERSION = version;
}
