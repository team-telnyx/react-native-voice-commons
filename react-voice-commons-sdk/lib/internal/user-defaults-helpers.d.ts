/**
 * Helper functions that use VoicePnBridge for UserDefaults functionality on iOS
 * These functions provide the same interface as the UserDefaultsModule from main branch
 * but route through the VoicePnBridge instead
 */
export declare function getVoipToken(): Promise<string | null>;
export declare function getPendingVoipPush(): Promise<string | null>;
export declare function clearPendingVoipPush(): Promise<boolean>;
export declare function getPendingVoipAction(): Promise<string | null>;
export declare function clearPendingVoipAction(): Promise<boolean>;
