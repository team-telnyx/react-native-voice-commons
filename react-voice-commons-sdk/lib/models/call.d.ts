import { Observable } from 'rxjs';
import { TelnyxCallState } from './call-state';
import { Call as TelnyxCall } from '@telnyx/react-native-voice-sdk';
/**
 * Represents a call with reactive state streams.
 *
 * This class wraps the underlying Telnyx Call object and provides
 * reactive streams for all call state changes, making it easy to
 * integrate with any state management solution.
 */
export declare class Call {
    private readonly _telnyxCall;
    private readonly _callId;
    private readonly _destination;
    private readonly _isIncoming;
    private readonly _callState;
    private readonly _isMuted;
    private readonly _isHeld;
    private readonly _duration;
    private _durationTimer?;
    private _startTime?;
    constructor(_telnyxCall: TelnyxCall, _callId: string, _destination: string, _isIncoming: boolean);
    /**
     * Unique identifier for this call
     */
    get callId(): string;
    /**
     * The destination number or SIP URI
     */
    get destination(): string;
    /**
     * Whether this is an incoming call
     */
    get isIncoming(): boolean;
    /**
     * Whether this is an outgoing call
     */
    get isOutgoing(): boolean;
    /**
     * Current call state (synchronous access)
     */
    get currentState(): TelnyxCallState;
    /**
     * Current mute state (synchronous access)
     */
    get currentIsMuted(): boolean;
    /**
     * Current hold state (synchronous access)
     */
    get currentIsHeld(): boolean;
    /**
     * Current call duration in seconds (synchronous access)
     */
    get currentDuration(): number;
    /**
     * Get the underlying Telnyx Call object (for internal use)
     * @internal
     */
    get telnyxCall(): TelnyxCall;
    /**
     * Observable stream of call state changes
     */
    get callState$(): Observable<TelnyxCallState>;
    /**
     * Observable stream of mute state changes
     */
    get isMuted$(): Observable<boolean>;
    /**
     * Observable stream of hold state changes
     */
    get isHeld$(): Observable<boolean>;
    /**
     * Observable stream of call duration changes (in seconds)
     */
    get duration$(): Observable<number>;
    /**
     * Observable that emits true when the call can be answered
     */
    get canAnswer$(): Observable<boolean>;
    /**
     * Observable that emits true when the call can be hung up
     */
    get canHangup$(): Observable<boolean>;
    /**
     * Observable that emits true when the call can be put on hold
     */
    get canHold$(): Observable<boolean>;
    /**
     * Observable that emits true when the call can be resumed from hold
     */
    get canResume$(): Observable<boolean>;
    /**
     * Answer the incoming call
     * @param customHeaders Optional custom headers to include with the answer
     */
    answer(customHeaders?: {
        name: string;
        value: string;
    }[]): Promise<void>;
    /**
     * Hang up the call
     * @param customHeaders Optional custom headers to include with the hangup request
     */
    hangup(customHeaders?: {
        name: string;
        value: string;
    }[]): Promise<void>;
    /**
     * Put the call on hold
     */
    hold(): Promise<void>;
    /**
     * Resume the call from hold
     */
    resume(): Promise<void>;
    /**
     * Mute the call
     */
    mute(): Promise<void>;
    /**
     * Unmute the call
     */
    unmute(): Promise<void>;
    /**
     * Toggle mute state
     */
    toggleMute(): Promise<void>;
    /**
     * Set the call to connecting state (used for push notification calls when answered via CallKit)
     * @internal
     */
    setConnecting(): void;
    /**
     * Clean up resources when the call is disposed
     */
    dispose(): void;
    /**
     * Set up listeners for the underlying Telnyx call
     */
    private _setupCallListeners;
    /**
     * Map Telnyx SDK call states to our simplified call states
     */
    private _mapToTelnyxCallState;
    /**
     * Start the duration timer
     */
    private _startDurationTimer;
    /**
     * Stop the duration timer
     */
    private _stopDurationTimer;
}
