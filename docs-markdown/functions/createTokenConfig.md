[**@telnyx/react-voice-commons-sdk v0.1.2**](../README.md)

***

[@telnyx/react-voice-commons-sdk](../globals.md) / createTokenConfig

# Function: createTokenConfig()

> **createTokenConfig**(`sipToken`, `options?`): [`TokenConfig`](../interfaces/TokenConfig.md)

Defined in: [models/config.ts:116](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/models/config.ts#L116)

Creates a token-based configuration

## Parameters

### sipToken

`string`

JWT token for authentication

### options?

`Partial`\<`Omit`\<[`TokenConfig`](../interfaces/TokenConfig.md), `"type"` \| `"sipToken"`\>\>

Optional configuration settings

## Returns

[`TokenConfig`](../interfaces/TokenConfig.md)

Complete token configuration object
