import EventEmitter from 'eventemitter3';
import { Call } from './call';

export type Notification = {
  type: 'callUpdate';
  call: Call;
};
type Events = {
  'telnyx.socket.open': () => unknown;
  'telnyx.socket.close': () => unknown;
  'telnyx.socket.error': (error: Error) => unknown;
  'telnyx.socket.message': (message: unknown) => unknown;
  'telnyx.ready': () => unknown;
  'telnyx.error': (error: Error) => unknown;
  'telnyx.notification': (notification: Notification) => unknown;
};
export const eventBus = new EventEmitter<Events>();
