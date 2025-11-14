import React from 'react';
import { AppStateStatus } from 'react-native';
import { TelnyxVoipClient } from './telnyx-voip-client';
/**
 * Configuration options for TelnyxVoiceApp
 */
export interface TelnyxVoiceAppOptions {
    /** The TelnyxVoipClient instance to manage */
    voipClient: TelnyxVoipClient;
    /** Optional callback when push notification processing starts */
    onPushNotificationProcessingStarted?: () => void;
    /** Optional callback when push notification processing completes */
    onPushNotificationProcessingCompleted?: () => void;
    /** Optional callback for additional background/foreground handling */
    onAppStateChanged?: (state: AppStateStatus) => void;
    /** Whether to enable automatic login/reconnection (default: true) */
    enableAutoReconnect?: boolean;
    /** Whether to skip web platform for background detection (default: true) */
    skipWebBackgroundDetection?: boolean;
    /** Enable debug logging */
    debug?: boolean;
}
/**
 * Props for the TelnyxVoiceApp component
 */
export interface TelnyxVoiceAppProps extends TelnyxVoiceAppOptions {
    /** The child components to render */
    children: React.ReactNode;
}
/**
 * Interface for the TelnyxVoiceApp component with static methods
 */
export interface TelnyxVoiceAppComponent extends React.FC<TelnyxVoiceAppProps> {
    initializeAndCreate: (options: {
        voipClient: TelnyxVoipClient;
        children: React.ReactNode;
        backgroundMessageHandler?: (message: any) => Promise<void>;
        onPushNotificationProcessingStarted?: () => void;
        onPushNotificationProcessingCompleted?: () => void;
        onAppStateChanged?: (state: AppStateStatus) => void;
        enableAutoReconnect?: boolean;
        skipWebBackgroundDetection?: boolean;
        debug?: boolean;
    }) => Promise<React.ComponentType>;
    handleBackgroundPush: (message: any) => Promise<void>;
}
export declare const TelnyxVoiceApp: TelnyxVoiceAppComponent;
export default TelnyxVoiceApp;
