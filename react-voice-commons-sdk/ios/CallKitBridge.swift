import Foundation
import React

#if os(iOS)
    import CallKit
    import AVFoundation
    import UIKit
    import PushKit
    import UserNotifications
    import WebRTC

    @objc(CallKitBridge)
    class CallKitBridge: RCTEventEmitter {

        public static var shared: CallKitBridge?
        private var hasListeners = false

        override init() {
            super.init()
            CallKitBridge.shared = self

            // Explicitly initialize the CallKit manager when React Native bridge loads
            TelnyxCallKitManager.shared.setup()
            NSLog("TelnyxVoice: CallKitBridge initialized with TelnyxCallKitManager active")
        }

        override func supportedEvents() -> [String]! {
            return [
                "CallKitDidReceiveStartCallAction",
                "CallKitDidPerformAnswerCallAction",
                "CallKitDidPerformEndCallAction",
                "CallKitDidReceivePush",
                "AudioSessionActivated",
                "AudioSessionDeactivated",
                "AudioSessionFailed",
            ]
        }

        override func startObserving() {
            hasListeners = true
        }

        override func stopObserving() {
            hasListeners = false
        }

        // Helper to get the CallKit manager
        private func getCallKitManager() -> TelnyxCallKitManager {
            return TelnyxCallKitManager.shared
        }

        // Direct event emission methods called by TelnyxVoiceAppDelegate
        public func emitCallEvent(_ eventName: String, callUUID: UUID, callData: [String: Any]?) {
            guard hasListeners else { return }

            let eventData: [String: Any] = [
                "callUUID": callUUID.uuidString,
                "callData": callData ?? [:],
            ]

            sendEvent(withName: eventName, body: eventData)
        }

        // Event emission method for audio session changes
        public func emitAudioSessionEvent(_ eventName: String, data: [String: Any]) {
            guard hasListeners else { return }

            sendEvent(withName: eventName, body: data)
        }

        // MARK: - React Native Exported Methods

        @objc func startOutgoingCall(
            _ callUUID: String, handle: String, displayName: String,
            resolver resolve: @escaping RCTPromiseResolveBlock,
            rejecter reject: @escaping RCTPromiseRejectBlock
        ) {
            guard let uuid = UUID(uuidString: callUUID) else {
                reject("INVALID_UUID", "Invalid UUID format", nil)
                return
            }

            let manager = getCallKitManager()
            guard let callController = manager.callKitController else {
                reject("NO_CALLKIT", "CallKit not available", nil)
                return
            }

            let callHandle = CXHandle(type: .phoneNumber, value: handle)
            let startCallAction = CXStartCallAction(call: uuid, handle: callHandle)
            let transaction = CXTransaction(action: startCallAction)

            callController.request(transaction) { error in
                if let error = error {
                    reject("START_CALL_ERROR", error.localizedDescription, error)
                } else {
                    resolve(["success": true, "callUUID": callUUID])
                }
            }
        }

        @objc func reportIncomingCall(
            _ callUUID: String, handle: String, displayName: String,
            resolver resolve: @escaping RCTPromiseResolveBlock,
            rejecter reject: @escaping RCTPromiseRejectBlock
        ) {
            guard let uuid = UUID(uuidString: callUUID) else {
                reject("INVALID_UUID", "Invalid UUID format", nil)
                return
            }

            let manager = getCallKitManager()
            guard let provider = manager.callKitProvider else {
                reject("NO_CALLKIT", "CallKit not available", nil)
                return
            }

            let callHandle = CXHandle(type: .phoneNumber, value: handle)
            let callUpdate = CXCallUpdate()
            callUpdate.remoteHandle = callHandle
            callUpdate.hasVideo = false
            callUpdate.localizedCallerName = displayName

            provider.reportNewIncomingCall(with: uuid, update: callUpdate) { error in
                if let error = error {
                    reject("INCOMING_CALL_ERROR", error.localizedDescription, error)
                } else {
                    resolve(["success": true, "callUUID": callUUID])
                }
            }
        }

        @objc func endCall(
            _ callUUID: String, resolver resolve: @escaping RCTPromiseResolveBlock,
            rejecter reject: @escaping RCTPromiseRejectBlock
        ) {
            guard let uuid = UUID(uuidString: callUUID) else {
                reject("INVALID_UUID", "Invalid UUID format", nil)
                return
            }

            let manager = getCallKitManager()
            guard let callController = manager.callKitController else {
                reject("NO_CALLKIT", "CallKit not available", nil)
                return
            }

            let endCallAction = CXEndCallAction(call: uuid)
            let transaction = CXTransaction(action: endCallAction)

            callController.request(transaction) { error in
                if let error = error {
                    reject("END_CALL_ERROR", error.localizedDescription, error)
                } else {
                    resolve(["success": true, "callUUID": callUUID])
                }
            }
        }

        @objc func answerCall(
            _ callUUID: String, resolver resolve: @escaping RCTPromiseResolveBlock,
            rejecter reject: @escaping RCTPromiseRejectBlock
        ) {
            guard let uuid = UUID(uuidString: callUUID) else {
                reject("INVALID_UUID", "Invalid UUID format", nil)
                return
            }

            let manager = getCallKitManager()
            guard let callController = manager.callKitController else {
                reject("NO_CALLKIT", "CallKit not available", nil)
                return
            }

            // Mark this call as already answered to prevent duplicate emission
            if var callData = manager.activeCalls[uuid] {
                callData["isAlreadyAnswered"] = true
                manager.activeCalls[uuid] = callData
            }

            let answerCallAction = CXAnswerCallAction(call: uuid)
            let transaction = CXTransaction(action: answerCallAction)

            callController.request(transaction) { error in
                if let error = error {
                    reject("ANSWER_CALL_ERROR", error.localizedDescription, error)
                } else {
                    resolve(["success": true, "callUUID": callUUID])
                }
            }
        }

        @objc func reportCallConnected(
            _ callUUID: String, resolver resolve: @escaping RCTPromiseResolveBlock,
            rejecter reject: @escaping RCTPromiseRejectBlock
        ) {
            guard let uuid = UUID(uuidString: callUUID) else {
                reject("INVALID_UUID", "Invalid UUID format", nil)
                return
            }

            let manager = getCallKitManager()
            guard let provider = manager.callKitProvider else {
                reject("NO_CALLKIT", "CallKit not available", nil)
                return
            }

            provider.reportOutgoingCall(with: uuid, connectedAt: Date())

            // Fulfill deferred CXAnswerCallAction now that peer connection is ready
            if let pendingAction = manager.pendingAnswerAction {
                NSLog("TelnyxVoice: reportCallConnected - fulfilling deferred CXAnswerCallAction")
                pendingAction.fulfill()
                manager.pendingAnswerAction = nil
            } else {
                // Fallback: ensure audio is enabled for non-push or already-fulfilled cases
                let rtcAudioSession = RTCAudioSession.sharedInstance()
                rtcAudioSession.lockForConfiguration()
                let webRTCConfig = RTCAudioSessionConfiguration.webRTC()
                webRTCConfig.categoryOptions = [.duckOthers, .allowBluetooth]
                do {
                    try rtcAudioSession.setConfiguration(webRTCConfig)
                } catch {
                    NSLog("TelnyxVoice: reportCallConnected - setConfiguration error: \(error)")
                }
                do {
                    try rtcAudioSession.setActive(true)
                } catch {
                    NSLog("TelnyxVoice: reportCallConnected - setActive error: \(error)")
                }
                rtcAudioSession.isAudioEnabled = true
                rtcAudioSession.unlockForConfiguration()
                rtcAudioSession.audioSessionDidActivate(AVAudioSession.sharedInstance())
            }

            resolve(["success": true])
        }

        @objc func reportCallEnded(
            _ callUUID: String, reason: NSNumber,
            resolver resolve: @escaping RCTPromiseResolveBlock,
            rejecter reject: @escaping RCTPromiseRejectBlock
        ) {
            guard let uuid = UUID(uuidString: callUUID) else {
                reject("INVALID_UUID", "Invalid UUID format", nil)
                return
            }

            let manager = getCallKitManager()
            guard let provider = manager.callKitProvider else {
                reject("NO_CALLKIT", "CallKit not available", nil)
                return
            }

            let endReason = CXCallEndedReason(rawValue: reason.intValue) ?? .remoteEnded
            provider.reportCall(with: uuid, endedAt: Date(), reason: endReason)
            resolve(["success": true])
        }

        @objc func getActiveCalls(
            _ resolver: @escaping RCTPromiseResolveBlock,
            rejecter reject: @escaping RCTPromiseRejectBlock
        ) {
            let manager = getCallKitManager()
            let activeCalls = Array(manager.activeCalls.values)
            resolver(activeCalls)
        }

        @objc func updateCall(
            _ callUUID: String, displayName: String, handle: String,
            resolver resolve: @escaping RCTPromiseResolveBlock,
            rejecter reject: @escaping RCTPromiseRejectBlock
        ) {
            guard let uuid = UUID(uuidString: callUUID) else {
                reject("INVALID_UUID", "Invalid UUID format", nil)
                return
            }

            let manager = getCallKitManager()
            guard let provider = manager.callKitProvider else {
                reject("NO_CALLKIT", "CallKit not available", nil)
                return
            }

            let callHandle = CXHandle(type: .phoneNumber, value: handle)
            let callUpdate = CXCallUpdate()
            callUpdate.remoteHandle = callHandle
            callUpdate.localizedCallerName = displayName

            provider.reportCall(with: uuid, updated: callUpdate)
            resolve(["success": true])
        }
    }

    // MARK: - Missed Call
    enum TelnyxVoiceUserDefaultsKey {
        static let missedCallNotificationsEnabled = "telnyx_enable_missed_call_notifications"
    }

    private enum TelnyxMissedCallPush {
        static let processedMissedCallIdsKey = "telnyx_processed_missed_call_ids"
        private static let missedCallMarkerKeys: Set<String> = [
            "is_missed_call",
            "message",
            "missed",
            "missed_call",
            "notification_type",
            "push_type",
            "type",
        ]
        private static let affirmativeMissedCallValues: Set<String> = [
            "1",
            "missed",
            "missed call",
            "true",
            "yes",
        ]

        static func isMissedCallPayload(_ payload: [AnyHashable: Any]) -> Bool {
            return containsMissedCallMarker(payload)
        }

        static func stableIdentifier(from payload: [AnyHashable: Any]) -> String {
            if let callId = callId(from: payload), !callId.isEmpty {
                return callId
            }

            return "payload-\(hashHex(canonicalString(from: payload)))"
        }

        static func uuid(from identifier: String) -> UUID {
            if let uuid = UUID(uuidString: identifier) {
                return uuid
            }

            let firstHash = hashHex(identifier)
            let secondHash = hashHex("telnyx-\(identifier)")
            let uuidString =
                "\(firstHash.prefix(8))-\(firstHash.dropFirst(8).prefix(4))-\(firstHash.dropFirst(12).prefix(4))-\(secondHash.prefix(4))-\(secondHash.dropFirst(4).prefix(12))"

            return UUID(uuidString: uuidString) ?? UUID()
        }

        static func callId(from payload: [AnyHashable: Any]) -> String? {
            return stringValue(for: ["call_id", "callId"], in: payload)
        }

        static func callerName(from payload: [AnyHashable: Any]) -> String {
            return stringValue(for: ["caller_name", "caller", "from"], in: payload)
                ?? callerNumber(from: payload)
        }

        static func callerNumber(from payload: [AnyHashable: Any]) -> String {
            return stringValue(for: ["caller_number", "caller", "from"], in: payload)
                ?? "Unknown Caller"
        }

        static func missedCallNotificationsEnabled() -> Bool {
            // bool(forKey:) returns false for both "unset" and "false"; default to enabled
            // unless the app explicitly stores a preference.
            guard
                UserDefaults.standard.object(
                    forKey: TelnyxVoiceUserDefaultsKey.missedCallNotificationsEnabled) != nil
            else {
                return true
            }
            return UserDefaults.standard.bool(
                forKey: TelnyxVoiceUserDefaultsKey.missedCallNotificationsEnabled)
        }

        private static func stringValue(for keys: [String], in payload: [AnyHashable: Any]) -> String? {
            if let metadata = payload["metadata"] as? [AnyHashable: Any],
                let value = firstStringValue(for: keys, in: metadata)
            {
                return value
            }

            if let metadata = payload["metadata"] as? [String: Any],
                let value = firstStringValue(for: keys, in: metadata)
            {
                return value
            }

            return firstStringValue(for: keys, in: payload)
        }

        private static func firstStringValue(for keys: [String], in dictionary: [AnyHashable: Any])
            -> String?
        {
            for key in keys {
                if let value = dictionary[key] as? String, !value.isEmpty {
                    return value
                }
            }
            return nil
        }

        private static func firstStringValue(for keys: [String], in dictionary: [String: Any])
            -> String?
        {
            for key in keys {
                if let value = dictionary[key] as? String, !value.isEmpty {
                    return value
                }
            }
            return nil
        }

        private static func containsMissedCallMarker(_ value: Any, key: String? = nil) -> Bool {
            if let key = key, missedCallMarkerKeys.contains(normalizedPayloadKey(key)) {
                if let boolValue = value as? Bool {
                    return boolValue
                }

                if let stringValue = value as? String {
                    return affirmativeMissedCallValues.contains(normalizedMissedCallValue(stringValue))
                }
            }

            if let stringValue = value as? String {
                let normalized = normalizedMissedCallValue(stringValue)
                if normalized == "missed call" || normalized == "missed" {
                    return true
                }
            }

            if let dictionary = value as? [AnyHashable: Any] {
                return dictionary.contains { rawKey, nestedValue in
                    containsMissedCallMarker(nestedValue, key: String(describing: rawKey))
                }
            }

            if let dictionary = value as? [String: Any] {
                return dictionary.contains { key, nestedValue in
                    containsMissedCallMarker(nestedValue, key: key)
                }
            }

            if let array = value as? [Any] {
                return array.contains { containsMissedCallMarker($0) }
            }

            return false
        }

        private static func normalizedPayloadKey(_ key: String) -> String {
            return key
                .lowercased()
                .replacingOccurrences(of: "-", with: "_")
                .replacingOccurrences(of: " ", with: "_")
                .trimmingCharacters(in: .whitespacesAndNewlines)
        }

        private static func normalizedMissedCallValue(_ value: String) -> String {
            return value
                .lowercased()
                .replacingOccurrences(of: "_", with: " ")
                .replacingOccurrences(of: "-", with: " ")
                .replacingOccurrences(of: "!", with: "")
                .trimmingCharacters(in: .whitespacesAndNewlines)
        }

        private static func canonicalString(from value: Any) -> String {
            if let dictionary = value as? [AnyHashable: Any] {
                return dictionary
                    .map { (String(describing: $0.key), $0.value) }
                    .sorted { $0.0 < $1.0 }
                    .map { "\($0):\(canonicalString(from: $1))" }
                    .joined(separator: "|")
            }

            if let dictionary = value as? [String: Any] {
                return dictionary
                    .sorted { $0.key < $1.key }
                    .map { "\($0):\(canonicalString(from: $1))" }
                    .joined(separator: "|")
            }

            if let array = value as? [Any] {
                return array.map { canonicalString(from: $0) }.joined(separator: ",")
            }

            return String(describing: value)
        }

        private static func hashHex(_ value: String) -> String {
            let prime: UInt64 = 1_099_511_628_211
            var hash: UInt64 = 14_695_981_039_346_656_037

            for byte in value.utf8 {
                hash ^= UInt64(byte)
                hash = hash &* prime
            }

            return String(format: "%016llx", hash)
        }
    }

    // MARK: - TelnyxCallKitManager
    /// TelnyxCallKitManager - Automatically handles CallKit integration for Telnyx Voice
    /// This class sets up CallKit and VoIP push notifications automatically when the app starts
    /// No AppDelegate changes required!
    @objc public class TelnyxCallKitManager: NSObject {

        public static let shared = TelnyxCallKitManager()

        public var voipRegistry: PKPushRegistry?
        public var callKitProvider: CXProvider?
        public var callKitController: CXCallController?
        public var activeCalls: [UUID: [String: Any]] = [:]
        public var pendingAnswerAction: CXAnswerCallAction?

        private override init() {
            super.init()
            // Only setup if explicitly requested via setup() method
            // This prevents automatic initialization conflicts
            NSLog("TelnyxVoice: TelnyxCallKitManager initialized (not yet active)")
        }

        public func setup() {
            // Only initialize once
            guard callKitProvider == nil else {
                NSLog("TelnyxVoice: CallKit already setup, skipping")
                return
            }

            DispatchQueue.main.async {
                self.setupAutomatically()
            }
        }

        @discardableResult
        public func setupSynchronously() -> CXProvider {
            // Only initialize once
            if let callKitProvider = callKitProvider {
                NSLog("TelnyxVoice: CallKit already setup, skipping")
                return callKitProvider
            }

            // CRITICAL: Setup CallKit synchronously for terminated app VoIP push handling
            // This MUST happen in the same run loop as the VoIP push
            NSLog("TelnyxVoice: Synchronous CallKit setup for terminated app scenario...")
            setupCallKit()
            if let callKitProvider = callKitProvider {
                NSLog("TelnyxVoice: ✅ CallKit provider ready for terminated app handling")
                return callKitProvider
            }

            NSLog("TelnyxVoice: CallKit setup did not create a provider; creating fallback provider")
            let callKitProvider = installCallKitProvider()
            NSLog("TelnyxVoice: ✅ CallKit provider ready for terminated app handling")
            return callKitProvider
        }

        private func setupAutomatically() {
            NSLog("TelnyxVoice: Auto-initializing CallKit via TelnyxCallKitManager...")
            // Note: VoIP push registration is handled by AppDelegate, not here
            // setupVoIPPushNotifications()
            setupCallKit()
            observeAppDelegate()
            NSLog("TelnyxVoice: ✅ TelnyxCallKitManager is now the ACTIVE CallKit provider")
            NSLog("TelnyxVoice: ⚠️  VoIP push handled by AppDelegate, not TelnyxCallKitManager")
        }

        private func setupVoIPPushNotifications() {
            voipRegistry = PKPushRegistry(queue: DispatchQueue.main)
            voipRegistry?.delegate = self
            voipRegistry?.desiredPushTypes = [PKPushType.voIP]
        }

        private func setupCallKit() {
            // ALWAYS configure WebRTC audio, even if provider already exists
            RTCAudioSession.sharedInstance().useManualAudio = true
            RTCAudioSession.sharedInstance().isAudioEnabled = false

            // Guard against duplicate provider creation (async setupAutomatically can overwrite
            // the provider created by setupSynchronously for VoIP push)
            guard callKitProvider == nil else {
                NSLog("TelnyxVoice: setupCallKit() - provider already exists, skipping to prevent overwrite")
                return
            }

            _ = installCallKitProvider()
        }

        private func installCallKitProvider() -> CXProvider {
            // Use the localizedName from the app's bundle display name or fallback
            let appName =
                Bundle.main.object(forInfoDictionaryKey: "CFBundleDisplayName") as? String
                ?? Bundle.main.object(forInfoDictionaryKey: "CFBundleName") as? String
                ?? "Voice Call"

            let configuration = CXProviderConfiguration(localizedName: appName)
            configuration.supportsVideo = false
            configuration.maximumCallGroups = 1
            configuration.maximumCallsPerCallGroup = 1
            configuration.supportedHandleTypes = [.phoneNumber, .generic]
            configuration.includesCallsInRecents = true

            let provider = CXProvider(configuration: configuration)
            provider.setDelegate(self, queue: nil)
            callKitProvider = provider
            callKitController = CXCallController()

            NSLog("TelnyxVoice: CallKit provider and controller created")
            return provider
        }

        fileprivate func reportAndEndWatchdogCall(
            callUUID: UUID,
            callerName: String,
            callerNumber: String,
            payload: [AnyHashable: Any],
            source: String,
            endedReason: CXCallEndedReason,
            completion: (() -> Void)? = nil
        ) {
            let callKitProvider = setupSynchronously()

            activeCalls[callUUID] = [
                "caller": callerName,
                "handle": callerNumber,
                "payload": payload,
                "uuid": callUUID.uuidString,
                "direction": "incoming",
                "source": source,
                "watchdogPlaceholder": true,
            ]

            let handle = CXHandle(type: .phoneNumber, value: callerNumber)
            let callUpdate = CXCallUpdate()
            callUpdate.remoteHandle = handle
            callUpdate.hasVideo = false
            callUpdate.localizedCallerName = callerName

            callKitProvider.reportNewIncomingCall(with: callUUID, update: callUpdate) { error in
                if let error = error {
                    NSLog(
                        "TelnyxVoice: Watchdog CallKit report failed for \(source): \(error.localizedDescription)"
                    )
                } else {
                    NSLog("TelnyxVoice: Watchdog CallKit call reported for \(source)")
                }

                callKitProvider.reportCall(with: callUUID, endedAt: Date(), reason: endedReason)
                self.activeCalls.removeValue(forKey: callUUID)

                if self.pendingAnswerAction?.callUUID == callUUID {
                    self.pendingAnswerAction?.fail()
                    self.pendingAnswerAction = nil
                }

                completion?()
            }
        }

        private func observeAppDelegate() {
            // Automatically hook into app lifecycle if needed
            NotificationCenter.default.addObserver(
                self,
                selector: #selector(appDidBecomeActive),
                name: UIApplication.didBecomeActiveNotification,
                object: nil
            )
        }

        @objc private func appDidBecomeActive() {
            // Ensure CallKit is still properly configured
            if callKitProvider == nil {
                setupCallKit()
            }
        }

        @discardableResult
        public func handleMissedCallPushIfNeeded(
            _ payload: [AnyHashable: Any],
            completion: (() -> Void)? = nil
        ) -> Bool {
            guard TelnyxMissedCallPush.isMissedCallPayload(payload) else {
                return false
            }

            NSLog("TelnyxVoice: Missed call VoIP push received: \(payload)")
            let callKitProvider = setupSynchronously()

            let callId = TelnyxMissedCallPush.callId(from: payload)
            let missedCallId = TelnyxMissedCallPush.stableIdentifier(from: payload)
            let callUUID = TelnyxMissedCallPush.uuid(from: missedCallId)
            let callerName = TelnyxMissedCallPush.callerName(from: payload)
            let callerNumber = TelnyxMissedCallPush.callerNumber(from: payload)

            if hasProcessedMissedCall(id: missedCallId) {
                NSLog("TelnyxVoice: Suppressing duplicate missed call notification: \(missedCallId)")
                reportAndEndWatchdogCall(
                    callUUID: UUID(),
                    callerName: callerName,
                    callerNumber: callerNumber,
                    payload: payload,
                    source: "missed_call_duplicate_watchdog",
                    endedReason: .remoteEnded,
                    completion: completion
                )
                return true
            }

            let finishMissedCall = {
                callKitProvider.reportCall(with: callUUID, endedAt: Date(), reason: .remoteEnded)
                self.activeCalls.removeValue(forKey: callUUID)

                if self.pendingAnswerAction?.callUUID == callUUID {
                    self.pendingAnswerAction?.fail()
                    self.pendingAnswerAction = nil
                }

                NSLog("TelnyxVoice: Ended stale CallKit call for missed call UUID: \(callUUID)")
                self.clearPendingPushData(for: callId)
                self.showMissedCallNotification(
                    callerName: callerName,
                    callerNumber: callerNumber,
                    missedCallId: missedCallId
                )
                self.markMissedCallProcessed(id: missedCallId)
                completion?()
            }

            if let activeCall = activeCalls[callUUID] {
                guard activeCall["source"] as? String == "missed_call_push" else {
                    NSLog("TelnyxVoice: Suppressing missed call notification because UUID belongs to an active call: \(callUUID)")
                    markMissedCallProcessed(id: missedCallId)
                    reportAndEndWatchdogCall(
                        callUUID: UUID(),
                        callerName: callerName,
                        callerNumber: callerNumber,
                        payload: payload,
                        source: "missed_call_collision_watchdog",
                        endedReason: .remoteEnded,
                        completion: completion
                    )
                    return true
                }

                reportAndEndWatchdogCall(
                    callUUID: UUID(),
                    callerName: callerName,
                    callerNumber: callerNumber,
                    payload: payload,
                    source: "missed_call_active_watchdog",
                    endedReason: .remoteEnded
                ) {
                    finishMissedCall()
                }
                return true
            }

            activeCalls[callUUID] = [
                "caller": callerName,
                "handle": callerNumber,
                "payload": payload,
                "uuid": callUUID.uuidString,
                "direction": "incoming",
                "source": "missed_call_push",
            ]

            let handle = CXHandle(type: .phoneNumber, value: callerNumber)
            let callUpdate = CXCallUpdate()
            callUpdate.remoteHandle = handle
            callUpdate.hasVideo = false
            callUpdate.localizedCallerName = callerName

            callKitProvider.reportNewIncomingCall(with: callUUID, update: callUpdate) { error in
                if let error = error {
                    NSLog("TelnyxVoice: Missed call CallKit report failed: \(error.localizedDescription)")
                    callKitProvider.reportCall(with: callUUID, endedAt: Date(), reason: .failed)
                    self.activeCalls.removeValue(forKey: callUUID)
                    self.clearPendingPushData(for: callId)
                    completion?()
                    return
                }

                finishMissedCall()
            }

            return true
        }

        private func clearPendingPushData(for callId: String?) {
            if hasPendingPushData(forDifferentCallThan: callId) {
                NSLog("TelnyxVoice: Skipping pending push cleanup for missed call; pending data belongs to a different call")
                return
            }

            UserDefaults.standard.removeObject(forKey: "pending_push_action")
            UserDefaults.standard.removeObject(forKey: "pending_push_metadata")
            UserDefaults.standard.removeObject(forKey: "pending_voip_push")
            UserDefaults.standard.removeObject(forKey: "pending_voip_action")
            UserDefaults.standard.removeObject(forKey: "@pending_callkit_uuid")
            UserDefaults.standard.synchronize()
        }

        private func hasPendingPushData(forDifferentCallThan missedCallId: String?) -> Bool {
            guard let missedCallId = missedCallId, !missedCallId.isEmpty else {
                return false
            }

            let pendingIds = [
                pendingCallId(fromJsonForKey: "pending_push_metadata"),
                pendingCallId(fromJsonForKey: "pending_voip_push"),
                UserDefaults.standard.string(forKey: "@pending_callkit_uuid"),
            ].compactMap { $0 }

            return pendingIds.contains { !$0.isEmpty && $0 != missedCallId }
        }

        private func pendingCallId(fromJsonForKey key: String) -> String? {
            guard let jsonString = UserDefaults.standard.string(forKey: key),
                let data = jsonString.data(using: .utf8),
                let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            else {
                return nil
            }

            if let directCallId = callId(from: json) {
                return directCallId
            }

            if let payload = json["payload"] as? [String: Any] {
                return callId(from: payload)
            }

            return nil
        }

        private func callId(from dictionary: [String: Any]) -> String? {
            for key in ["call_id", "callId", "telnyx_call_id"] {
                if let value = dictionary[key] as? String, !value.isEmpty {
                    return value
                }
            }

            if let metadata = dictionary["metadata"] as? [String: Any] {
                return callId(from: metadata)
            }

            return nil
        }

        private func hasProcessedMissedCall(id: String) -> Bool {
            return processedMissedCallIds().contains(id)
        }

        private func markMissedCallProcessed(id: String) {
            var ids = processedMissedCallIds().filter { $0 != id }
            ids.append(id)
            UserDefaults.standard.set(Array(ids.suffix(50)), forKey: TelnyxMissedCallPush.processedMissedCallIdsKey)
            UserDefaults.standard.synchronize()
        }

        private func processedMissedCallIds() -> [String] {
            return UserDefaults.standard.stringArray(
                forKey: TelnyxMissedCallPush.processedMissedCallIdsKey) ?? []
        }

        private func showMissedCallNotification(
            callerName: String, callerNumber: String, missedCallId: String
        ) {
            guard TelnyxMissedCallPush.missedCallNotificationsEnabled() else {
                NSLog("TelnyxVoice: Missed call local notification disabled")
                return
            }

            let content = UNMutableNotificationContent()
            content.title = "Missed Call"
            content.body = "You missed a call from \(callerName)"
            content.sound = .default
            content.userInfo = [
                "call_id": missedCallId,
                "caller_name": callerName,
                "caller_number": callerNumber,
            ]

            let identifier = "telnyx.missed-call.\(missedCallId)"
            let request = UNNotificationRequest(
                identifier: identifier,
                content: content,
                trigger: nil
            )

            let notificationCenter = UNUserNotificationCenter.current()
            notificationCenter.getNotificationSettings { settings in
                guard settings.authorizationStatus == .authorized
                    || settings.authorizationStatus == .provisional
                    || settings.authorizationStatus == .ephemeral
                else {
                    NSLog(
                        "TelnyxVoice: Missed call notification not shown; notification authorization status: \(settings.authorizationStatus.rawValue)"
                    )
                    return
                }

                notificationCenter.add(request) { error in
                    if let error = error {
                        NSLog("TelnyxVoice: Failed to show missed call notification: \(error)")
                    } else {
                        NSLog("TelnyxVoice: Missed call notification scheduled")
                    }
                }
            }
        }
    }

    // MARK: - PKPushRegistryDelegate
    extension TelnyxCallKitManager: PKPushRegistryDelegate {

        public func pushRegistry(
            _ registry: PKPushRegistry, didUpdate pushCredentials: PKPushCredentials,
            for type: PKPushType
        ) {
            NSLog("TelnyxVoice: VoIP push token updated")
            let deviceToken = pushCredentials.token.map { String(format: "%02x", $0) }.joined()
            NSLog("TelnyxVoice: VoIP Push Token: \(deviceToken)")

            // Store token in both keys for compatibility
            UserDefaults.standard.set(deviceToken, forKey: "telnyx_voip_push_token")
            UserDefaults.standard.set(deviceToken, forKey: "voip_push_token")  // For VoicePnBridge compatibility
            UserDefaults.standard.synchronize()

            // Forward the token to RNVoipPushNotificationManager for React Native compatibility
            if let RNVoipPushNotificationManager = NSClassFromString(
                "RNVoipPushNotificationManager") as? NSObject.Type
            {
                if RNVoipPushNotificationManager.responds(
                    to: Selector(("didUpdatePushCredentials:forType:")))
                {
                    RNVoipPushNotificationManager.perform(
                        Selector(("didUpdatePushCredentials:forType:")),
                        with: pushCredentials,
                        with: type.rawValue
                    )
                    NSLog("TelnyxVoice: Forwarded token to RNVoipPushNotificationManager")
                } else {
                    NSLog(
                        "TelnyxVoice: RNVoipPushNotificationManager doesn't respond to didUpdatePushCredentials"
                    )
                }
            } else {
                NSLog("TelnyxVoice: RNVoipPushNotificationManager class not found")
            }
        }

        public func pushRegistry(
            _ registry: PKPushRegistry, didInvalidatePushTokenFor type: PKPushType
        ) {
            NSLog("TelnyxVoice: VoIP push token invalidated")
            UserDefaults.standard.removeObject(forKey: "telnyx_voip_push_token")
        }

        public func pushRegistry(
            _ registry: PKPushRegistry, didReceiveIncomingPushWith payload: PKPushPayload,
            for type: PKPushType, completion: @escaping () -> Void
        ) {
            NSLog("TelnyxVoice: Received VoIP push notification: \(payload.dictionaryPayload)")

            if handleMissedCallPushIfNeeded(payload.dictionaryPayload, completion: completion) {
                return
            }

            // Store the VoIP push data for VoicePnBridge (same format as AppDelegate was using)
            do {
                let jsonData = try JSONSerialization.data(withJSONObject: payload.dictionaryPayload)
                let jsonString = String(data: jsonData, encoding: .utf8) ?? ""

                UserDefaults.standard.set("incoming_call", forKey: "pending_push_action")
                UserDefaults.standard.set(jsonString, forKey: "pending_push_metadata")
                UserDefaults.standard.synchronize()
                NSLog("TelnyxVoice: Stored VoIP push data for VoicePnBridge")
            } catch {
                NSLog("TelnyxVoice: Error converting VoIP payload to JSON: \(error)")
                UserDefaults.standard.set("incoming_call", forKey: "pending_push_action")
                UserDefaults.standard.set("{}", forKey: "pending_push_metadata")
                UserDefaults.standard.synchronize()
            }

            let callUUID = UUID()
            var caller = "Unknown Caller"
            var callId: String?

            if let metadata = payload.dictionaryPayload["metadata"] as? [String: Any] {
                caller =
                    metadata["caller_name"] as? String ?? metadata["caller_number"] as? String
                    ?? "Unknown Caller"
                callId = metadata["call_id"] as? String
            } else {
                caller =
                    payload.dictionaryPayload["caller"] as? String ?? payload.dictionaryPayload[
                        "from"] as? String ?? "Unknown Caller"
                callId =
                    payload.dictionaryPayload["call_id"] as? String ?? payload.dictionaryPayload[
                        "callId"] as? String
            }

            activeCalls[callUUID] = [
                "caller": caller,
                "callId": callId as Any,
                "payload": payload.dictionaryPayload,
                "uuid": callUUID.uuidString,
                "direction": "incoming",
                "source": "push",
            ]

            let handle = CXHandle(type: .phoneNumber, value: caller)
            let callUpdate = CXCallUpdate()
            callUpdate.remoteHandle = handle
            callUpdate.hasVideo = false
            callUpdate.localizedCallerName = caller

            callKitProvider?.reportNewIncomingCall(with: callUUID, update: callUpdate) {
                [weak self] error in
                if let error = error {
                    NSLog("TelnyxVoice: CallKit error: \(error.localizedDescription)")
                    self?.activeCalls.removeValue(forKey: callUUID)
                } else {
                    NSLog("TelnyxVoice: CallKit incoming call reported successfully")
                }
                completion()
            }
        }
    }

    // MARK: - CXProviderDelegate
    extension TelnyxCallKitManager: CXProviderDelegate {

        public func providerDidReset(_ provider: CXProvider) {
            NSLog("📞 TelnyxVoice: CALLKIT PROVIDER RESET - Provider: \(provider)")
            NSLog("TelnyxVoice: CallKit provider reset - ending all active calls")
            activeCalls.removeAll()
        }

        public func provider(_ provider: CXProvider, perform action: CXAnswerCallAction) {
            NSLog("📞 TelnyxVoice: CALLKIT ANSWER ACTION - Provider: \(provider), Action: \(action)")
            NSLog("TelnyxVoice: User answered call with UUID: \(action.callUUID)")

            if activeCalls[action.callUUID]?["watchdogPlaceholder"] as? Bool == true {
                NSLog("TelnyxVoice: Failing answer for watchdog placeholder call: \(action.callUUID)")
                activeCalls.removeValue(forKey: action.callUUID)
                action.fail()
                return
            }

            // Check if this is a programmatic answer (call already answered in WebRTC)
            // vs a user answer from CallKit UI
            if let callData = activeCalls[action.callUUID],
                let isAlreadyAnswered = callData["isAlreadyAnswered"] as? Bool,
                isAlreadyAnswered
            {
                NSLog("TelnyxVoice: Call already answered in WebRTC, skipping emission")
            } else {
                // Notify React Native via CallKit bridge (only for user-initiated answers)
                CallKitBridge.shared?.emitCallEvent(
                    "CallKitDidPerformAnswerCallAction", callUUID: action.callUUID,
                    callData: activeCalls[action.callUUID])
            }

            // Defer action.fulfill() until reportCallConnected when peer connection is ready
            NSLog("TelnyxVoice: Deferring CXAnswerCallAction.fulfill() until peer connection is ready")
            self.pendingAnswerAction = action
        }

        public func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
            NSLog("TelnyxVoice: User ended call with UUID: \(action.callUUID)")

            // Notify React Native via CallKit bridge
            CallKitBridge.shared?.emitCallEvent(
                "CallKitDidPerformEndCallAction", callUUID: action.callUUID,
                callData: activeCalls[action.callUUID])

            activeCalls.removeValue(forKey: action.callUUID)
            NSLog("📞 TelnyxVoice: Fulfilling CXEndCallAction for call UUID: \(action.callUUID)")
            action.fulfill()
            NSLog("📞 TelnyxVoice: ✅ CXEndCallAction fulfilled successfully")
        }

        public func provider(_ provider: CXProvider, perform action: CXStartCallAction) {
            NSLog("TelnyxVoice: Starting outgoing call with UUID: \(action.callUUID)")

            // Notify React Native via CallKit bridge
            CallKitBridge.shared?.emitCallEvent(
                "CallKitDidReceiveStartCallAction", callUUID: action.callUUID,
                callData: activeCalls[action.callUUID])

            NSLog("📞 TelnyxVoice: Fulfilling CXStartCallAction for call UUID: \(action.callUUID)")
            action.fulfill()
            NSLog("📞 TelnyxVoice: ✅ CXStartCallAction fulfilled successfully")
        }

        public func provider(_ provider: CXProvider, didActivate audioSession: AVAudioSession) {
            NSLog("TelnyxVoice: Audio session activated by CallKit")

            let rtcAudioSession = RTCAudioSession.sharedInstance()

            // Step 1: Configure (matches native iOS SDK setupCorrectAudioConfiguration)
            rtcAudioSession.lockForConfiguration()
            let webRTCConfig = RTCAudioSessionConfiguration.webRTC()
            webRTCConfig.categoryOptions = [.duckOthers, .allowBluetooth]
            do {
                try rtcAudioSession.setConfiguration(webRTCConfig)
            } catch {
                NSLog("TelnyxVoice: didActivateAudioSession - setConfiguration error: \(error)")
            }
            rtcAudioSession.unlockForConfiguration()

            // Step 2: Activate (matches native iOS SDK setAudioSessionActive)
            rtcAudioSession.lockForConfiguration()
            do {
                try rtcAudioSession.setActive(true)
            } catch {
                NSLog("TelnyxVoice: didActivateAudioSession - setActive error: \(error)")
            }
            rtcAudioSession.isAudioEnabled = true
            rtcAudioSession.unlockForConfiguration()

            rtcAudioSession.audioSessionDidActivate(audioSession)

            // Emit audio session activated event to React Native
            CallKitBridge.shared?.emitAudioSessionEvent(
                "AudioSessionActivated",
                data: [
                    "category": audioSession.category.rawValue,
                    "mode": audioSession.mode.rawValue,
                    "isActive": true,
                ])
        }

        public func provider(_ provider: CXProvider, didDeactivate audioSession: AVAudioSession) {
            NSLog("TelnyxVoice: Audio session deactivated by CallKit")

            let rtcAudioSession = RTCAudioSession.sharedInstance()

            // Reset audio config (matches native iOS SDK resetAudioConfiguration)
            let avAudioSession = AVAudioSession.sharedInstance()
            do {
                try avAudioSession.setCategory(.playback, mode: .default, options: [.mixWithOthers])
            } catch {
                NSLog("TelnyxVoice: didDeactivateAudioSession - setCategory error: \(error)")
            }

            // Deactivate (matches native iOS SDK setAudioSessionActive(false))
            rtcAudioSession.lockForConfiguration()
            do {
                try rtcAudioSession.setActive(false)
            } catch {
                NSLog("TelnyxVoice: didDeactivateAudioSession - setActive(false) error: \(error)")
            }
            rtcAudioSession.isAudioEnabled = false
            rtcAudioSession.unlockForConfiguration()

            rtcAudioSession.audioSessionDidDeactivate(audioSession)

            // Emit audio session deactivated event to React Native
            CallKitBridge.shared?.emitAudioSessionEvent(
                "AudioSessionDeactivated",
                data: [
                    "category": audioSession.category.rawValue,
                    "mode": audioSession.mode.rawValue,
                    "isActive": false,
                ])
        }
    }

    // MARK: - VoIP Push Handler
    // This class provides VoIP push notification handling for the main AppDelegate
    // It integrates with the react-voice-commons CallKit system

    @objc public class TelnyxVoipPushHandler: NSObject {

        @objc public static let shared = TelnyxVoipPushHandler()

        private override init() {
            super.init()
        }

        /**
         * Initialize VoIP push registration
         * Call this from the main app's AppDelegate didFinishLaunchingWithOptions
         */
        @objc public static func initializeVoipRegistration() {
            if let RNVoipPushNotificationManager = NSClassFromString(
                "RNVoipPushNotificationManager") as? NSObject.Type
            {
                if RNVoipPushNotificationManager.responds(to: Selector(("voipRegistration"))) {
                    RNVoipPushNotificationManager.perform(Selector(("voipRegistration")))
                    NSLog("[TelnyxVoipPushHandler] VoIP registration initialized")
                } else {
                    NSLog(
                        "[TelnyxVoipPushHandler] RNVoipPushNotificationManager doesn't respond to voipRegistration"
                    )
                }
            } else {
                NSLog("[TelnyxVoipPushHandler] RNVoipPushNotificationManager class not found")
            }
        }

        /**
         * Call this method from your AppDelegate's didReceiveIncomingPushWith method
         * to handle VoIP push notifications using the react-voice-commons CallKit system
         */
        @objc public func handleVoipPush(
            _ payload: PKPushPayload,
            type: PKPushType,
            completion: @escaping () -> Void
        ) {
            NSLog("[TelnyxVoipPushHandler] VoIP push received for type: \(type.rawValue)")
            NSLog("[TelnyxVoipPushHandler] VoIP payload: \(payload.dictionaryPayload)")

            if TelnyxCallKitManager.shared.handleMissedCallPushIfNeeded(
                payload.dictionaryPayload,
                completion: completion
            ) {
                return
            }

            // Configure audio session early for VoIP call
            let audioSession = AVAudioSession.sharedInstance()
            do {
                try audioSession.setCategory(.playAndRecord, mode: .voiceChat)
                NSLog("Succeeded to activate audio session")
            } catch {
                NSLog("Failed to activate audio session: \(error)")
            }

            // Extract caller information and call_id from the payload
            var callerName = "Unknown Caller"
            var callerNumber = "Unknown"
            var callId: String?

            if let metadata = payload.dictionaryPayload["metadata"] as? [String: Any] {
                callerName =
                    metadata["caller_name"] as? String ?? metadata["caller_number"] as? String
                    ?? "Unknown Caller"
                callerNumber = metadata["caller_number"] as? String ?? callerName
                callId = metadata["call_id"] as? String
            } else {
                callerName =
                    payload.dictionaryPayload["caller"] as? String ?? payload.dictionaryPayload[
                        "from"] as? String ?? "Unknown Caller"
                callerNumber = payload.dictionaryPayload["caller_number"] as? String ?? callerName
                callId = payload.dictionaryPayload["call_id"] as? String
            }

            // Use call_id as CallKit UUID to ensure matching with WebRTC.
            guard let callIdString = callId, let callUUID = UUID(uuidString: callIdString) else {
                NSLog(
                    "[TelnyxVoipPushHandler] ⚠️ Invalid or missing call_id in payload (\(callId ?? "nil")); reporting failed watchdog placeholder"
                )
                TelnyxCallKitManager.shared.reportAndEndWatchdogCall(
                    callUUID: UUID(),
                    callerName: callerName,
                    callerNumber: callerNumber,
                    payload: payload.dictionaryPayload,
                    source: "malformed_push_watchdog",
                    endedReason: .failed,
                    completion: completion
                )
                return
            }

            NSLog(
                "[TelnyxVoipPushHandler] Processing call - Call ID as UUID: \(callUUID.uuidString), Caller: \(callerName), Number: \(callerNumber)"
            )

            // Store the VoIP push data for VoicePnBridge
            do {
                let jsonData = try JSONSerialization.data(withJSONObject: payload.dictionaryPayload)
                let jsonString = String(data: jsonData, encoding: .utf8) ?? ""

                // Store for TelnyxVoiceApp (push action flow)
                UserDefaults.standard.set("incoming_call", forKey: "pending_push_action")
                UserDefaults.standard.set(jsonString, forKey: "pending_push_metadata")

                // ALSO store for VoicePnBridge.getPendingVoipPush() (CallKit coordinator flow)
                // This creates a structured object with payload property
                let voipPushData = [
                    "payload": payload.dictionaryPayload
                ]
                let voipJsonData = try JSONSerialization.data(withJSONObject: voipPushData)
                let voipJsonString = String(data: voipJsonData, encoding: .utf8) ?? ""
                UserDefaults.standard.set(voipJsonString, forKey: "pending_voip_push")

                UserDefaults.standard.synchronize()
                NSLog(
                    "[TelnyxVoipPushHandler] Stored VoIP push data for both TelnyxVoiceApp and VoicePnBridge"
                )
            } catch {
                NSLog("[TelnyxVoipPushHandler] Error converting VoIP payload to JSON: \(error)")
                UserDefaults.standard.set("incoming_call", forKey: "pending_push_action")
                UserDefaults.standard.set("{}", forKey: "pending_push_metadata")
                UserDefaults.standard.set("{\"payload\":{}}", forKey: "pending_voip_push")
                UserDefaults.standard.synchronize()
            }

            // Use unified CallKit handling path that works for both running and terminated app scenarios
            NSLog("[TelnyxVoipPushHandler] Using unified CallKit handling path")

            // Use the existing TelnyxCallKitManager which has CallKit setup
            let callKitManager = TelnyxCallKitManager.shared

            // CRITICAL: Setup CallKit SYNCHRONOUSLY - no async dispatch allowed
            // This must happen in the same run loop as the VoIP push
            let callKitProvider = callKitManager.setupSynchronously()

            NSLog("[TelnyxVoipPushHandler] ✅ CallKit provider ready, reporting incoming call")


            // Store call data manually and report to CallKit
            let isAppRunning = CallKitBridge.shared != nil
            callKitManager.activeCalls[callUUID] = [
                "caller": callerName,
                "handle": callerNumber,
                "payload": payload.dictionaryPayload,
                "uuid": callUUID.uuidString,
                "direction": "incoming",
                "source": isAppRunning ? "push_notification" : "terminated_app_push",
            ]

            // Report to CallKit immediately
            let handle = CXHandle(type: .phoneNumber, value: callerNumber)
            let callUpdate = CXCallUpdate()
            callUpdate.remoteHandle = handle
            callUpdate.hasVideo = false
            callUpdate.localizedCallerName = callerName

            callKitProvider.reportNewIncomingCall(with: callUUID, update: callUpdate) { error in
                if let error = error {
                    NSLog(
                        "[TelnyxVoipPushHandler] ❌ CallKit error during terminated app handling: \(error.localizedDescription)"
                    )
                    callKitManager.activeCalls.removeValue(forKey: callUUID)
                } else {
                    NSLog(
                        "[TelnyxVoipPushHandler] ✅ CallKit call reported successfully via unified path"
                    )

                    // CRITICAL: Store the CallKit UUID for the React Native CallKitCoordinator
                    // This allows the coordinator to find the existing CallKit call instead of creating a duplicate
                    UserDefaults.standard.set(callUUID.uuidString, forKey: "@pending_callkit_uuid")
                    UserDefaults.standard.synchronize()
                    NSLog(
                        "[TelnyxVoipPushHandler] ✅ Stored CallKit UUID for React Native coordinator: \(callUUID.uuidString)"
                    )

                    // Try to emit push received event if CallKit bridge is available
                    if let callKitBridge = CallKitBridge.shared {
                        let source = isAppRunning ? "push_notification" : "terminated_app_push"
                        callKitBridge.emitCallEvent(
                            "CallKitDidReceivePush", callUUID: callUUID,
                            callData: [
                                "caller": callerName,
                                "handle": callerNumber,
                                "payload": payload.dictionaryPayload,
                                "uuid": callUUID.uuidString,
                                "direction": "incoming",
                                "source": source,
                            ])
                        NSLog(
                            "[TelnyxVoipPushHandler] ✅ Emitted CallKitDidReceivePush event to React Native"
                        )
                    } else {
                        NSLog(
                            "[TelnyxVoipPushHandler] ⚠️ React Native bridge not ready - event will be emitted when bridge becomes available"
                        )
                    }
                }

                completion()
            }
        }

        /**
         * Call this method from your AppDelegate's didUpdate pushCredentials method
         * to handle VoIP token updates
         */
        @objc public func handleVoipTokenUpdate(
            _ pushCredentials: PKPushCredentials,
            type: PKPushType
        ) {
            NSLog(
                "[TelnyxVoipPushHandler] VoIP push credentials updated for type: \(type.rawValue)")

            let tokenString = pushCredentials.token.map { String(format: "%02x", $0) }.joined()
            NSLog("[TelnyxVoipPushHandler] VoIP token: \(tokenString)")

            // Store token in UserDefaults for VoicePnBridge access
            UserDefaults.standard.set(tokenString, forKey: "voip_push_token")
            UserDefaults.standard.synchronize()
            NSLog("[TelnyxVoipPushHandler] VoIP Push Token stored in UserDefaults")

            // Forward to RNVoipPushNotificationManager for React Native compatibility
            if let RNVoipPushNotificationManager = NSClassFromString(
                "RNVoipPushNotificationManager") as? NSObject.Type
            {
                if RNVoipPushNotificationManager.responds(
                    to: Selector(("didUpdatePushCredentials:forType:")))
                {
                    RNVoipPushNotificationManager.perform(
                        Selector(("didUpdatePushCredentials:forType:")),
                        with: pushCredentials,
                        with: type.rawValue
                    )
                    NSLog(
                        "[TelnyxVoipPushHandler] Forwarded token to RNVoipPushNotificationManager")
                } else {
                    NSLog(
                        "[TelnyxVoipPushHandler] RNVoipPushNotificationManager doesn't respond to didUpdatePushCredentials"
                    )
                }
            } else {
                NSLog("[TelnyxVoipPushHandler] RNVoipPushNotificationManager class not found")
            }
        }
    }

#endif
