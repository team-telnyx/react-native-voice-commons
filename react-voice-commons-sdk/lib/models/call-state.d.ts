/**
 * Represents the state of a call in the Telnyx system.
 *
 * This enum provides a simplified view of call states, abstracting away
 * the complexity of the underlying SIP call states.
 */
export declare enum TelnyxCallState {
  /** Call is being initiated (outgoing) or received (incoming) */
  RINGING = 'RINGING',
  /** Call is connecting after being answered (usually from push notification) */
  CONNECTING = 'CONNECTING',
  /** Call has been answered and media is flowing */
  ACTIVE = 'ACTIVE',
  /** Call is on hold */
  HELD = 'HELD',
  /** Call has ended normally */
  ENDED = 'ENDED',
  /** Call failed to connect or was rejected */
  FAILED = 'FAILED',
  /** Call was dropped due to network issues */
  DROPPED = 'DROPPED',
}
/**
 * Type guard to check if a value is a valid TelnyxCallState
 */
export declare function isTelnyxCallState(value: any): value is TelnyxCallState;
/**
 * Helper functions to determine what actions are available in each state
 */
export declare const CallStateHelpers: {
  /**
   * Can the call be answered in this state?
   */
  canAnswer(state: TelnyxCallState): boolean;
  /**
   * Can the call be hung up in this state?
   */
  canHangup(state: TelnyxCallState): boolean;
  /**
   * Can the call be put on hold in this state?
   */
  canHold(state: TelnyxCallState): boolean;
  /**
   * Can the call be resumed from hold in this state?
   */
  canResume(state: TelnyxCallState): boolean;
  /**
   * Can the call be muted/unmuted in this state?
   */
  canToggleMute(state: TelnyxCallState): boolean;
  /**
   * Is the call in a terminated state?
   */
  isTerminated(state: TelnyxCallState): boolean;
  /**
   * Is the call in an active state (can have media)?
   */
  isActive(state: TelnyxCallState): boolean;
  /**
   * Is the call in a connecting state (answered but not yet active)?
   */
  isConnecting(state: TelnyxCallState): boolean;
};
