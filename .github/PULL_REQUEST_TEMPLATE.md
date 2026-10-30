<!-- Ticket details and link -->

## [WEBRTC-XXX - Ticket title](https://telnyx.atlassian.net/browse/WEBRTC-XXX)

<!-- Describe your change here -->

Please provide a summary of the change / issue with a proper context.

## :older_man: :baby: Behaviors

### Before changes

- Describe the behaviour before making the changes.

### After changes

- Describe the behaviour and impact after the changes.

## TODO

Please mention pending items if any.

## ✋ Manual testing

1. Please list down all the steps required to test the changes.

## Known Issues

Please mention known issues if any.

## Screenshots

Please attach the screenshots if required

## Application Flow Checklist

Run on physical iOS and Android devices using the React Native demo. Mark anything not tested as N/A with a reason.

- Versions tested (voice-sdk / commons-sdk):
- iOS device / OS:
- Android device / OS:

### 🧪 Logged in with Token

- [ ] **Connection:** Establish connection via Token

#### Inbound Calls (Receiving as Token user)

- [ ] Receive inbound call from SIP Connection
  - [ ] On WiFi
  - [ ] On Mobile Network

#### Outbound Calls (Making calls as Token user)

- [ ] Make outbound call to SIP Connection
  - [ ] On WiFi
  - [ ] On Mobile Network
- [ ] Make outbound call to associated number
  - [ ] On WiFi
  - [ ] On Mobile Network
- [ ] Make outbound call to PSTN
  - [ ] On WiFi
  - [ ] On Mobile Network

#### Notifications (While logged in as Token)

- [ ] Receive push notification (App Background) -> Reject Call
  - [ ] Screen On
  - [ ] Screen Locked (Active)
  - [ ] Screen Locked (Sleep)
- [ ] Receive push notification (App Background) -> Accept Call
  - [ ] Screen On
  - [ ] Screen Locked (Active)
  - [ ] Screen Locked (Sleep)
- [ ] Receive push notification (App Terminated) -> Reject Call
  - [ ] Screen On
  - [ ] Screen Locked (Active)
  - [ ] Screen Locked (Sleep)
- [ ] Receive push notification (App Terminated) -> Accept Call
  - [ ] Screen On
  - [ ] Screen Locked (Active)
  - [ ] Screen Locked (Sleep)

---

### 📞 Logged in with SIP Connection

- [ ] **Connection:** Establish connection via SIP Credential

#### Inbound Calls (Receiving as SIP user)

- [ ] Receive inbound call from another SIP Connection
  - [ ] On WiFi
  - [ ] On Mobile Network
- [ ] Receive inbound call via associated number
  - [ ] On WiFi
  - [ ] On Mobile Network
- [ ] Receive inbound call from PSTN
  - [ ] On WiFi
  - [ ] On Mobile Network

#### Outbound Calls (Making calls as SIP user)

- [ ] Make outbound call to SIP Connection
  - [ ] On WiFi
  - [ ] On Mobile Network
- [ ] Make outbound call to associated number
  - [ ] On WiFi
  - [ ] On Mobile Network
- [ ] Make outbound call to PSTN
  - [ ] On WiFi
  - [ ] On Mobile Network

#### Notifications (While logged in as SIP)

- [ ] Receive push notification (App Background) -> Reject Call
  - [ ] Screen On
  - [ ] Screen Locked (Active)
  - [ ] Screen Locked (Sleep)
- [ ] Receive push notification (App Background) -> Accept Call
  - [ ] Screen On
  - [ ] Screen Locked (Active)
  - [ ] Screen Locked (Sleep)
- [ ] Receive push notification (App Terminated) -> Reject Call
  - [ ] Screen On
  - [ ] Screen Locked (Active)
  - [ ] Screen Locked (Sleep)
- [ ] Receive push notification (App Terminated) -> Accept Call
  - [ ] Screen On
  - [ ] Screen Locked (Active)
  - [ ] Screen Locked (Sleep)

---

### 👤 Logged in with genCred

- [ ] **Connection:** Establish connection via genCred

#### Inbound Calls (Receiving as genCred user)

- [ ] Receive inbound call from SIP Connection
  - [ ] On WiFi
  - [ ] On Mobile Network
- [ ] Receive inbound call via associated number
  - [ ] On WiFi
  - [ ] On Mobile Network
- [ ] Receive inbound call from PSTN
  - [ ] On WiFi
  - [ ] On Mobile Network

#### Outbound Calls (Making calls as genCred user)

- [ ] Make outbound call to SIP Connection
  - [ ] On WiFi
  - [ ] On Mobile Network
- [ ] Make outbound call to associated number
  - [ ] On WiFi
  - [ ] On Mobile Network
- [ ] Make outbound call to PSTN
  - [ ] On WiFi
  - [ ] On Mobile Network

#### Notifications (While logged in as genCred)

- [ ] Receive push notification (App Background) -> Reject Call
  - [ ] Screen On
  - [ ] Screen Locked (Active)
  - [ ] Screen Locked (Sleep)
- [ ] Receive push notification (App Background) -> Accept Call
  - [ ] Screen On
  - [ ] Screen Locked (Active)
  - [ ] Screen Locked (Sleep)
- [ ] Receive push notification (App Terminated) -> Reject Call
  - [ ] Screen On
  - [ ] Screen Locked (Active)
  - [ ] Screen Locked (Sleep)
- [ ] Receive push notification (App Terminated) -> Accept Call
  - [ ] Screen On
  - [ ] Screen Locked (Active)
  - [ ] Screen Locked (Sleep)

---

### 🔁 General Reconnection Scenarios

- [ ] Establish call -> Drop network -> Re-establish connection within timeframe
  - [ ] On WiFi
  - [ ] On 4G/Mobile Network
- [ ] Establish call -> Drop network -> Fail to re-establish connection within timeframe (verify dropped state)
  - [ ] On WiFi
  - [ ] On 4G/Mobile Network

---

### 📊 General Stats Scenarios

- [ ] Enable stats (config level) -> Establish call -> Verify portal stats appear
- [ ] Disable stats (config level) -> Establish call -> Verify no portal stats appear
- [ ] Enable stats (call level) -> Establish call -> Verify quality metrics are available
- [ ] Disable stats (call level) -> Establish call -> Verify quality metrics are not available

---

### 📞 Call Waiting Scenarios

A is the current call, B is the second incoming call.

- [ ] A active -> Receive B -> Hold & Accept -> Verify A held, B active with audio
- [ ] A active -> Receive B -> End & Accept -> Verify A ended, B active with audio
- [ ] A active -> Receive B -> Decline -> Verify B ended, A still active with audio
- [ ] A held -> Receive B -> Answer -> Verify A stays held, B active with audio
- [ ] A held, B active -> Swap calls a few times -> Verify audio follows the active call
- [ ] A held, B active -> End B -> Resume A -> Verify A has audio
  - [ ] Local hangup
  - [ ] Remote hangup
- [ ] A active -> Receive B -> B hangs up while tapping Hold & Accept -> Verify no ghost B, A can resume
- [ ] A active -> Receive B -> Answer from system UI and app at once -> Verify only one B connects
- [ ] A active -> Decline B -> Immediately receive C -> Answer C -> Verify C connects with the right caller
- [ ] A active -> Receive B -> Accept or Decline
  - [ ] App Background
  - [ ] Screen Locked
- [ ] A held, B active -> Toggle mute/speaker -> Swap calls -> Verify controls apply to the active call
- [ ] A active -> Hold & Accept B -> Drop network -> Verify calls recover or end cleanly
