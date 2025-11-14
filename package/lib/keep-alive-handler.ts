import { EventEmitter } from 'eventemitter3';
import { Connection } from './connection';
import log from 'loglevel';
import { createKeepAlivePingAck, isKeepAlivePing } from './messages/keep-alive';
type KeepAliveHandlerEvents = {
  'telnyx.internal.keepalive.error': () => void;
};
export class KeepAliveHandler extends EventEmitter<KeepAliveHandlerEvents> {
  private connection: Connection;

  constructor(connection: Connection) {
    super();
    this.connection = connection;
  }

  public start = () => {
    this.connection.addListener('telnyx.socket.message', this.onSocketMessage);
  };
  public stop = () => {
    this.connection.removeListener('telnyx.socket.message', this.onSocketMessage);
  };

  private onSocketMessage = async (msg: unknown) => {
    if (!isKeepAlivePing(msg)) {
      return;
    }

    log.debug('[KeepAliveHandler]: Received keep-alive ping', msg);
    await this.connection.sendAndWait(createKeepAlivePingAck());
  };
}
