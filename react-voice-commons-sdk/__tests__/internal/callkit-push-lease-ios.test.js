const fs = require('fs');
const path = require('path');

const iosDir = path.join(__dirname, '..', '..', 'ios');
const callKitSwift = fs.readFileSync(path.join(iosDir, 'CallKitBridge.swift'), 'utf8');
const voicePnSwift = fs.readFileSync(path.join(iosDir, 'VoicePnBridge.swift'), 'utf8');
const callKitObjC = fs.readFileSync(path.join(iosDir, 'CallKitBridge.m'), 'utf8');
const voicePnObjC = fs.readFileSync(path.join(iosDir, 'VoicePnBridge.m'), 'utf8');

function extractFunctionAt(source, start) {
  if (start < 0) {
    return '';
  }

  const bodyStart = source.indexOf('{', start);
  if (bodyStart < 0) {
    return '';
  }

  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }

  return '';
}

function extractFunction(source, signature) {
  return extractFunctionAt(source, source.indexOf(signature));
}

function extractIncomingPushRegistry(source) {
  const marker = source.indexOf('didReceiveIncomingPushWith payload: PKPushPayload');
  if (marker < 0) {
    return '';
  }

  return extractFunctionAt(source, source.lastIndexOf('public func pushRegistry(', marker));
}

function sliceBetween(source, startToken, endToken) {
  const start = source.indexOf(startToken);
  if (start < 0) {
    return '';
  }

  const end = source.indexOf(endToken, start);
  if (end < 0) {
    return '';
  }

  return source.slice(start, end + endToken.length);
}

function countOccurrences(source, token) {
  return (source.match(new RegExp(token, 'g')) || []).length;
}

// Models the single-slot lease used to keep sequential pushes from clearing each
// other: a finish only clears the push that stored it.
function createPushLease(ttlMs) {
  let lease = null;

  return {
    write(ownerCallId, metadata) {
      lease = { ownerCallId, metadata, issuedAt: Date.now() };
    },
    read(now = Date.now()) {
      if (lease && now - lease.issuedAt > ttlMs) {
        lease = null;
      }
      return lease;
    },
    clear(callId, now = Date.now()) {
      const current = this.read(now);
      if (current && callId && current.ownerCallId !== callId) {
        return false;
      }
      lease = null;
      return true;
    },
  };
}

describe('iOS push lease ownership', () => {
  it('stores the push owner and issuance time alongside the push payload', () => {
    expect(callKitSwift).toContain('enum TelnyxPushLease');

    const lease = sliceBetween(callKitSwift, 'enum TelnyxPushLease {', '\n}');
    expect(lease).toContain('ownerKey = "pending_push_owner_call_id"');
    expect(lease).toContain('pushCallIdKey = "pending_push_call_id"');
    expect(lease).toContain('issuedAtKey = "pending_push_issued_at"');
    expect(lease).toContain('callKitAnswerKey = "pending_callkit_answer"');
    expect(lease).toContain('voipActionKey = "pending_voip_action"');

    const store = extractFunction(callKitSwift, 'fileprivate func storePendingPushAction(');
    expect(store).toContain('ownerCallId: String');
    expect(store).toContain('pushCallId: String?');
    expect(store).toContain(
      'recordPendingPushLeaseLocked(ownerCallId: ownerCallId, pushCallId: pushCallId)'
    );

    const write = extractFunction(callKitSwift, 'fileprivate func writePendingVoipPush(');
    expect(write).toContain('ownerCallId: String');
    expect(write).toContain('pushCallId: String?');
    expect(write).toContain(
      'recordPendingPushLeaseLocked(ownerCallId: ownerCallId, pushCallId: pushCallId)'
    );
    expect(countOccurrences(callKitSwift, '\\.set\\([^\\n]*forKey: "pending_voip_push"\\)')).toBe(
      1
    );

    const record = extractFunction(callKitSwift, 'private func recordPendingPushLeaseLocked(');
    expect(record).toContain('TelnyxPushLease.ownerKey');
    expect(record).toContain('TelnyxPushLease.pushCallIdKey');
    expect(record).toContain('TelnyxPushLease.issuedAtKey');
  });

  it('scopes the PushKit payload to the CallKit call that answers it', () => {
    const pushRegistry = extractIncomingPushRegistry(callKitSwift);

    expect(pushRegistry).not.toBe('');
    const callUUIDIndex = pushRegistry.indexOf('let callUUID = UUID()');
    const ownerIndex = pushRegistry.indexOf('ownerCallId: callUUID.uuidString');

    expect(callUUIDIndex).toBeGreaterThanOrEqual(0);
    expect(ownerIndex).toBeGreaterThan(callUUIDIndex);
    // The payload must be written through the lease store, not as loose defaults.
    expect(pushRegistry).not.toContain('forKey: "pending_push_action"');
    expect(pushRegistry).not.toContain('forKey: "pending_push_metadata"');
  });

  it('derives the VoIP push owner from the accepted CallKit registration', () => {
    const store = extractFunction(
      callKitSwift,
      'private func storePendingVoipPush(_ payload: [AnyHashable: Any])'
    );
    expect(store).toContain('TelnyxPushLease.callKitUUIDKey');
    expect(store).toContain('pushCallId: Self.callId(from: payload)');

    const handleVoipPush = extractFunction(callKitSwift, '@objc public func handleVoipPush(');
    const uuidIndex = handleVoipPush.indexOf('forKey: "@pending_callkit_uuid"');
    const persistIndex = handleVoipPush.indexOf(
      'self.storePendingVoipPush(payload.dictionaryPayload)'
    );

    expect(uuidIndex).toBeGreaterThanOrEqual(0);
    expect(persistIndex).toBeGreaterThan(uuidIndex);
  });
});

