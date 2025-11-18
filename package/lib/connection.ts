import { EventEmitter } from 'eventemitter3';
import { PROD_HOST } from './env';
import { isMessage } from './message';
import { createDeferredPromise } from './promise';
import type { DeferredPromise } from './promise';
import log from 'loglevel';
import { updateVoiceSDKId, VOICE_SDK_ID } from './global';
import WebSocketSelfSigned from 'react-native-websocket-self-signed';

type ConnectionEvents = {
  'telnyx.socket.open': () => void;
  'telnyx.socket.close': () => void;
  'telnyx.socket.error': (ev: Event) => void;
  'telnyx.socket.message': (message: unknown) => void;
};

export class Connection extends EventEmitter<ConnectionEvents> {
  public socket: WebSocketSelfSigned;
  private isSocketConnected: boolean = false;
  private customVoiceSDKId?: string;
  public _client: any = null; // Reference to the client for CallKit UUID storage
  private reconnectEnabled: boolean = true;
  private reconnectAttempts: number = 0;
  private reconnectTimer: any = null;

  private transactions: Map<string, DeferredPromise<unknown>>;
  private messageQueue: unknown[];

  constructor(voiceSDKId?: string) {
    super();
    this.customVoiceSDKId = voiceSDKId;
    // TODO: Toggle between PROD and DEV
    const wsUrl = this.buildWebsocketURL();
    log.debug('[Connection]: WebSocket URL:', wsUrl);
    log.debug('[Connection]: Attempting to connect to:', wsUrl);

    // Console logs for release debugging
    console.log('[Connection] RELEASE DEBUG - WebSocket URL:', wsUrl);
    console.log('[Connection] RELEASE DEBUG - Attempting to connect to:', wsUrl);

    // Use WebSocketSelfSigned for iOS to handle self-signed certificates
    log.debug('[Connection]: Using WebSocketSelfSigned with self-signed certificate support');
    this.socket = WebSocketSelfSigned.getInstance(wsUrl);

    this.socket.onOpen(() => {
      log.debug('[Connection]: WebSocket connection opened');
      this.isSocketConnected = true;
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      this.reconnectAttempts = 0;
      try {
        this.emit('telnyx.socket.open');
      } catch (error) {
        log.error('[Connection]: Failed to emit socket.open event - bridge may be disconnected:', error);
      }
      this.flushMessageQueue();
    });

    this.socket.onError((error: string) => {
      log.error('[Connection]: WebSocket error occurred', error);
      try {
        this.emit('telnyx.socket.error', error as any);
      } catch (emitError) {
        log.error('[Connection]: Failed to emit socket.error event - bridge may be disconnected:', emitError);
      }
    });

    this.socket.onClose(() => {
      log.debug('[Connection]: WebSocket connection closed');
      this.isSocketConnected = false;
      try {
        this.emit('telnyx.socket.close');
      } catch (error) {
        log.error('[Connection]: Failed to emit socket.close event - bridge may be disconnected:', error);
      }
      
    });

    this.socket.onMessage((message: string) => {
      const parsedMessage = this.safeParseMessage(message);
      log.debug('Received message:', parsedMessage);

      if (isMessage(parsedMessage)) {
        const transaction = this.transactions.get(parsedMessage.id);
        transaction?.resolve(parsedMessage);
        this.transactions.delete(parsedMessage.id);
      }

      if (parsedMessage.voice_sdk_id) {
        updateVoiceSDKId(parsedMessage.voice_sdk_id);
      }
      try {
        this.emit('telnyx.socket.message', parsedMessage);
      } catch (error) {
        log.error('[Connection]: Failed to emit socket.message event - bridge may be disconnected:', error);
      }
    });

    this.transactions = new Map();
    this.messageQueue = [];

    // Initiate connection
    this.socket.connect().catch((error) => {
      log.error('[Connection]: Failed to connect WebSocket', error);
    });
  }

  public send = (msg: unknown) => {
    if (!this.isConnected) {
      this.messageQueue.push(msg);
      return;
    }

    try {
      log.debug('Sending message to gateway', msg);
      this.socket.send(JSON.stringify(msg));
    } catch (error) {
      log.error('[Connection]: Failed to send WebSocket message - bridge may be disconnected:', error);
      // Don't throw the error, just log it to prevent app crashes during app state transitions
      // The message will be lost, but this is better than crashing the entire app
    }
  };

  public sendAndWait = (msg: { id: string }): Promise<unknown> => {
    const deferred = createDeferredPromise<unknown>();
    this.transactions.set(msg.id, deferred);
    this.send(msg);
    return deferred.promise;
  };

  public close = () => {
    this.reconnectEnabled = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.socket.close();
    this.socket.removeOnOpenListener();
    this.socket.removeOnErrorListener();
    this.socket.removeOnCloseListener();
    this.socket.removeOnMessageListener();
    this.removeAllListeners();
    this.transactions.clear();
    this.messageQueue = [];
  };
  public get isConnected() {
    return this.isSocketConnected;
  }

  private buildWebsocketURL = () => {
    const url = new URL(PROD_HOST);

    // Use custom voice_sdk_id from push notification if available, otherwise use global one
    const voiceSDKIdToUse = this.customVoiceSDKId || VOICE_SDK_ID;
    if (voiceSDKIdToUse) {
      url.searchParams.set('voice_sdk_id', voiceSDKIdToUse);
      if (this.customVoiceSDKId) {
        log.debug(
          '[Connection]: Using custom voice_sdk_id from push notification:',
          this.customVoiceSDKId
        );
      }
    }

    const result = url.toString();
    log.debug('[Connection]: Final WebSocket URL:', result);

    // Console log for release debugging
    console.log('[Connection] RELEASE DEBUG - Final WebSocket URL with params:', result);

    return result;
  };
  private flushMessageQueue = () => {
    if (this.messageQueue.length === 0) {
      return;
    }
    this.messageQueue.forEach((msg) => this.send(msg));
    this.messageQueue = [];
  };

  private safeParseMessage = (msg: string) => {
    try {
      return JSON.parse(msg);
    } catch (error) {
      log.error('Failed to parse message:', msg, error);
      return msg;
    }
  };

  private scheduleReconnect = () => {
    if (!this.reconnectEnabled || this.isSocketConnected || this.reconnectTimer) {
      return;
    }
    const attempt = this.reconnectAttempts;
    const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      if (!this.reconnectEnabled || this.isSocketConnected) {
        return;
      }
      try {
        await this.socket.connect();
      } catch (e) {
        log.error('[Connection]: Reconnect attempt failed', e);
        this.reconnectAttempts = attempt + 1;
        this.scheduleReconnect();
      }
    }, delay);
  };
}
