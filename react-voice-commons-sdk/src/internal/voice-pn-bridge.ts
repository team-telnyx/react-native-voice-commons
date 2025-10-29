import { NativeModules } from 'react-native';

export interface VoicePnBridgeInterface {
  getPendingPushAction(): Promise<{
    action: string | null;
    metadata: string | null;
  }>;
  setPendingPushAction(action: string, metadata: string): Promise<boolean>;
  clearPendingPushAction(): Promise<boolean>;
  // Additional UserDefaults methods
  getVoipToken(): Promise<string | null>;
  getPendingVoipPush(): Promise<string | null>;
  clearPendingVoipPush(): Promise<boolean>;
  getPendingVoipAction(): Promise<string | null>;
  clearPendingVoipAction(): Promise<boolean>;
}

export const VoicePnBridge: VoicePnBridgeInterface = NativeModules.VoicePnBridge;
