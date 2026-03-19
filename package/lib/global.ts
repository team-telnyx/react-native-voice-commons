export let VOICE_SDK_ID: string | null = null;
export const updateVoiceSDKId = (id: string | null) => {
  if (typeof id !== 'string' && id !== null) {
    return;
  }
  VOICE_SDK_ID = id;
};

export let CALL_REPORT_ID: string | null = null;
export const updateCallReportId = (id: string | null) => {
  if (typeof id !== 'string' && id !== null) {
    return;
  }
  CALL_REPORT_ID = id;
};
