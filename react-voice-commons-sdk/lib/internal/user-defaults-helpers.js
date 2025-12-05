'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.getVoipToken = getVoipToken;
exports.getPendingVoipPush = getPendingVoipPush;
exports.clearPendingVoipPush = clearPendingVoipPush;
exports.getPendingVoipAction = getPendingVoipAction;
exports.clearPendingVoipAction = clearPendingVoipAction;
const voice_pn_bridge_1 = require('./voice-pn-bridge');
const react_native_1 = require('react-native');
/**
 * Helper functions that use VoicePnBridge for UserDefaults functionality on iOS
 * These functions provide the same interface as the UserDefaultsModule from main branch
 * but route through the VoicePnBridge instead
 */
async function getVoipToken() {
  if (react_native_1.Platform.OS !== 'ios') return null;
  try {
    return await voice_pn_bridge_1.VoicePnBridge.getVoipToken();
  } catch (error) {
    console.warn('[UserDefaults] getVoipToken error:', error);
    return null;
  }
}
async function getPendingVoipPush() {
  if (react_native_1.Platform.OS !== 'ios') return null;
  try {
    return await voice_pn_bridge_1.VoicePnBridge.getPendingVoipPush();
  } catch (error) {
    console.warn('[UserDefaults] getPendingVoipPush error:', error);
    return null;
  }
}
async function clearPendingVoipPush() {
  if (react_native_1.Platform.OS !== 'ios') return true;
  try {
    return await voice_pn_bridge_1.VoicePnBridge.clearPendingVoipPush();
  } catch (error) {
    console.warn('[UserDefaults] clearPendingVoipPush error:', error);
    return false;
  }
}
async function getPendingVoipAction() {
  if (react_native_1.Platform.OS !== 'ios') return null;
  try {
    return await voice_pn_bridge_1.VoicePnBridge.getPendingVoipAction();
  } catch (error) {
    console.warn('[UserDefaults] getPendingVoipAction error:', error);
    return null;
  }
}
async function clearPendingVoipAction() {
  if (react_native_1.Platform.OS !== 'ios') return true;
  try {
    return await voice_pn_bridge_1.VoicePnBridge.clearPendingVoipAction();
  } catch (error) {
    console.warn('[UserDefaults] clearPendingVoipAction error:', error);
    return false;
  }
}
