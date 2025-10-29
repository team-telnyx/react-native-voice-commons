import { Observable } from 'rxjs';
import { TelnyxConnectionState } from './models/connection-state';
import { Call } from './models/call';
import { CredentialConfig, TokenConfig } from './models/config';
/**
 * Configuration options for TelnyxVoipClient
 */
export interface TelnyxVoipClientOptions {
    /** Enable automatic app state management (background/foreground behavior) - default: true */
    enableAppStateManagement?: boolean;
    /** Enable debug logging */
    debug?: boolean;
}
/**
 * The main public interface for the react-voice-commons module.
 *
 * This class serves as the Façade for the entire module, providing a simplified
 * API that completely hides the underlying complexity. It is the sole entry point
 * for developers using the react-voice-commons package.
 *
 * The TelnyxVoipClient is designed to be state-management agnostic, exposing
 * all observable state via RxJS streams. This allows developers to integrate it
 * into their chosen state management solution naturally.
 */
export declare class TelnyxVoipClient {
    private readonly _sessionManager;
    private readonly _callStateController;
    private readonly _options;
    private _disposed;
    /**
     * Creates a new TelnyxVoipClient instance.
     *
     * @param options Configuration options for the client
     */
    constructor(options?: TelnyxVoipClientOptions);
    /**
     * Stream of connection state changes.
     *
     * Emits the current status of the connection to the Telnyx backend.
     * Values include connecting, connected, disconnected, and error states.
     * Listen to this to show connection indicators in your UI.
     */
    get connectionState$(): Observable<TelnyxConnectionState>;
    /**
     * Stream of all current calls.
     *
     * Emits a list of all current Call objects. Use this for applications
     * that need to support multiple simultaneous calls (e.g., call waiting,
     * conference calls).
     */
    get calls$(): Observable<Call[]>;
    /**
     * Stream of the currently active call.
     *
     * A convenience stream that emits the currently active Call object.
     * It emits null when no call is in progress. Ideal for applications
     * that only handle a single call at a time.
     */
    get activeCall$(): Observable<Call | null>;
    /**
     * Current connection state (synchronous access).
     */
    get currentConnectionState(): TelnyxConnectionState;
    /**
     * Current list of calls (synchronous access).
     */
    get currentCalls(): Call[];
    /**
     * Current active call (synchronous access).
     */
    get currentActiveCall(): Call | null;
    /**
     * Current session ID (UUID) for this connection.
     */
    get sessionId(): string;
    /**
     * Configuration options for this client instance.
     */
    get options(): Required<TelnyxVoipClientOptions>;
    /**
     * Connects to the Telnyx platform using credential authentication.
     *
     * @param config The credential configuration containing SIP username and password
     * @returns A Promise that completes when the connection attempt is initiated
     *
     * Listen to connectionState$ to monitor the actual connection status.
     */
    login(config: CredentialConfig): Promise<void>;
    /**
     * Connects to the Telnyx platform using token authentication.
     *
     * @param config The token configuration containing the authentication token
     * @returns A Promise that completes when the connection attempt is initiated
     *
     * Listen to connectionState$ to monitor the actual connection status.
     */
    loginWithToken(config: TokenConfig): Promise<void>;
    /**
     * Disconnects from the Telnyx platform.
     *
     * This method terminates the connection, ends any active calls, and
     * cleans up all related resources.
     */
    logout(): Promise<void>;
    /**
     * Attempts to reconnect using previously stored configuration.
     *
     * This method is used for auto-reconnection scenarios where the app
     * comes back to the foreground and needs to restore the connection.
     *
     * @returns Promise<boolean> - true if reconnection was successful, false otherwise
     */
    loginFromStoredConfig(): Promise<boolean>;
    /**
     * Initiates a new outgoing call.
     *
     * @param destination The destination number or SIP URI to call
     * @param debug Optional flag to enable call quality metrics for this call
     * @returns A Promise that completes with the Call object once the invitation has been sent
     *
     * The call's state can be monitored through the returned Call object's streams.
     */
    newCall(destination: string, debug?: boolean): Promise<Call>;
    /**
     * Handle push notification payload.
     *
     * This is the unified entry point for all push notifications. It intelligently
     * determines whether to show a new incoming call UI or to process an already
     * actioned (accepted/declined) call upon app launch.
     *
     * @param payload The push notification payload
     */
    handlePushNotification(payload: Record<string, any>): Promise<void>;
    /**
     * Disables push notifications for the current session.
     *
     * This method sends a request to the Telnyx backend to disable push
     * notifications for the current registered device/session.
     */
    disablePushNotifications(): void;
    /**
     * Set a call to connecting state (used for push notification calls when answered via CallKit)
     * @param callId The ID of the call to set to connecting state
     * @internal
     */
    setCallConnecting(callId: string): void;
    /**
     * Find a call by its underlying Telnyx call object
     * @param telnyxCall The Telnyx call object to find
     * @internal
     */
    findCallByTelnyxCall(telnyxCall: any): Call | null;
    /**
     * Queue an answer action for when the call invite arrives (for CallKit integration)
     * This should be called when the user answers from CallKit before the socket connection is established
     * @param customHeaders Optional custom headers to include with the answer
     */
    queueAnswerFromCallKit(customHeaders?: Record<string, string>): void;
    /**
     * Queue an end action for when the call invite arrives (for CallKit integration)
     * This should be called when the user ends from CallKit before the socket connection is established
     */
    queueEndFromCallKit(): void;
    /**
     * Dispose of the client and clean up all resources.
     *
     * After calling this method, the client instance should not be used anymore.
     * This is particularly important for background clients that should be
     * disposed after handling push notifications.
     */
    dispose(): void;
    /**
     * Throw an error if the client has been disposed
     */
    private _throwIfDisposed;
}
/**
 * Create a new TelnyxVoipClient instance for normal app usage
 */
export declare function createTelnyxVoipClient(options?: TelnyxVoipClientOptions): TelnyxVoipClient;
/**
 * Create a new TelnyxVoipClient instance for background push notification handling
 */
export declare function createBackgroundTelnyxVoipClient(options?: TelnyxVoipClientOptions): TelnyxVoipClient;
