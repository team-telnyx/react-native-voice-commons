/**
 * Type definitions for Telnyx React Native Voice SDK
 * This file provides type definitions without importing the actual SDK
 */

declare module '@telnyx/react-native-voice-sdk' {
  import { EventEmitter } from 'eventemitter3';

  export interface CallOptions {
    callerIdName?: string;
    callerIdNumber?: string;
    customHeaders?: Record<string, string>;
    clientState?: string;
    destinationNumber?: string;
    audio?: boolean;
    video?: boolean;
  }

  export interface ClientOptions {
    login?: string;
    password?: string;
    token?: string;
    login_token?: string;
    ringtoneFile?: string;
    ringbackFile?: string;
    debug?: boolean;
    logLevel?: string;
    pushNotificationDeviceToken?: string;
  }

  export enum CallState {
    NEW = 'new',
    CONNECTING = 'connecting',
    RINGING = 'ringing',
    ACTIVE = 'active',
    HELD = 'held',
    HANGUP = 'hangup',
    DESTROY = 'destroy',
    PURGE = 'purge',
  }

  export class Call extends EventEmitter {
    callId: string;
    state: CallState;
    direction: 'inbound' | 'outbound';
    remoteCallerIdName?: string;
    remoteCallerIdNumber?: string;
    localCallerIdName?: string;
    localCallerIdNumber?: string;

    /**
     * Custom headers received from the WebRTC INVITE message.
     * These headers are passed during call initiation and can contain application-specific information.
     * Format should be [{"name": "X-Header-Name", "value": "Value"}] where header names must start with "X-".
     */
    inviteCustomHeaders: { name: string; value: string }[] | null;

    /**
     * Custom headers received from the WebRTC ANSWER message.
     * These headers are passed during call acceptance and can contain application-specific information.
     * Format should be [{"name": "X-Header-Name", "value": "Value"}] where header names must start with "X-".
     */
    answerCustomHeaders: { name: string; value: string }[] | null;

    constructor(options: any);

    answer(customHeaders?: { name: string; value: string }[]): Promise<void>;
    hangup(customHeaders?: { name: string; value: string }[]): Promise<void>;
    hold(): Promise<void>;
    unhold(): Promise<void>;
    mute(): Promise<void>;
    unmute(): Promise<void>;
    dtmf(digits: string): Promise<void>;

    on(event: string, listener: (...args: any[]) => void): this;
    off(event: string, listener: (...args: any[]) => void): this;
    emit(event: string, ...args: any[]): boolean;
  }

  export class TelnyxRTC extends EventEmitter {
    constructor(options: ClientOptions);

    connect(): Promise<void>;
    disconnect(): void;
    newCall(options: CallOptions): Promise<Call>;
    disablePushNotification(): void;

    on(event: string, listener: (...args: any[]) => void): this;
    off(event: string, listener: (...args: any[]) => void): this;
    emit(event: string, ...args: any[]): boolean;
  }

  export { TelnyxRTC as default };
}
