import { Observable } from 'rxjs';
import { Call } from '../../models/call';
import { SessionManager } from '../session/session-manager';
/**
 * Central state machine for call management.
 *
 * This class manages all active calls, handles call state transitions,
 * and provides reactive streams for call-related state changes.
 */
export declare class CallStateController {
  private readonly _sessionManager;
  private readonly _calls;
  private readonly _callMap;
  private _disposed;
  private _isWaitingForInvite?;
  private _onInviteAutoAccepted?;
  constructor(_sessionManager: SessionManager);
  /**
   * Observable stream of all current calls
   */
  get calls$(): Observable<Call[]>;
  /**
   * Observable stream of the currently active call
   */
  get activeCall$(): Observable<Call | null>;
  /**
   * Current list of calls (synchronous access)
   */
  get currentCalls(): Call[];
  /**
   * Current active call (synchronous access)
   */
  get currentActiveCall(): Call | null;
  /**
   * Set a call to connecting state (used for push notification calls when answered via CallKit)
   * @param callId The ID of the call to set to connecting state
   */
  setCallConnecting(callId: string): void;
  /**
   * Find a call by its underlying Telnyx call ID
   * @param telnyxCall The Telnyx call object to find
   */
  findCallByTelnyxCall(telnyxCall: any): Call | null;
  /**
   * Initialize client listeners when the Telnyx client becomes available
   * This should be called by the session manager after client creation
   */
  initializeClientListeners(): void;
  /**
   * Initiate a new outgoing call
   */
  newCall(
    destination: string,
    callerName?: string,
    callerNumber?: string,
    debug?: boolean
  ): Promise<Call>;
  /**
   * Set callbacks for waiting for invite logic (used for push notifications)
   */
  setWaitingForInviteCallbacks(callbacks: {
    isWaitingForInvite: () => boolean;
    onInviteAutoAccepted: () => void;
  }): void;
  /**
   * Dispose of the controller and clean up resources
   */
  dispose(): void;
  /**
   * Set up event listeners for the Telnyx client
   */
  private _setupClientListeners;
  /**
   * Handle incoming call
   */
  private _handleIncomingCall;
  /**
   * Handle call state changes from the Telnyx client
   */
  private _handleCallStateChange;
  /**
   * Handle call updates from notifications
   */
  private _handleCallUpdate;
  /**
   * Add a call to our tracking
   */
  private _addCall;
  /**
   * Remove a call from our tracking
   */
  private _removeCall;
  /**
   * Generate a unique call ID
   */
  private _generateCallId;
}
