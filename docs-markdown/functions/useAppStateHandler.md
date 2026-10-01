# Function: useAppStateHandler()

> **useAppStateHandler**(`__namedParameters`): `object`

Defined in: [hooks/useAppStateHandler.ts:19](https://github.com/team-telnyx/react-native-voice-commons/blob/16f83b09dd3a6c7aff2b371d28f6a3c260e60749/react-voice-commons-sdk/src/hooks/useAppStateHandler.ts#L19)

Hook to handle app state changes for VoIP behavior
When app goes to background without an active call, disconnect socket and redirect to login

## Parameters

### \_\_namedParameters

`UseAppStateHandlerOptions`

## Returns

`object`

### currentAppState

> **currentAppState**: `AppStateStatus` = `appState.current`
