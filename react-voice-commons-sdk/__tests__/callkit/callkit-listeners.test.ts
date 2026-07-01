/**
 * Regression tests for CallKit listener clobbering fix (VSDK-341).
 *
 * Before the fix, `CallKitManager` stored listeners in a `Map<string, listener>`
 * (single-slot). Each `onXxx(listener)` call used `.set()`, so registering a
 * second listener for the same event type replaced the first one — the
 * coordinator and app/hook listeners could clobber each other.
 *
 * The fix changes the storage to `Map<string, Set<listener>>` so multiple
 * subscribers can coexist, and each `onXxx()` returns an unsubscribe function
 * that removes only the specific listener.
 */

// Mock react-native before importing CallKit
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: (opts: Record<string, unknown>) => opts.ios,
  },
  NativeModules: {
    CallKitBridge: {},
  },
  NativeEventEmitter: jest.fn().mockImplementation(() => ({
    addListener: jest.fn(),
    removeListener: jest.fn(),
    removeAllListeners: jest.fn(),
  })),
}));

import { CallKit } from '../../src/callkit/callkit';

type NotifyFn = (eventType: string, event: { callUUID: string }) => void;
const notify = (CallKit as unknown as { notifyListeners: NotifyFn })
  .notifyListeners.bind(CallKit);

describe('CallKit listener management (VSDK-341)', () => {
  afterEach(() => {
    // Clean up any leftover listeners between tests
    const listeners = (CallKit as unknown as {
      listeners: Map<string, Set<unknown>>;
    }).listeners;
    listeners.clear();
  });

  it('should support multiple listeners for the same event type', () => {
    const listener1 = jest.fn();
    const listener2 = jest.fn();
    const event = { callUUID: 'test-uuid-1' };

    CallKit.onStartCall(listener1);
    CallKit.onStartCall(listener2);

    notify('startCall', event);

    expect(listener1).toHaveBeenCalledWith(event);
    expect(listener2).toHaveBeenCalledWith(event);
  });

  it('should not clobber existing listeners when a new one is added', () => {
    const listener1 = jest.fn();
    const listener2 = jest.fn();
    const event = { callUUID: 'test-uuid-2' };

    // Register first listener
    CallKit.onEndCall(listener1);

    // Register second listener — previously this replaced listener1
    CallKit.onEndCall(listener2);

    notify('endCall', event);

    // Both should be called — before the fix, only listener2 would fire
    expect(listener1).toHaveBeenCalledWith(event);
    expect(listener2).toHaveBeenCalledWith(event);
  });

  it('should allow unsubscribing one listener without affecting others', () => {
    const listener1 = jest.fn();
    const listener2 = jest.fn();
    const event = { callUUID: 'test-uuid-3' };

    const unsub1 = CallKit.onAnswerCall(listener1);
    CallKit.onAnswerCall(listener2);

    // Unsubscribe first listener
    unsub1();

    notify('answerCall', event);

    expect(listener1).not.toHaveBeenCalled();
    expect(listener2).toHaveBeenCalledWith(event);
  });

  it('should clean up the Set when the last listener is unsubscribed', () => {
    const listener = jest.fn();
    const event = { callUUID: 'test-uuid-4' };

    const unsub = CallKit.onReceivePush(listener);

    // Unsubscribe the only listener
    unsub();

    notify('receivePush', event);

    expect(listener).not.toHaveBeenCalled();

    // The Set should be removed from the Map entirely
    const listeners = (CallKit as unknown as {
      listeners: Map<string, Set<unknown>>;
    }).listeners;
    expect(listeners.has('receivePush')).toBe(false);
  });

  it('should support listeners across different event types independently', () => {
    const startListener = jest.fn();
    const answerListener = jest.fn();
    const endListener = jest.fn();
    const pushListener = jest.fn();

    CallKit.onStartCall(startListener);
    CallKit.onAnswerCall(answerListener);
    CallKit.onEndCall(endListener);
    CallKit.onReceivePush(pushListener);

    const startEvent = { callUUID: 'start-uuid' };
    notify('startCall', startEvent);

    expect(startListener).toHaveBeenCalledWith(startEvent);
    expect(answerListener).not.toHaveBeenCalled();
    expect(endListener).not.toHaveBeenCalled();
    expect(pushListener).not.toHaveBeenCalled();

    const answerEvent = { callUUID: 'answer-uuid' };
    notify('answerCall', answerEvent);

    expect(answerListener).toHaveBeenCalledWith(answerEvent);
    expect(startListener).toHaveBeenCalledTimes(1); // unchanged
  });
});
