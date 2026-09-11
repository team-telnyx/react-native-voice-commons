# Function: createTelnyxVoipClient()

> **createTelnyxVoipClient**(`options?`): [`TelnyxVoipClient`](../classes/TelnyxVoipClient.md)

Defined in: [telnyx-voip-client.ts:833](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/telnyx-voip-client.ts#L833)

Create or retrieve the shared TelnyxVoipClient instance.

This uses a singleton pattern — calling it multiple times (e.g., inside a
React component body) always returns the same instance.  If you need to
reset the instance, call `destroyTelnyxVoipClient()` first.

## Parameters

### options?

[`TelnyxVoipClientOptions`](../interfaces/TelnyxVoipClientOptions.md)

## Returns

[`TelnyxVoipClient`](../classes/TelnyxVoipClient.md)
