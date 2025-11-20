# Function: createTokenConfig()

> **createTokenConfig**(`sipToken`, `options?`): [`TokenConfig`](../interfaces/TokenConfig.md)

Defined in: [models/config.ts:116](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/models/config.ts#L116)

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
