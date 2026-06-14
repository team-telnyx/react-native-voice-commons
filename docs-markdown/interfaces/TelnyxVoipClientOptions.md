# Interface: TelnyxVoipClientOptions

Defined in: [telnyx-voip-client.ts:11](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/telnyx-voip-client.ts#L11)

Configuration options for TelnyxVoipClient

## Properties

### enableAppStateManagement?

> `optional` **enableAppStateManagement**: `boolean`

Defined in: [telnyx-voip-client.ts:13](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/telnyx-voip-client.ts#L13)

Enable automatic app state management (background/foreground behavior) - default: true

***

### debug?

> `optional` **debug**: `boolean`

Defined in: [telnyx-voip-client.ts:16](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/telnyx-voip-client.ts#L16)

Enable debug logging. Default: `false`

***

### useTrickleIce?

> `optional` **useTrickleIce**: `boolean`

Defined in: [telnyx-voip-client.ts:23](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/telnyx-voip-client.ts#L23)

Enable Trickle ICE for calls created by this client. When enabled, the SDK sends the initial SDP immediately and delivers ICE candidates incrementally, which can reduce call setup latency. Default: `false`

See the [Trickle ICE guide](../call-features/trickle-ice.md) for details and usage examples.
