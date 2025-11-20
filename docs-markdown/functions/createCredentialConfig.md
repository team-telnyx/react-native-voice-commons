# Function: createCredentialConfig()

> **createCredentialConfig**(`sipUser`, `sipPassword`, `options?`): [`CredentialConfig`](../interfaces/CredentialConfig.md)

Defined in: [models/config.ts:94](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/models/config.ts#L94)

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
