const fs = require('fs');
const path = require('path');

const libraryRoot = path.join(__dirname, '..', '..');
const repoRoot = path.join(libraryRoot, '..');

function readSource(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

const managerSource = readSource(
  'react-voice-commons-sdk/android/src/main/java/com/telnyx/react_voice_commons/VoicePnManager.kt'
);
const bridgeSource = readSource(
  'react-voice-commons-sdk/android/src/main/java/com/telnyx/react_voice_commons/VoicePnBridgeModule.kt'
);
const notificationHelperSource = readSource(
  'react-voice-commons-sdk/android/src/main/java/com/telnyx/react_voice_commons/TelnyxNotificationHelper.kt'
);
const appMessagingSource = readSource(
  'android/app/src/main/java/com/telnyx/rn_voice_sdk_demo/AppFirebaseMessagingService.kt'
);
const appReceiverSource = readSource(
  'android/app/src/main/java/com/telnyx/rn_voice_sdk_demo/AppNotificationActionReceiver.kt'
);
const appActivitySource = readSource(
  'android/app/src/main/java/com/telnyx/rn_voice_sdk_demo/MainActivity.kt'
);

function extractFunction(source, signature) {
  const start = source.indexOf(signature);
  if (start < 0) {
    throw new Error(`Unable to locate ${signature}`);
  }

  const bodyStart = source.indexOf('{', start);
  if (bodyStart < 0) {
    throw new Error(`Unable to locate body for ${signature}`);
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

  throw new Error(`Unable to parse body for ${signature}`);
}

function countOccurrences(source, pattern) {
  return (source.match(pattern) || []).length;
}

describe('Android push metadata scoping', () => {
  it('stores push metadata under the call id that handles the push', () => {
    const setPending = extractFunction(managerSource, 'fun setPendingPushAction(');

    expect(setPending).toContain('normalizedCallId');
    expect(setPending).toMatch(/flows\[normalizedCallId\]\s*=\s*PendingPushFlow\(/);
    expect(setPending).toMatch(/writePushFlows\(editor,\s*flows\)/);
    expect(setPending).toMatch(/editor\.putString\(PENDING_PUSH_CALL_ID,\s*normalizedCallId\)/);
    expect(setPending).toContain('editor.putString(PENDING_PUSH_METADATA, metadata)');
  });

  it('recovers the owning call id for callers that only pass metadata', () => {
    const setPending = extractFunction(managerSource, 'fun setPendingPushAction(');
    const extractCallId = extractFunction(managerSource, 'private fun extractCallIdFromMetadata(');

    expect(setPending).toContain('normalizeCallId(callId) ?: extractCallIdFromMetadata(metadata)');
    expect(extractCallId).toContain('json.optString("call_id", "")');
    expect(extractCallId).toContain('json.optString("metadata", "")');
    expect(extractCallId).toContain('call_id=');
  });

  it('never drops another call flow when a new push is recorded', () => {
    const setPending = extractFunction(managerSource, 'fun setPendingPushAction(');

    // Recording a push may prune only expired entries, never clear the map.
    expect(setPending).not.toContain('editor.clear()');
    expect(setPending).not.toContain('clearCurrentPushFlow');
    expect(setPending).toContain('pruneExpiredFlows(flows, now)');
  });

  it('returns metadata only to the call id that owns it', () => {
    const getPending = extractFunction(managerSource, 'fun getPendingPushAction(');

    expect(getPending).toMatch(/val flow = flows\[normalizedCallId\]/);
    expect(getPending).toMatch(
      /currentCallId\.equals\(normalizedCallId,\s*ignoreCase\s*=\s*true\)/
    );
    // A mismatched call id must return empty instead of falling back to the
    // most recent push, which may belong to a different call.
    expect(getPending).toMatch(/return Pair\(null,\s*null\)/);
    expect(getPending).toContain('PENDING_PUSH_CALL_ID');
  });

  it('serves the most recent flow to the legacy, call-less lookup', () => {
    const getPending = extractFunction(managerSource, 'fun getPendingPushAction(');

    // The per-call map is consulted only inside the call-id branch, so an
    // unkeyed lookup cannot resurrect another call's retained metadata.
    expect(countOccurrences(getPending, /readPushFlows\(prefs\)/g)).toBe(1);
    expect(getPending).toContain('prefs.getString(PENDING_PUSH_ACTION, null)');
    expect(getPending).toContain('prefs.getString(PENDING_PUSH_METADATA, null)');
  });

  it('clears only the matching call flow and leaves other calls intact', () => {
    const clearForCall = extractFunction(managerSource, 'fun clearPendingPushActionForCall(');

    expect(clearForCall).toMatch(/flows\.remove\(normalizedCallId\)/);
    expect(clearForCall).toMatch(
      /currentCallId\.equals\(normalizedCallId,\s*ignoreCase\s*=\s*true\)/
    );
    expect(clearForCall).toContain('clearCurrentPushFlow(editor)');
    expect(clearForCall).toContain('if (normalizedCallId == null)');
    expect(clearForCall).not.toContain('editor.clear()');
  });

  it('clears the current flow without deleting retained flows for other calls', () => {
    const clearCurrent = extractFunction(managerSource, 'fun clearPendingPushAction(');

    expect(clearCurrent).toMatch(/flows\.remove\(currentCallId\)/);
    expect(clearCurrent).toContain('clearCurrentPushFlow(editor)');
    expect(clearCurrent).not.toContain('editor.clear()');
  });

  it('consumes only the requested flow when checking for a pending action', () => {
    const checkPending = extractFunction(managerSource, 'fun checkPendingPushAction(');

    expect(checkPending).toContain('getPendingPushAction(context, callId)');
    expect(checkPending).toContain('clearPendingPushActionForCall(context, callId)');
  });

  it('expires abandoned flows so a later login cannot inherit their identity', () => {
    const getPending = extractFunction(managerSource, 'fun getPendingPushAction(');

    expect(managerSource).toContain('PENDING_PUSH_MAX_AGE_MS');
    expect(managerSource).toContain('PENDING_PUSH_FLOWS = "pending_push_flows"');
    expect(getPending).toContain('isExpired(flow.timestamp, now)');
    expect(getPending).toContain('isExpired(timestamp, now)');
    expect(getPending).toContain('Discarding expired pending push action');
  });
});

describe('Android bridge exposes call-scoped push verification hooks', () => {
  it('keeps the legacy React Native method signature and reports the owning call', () => {
    const legacyGet = extractFunction(bridgeSource, 'fun getPendingPushAction(promise: Promise)');

    expect(legacyGet).not.toContain('callId: String');
    expect(legacyGet).toContain('VoicePnManager.getPendingPushActionCallId');
    expect(legacyGet).toContain('result.putString("callId"');
  });

  it('exposes get, set, clear and owner lookup scoped by call id', () => {
    expect(bridgeSource).toContain('fun getPendingPushActionForCall(');
    expect(bridgeSource).toContain('fun setPendingPushActionForCall(');
    expect(bridgeSource).toContain('fun clearPendingPushActionForCall(');
    expect(bridgeSource).toContain('fun getPendingPushActionCallId(');

    const scopedSet = extractFunction(bridgeSource, 'fun setPendingPushActionForCall(');
    expect(scopedSet).toContain('VoicePnManager.setPendingPushAction(');
    expect(scopedSet).toContain('callId');

    const scopedClear = extractFunction(bridgeSource, 'fun clearPendingPushActionForCall(');
    expect(scopedClear).toContain('VoicePnManager.clearPendingPushActionForCall(');
  });

  it('clears the ended call push flow without touching other calls', () => {
    const endCall = extractFunction(bridgeSource, 'fun endCall(');

    expect(endCall).toContain(
      'VoicePnManager.clearPendingPushActionForCall(reactApplicationContext, callId)'
    );
  });
});

describe('Android notification fallback cleanup', () => {
  it('clears the fallback flow by its call id instead of the current slot', () => {
    const clearFallback = extractFunction(
      notificationHelperSource,
      'private fun clearFallbackPushAction('
    );

    expect(clearFallback).toContain(
      'VoicePnManager.clearPendingPushActionForCall(context, callId)'
    );
    expect(clearFallback).not.toContain('VoicePnManager.clearPendingPushAction(context)');
  });
});

describe('demo app owns push metadata from receipt to abandonment', () => {
  it('retains the push metadata for its call before showing the notification', () => {
    const handlePush = extractFunction(
      appMessagingSource,
      'protected override fun handleTelnyxVoicePush('
    );

    const storeIndex = handlePush.indexOf(
      'VoicePnManager.setPendingPushAction(this, "incoming_call", metadata, callId)'
    );
    const notifyIndex = handlePush.indexOf('super.handleTelnyxVoicePush(remoteMessage)');

    expect(storeIndex).toBeGreaterThanOrEqual(0);
    expect(notifyIndex).toBeGreaterThan(storeIndex);
    expect(handlePush).toContain('extractPushIdentity(remoteMessage)');
  });

  it('clears a missed call flow by call id instead of clearing everything', () => {
    const handleMissed = extractFunction(
      appMessagingSource,
      'protected override fun handleTelnyxMissedCall('
    );

    expect(handleMissed).toContain('VoicePnManager.clearPendingPushActionForCall(this, callId)');
    expect(handleMissed).not.toContain('clearPendingPushAction(this)');
  });

  it('answers with the tapped call metadata and clears a rejected flow', () => {
    const answer = extractFunction(appReceiverSource, 'protected override fun handleAnswerCall(');
    const reject = extractFunction(appReceiverSource, 'protected override fun handleRejectCall(');

    expect(answer).toContain('VoicePnManager.getPendingPushAction(context, callId)');
    expect(answer).not.toContain('getPendingPushAction(context)');
    expect(answer).toContain(
      'VoicePnManager.setPendingPushAction(context, "answer", metadata, callId)'
    );
    expect(reject).toContain('VoicePnManager.clearPendingPushActionForCall(context, callId)');
  });

  it('scopes notification intents and abandons rejected flows', () => {
    const handleIntent = extractFunction(
      appActivitySource,
      'protected override fun onHandleIntent('
    );

    expect(handleIntent).toContain(
      'VoicePnManager.setPendingPushAction(this, action, metadata, callId)'
    );
    expect(handleIntent).toContain('VoicePnManager.clearPendingPushActionForCall(this, callId)');

    const rejectIndex = handleIntent.indexOf('"reject", "hangup"');
    expect(rejectIndex).toBeGreaterThanOrEqual(0);
    expect(
      handleIntent.indexOf('clearPendingPushActionForCall(this, callId)', rejectIndex)
    ).toBeGreaterThan(rejectIndex);

    // Selecting the call keeps its metadata available for the connection that
    // handles it; only rejecting or hanging up abandons the flow.
    const answerIndex = handleIntent.indexOf('"answer", "incoming_call"');
    expect(answerIndex).toBeGreaterThan(rejectIndex);
    expect(handleIntent.slice(answerIndex)).not.toContain('clearPendingPushActionForCall');
  });

  it('does not duplicate session login fields in the Android layer', () => {
    // sessid/attach_call belong to the low-level login builder (package/) and
    // the native voice SDK; the Android bridge only scopes push metadata.
    const androidSources = [
      managerSource,
      bridgeSource,
      appMessagingSource,
      appReceiverSource,
      appActivitySource,
    ];

    for (const source of androidSources) {
      expect(source).not.toContain('"sessid"');
      expect(source).not.toContain('attach_call');
    }
  });
});
