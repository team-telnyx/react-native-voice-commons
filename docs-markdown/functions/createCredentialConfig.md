# Function: createCredentialConfig()

> **createCredentialConfig**(`sipUser`, `sipPassword`, `options?`): [`CredentialConfig`](../interfaces/CredentialConfig.md)

Defined in: [models/config.ts:127](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/models/config.ts#L127)

Creates a credential configuration

## Parameters

### sipUser

`string`

SIP username for authentication

### sipPassword

`string`

SIP password for authentication

### options?

`Partial`\<`Omit`\<[`CredentialConfig`](../interfaces/CredentialConfig.md), `"type"` \| `"sipUser"` \| `"sipPassword"`\>\>

Optional configuration settings

## Returns

[`CredentialConfig`](../interfaces/CredentialConfig.md)

Complete credential configuration object