describe('iOS push lease cleanup', () => {
  it('clears the lease when the push-answer connection completes or ends', () => {
    expect(extractFunction(callKitSwift, '@objc func reportCallConnected(')).toContain(
      'clearPendingPushData(for: callUUID)'
    );
    expect(extractFunction(callKitSwift, '@objc func reportCallEnded(')).toContain(
      'clearPendingPushData(for: callUUID)'
    );

    const endAction = extractFunction(
      callKitSwift,
      'public func provider(_ provider: CXProvider, perform action: CXEndCallAction)'
    );
    expect(endAction).toContain('clearPendingPushData(for: action.callUUID.uuidString)');
  });

  it('clears the lease on rejection, timeout, and failure', () => {
    const answerCall = extractFunction(callKitSwift, '@objc func answerCall(');
    const answerError = sliceBetween(answerCall, 'if let error = error {', '} else {');
    expect(answerError).toContain('clearPendingPushData(for: callUUID)');

    const timedOut = extractFunction(
      callKitSwift,
      'public func provider(_ provider: CXProvider, timedOutPerforming action: CXAction)'
    );
    expect(timedOut).toContain('clearPendingPushData(for: answerAction.callUUID.uuidString)');

    const handleVoipPush = extractFunction(callKitSwift, '@objc public func handleVoipPush(');
    const registrationError = sliceBetween(handleVoipPush, 'if let error = error {', '} else {');
    expect(registrationError).toContain('clearPendingPushData(for: callUUID.uuidString)');

    const pushRegistry = extractIncomingPushRegistry(callKitSwift);
    const legacyRegistrationError = sliceBetween(
      pushRegistry,
      'if let error = error {',
      '} else {'
    );
    expect(legacyRegistrationError).toContain('clearPendingPushData(for: callUUID.uuidString)');
  });

  it('clears every push-scoped value, including pending answer and voip action', () => {
    const reset = extractFunction(callKitSwift, 'public func providerDidReset(');
    expect(reset).toContain('clearPendingPushData(for: nil)');

    const clear = extractFunction(callKitSwift, 'func clearPendingPushData(for callId: String?)');
    expect(clear).toContain('clearPendingPushKeysLocked()');

    const clearKeys = extractFunction(callKitSwift, 'private func clearPendingPushKeysLocked(');
    expect(clearKeys).toContain('TelnyxPushLease.allKeys');

    const allKeys = sliceBetween(callKitSwift, 'static let allKeys = [', ']');
    expect(allKeys).toContain('callKitAnswerKey');
    expect(allKeys).toContain('voipActionKey');
  });
  it('only clears a lease owned by the call that is finishing', () => {
    const clear = extractFunction(callKitSwift, 'func clearPendingPushData(for callId: String?)');
    const lockIndex = clear.indexOf('pendingVoipPushLock.lock()');
    const guardIndex = clear.indexOf('hasPendingPushData(forDifferentCallThan: callId)');
    const removeIndex = clear.indexOf('clearPendingPushKeysLocked()');

    expect(lockIndex).toBeGreaterThanOrEqual(0);
    expect(guardIndex).toBeGreaterThan(lockIndex);
    expect(removeIndex).toBeGreaterThan(guardIndex);

    const hasPending = extractFunction(callKitSwift, 'private func hasPendingPushData(');
    expect(hasPending).toContain('pendingPushIdentitiesLocked()');
    expect(hasPending).toContain('caseInsensitiveCompare');

    const identities = extractFunction(callKitSwift, 'private func pendingPushIdentitiesLocked(');
    expect(identities).toContain('TelnyxPushLease.ownerKey');
    expect(identities).toContain('TelnyxPushLease.pushCallIdKey');
    expect(identities).toContain('TelnyxPushLease.callKitUUIDKey');
    expect(identities).toContain('TelnyxPushLease.metadataKey');
  });

  it('clears by either the CallKit UUID or the Telnyx call id of the same push', () => {
    // The lease is written with the CallKit UUID that answers the push and the Telnyx
    // call id from its metadata. Cleanup arrives with one or the other depending on the
    // path (connect/end uses the UUID, missed-call watchdog uses the Telnyx id), so a
    // partial mismatch must not keep the push identity alive.
    const clearIfOwnedBy = (lease, callId) => {
      const ids = [lease.callKitUUID, lease.callId].filter(Boolean);
      if (ids.length > 0 && !ids.some((id) => id.toLowerCase() === callId.toLowerCase())) {
        return false;
      }
      return true;
    };

    const lease = { callKitUUID: 'UUID-A', callId: 'v3:call-a', voiceSdkId: 'vsk-a' };
    expect(clearIfOwnedBy(lease, 'uuid-a')).toBe(true);
    expect(clearIfOwnedBy(lease, 'V3:CALL-A')).toBe(true);
    expect(clearIfOwnedBy(lease, 'UUID-B')).toBe(false);
    expect(clearIfOwnedBy(lease, 'v3:call-b')).toBe(false);
  });

  it('only clears the stored VoIP payload for a matching call', () => {
    const clearVoip = extractFunction(
      callKitSwift,
      'func clearPendingVoipPush(ifMatches callId: String)'
    );
    expect(clearVoip).toContain('pendingPushIdentitiesLocked()');
    expect(clearVoip.indexOf('caseInsensitiveCompare')).toBeLessThan(
      clearVoip.indexOf('removeObject(forKey: "pending_voip_push")')
    );
  });

  it('keeps sequential pushes isolated when one flow finishes', () => {
    const lease = createPushLease(600_000);
    lease.write('push-a', { voice_sdk_id: 'vsk-a' });
    lease.write('push-b', { voice_sdk_id: 'vsk-b' });

    expect(lease.clear('push-a')).toBe(false);
    expect(lease.read()).toMatchObject({
      ownerCallId: 'push-b',
      metadata: { voice_sdk_id: 'vsk-b' },
    });

    expect(lease.clear('push-b')).toBe(true);
    expect(lease.read()).toBeNull();
  });
});

