import { Call, TelnyxCallState } from '../react-voice-commons-sdk/src';
import { RingingCall } from './RingingCall';
import { ActiveCall } from './ActiveCall';
import { CallConnecting } from './CallConnecting';

type Props = {
  call: Call | null;
  callState: TelnyxCallState | null;
};

const CurrentCall = ({ call, callState }: Props) => {
  // Check if this is a push notification call by accessing the underlying Telnyx call's client isCallFromPush flag
  const isPushNotificationCall = call
    ? (call as any).telnyxCall?.connection?._client?.isCallFromPush
    : false;

  console.log('CurrentCall: Rendering with', {
    hasCall: !!call,
    callId: call?.callId,
    destination: call?.destination,
    callState,
    isPushNotificationCall: isPushNotificationCall,
  });

  if (!call || !callState) {
    console.log('CurrentCall: Not rendering - no call or no call state');
    return null;
  }

  switch (callState) {
    case TelnyxCallState.RINGING: {
      console.log('CurrentCall: Rendering RingingCall', { isPushNotificationCall });
      return <RingingCall call={call} isPushNotificationCall={isPushNotificationCall} />;
    }
    case TelnyxCallState.CONNECTING: {
      console.log('CurrentCall: Rendering CallConnecting', { isPushNotificationCall });
      return <CallConnecting call={call} isPushNotificationCall={isPushNotificationCall} />;
    }
    case TelnyxCallState.ACTIVE:
    case TelnyxCallState.HELD: {
      console.log('CurrentCall: Rendering ActiveCall for state:', callState);
      return <ActiveCall call={call} />;
    }
    case TelnyxCallState.ENDED:
    case TelnyxCallState.FAILED:
    case TelnyxCallState.DROPPED: {
      console.log('CurrentCall: Not rendering - call state is', callState);
      return null;
    }
    default: {
      console.log('CurrentCall: Not rendering - unknown call state:', callState);
      return null;
    }
  }
};

export default CurrentCall;
