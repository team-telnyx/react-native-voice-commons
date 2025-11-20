# Function: useAppStateHandler()

> **useAppStateHandler**(`__namedParameters`): `object`

Defined in: [hooks/useAppStateHandler.ts:20](https://github.com/team-telnyx/react-native-voice-commons/blob/5f0c1df513588a68afc08a15104d57f9daa9c0a1/react-voice-commons-sdk/src/hooks/useAppStateHandler.ts#L20)

Hook to handle app state changes for VoIP behavior
When app goes to background without an active call, disconnect socket and redirect to login

## Parameters

### \_\_namedParameters

`UseAppStateHandlerOptions`

## Returns

`object`

### currentAppState

> **currentAppState**: `AppStateStatus` = `appState.current`
