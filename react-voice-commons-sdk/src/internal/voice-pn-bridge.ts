import {
  NativeModules,
  NativeEventEmitter,
  DeviceEventEmitter,
  EmitterSubscription,
  Platform,
} from 'react-native';

export interface CallActionEvent {
  action: string;
  callId?: string;
  timestamp: number;
}

export interface PendingPushActionSnapshot {
  action?: string;
  metadata?: string;
  callId?: string;
}

export interface PendingPushActionLookup extends PendingPushActionSnapshot {
  /** True when the native store found a flow for the requested call. */
  found: boolean;
}

export interface ConsumedPushActionSnapshot extends PendingPushActionSnapshot {
  /** True when the native store removed a flow and returned it. */
  consumed: boolean;
}

export interface VoicePnBridgeInterface {
  getPendingPushAction(): Promise<{
    action: string | null;
    metadata: string | null;
    callId?: string | null;
  }>;
  setPendingPushAction(action: string, metadata: string): Promise<boolean>;
  clearPendingPushAction(): Promise<boolean>;

  // Per-call pending push store (Android). Each incoming push owns its own
  // action, metadata and voice_sdk_id so sequential pushes stay isolated.
  getPendingPushActionForCall(callId: string | null): Promise<{
    action: string | null;
    metadata: string | null;
    callId?: string | null;
    found: boolean;
  }>;
  getPendingVoiceSdkIdForCall(callId: string | null): Promise<string | null>;
  hasPendingPushActionForCall(callId: string | null): Promise<boolean>;
  consumePendingPushAction(callId: string | null): Promise<{
    action: string | null;
    metadata: string | null;
    callId?: string | null;
    consumed: boolean;
  }>;
  setPendingPushActionForCall(
    action: string,
    metadata: string,
    callId: string | null
  ): Promise<boolean>;
  clearPendingPushActionForCall(callId: string | null): Promise<boolean>;
  clearAllPendingPushActions(): Promise<boolean>;
  resetPushStateForFreshLogin(): Promise<boolean>;
  completePushFlow(callId: string | null, reason: string | null): Promise<boolean>;
  expireStalePendingPushActions(): Promise<number>;
  getPendingPushState(): Promise<string>;

  // Call action methods (reliable @ReactMethod pattern)
  getPendingCallAction(): Promise<{
    action: string | null;
    callId: string | null;
    timestamp: number | null;
  }>;
  clearPendingCallAction(): Promise<boolean>;

  // Call control methods (Android specific)
  endCall(callId: string | null): Promise<boolean>;
  showOngoingCallNotification(
    callerName: string | null,
    callerNumber: string | null,
    callId: string | null
  ): Promise<boolean>;
  hideOngoingCallNotification(): Promise<boolean>;
  hideIncomingCallNotification(): Promise<boolean>;
  setIncomingCallRingtone(resourceName: string | null): Promise<boolean>;

  // CallKit answer persistence (iOS only)
  getPendingCallKitAnswer(): Promise<string | null>;
  clearPendingCallKitAnswer(): Promise<boolean>;

  // Additional UserDefaults methods
  getVoipToken(): Promise<string | null>;
  getPendingVoipPush(): Promise<string | null>;
  clearPendingVoipPush(): Promise<boolean>;
  clearPendingVoipPushIfMatches(callId: string): Promise<boolean>;
  getPendingVoipAction(): Promise<string | null>;
  clearPendingVoipAction(): Promise<boolean>;
  setMissedCallNotificationsEnabled(enabled: boolean): Promise<boolean>;
  getMissedCallNotificationsEnabled(): Promise<boolean>;
  setSpeakerEnabled(enabled: boolean): Promise<boolean>;
  isSpeakerEnabled(): Promise<boolean>;
}

const NativeBridge: VoicePnBridgeInterface = NativeModules.VoicePnBridge;

/**
 * Enhanced VoicePnBridge with call control and event handling capabilities
 */
