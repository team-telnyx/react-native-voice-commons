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
 * Native Telnyx SDKs add `a=ice-options:trickle` at the session level after
 * the origin line. If WebRTC generated extra options, normalize the line to
 * only `trickle` so the signaling payload matches Android.
 */
export function addTrickleIceCapability(sdp: string): string {
  if (!sdp) {
    return sdp;
  }

  const lines = sdp.split(SDP_LINE_SEPARATOR);
  const existingIndex = lines.findIndex((line) => line.startsWith('a=ice-options:'));
  if (existingIndex >= 0) {
    if (lines[existingIndex] === 'a=ice-options:trickle') {
      return sdp;
    }
    lines[existingIndex] = 'a=ice-options:trickle';
    return joinSdpLines(lines, sdp);
  }

  const originIndex = lines.findIndex((line) => line.startsWith('o='));
  const insertAt = originIndex >= 0 ? originIndex + 1 : lines.length;
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

/**
 * Match Android's candidate cleaning before signaling: keep the RFC candidate
 * fields and drop WebRTC-specific extensions like generation, ufrag, network-id
 * and network-cost.
 */
export function cleanCandidateString(candidate: string): string {
  const normalized = normalizeRemoteCandidateString(candidate).trim();
  const parts = normalized.split(/\s+/);
  if (!parts[0]?.startsWith('candidate:') || parts.length < 8) {
    return normalized;
  }

  const cleaned = parts.slice(0, 8);
  for (let i = 8; i < parts.length; i++) {
    const part = parts[i];
    if ((part === 'raddr' || part === 'rport') && i + 1 < parts.length) {
      cleaned.push(part, parts[i + 1]);
      i++;
    }
  }
  return cleaned.join(' ');
}

export function prepareTrickleSdp(sdp: string): string {
  return addTrickleIceCapability(removeCandidateLines(sdp));
}
