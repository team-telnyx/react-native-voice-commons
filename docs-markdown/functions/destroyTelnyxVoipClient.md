# Function: destroyTelnyxVoipClient()

> **destroyTelnyxVoipClient**(): `Promise`\<`void`\>

Defined in: [telnyx-voip-client.ts:847](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/telnyx-voip-client.ts#L847)

Destroy the shared TelnyxVoipClient instance.

Disposes the current singleton so that a subsequent call to
`createTelnyxVoipClient()` will create a fresh instance.

## Returns

`Promise`\<`void`\>
