[**@telnyx/react-voice-commons-sdk v0.1.2**](../README.md)

***

[@telnyx/react-voice-commons-sdk](../globals.md) / createCredentialConfig

# Function: createCredentialConfig()

> **createCredentialConfig**(`sipUser`, `sipPassword`, `options?`): [`CredentialConfig`](../interfaces/CredentialConfig.md)

Defined in: [models/config.ts:94](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/models/config.ts#L94)

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
