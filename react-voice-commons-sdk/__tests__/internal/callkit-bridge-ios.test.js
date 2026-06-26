const fs = require('fs');
const path = require('path');

const swiftSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'ios', 'CallKitBridge.swift'),
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
const handleVoipPush = extractFunction('@objc public func handleVoipPush(');
const answerAction = extractFunction(
  'public func provider(_ provider: CXProvider, perform action: CXAnswerCallAction)'
);

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
    const storeIndex = handleVoipPush.indexOf('UserDefaults.standard.set("incoming_call"');
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
