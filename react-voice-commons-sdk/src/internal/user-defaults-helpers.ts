import { VoicePnBridge } from './voice-pn-bridge';
import { Platform } from 'react-native';

/**
 * Helper functions that use VoicePnBridge for UserDefaults functionality on iOS
 * These functions provide the same interface as the UserDefaultsModule from main branch
 * but route through the VoicePnBridge instead
 */

export async function getVoipToken(): Promise<string | null> {
  if (Platform.OS !== 'ios') return null;
  try {
    return await VoicePnBridge.getVoipToken();
  } catch (error) {
    console.warn('[UserDefaults] getVoipToken error:', error);
    return null;
  }
}

export async function getPendingVoipPush(): Promise<string | null> {
  if (Platform.OS !== 'ios') return null;
  try {
    return await VoicePnBridge.getPendingVoipPush();
  } catch (error) {
    console.warn('[UserDefaults] getPendingVoipPush error:', error);
    return null;
  }
}

export async function clearPendingVoipPush(): Promise<boolean> {
  if (Platform.OS !== 'ios') return true;
  try {
    return await VoicePnBridge.clearPendingVoipPush();
  } catch (error) {
    console.warn('[UserDefaults] clearPendingVoipPush error:', error);
    return false;
  }
}

export async function getPendingVoipAction(): Promise<string | null> {
  if (Platform.OS !== 'ios') return null;
  try {
    return await VoicePnBridge.getPendingVoipAction();
  } catch (error) {
    console.warn('[UserDefaults] getPendingVoipAction error:', error);
    return null;
  }
}

export async function clearPendingVoipAction(): Promise<boolean> {
  if (Platform.OS !== 'ios') return true;
  try {
    return await VoicePnBridge.clearPendingVoipAction();
  } catch (error) {
    console.warn('[UserDefaults] clearPendingVoipAction error:', error);
    return false;
  }
}
