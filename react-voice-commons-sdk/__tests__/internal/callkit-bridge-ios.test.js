const fs = require('fs');
const path = require('path');

const swiftSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'ios', 'CallKitBridge.swift'),
  'utf8'
);
const objectiveCSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'ios', 'CallKitBridge.m'),
  'utf8'
);

function extractFunction(signature) {
  const start = swiftSource.indexOf(signature);
  if (start < 0) {
    throw new Error(`Unable to locate ${signature} in CallKitBridge.swift`);
  }

  const bodyStart = swiftSource.indexOf('{', start);
  if (bodyStart < 0) {
    throw new Error(`Unable to locate body for ${signature}`);
  }

  let depth = 0;
  for (let index = bodyStart; index < swiftSource.length; index += 1) {
    const char = swiftSource[index];
    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return swiftSource.slice(start, index + 1);
      }
    }
  }

  throw new Error(`Unable to parse body for ${signature}`);
}

function countOccurrences(source, token) {
  return (source.match(new RegExp(token, 'g')) || []).length;
}

function sliceBetween(source, startToken, endToken) {
  const start = source.indexOf(startToken);
  if (start < 0) {
    throw new Error(`Unable to find start token: ${startToken}`);
  }

  const end = source.indexOf(endToken, start);
  if (end < 0) {
    throw new Error(`Unable to find end token after ${startToken}: ${endToken}`);
  }

  return source.slice(start, end + endToken.length);
}

const reportAndEndWatchdogCall = extractFunction('fileprivate func reportAndEndWatchdogCall(');
const handleMissedCallPushIfNeeded = extractFunction('public func handleMissedCallPushIfNeeded(');
const endAction = extractFunction(
  'public func provider(_ provider: CXProvider, perform action: CXEndCallAction)'
);
const handleVoipPush = extractFunction('@objc public func handleVoipPush(');
const answerAction = extractFunction(
  'public func provider(_ provider: CXProvider, perform action: CXAnswerCallAction)'
);
const answerCall = extractFunction('@objc func answerCall(');
const handleIncomingVoipPush = extractFunction('@objc public func handleVoipPush(');

describe('iOS CallKitBridge PushKit watchdog handling', () => {
  it('reports exactly one placeholder call, ends it, cleans state, then completes', () => {
    expect(countOccurrences(reportAndEndWatchdogCall, 'reportNewIncomingCall')).toBe(1);
    expect(reportAndEndWatchdogCall).toContain('"watchdogPlaceholder": true');

    const reportIndex = reportAndEndWatchdogCall.indexOf('reportNewIncomingCall');
    const endIndex = reportAndEndWatchdogCall.indexOf(
      'reportCall(with: callUUID, endedAt: Date(), reason: endedReason)'
    );
    const cleanupIndex = reportAndEndWatchdogCall.indexOf(
      'activeCalls.removeValue(forKey: callUUID)'
    );
    const completionIndex = reportAndEndWatchdogCall.indexOf('completion?()');

    expect(reportIndex).toBeGreaterThanOrEqual(0);
    expect(endIndex).toBeGreaterThan(reportIndex);
    expect(cleanupIndex).toBeGreaterThan(endIndex);
    expect(completionIndex).toBeGreaterThan(cleanupIndex);
  });

  it('routes malformed or missing call_id through failed placeholder cleanup only', () => {
    expect(countOccurrences(handleVoipPush, 'reportNewIncomingCall')).toBe(1);

    const malformedBranch = sliceBetween(
      handleVoipPush,
      'guard let callIdString = callId, let callUUID = UUID(uuidString: callIdString) else {',
      'return'
    );
    const storeIndex = handleVoipPush.indexOf(
      'self.storePendingVoipPush(payload.dictionaryPayload)'
    );
    const malformedReturnIndex = handleVoipPush.indexOf(
      'return',
      handleVoipPush.indexOf('source: "malformed_push_watchdog"')
    );

    expect(malformedBranch).toContain('reportAndEndWatchdogCall(');
    expect(malformedBranch).toContain('callUUID: UUID()');
    expect(malformedBranch).toContain('source: "malformed_push_watchdog"');
    expect(malformedBranch).toContain('endedReason: .failed');
    expect(malformedBranch).toContain('completion: completion');
    expect(malformedBranch).not.toContain('UserDefaults.standard.set');
    expect(malformedBranch).not.toContain('emitCallEvent');
    expect(storeIndex).toBeGreaterThan(malformedReturnIndex);
  });

  it('keeps missed-call duplicate suppression behind PushKit report/end satisfaction', () => {
    expect(countOccurrences(handleMissedCallPushIfNeeded, 'reportNewIncomingCall')).toBe(1);

    const duplicateBranch = sliceBetween(
      handleMissedCallPushIfNeeded,
      'if hasProcessedMissedCall(id: missedCallId) {',
      'return true'
    );
    const collisionBranch = sliceBetween(
      handleMissedCallPushIfNeeded,
      'guard activeCall["source"] as? String == "missed_call_push" else {',
      'return true'
    );
    const activeBranch = sliceBetween(
      handleMissedCallPushIfNeeded,
      'reportAndEndWatchdogCall(\n                    callUUID: UUID(),\n                    callerName: callerName,\n                    callerNumber: callerNumber,\n                    payload: payload,\n                    source: "missed_call_active_watchdog"',
      'return true'
    );

    expect(duplicateBranch).toContain('source: "missed_call_duplicate_watchdog"');
    expect(duplicateBranch).toContain('reportAndEndWatchdogCall(');
    expect(duplicateBranch).not.toContain('completion?()');

    expect(collisionBranch).toContain('markMissedCallProcessed(id: missedCallId)');
    expect(collisionBranch).toContain('source: "missed_call_collision_watchdog"');
    expect(collisionBranch).toContain('reportAndEndWatchdogCall(');
    expect(collisionBranch).not.toContain('completion?()');

    expect(activeBranch).toContain('reportAndEndWatchdogCall(');
    expect(activeBranch).toContain('finishMissedCall()');
  });

  it('fails placeholder answer actions instead of emitting normal RN answer events', () => {
    const placeholderIndex = answerAction.indexOf('"watchdogPlaceholder"');
    const failIndex = answerAction.indexOf('action.fail()');
    const emitIndex = answerAction.indexOf('emitCallEvent');

    expect(placeholderIndex).toBeGreaterThanOrEqual(0);
    expect(failIndex).toBeGreaterThan(placeholderIndex);
    expect(emitIndex).toBeGreaterThan(failIndex);
  });
});

