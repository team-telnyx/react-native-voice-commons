import * as pkg from '../package.json';
export const DEV_HOST = 'wss://rtcdev.telnyx.com';
export const PROD_HOST = 'wss://rtc.telnyx.com';
export const IS_DEV = process.env.NODE_ENV === 'development';
export const SDK_VERSION = pkg.version;
