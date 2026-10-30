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

For releases, run this checklist on physical iOS and Android devices using the React Native demo/integration (native SDK testing alone is not sufficient). Record each platform's results separately below. Check an item only after all applicable runs pass; record FAIL, BLOCKED or N/A with a reason and linked evidence instead of checking an untested item. For feature PRs, record which scenarios were tested and why others are out of scope.

- Packages/build tested (voice-sdk and commons-sdk versions):
- Tester/date:
- iOS device/OS, results and evidence:
- Android device/OS, results and evidence:
- Failures, blocked prerequisites or N/A reasons:

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

### 📞 Call waiting and overlapping actions

Use two independent callers: A is the existing call, B is the waiting call and C is a subsequent call. Repeat with incoming and outgoing A, and apply the existing auth/network/app-state coverage where relevant. Use the supported iOS CallKit or Android notification/in-app controls; record unsupported actions as N/A with a reason. In every connected case, verify the caller identity and actual two-way audio, not just an ACTIVE/HELD label.

- [ ] **Waiting-call choices:** With A active, receive B and separately try Hold & Accept, End & Accept and Decline. Only the intended call ends or holds; B connects when accepted and A remains usable when B is declined.
- [ ] **Already-held / pending hold:** Answer B with A already held, then repeat by tapping Hold & Accept immediately when B arrives. B is not blocked by A's presence or pending hold; A stays held and B has two-way audio.
- [ ] **Repeated swaps and surviving call:** With A held and B active, swap both ways three times. End A and B in separate runs, using both local and remote hangup. Each selected call regains audio; the survivor has correct controls and can resume.
- [ ] **Caller cancels during acceptance:** Have B hang up just before/after Hold & Accept, including while A is being held. No ghost B remains; newly held A is restored or has a working Resume action. Repeat with A initially held: it must not resume unexpectedly.
- [ ] **Hold / answer rejection:** Using a documented QA failure setup, reject the hold request, then separately fail B's answer after A was held. Failure is visible, A is recoverable, and waiting choices/retry remain available while B is ringing. End & Accept must not falsely restore an ended A.
- [ ] **Duplicate answer entry points:** Answer B from system UI/notification while opening and tapping Answer in the app; also double-tap Answer. Only one B/audio path connects and A is not unintentionally ended.
- [ ] **Old call versus new call:** Cancel/decline B while ringing/connecting, immediately call as C and answer quickly. Delayed B callbacks/timeouts must not answer, dismiss or end C; C shows the correct caller and has audio.
- [ ] **Background / locked transitions:** With A active, accept and decline B from background/locked state and while reopening the app. System and React Native UI agree on both calls, with no duplicate incoming screen or unrelated teardown.
- [ ] **Audio controls across swaps:** Change mute, speaker and a supported Bluetooth/headset route during A/B swaps, then end B and return to A. Controls affect the intended call, with no one-way audio or held-call microphone leakage.
- [ ] **Network change during transition:** Switch Wi-Fi/cellular or briefly drop connectivity during hold/answer/swap, then recover. No stuck/ghost call or ended call returns; the survivor recovers audio or ends with clear feedback.
- [ ] **React Native card selection:** Accept B from the waiting-call card; repeat while B cancels or acceptance fails. Successful B is selected, but a late completion never selects ended/failed B. A remains selectable and recoverable if it survives.
- [ ] **Cold-start push overlap:** Start the app from B's push, cancel B and immediately call as C; also duplicate the same push with the approved QA tool. No duplicate incoming UI or stale B answer reaches C. Run through the React Native integration on each OS.

For rejected requests, duplicate pushes or controlled delays, document the QA tool/setup used. If the required setup is unavailable, record BLOCKED and the missing prerequisite; mocked/unit tests are not a manual device pass.