describe('iOS CallKitBridge call waiting contract', () => {
  it('allows two one-call groups and advertises holding', () => {
    expect(swiftSource).toContain('configuration.maximumCallGroups = 2');
    expect(swiftSource).toContain('configuration.maximumCallsPerCallGroup = 1');
    expect(swiftSource).toContain('callUpdate.supportsHolding = true');
  });

  it('keeps answer and held actions keyed by UUID', () => {
    expect(swiftSource).toContain('LockedDictionary<UUID, CXAnswerCallAction>');
    expect(swiftSource).toContain('LockedDictionary<UUID, CXSetHeldCallAction>');
    expect(swiftSource).toContain('pendingAnswerActions.removeValue(forKey: uuid)');
    expect(swiftSource).toContain('pendingHeldActions.removeValue(forKey: uuid)');
  });

  it('rejects programmatic answers before submitting a transaction for an unknown UUID', () => {
    const registrationGuard = answerCall.indexOf('guard manager.isCallKitRegistered(uuid)');
    const transaction = answerCall.indexOf('CXAnswerCallAction(call: uuid)');

    expect(objectiveCSource).toContain('RCT_EXTERN_METHOD(isCallRegistered:');
    expect(registrationGuard).toBeGreaterThanOrEqual(0);
    expect(transaction).toBeGreaterThan(registrationGuard);
    expect(answerAction).toContain('guard isCallKitRegistered(action.callUUID)');
  });

  it('persists PushKit data only after CallKit accepts incoming registration', () => {
    const errorBranch = sliceBetween(handleIncomingVoipPush, 'if let error = error {', '} else {');
    const successStart = handleIncomingVoipPush.indexOf('} else {');
    const persistIndex = handleIncomingVoipPush.indexOf(
      'self.storePendingVoipPush(payload.dictionaryPayload)'
    );
    const registrationIndex = handleIncomingVoipPush.indexOf(
      'callKitManager.markCallKitRegistered(callUUID)'
    );

    expect(errorBranch).toContain('clearPendingPushData(for: callUUID.uuidString)');
    expect(errorBranch).not.toContain('storePendingVoipPush');
    expect(registrationIndex).toBeGreaterThan(successStart);
    expect(persistIndex).toBeGreaterThan(registrationIndex);
    expect(persistIndex).toBeGreaterThan(successStart);
  });

  it('emits held actions and waits for explicit JavaScript completion', () => {
    const heldAction = extractFunction(
      'public func provider(_ provider: CXProvider, perform action: CXSetHeldCallAction)'
    );
    const completion = extractFunction('@objc func completeHeldCallAction(');

    expect(heldAction).toContain('emitHeldCallEvent(');
    expect(heldAction).not.toContain('action.fulfill()');
    expect(completion).toContain('action.fulfill()');
    expect(completion).toContain('action.fail()');
  });

  it('requests an atomic two-action transaction when swapping calls', () => {
    const swapCalls = extractFunction('@objc func swapCalls(');

    expect(objectiveCSource).toContain('RCT_EXTERN_METHOD(swapCalls:');
    expect(swapCalls).toContain('CXSetHeldCallAction(call: activeUUID, onHold: true)');
    expect(swapCalls).toContain('CXSetHeldCallAction(call: heldUUID, onHold: false)');
    expect(swapCalls).toContain('CXTransaction(actions: actions)');
  });

  it('requests a CallKit transaction for app-originated hold changes', () => {
    const setCallHeld = extractFunction('@objc func setCallHeld(');

    expect(objectiveCSource).toContain('RCT_EXTERN_METHOD(setCallHeld:');
    expect(setCallHeld).toContain('CXSetHeldCallAction(call: uuid, onHold: isOnHold)');
    expect(setCallHeld).toContain('CXTransaction(action: action)');
  });

  it('fails an end action for an unknown UUID before emitting or removing anything', () => {
    const guardIndex = endAction.indexOf('guard let callData = activeCalls[action.callUUID]');
    const failIndex = endAction.indexOf('action.fail()');
    const returnIndex = endAction.indexOf('return', failIndex);
    const emitIndex = endAction.indexOf('emitCallEvent(');
    const removeIndex = endAction.indexOf('activeCalls.removeValue(forKey: action.callUUID)');

    expect(guardIndex).toBeGreaterThanOrEqual(0);
    expect(failIndex).toBeGreaterThan(guardIndex);
    expect(returnIndex).toBeGreaterThan(failIndex);
    expect(emitIndex).toBeGreaterThan(returnIndex);
    expect(removeIndex).toBeGreaterThan(returnIndex);
  });
});
