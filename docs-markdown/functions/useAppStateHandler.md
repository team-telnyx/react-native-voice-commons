[**@telnyx/react-voice-commons-sdk v0.1.2**](../README.md)

***

[@telnyx/react-voice-commons-sdk](../globals.md) / useAppStateHandler

# Function: useAppStateHandler()

> **useAppStateHandler**(`__namedParameters`): `object`

Defined in: [hooks/useAppStateHandler.ts:20](https://github.com/team-telnyx/react-native-voice-commons/blob/531778fc3b7534661b18c7521a35e184b595c2c0/react-voice-commons-sdk/src/hooks/useAppStateHandler.ts#L20)

Hook to handle app state changes for VoIP behavior
When app goes to background without an active call, disconnect socket and redirect to login

## Parameters

### \_\_namedParameters

`UseAppStateHandlerOptions`

## Returns

`object`

### currentAppState

> **currentAppState**: `AppStateStatus` = `appState.current`