export class VoicePnBridge {
  /**
   * Get any pending push notification action from native side
   */
  static async getPendingPushAction(): Promise<PendingPushActionSnapshot> {
    try {
      const result = await NativeBridge.getPendingPushAction();
      return {
        action: result?.action || undefined,
        metadata: result?.metadata || undefined,
        callId: result?.callId || undefined,
      };
    } catch (error) {
      console.error('VoicePnBridge: Error getting pending push action:', error);
      return {};
    }
  }

  /**
   * Set a pending push notification action to native side
   */
  static async setPendingPushAction(action: string, metadata: string): Promise<boolean> {
    try {
      return await NativeBridge.setPendingPushAction(action, metadata);
    } catch (error) {
      console.error('VoicePnBridge: Error setting pending push action:', error);
      return false;
    }
  }

  /**
   * Get any pending call action from native side (reliable polling pattern)
   */
  static async getPendingCallAction(): Promise<{
    action?: string;
    callId?: string;
    timestamp?: number;
  }> {
    try {
      const result = await NativeBridge.getPendingCallAction();
      return {
        action: result?.action || undefined,
        callId: result?.callId || undefined,
        timestamp: result?.timestamp || undefined,
      };
    } catch (error) {
      console.error('VoicePnBridge: Error getting pending call action:', error);
      return {};
    }
  }

  /**
   * Clear any pending call action
   */
  static async clearPendingCallAction(): Promise<boolean> {
    try {
      return await NativeBridge.clearPendingCallAction();
    } catch (error) {
      console.error('VoicePnBridge: Error clearing pending call action:', error);
      return false;
    }
  }

  /**
   * Clear any pending push notification action
   */
  static async clearPendingPushAction(): Promise<boolean> {
    try {
      return await NativeBridge.clearPendingPushAction();
    } catch (error) {
      console.error('VoicePnBridge: Error clearing pending push action:', error);
      return false;
    }
  }

  /**
   * Read the pending push flow that belongs to `callId` without consuming it.
   * Reading is deliberately side-effect free so the push-answer connection can
   * still attach the pending INVITE after the launch read.
   */
  static async getPendingPushActionForCall(callId?: string): Promise<PendingPushActionLookup> {
    if (Platform.OS !== 'android') return { found: false };
    if (!callId) return { found: false };
    try {
      const result = await NativeBridge.getPendingPushActionForCall(callId);
      return {
        action: result?.action || undefined,
        metadata: result?.metadata || undefined,
        callId: result?.callId || callId,
        found: Boolean(result?.found),
      };
    } catch (error) {
      console.error('VoicePnBridge: Error getting pending push action for call:', error);
      return { found: false };
    }
  }

  /**
   * Push-carried voice_sdk_id for one call, or null. Never falls back to
   * another call's push flow.
   */
  static async getPendingVoiceSdkIdForCall(callId?: string): Promise<string | null> {
    if (Platform.OS !== 'android') return null;
    if (!callId) return null;
    try {
      return (await NativeBridge.getPendingVoiceSdkIdForCall(callId)) || null;
    } catch (error) {
      console.error('VoicePnBridge: Error getting pending voice_sdk_id for call:', error);
      return null;
    }
  }

