let mockSocket: {
  onOpen: jest.Mock;
  onError: jest.Mock;
  onClose: jest.Mock;
  onMessage: jest.Mock;
  connect: jest.Mock;
  send: jest.Mock;
  close: jest.Mock;
  removeOnOpenListener: jest.Mock;
  removeOnErrorListener: jest.Mock;
  removeOnCloseListener: jest.Mock;
  removeOnMessageListener: jest.Mock;
};

jest.mock('react-native-websocket-self-signed', () => ({
  getInstance: jest.fn(() => mockSocket),
}));

describe('Connection teardown', () => {
  let emitClose: () => void;

  beforeEach(() => {
    emitClose = () => {};
    mockSocket = {
      onOpen: jest.fn(),
      onError: jest.fn(),
      onClose: jest.fn((callback: () => void) => {
        emitClose = callback;
      }),
      onMessage: jest.fn(),
      connect: jest.fn(() => Promise.resolve()),
      send: jest.fn(),
      close: jest.fn(),
      removeOnOpenListener: jest.fn(),
      removeOnErrorListener: jest.fn(),
      removeOnCloseListener: jest.fn(),
      removeOnMessageListener: jest.fn(),
    };
  });

  it('rejects pending sendAndWait promises on explicit close', async () => {
    const { Connection } = require('../lib/connection.ts') as typeof import('../lib/connection');
    const connection = new Connection();
    const closeListener = jest.fn();

    connection.addListener('telnyx.socket.close', closeListener);

    const pendingResponse = connection.sendAndWait({ id: 'login' });
    const rejection = expect(pendingResponse).rejects.toThrow('Connection closed');

    connection.close();

    await rejection;
    expect(closeListener).not.toHaveBeenCalled();
    expect(mockSocket.close).toHaveBeenCalledTimes(1);
  });

  it('rejects sendAndWait calls created after explicit close', async () => {
    const { Connection } = require('../lib/connection.ts') as typeof import('../lib/connection');
    const connection = new Connection();

    connection.close();

    await expect(connection.sendAndWait({ id: 'after-close' })).rejects.toThrow(
      'Connection closed'
    );
  });

  it('continues close cleanup when native socket close throws', () => {
    const { Connection } = require('../lib/connection.ts') as typeof import('../lib/connection');
    const connection = new Connection();
    mockSocket.close.mockImplementationOnce(() => {
      throw new Error('native close failed');
    });

    expect(() => connection.close()).not.toThrow();
    expect(mockSocket.removeOnOpenListener).toHaveBeenCalledTimes(1);
    expect(mockSocket.removeOnErrorListener).toHaveBeenCalledTimes(1);
    expect(mockSocket.removeOnCloseListener).toHaveBeenCalledTimes(1);
    expect(mockSocket.removeOnMessageListener).toHaveBeenCalledTimes(1);
  });

  it('rejects pending sendAndWait promises on natural socket close', async () => {
    const { Connection } = require('../lib/connection.ts') as typeof import('../lib/connection');
    const connection = new Connection();

    const pendingResponse = connection.sendAndWait({ id: 'login' });
    const rejection = expect(pendingResponse).rejects.toThrow('Connection closed');

    emitClose();

    await rejection;
  });
});