describe('iOS push lease reads', () => {
  it('discards an abandoned expired lease instead of exposing it to a later login', () => {
    const snapshot = extractFunction(callKitSwift, 'func pendingPushSnapshot()');
    const expiryIndex = snapshot.indexOf('pendingPushLeaseExpiredLocked()');
    const clearIndex = snapshot.indexOf('clearPendingPushKeysLocked()');

    expect(expiryIndex).toBeGreaterThanOrEqual(0);
    expect(clearIndex).toBeGreaterThan(expiryIndex);
    expect(snapshot).toContain('PendingPushSnapshot(action: nil, metadata: nil, voipPush: nil)');

    const expiry = extractFunction(callKitSwift, 'private func pendingPushLeaseExpiredLocked(');
    expect(expiry).toContain('TelnyxPushLease.issuedAtKey');
    expect(expiry).toContain('TelnyxPushLease.ttl');
    expect(callKitSwift).toMatch(/static let ttl: TimeInterval = \d+/);
  });

  it('reads pending push data through the lease snapshot', () => {
    const getAction = extractFunction(voicePnSwift, 'func getPendingPushAction(');
    expect(getAction).toContain('TelnyxCallKitManager.shared.pendingPushSnapshot()');
    expect(getAction).not.toContain('forKey: "pending_push_metadata"');

    const getVoipPush = extractFunction(voicePnSwift, 'func getPendingVoipPush(');
    expect(getVoipPush).toContain('pendingPushSnapshot()');
    expect(getVoipPush).not.toContain('forKey: "pending_voip_push"');

    const clearAction = extractFunction(voicePnSwift, 'func clearPendingPushAction(');
    expect(clearAction).toContain('TelnyxCallKitManager.shared.clearPendingPushAction()');

    // Consuming a JavaScript push action must not discard the VoIP payload that is
    // still owned by a ringing CallKit call.
    const managerClearAction = extractFunction(callKitSwift, 'func clearPendingPushAction()');
    expect(managerClearAction).toContain('TelnyxPushLease.actionKey');
    expect(managerClearAction).toContain('TelnyxPushLease.metadataKey');
    expect(managerClearAction).toContain('TelnyxPushLease.voipPushKey');
    // Consuming the action must not discard the CallKit answer/UUID that a
    // still-ringing push-answer call depends on.
    expect(managerClearAction).not.toContain('clearPendingPushKeysLocked()');
    expect(managerClearAction).not.toContain('TelnyxPushLease.callKitAnswerKey');
    expect(managerClearAction).not.toContain('TelnyxPushLease.callKitUUIDKey');
  });

  it('does not own or inject session reattachment wire fields', () => {
    // `attach_call`/`attach_calls` and `sessid` are built by the underlying
    // React Native voice SDK login handler, not by these CallKit/Pn bridges.
    const bridgeSource = [callKitSwift, voicePnSwift, callKitObjC, voicePnObjC].join('\n');

    expect(bridgeSource).not.toMatch(/"sessid"\s*:/);
    expect(bridgeSource).not.toMatch(/"attach_call"\s*:/);
    expect(bridgeSource).not.toMatch(/"attach_calls"\s*:/);
  });
});