  /**
   * Whether one specific call still owns a pending push flow.
   */
  static async hasPendingPushActionForCall(callId?: string): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    if (!callId) return false;
    try {
      return Boolean(await NativeBridge.hasPendingPushActionForCall(callId));
    } catch (error) {
      console.error('VoicePnBridge: Error checking pending push action for call:', error);
      return false;
    }
  }

  /**
   * Atomically remove and return the push flow for one call. When `callId` is
   * omitted the native side consumes the currently delivered flow.
   */
  static async consumePendingPushAction(callId?: string): Promise<ConsumedPushActionSnapshot> {
    if (Platform.OS !== 'android') return { consumed: false };
    try {
      const result = await NativeBridge.consumePendingPushAction(callId || null);
      return {
        action: result?.action || undefined,
        metadata: result?.metadata || undefined,
        callId: result?.callId || undefined,
        consumed: Boolean(result?.consumed),
      };
    } catch (error) {
      console.error('VoicePnBridge: Error consuming pending push action:', error);
      return { consumed: false };
    }
  }

  /**
   * Scope an action to an explicit call, e.g. when a notification action intent
   * carries a call_id that must not borrow another flow's metadata.
   */
  static async setPendingPushActionForCall(
    action: string,
    metadata: string,
    callId?: string
  ): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    try {
      return await NativeBridge.setPendingPushActionForCall(action, metadata, callId || null);
    } catch (error) {
      console.error('VoicePnBridge: Error setting pending push action for call:', error);
      return false;
    }
  }

  /**
   * Clear only the flow owned by `callId`; other pending pushes survive.
   */
  static async clearPendingPushActionForCall(callId?: string): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    if (!callId) return false;
    try {
      return await NativeBridge.clearPendingPushActionForCall(callId);
    } catch (error) {
      console.error('VoicePnBridge: Error clearing pending push action for call:', error);
      return false;
    }
  }

  /**
   * Clear every pending push flow. Reserved for an explicit fresh session.
   */
  static async clearAllPendingPushActions(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    try {
      return await NativeBridge.clearAllPendingPushActions();
    } catch (error) {
      console.error('VoicePnBridge: Error clearing all pending push actions:', error);
      return false;
    }
  }

  /**
   * Reset the native push store before a fresh (non-reconnecting) login so no
   * previous push's voice_sdk_id or pending-call attach state is reused.
   */
  static async resetPushStateForFreshLogin(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    try {
      return await NativeBridge.resetPushStateForFreshLogin();
    } catch (error) {
      console.error('VoicePnBridge: Error resetting push state for fresh login:', error);
      return false;
    }
  }

  /**
   * Explicit end-of-flow hook for rejection, timeout, failure or cancellation.
   * Only the flow for `callId` is cleared, so a newer sequential push survives.
   */
  static async completePushFlow(callId?: string, reason?: string): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    try {
      return await NativeBridge.completePushFlow(callId || null, reason || null);
    } catch (error) {
      console.error('VoicePnBridge: Error completing push flow:', error);
      return false;
    }
  }

  /**
   * Remove push flows that outlived their handling window.
   */
  static async expireStalePendingPushActions(): Promise<number> {
    if (Platform.OS !== 'android') return 0;
    try {
      return (await NativeBridge.expireStalePendingPushActions()) || 0;
    } catch (error) {
      console.error('VoicePnBridge: Error expiring stale pending push actions:', error);
      return 0;
    }
  }

  /**
   * Diagnostic snapshot of the scoped native push store.
   */
  static async getPendingPushState(): Promise<string | null> {
    if (Platform.OS !== 'android') return null;
    try {
      return (await NativeBridge.getPendingPushState()) || null;
    } catch (error) {
      console.error('VoicePnBridge: Error reading pending push state:', error);
      return null;
    }
  }

  /**
   * React Native → Android: End/hang up the current call
   * This will hide the ongoing call notification and notify the native side
   */
  static async endCall(callId?: string): Promise<boolean> {
    try {
      return await NativeBridge.endCall(callId || null);
    } catch (error) {
      console.error('VoicePnBridge: Error ending call:', error);
      return false;
    }
  }

  /**
   * React Native → Android: Show ongoing call notification to keep app alive
   * Should be called when a call becomes active to prevent background termination
   */
  static async showOngoingCallNotification(
    callerName?: string,
    callerNumber?: string,
    callId?: string
  ): Promise<boolean> {
    try {
      return await NativeBridge.showOngoingCallNotification(
        callerName || null,
        callerNumber || null,
        callId || null
      );
    } catch (error) {
      console.error('VoicePnBridge: Error showing ongoing call notification:', error);
      return false;
    }
  }

  /**
   * React Native → Android: Hide ongoing call notification
   * Should be called when a call ends to clean up notifications
   */
  static async hideOngoingCallNotification(): Promise<boolean> {
    try {
      return await NativeBridge.hideOngoingCallNotification();
    } catch (error) {
      console.error('VoicePnBridge: Error hiding ongoing call notification:', error);
      return false;
    }
  }

  /**
   * React Native → Android: Hide incoming call notification
   * Useful for dismissing notifications when call is answered/rejected in app
   */
  static async hideIncomingCallNotification(): Promise<boolean> {
    try {
      return await NativeBridge.hideIncomingCallNotification();
    } catch (error) {
      console.error('VoicePnBridge: Error hiding incoming call notification:', error);
      return false;
    }
  }

  /**
   * Configure Android's incoming-call ringtone using an app resource in `res/raw`.
   * Pass no value to use the device's default phone ringtone.
   */
  static async setIncomingCallRingtone(resourceName?: string): Promise<boolean> {
    if (Platform.OS !== 'android') return true;
    try {
      return await NativeBridge.setIncomingCallRingtone(resourceName?.trim() || null);
    } catch (error) {
      console.error('VoicePnBridge: Error setting incoming call ringtone:', error);
      return false;
    }
  }

  /**
   * Get pending CallKit answer UUID from native storage (iOS only).
   * When the user answers a CallKit call before JS listeners are ready,
   * the native side persists the answer UUID in UserDefaults so JS can detect it.
   */
  static async getPendingCallKitAnswer(): Promise<string | null> {
    if (Platform.OS !== 'ios') return null;
    try {
      return await NativeBridge.getPendingCallKitAnswer();
    } catch (error) {
      console.error('VoicePnBridge: Error getting pending CallKit answer:', error);
      return null;
    }
  }

  /**
   * Clear pending CallKit answer from native storage (iOS only)
   */
  static async clearPendingCallKitAnswer(): Promise<boolean> {
    if (Platform.OS !== 'ios') return true;
    try {
      return await NativeBridge.clearPendingCallKitAnswer();
    } catch (error) {
      console.error('VoicePnBridge: Error clearing pending CallKit answer:', error);
      return false;
    }
  }

  /**
   * Get VoIP token from native storage
   */
  static async getVoipToken(): Promise<string | null> {
    if (Platform.OS !== 'ios') return null;
    try {
      return await NativeBridge.getVoipToken();
    } catch (error) {
      console.error('VoicePnBridge: Error getting VoIP token:', error);
      return null;
    }
  }

  /**
   * Get pending VoIP push from native storage (iOS only)
   */
  static async getPendingVoipPush(): Promise<string | null> {
    if (Platform.OS !== 'ios') return null;
    try {
      return await NativeBridge.getPendingVoipPush();
    } catch (error) {
      console.error('VoicePnBridge: Error getting pending VoIP push:', error);
      return null;
    }
  }

  /**
   * Clear pending VoIP push from native storage (iOS only)
   */
  static async clearPendingVoipPush(): Promise<boolean> {
    if (Platform.OS !== 'ios') return true;
    try {
      return await NativeBridge.clearPendingVoipPush();
    } catch (error) {
      console.error('VoicePnBridge: Error clearing pending VoIP push:', error);
      return false;
    }
  }

  /**
   * Clear pending VoIP push data only if it still belongs to this call (iOS only).
   * Native checks and deletes in one step, so a newer push for another call survives.
   */
  static async clearPendingVoipPushIfMatches(callId: string): Promise<boolean> {
    if (Platform.OS !== 'ios') return false;
    try {
      return await NativeBridge.clearPendingVoipPushIfMatches(callId);
    } catch (error) {
      console.error('VoicePnBridge: Error clearing matching pending VoIP push:', error);
      return false;
    }
  }

  /**
   * Get pending VoIP action from native storage (iOS only)
   */
  static async getPendingVoipAction(): Promise<string | null> {
    if (Platform.OS !== 'ios') return null;
    try {
      return await NativeBridge.getPendingVoipAction();
    } catch (error) {
      console.error('VoicePnBridge: Error getting pending VoIP action:', error);
      return null;
    }
  }

  /**
   * Clear pending VoIP action from native storage (iOS only)
   */
  static async clearPendingVoipAction(): Promise<boolean> {
    if (Platform.OS !== 'ios') return true;
    try {
      return await NativeBridge.clearPendingVoipAction();
    } catch (error) {
      console.error('VoicePnBridge: Error clearing pending VoIP action:', error);
      return false;
    }
  }

  /**
   * Enable or disable local missed call notifications on iOS.
   * Missed-call VoIP pushes are still handled through CallKit either way.
   */
  static async setMissedCallNotificationsEnabled(enabled: boolean): Promise<boolean> {
    try {
      return await NativeBridge.setMissedCallNotificationsEnabled(enabled);
    } catch (error) {
      console.error('VoicePnBridge: Error setting missed call notifications:', error);
      return false;
    }
  }

  /**
   * Returns true by default, matching the sample-app behavior for missed calls.
   */
  static async getMissedCallNotificationsEnabled(): Promise<boolean> {
    try {
      return await NativeBridge.getMissedCallNotificationsEnabled();
    } catch (error) {
      console.error('VoicePnBridge: Error getting missed call notifications setting:', error);
      return true;
    }
  }

  /**
   * Route call audio through the loudspeaker when enabled, or back to the
   * platform default voice route when disabled.
   */
  static async setSpeakerEnabled(enabled: boolean): Promise<boolean> {
    try {
      return await NativeBridge.setSpeakerEnabled(enabled);
    } catch (error) {
      console.error('VoicePnBridge: Error setting speaker route:', error);
      throw error;
    }
  }

  /**
   * Returns whether the current audio route is using the loudspeaker.
   */
  static async isSpeakerEnabled(): Promise<boolean> {
    try {
      return await NativeBridge.isSpeakerEnabled();
    } catch (error) {
      console.error('VoicePnBridge: Error getting speaker route:', error);
      throw error;
    }
  }

  /**
   * Toggle between loudspeaker and the platform default voice route.
   */
  static async toggleSpeaker(): Promise<boolean> {
    // This is intentionally read-then-write because route changes can also come from
    // the OS, Bluetooth, wired accessories, or the active call session.
    const enabled = await VoicePnBridge.isSpeakerEnabled();
    return VoicePnBridge.setSpeakerEnabled(!enabled);
  }

  /**
   * iOS: Listen for call audio route changes, including those made from the CallKit screen or by
   * connecting an accessory. Does nothing on other platforms.
   *
   * @returns A function that removes the listener.
   */
  static addSpeakerStateListener(listener: (enabled: boolean) => void): () => void {
    const { CallKitBridge } = NativeModules;
    if (Platform.OS !== 'ios' || !CallKitBridge) {
      return () => {};
    }

    const subscription = new NativeEventEmitter(CallKitBridge).addListener(
      'AudioRouteChanged',
      (event: { isSpeakerEnabled: boolean }) => listener(event.isSpeakerEnabled)
    );
    return () => subscription.remove();
  }

  /**
   * Android → React Native: Listen for immediate call action events from notification buttons
   * Use this for active calls where immediate response is needed (e.g., ending ongoing calls)
   */
  static addCallActionListener(listener: (event: CallActionEvent) => void): EmitterSubscription {
    return DeviceEventEmitter.addListener('TelnyxCallAction', listener);
  }

  /**
   * Remove call action listener
   */
  static removeCallActionListener(subscription: EmitterSubscription): void {
    subscription.remove();
  }

  /**
   * Remove all call action listeners
   */
  static removeAllCallActionListeners(): void {
    DeviceEventEmitter.removeAllListeners('TelnyxCallAction');
  }
}

