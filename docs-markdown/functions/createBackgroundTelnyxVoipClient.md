# Function: createBackgroundTelnyxVoipClient()

> **createBackgroundTelnyxVoipClient**(`options?`): [`TelnyxVoipClient`](../classes/TelnyxVoipClient.md)

Defined in: [telnyx-voip-client.ts:862](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/telnyx-voip-client.ts#L862)

Create a new TelnyxVoipClient instance for background push notification handling.

Unlike `createTelnyxVoipClient`, this always creates a new instance because
background isolates need their own independent client.

## Parameters

### options?

[`TelnyxVoipClientOptions`](../interfaces/TelnyxVoipClientOptions.md)

## Returns

[`TelnyxVoipClient`](../classes/TelnyxVoipClient.md)
