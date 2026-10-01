import { CallStateController } from '../../../src/internal/calls/call-state-controller';

describe('CallStateController', () => {
  const createController = (newCall = jest.fn()) => {
    const sessionManager = {
      telnyxClient: { newCall },
      useTrickleIce: true,
    } as any;

    return new CallStateController(sessionManager);
  };

  const mockTelnyxCall = () => ({
    callId: 'call-123',
    on: jest.fn(),
    off: jest.fn(),
  });

  it('converts record custom headers to the SDK array format when creating a call', async () => {
    const newCall = jest.fn().mockResolvedValue(mockTelnyxCall());
    const controller = createController(newCall);

    await controller.newCall('15551234567', 'Alice', '15557654321', {
      'X-Customer-Id': '123',
      'X-Trace-Id': 'trace-abc',
    });

    expect(newCall).toHaveBeenCalledWith(
      expect.objectContaining({
        customHeaders: [
          { name: 'X-Customer-Id', value: '123' },
          { name: 'X-Trace-Id', value: 'trace-abc' },
        ],
      })
    );
  });

  it('preserves array custom headers when creating a call', async () => {
    const newCall = jest.fn().mockResolvedValue(mockTelnyxCall());
    const controller = createController(newCall);
    const customHeaders = [{ name: 'X-Customer-Id', value: '123' }];

    await controller.newCall('15551234567', undefined, undefined, customHeaders);

    expect(newCall).toHaveBeenCalledWith(
      expect.objectContaining({
        customHeaders,
      })
    );
  });
});
