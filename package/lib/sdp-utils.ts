const SDP_LINE_SEPARATOR = /\r\n|\n|\r/;

function joinSdpLines(lines: string[], originalSdp: string): string {
  const separator = originalSdp.includes('\r\n') ? '\r\n' : '\n';
  const hasTrailingNewline = /(?:\r\n|\n|\r)$/.test(originalSdp);
  const joined = lines.join(separator);
  return hasTrailingNewline ? `${joined}${separator}` : joined;
}

/**
 * Advertise Trickle ICE support in SDP.
 *
 * Native Telnyx SDKs add `a=ice-options:trickle` before sending the initial
 * offer/answer when Trickle ICE is enabled. This helper is idempotent so it can
 * safely be applied from multiple call paths.
 */
export function addTrickleIceCapability(sdp: string): string {
  if (!sdp || /(^|\r?\n)a=ice-options:.*\btrickle\b/.test(sdp)) {
    return sdp;
  }

  const lines = sdp.split(SDP_LINE_SEPARATOR);
  const firstMediaLineIndex = lines.findIndex((line) => line.startsWith('m='));
  const insertAt = firstMediaLineIndex >= 0 ? firstMediaLineIndex : lines.length;
  lines.splice(insertAt, 0, 'a=ice-options:trickle');
  return joinSdpLines(lines, sdp);
}

/**
 * Remove already gathered ICE candidates from the initial SDP when Trickle ICE
 * is enabled. Candidates are sent separately over `telnyx_rtc.candidate`, so
 * keeping them in SDP can duplicate candidate delivery.
 */
export function removeCandidateLines(sdp: string): string {
  if (!sdp) {
    return sdp;
  }

  const lines = sdp
    .split(SDP_LINE_SEPARATOR)
    .filter((line) => !line.startsWith('a=candidate:') && line !== 'a=end-of-candidates');

  return joinSdpLines(lines, sdp);
}

/**
 * RTCIceCandidateInit expects `candidate:` without the SDP `a=` line prefix.
 */
export function normalizeRemoteCandidateString(candidate: string): string {
  return candidate.replace(/^a=/, '');
}

export function prepareTrickleSdp(sdp: string): string {
  return addTrickleIceCapability(removeCandidateLines(sdp));
}