// Export the native bridge for direct access if needed
export { NativeBridge as VoicePnBridgeNative };

// ===========================================================================
// Push-flow helpers
//
// These keep the Android push flow scoped to the call that owns it. Reading a
// launch push must not consume it (the push-answer connection still needs the
// metadata to attach the pending INVITE), and ending one flow must never clear
// a newer sequential push that arrived in the meantime.
// ===========================================================================

/**
 * Push data that a wake/launch path hands to `TelnyxVoipClient`.
 *
 * `callId` is carried explicitly so every later cleanup can target exactly the
 * flow this push owns instead of whichever flow happens to be current.
 */
export interface WakePushData {
  action: string;
  metadata: any;
  from_notification: true;
  callId?: string;
}

const TERMINAL_PUSH_ACTIONS = new Set(['reject', 'decline', 'hangup', 'end', 'endCall']);

/**
 * Metadata can arrive as an object or as a JSON string depending on the push
 * provider. Parse it to an object when possible without throwing.
 */
export function parsePushMetadata(metadata: unknown): any {
  if (typeof metadata !== 'string') {
    return metadata;
  }

  try {
    return JSON.parse(metadata);
  } catch {
    return metadata;
  }
}

/**
 * Resolve the call a push payload belongs to, either from an explicit
 * `callId` or from `metadata.call_id`.
 */
