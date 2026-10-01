# Function: createTokenConfig()

> **createTokenConfig**(`sipToken`, `options?`): [`TokenConfig`](../interfaces/TokenConfig.md)

Defined in: [models/config.ts:150](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/models/config.ts#L150)

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
