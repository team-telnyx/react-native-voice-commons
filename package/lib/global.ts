export let CALL_REPORT_ID: string | null = null;
export const updateCallReportId = (id: string | null) => {
  if (typeof id !== 'string' && id !== null) {
    return;
  }
  CALL_REPORT_ID = id;
};