export function extractPushCallId(
  payload: Record<string, any> | null | undefined
): string | undefined {
  if (!payload) {
    return undefined;
  }

  if (typeof payload.callId === 'string' && payload.callId) {
    return payload.callId;
  }

  const metadata = parsePushMetadata(payload.metadata);
  if (metadata && typeof metadata === 'object') {
    const metadataCallId = metadata.call_id;
    if (typeof metadataCallId === 'string' && metadataCallId) {
      return metadataCallId;
    }
  }

  if (typeof payload.call_id === 'string' && payload.call_id) {
    return payload.call_id;
  }

  return undefined;
}

/**
 * Convert a native pending-action snapshot into the wake payload consumed by
 * `handlePushNotification`, preserving the call scope.
 */
export function toWakePushData(snapshot: PendingPushActionSnapshot): WakePushData | null {
  if (!snapshot?.action || snapshot.metadata == null) {
    return null;
  }

  const metadata = parsePushMetadata(snapshot.metadata);
  const callId = snapshot.callId || extractPushCallId({ metadata });

  return {
    action: snapshot.action,
    metadata,
    from_notification: true,
    callId,
  };
}

/**
 * Read the launch push without consuming it.
 *
 * Reading one call's flow must not clear another call's pending push, and it
 * must not clear this flow either: the push-answer connection still needs the
 * metadata to attach the pending INVITE. Completion/rejection/failure clears
 * it through `completeAndroidPushFlow`.
 */
