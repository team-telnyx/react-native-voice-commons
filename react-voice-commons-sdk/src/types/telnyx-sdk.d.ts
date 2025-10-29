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

    constructor(options: any);

    answer(): Promise<void>;
    hangup(): Promise<void>;
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

    on(event: string, listener: (...args: any[]) => void): this;
    off(event: string, listener: (...args: any[]) => void): this;
    emit(event: string, ...args: any[]): boolean;
  }

  export { TelnyxRTC as default };
}