export async function readPendingAndroidPush(
  bridge: Pick<
    typeof VoicePnBridge,
    'getPendingPushAction' | 'getPendingPushActionForCall' | 'getPendingVoiceSdkIdForCall'
  > = VoicePnBridge
): Promise<WakePushData | null> {
  const pending = await bridge.getPendingPushAction();
  const wake = toWakePushData(pending);
  if (!wake) {
    return null;
  }

  let resolved = wake;

  if (wake.callId) {
    // Re-read the flow scoped to its own call. This keeps a newer sequential
    // push from being selected as "current" and confirms the metadata belongs
    // to the call we are about to connect for.
    const scoped = await bridge.getPendingPushActionForCall(wake.callId);
    if (scoped?.found) {
      const scopedWake = toWakePushData({
        action: scoped.action,
        metadata: scoped.metadata,
        callId: scoped.callId || wake.callId,
      });
      if (scopedWake) {
        resolved = scopedWake;
      }
    }
  }

  // Ensure the connection is stamped with the voice_sdk_id that belongs to
  // this call's push, even if the metadata lost it on the way through.
  const { callId, metadata } = resolved;
  if (callId && metadata && typeof metadata === 'object' && !metadata.voice_sdk_id) {
    const scopedVoiceSdkId = await bridge.getPendingVoiceSdkIdForCall(callId);
    if (scopedVoiceSdkId) {
      return { ...resolved, metadata: { ...metadata, voice_sdk_id: scopedVoiceSdkId } };
    }
  }

  return resolved;
}

/**
 * End the push flow for one call after its terminal outcome. Only that call's
 * flow is removed, so a sequential push that arrived in the meantime survives.
 */
export async function completeAndroidPushFlow(
  payload: Record<string, any> | null | undefined,
  reason: string
): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return false;
  }

  return VoicePnBridge.completePushFlow(extractPushCallId(payload), reason);
}

/**
 * Whether an action ends the push flow rather than leaving a call to attach.
 */
export function isTerminalPushAction(action?: string): boolean {
  return typeof action === 'string' && TERMINAL_PUSH_ACTIONS.has(action);
}
