import Foundation
import React

#if os(iOS)
    import CallKit
    import AVFoundation
    import UIKit
    import PushKit
    import UserNotifications
    import WebRTC

    /// Small synchronized dictionary used because React Native module methods
    /// and CXProvider delegate callbacks are not guaranteed to share a queue.
    public final class LockedDictionary<Key: Hashable, Value> {
        private var storage: [Key: Value] = [:]
        private let lock: NSRecursiveLock

        init(lock: NSRecursiveLock) {
            self.lock = lock
        }

        public subscript(key: Key) -> Value? {
            get {
                lock.lock()
                defer { lock.unlock() }
                return storage[key]
            }
            set {
                lock.lock()
                defer { lock.unlock() }
                storage[key] = newValue
            }
        }

        public var values: [Value] {
            lock.lock()
            defer { lock.unlock() }
            return Array(storage.values)
        }

        @discardableResult
        public func removeValue(forKey key: Key) -> Value? {
            lock.lock()
            defer { lock.unlock() }
            return storage.removeValue(forKey: key)
        }

        public func removeAll() {
            lock.lock()
            defer { lock.unlock() }
            storage.removeAll()
        }
    }

    @objc(CallKitBridge)
    class CallKitBridge: RCTEventEmitter {

        public static var shared: CallKitBridge?
        private var hasListeners = false

        override init() {
            super.init()
            CallKitBridge.shared = self

            // Explicitly initialize the CallKit manager when React Native bridge loads
            TelnyxCallKitManager.shared.setup()
            // A killed process can leave push-only UserDefaults behind with no
            // CallKit call left to consume or clear them. Drop that state before
            // a fresh login can mistake it for a pending push. A live push has
            // already registered its call, so its metadata is preserved.
            TelnyxCallKitManager.shared.purgePendingPushStateIfNoActiveCalls()
            NSLog("TelnyxVoice: CallKitBridge initialized with TelnyxCallKitManager active")
        }

        override func supportedEvents() -> [String]! {
            return [
                "CallKitDidReceiveStartCallAction",
                "CallKitDidPerformAnswerCallAction",
                "CallKitDidPerformEndCallAction",
                "CallKitDidPerformHeldCallAction",
                "CallKitDidReceivePush",
                "AudioSessionActivated",
                "AudioSessionDeactivated",
                "AudioSessionFailed",
                "AudioRouteChanged",
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
        @discardableResult
        public func emitCallEvent(_ eventName: String, callUUID: UUID, callData: [String: Any]?) -> Bool {
            guard hasListeners else { return false }

            let eventData: [String: Any] = [
                "callUUID": callUUID.uuidString,
                "callData": callData ?? [:],
            ]

            sendEvent(withName: eventName, body: eventData)
            return true
        }

        @discardableResult
        public func emitHeldCallEvent(
            callUUID: UUID, isOnHold: Bool, callData: [String: Any]?
        ) -> Bool {
            guard hasListeners else { return false }

            let eventData: [String: Any] = [
                "callUUID": callUUID.uuidString,
                "isOnHold": isOnHold,
                "callData": callData ?? [:],
            ]
            sendEvent(withName: "CallKitDidPerformHeldCallAction", body: eventData)
            return true
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

            manager.activeCalls[uuid] = [
                "caller": displayName,
                "handle": handle,
                "uuid": uuid.uuidString,
                "direction": "outgoing",
                // VSDK-771 AFK review: align internal source tag with the
                // new prefixed convention so grep-based family completeness
                // (webrtc-react-native / webrtc-react-native-commons) is
                // clean across the SDK. Not consumed by the wire contract.
                "source": "webrtc-react-native",
            ]

            callController.request(transaction) { error in
                if let error = error {
                    manager.activeCalls.removeValue(forKey: uuid)
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
            callUpdate.supportsHolding = true

            manager.activeCalls[uuid] = [
                "caller": displayName,
                "handle": handle,
                "uuid": uuid.uuidString,
                "direction": "incoming",
                // VSDK-771 AFK review: align internal source tag with the
                // new prefixed convention. See outgoing branch above.
                "source": "webrtc-react-native",
                "isCallKitRegistered": false,
            ]

            provider.reportNewIncomingCall(with: uuid, update: callUpdate) { error in
                if let error = error {
                    manager.activeCalls.removeValue(forKey: uuid)
                    manager.clearPendingPushData(for: nil, callUUID: uuid)
                    reject("INCOMING_CALL_ERROR", error.localizedDescription, error)
                } else {
                    manager.markCallKitRegistered(uuid)
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

        @objc func completeHeldCallAction(
            _ callUUID: String, success: Bool,
            resolver resolve: @escaping RCTPromiseResolveBlock,
            rejecter reject: @escaping RCTPromiseRejectBlock
        ) {
            guard let uuid = UUID(uuidString: callUUID) else {
                reject("INVALID_UUID", "Invalid UUID format", nil)
                return
            }

            let manager = getCallKitManager()
            let completeAction = {
                guard let action = manager.pendingHeldActions.removeValue(forKey: uuid) else {
                    reject("NO_PENDING_HELD_ACTION", "No pending held action for UUID", nil)
                    return
                }

                if success {
                    if var callData = manager.activeCalls[uuid] {
                        callData["isOnHold"] = action.isOnHold
                        manager.activeCalls[uuid] = callData
                    }
                    action.fulfill()
                } else {
                    action.fail()
                }
                resolve(["success": success, "callUUID": callUUID])
            }

            if Thread.isMainThread {
                completeAction()
            } else {
                DispatchQueue.main.async(execute: completeAction)
            }
        }

        @objc func setCallHeld(
            _ callUUID: String, isOnHold: Bool,
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

            guard manager.activeCalls[uuid] != nil else {
                reject("UNKNOWN_CALL", "Call must be registered with CallKit", nil)
                return
            }

            let action = CXSetHeldCallAction(call: uuid, onHold: isOnHold)
            let transaction = CXTransaction(action: action)
            callController.request(transaction) { error in
                if let error = error {
                    reject("SET_HELD_ERROR", error.localizedDescription, error)
                } else {
                    resolve([
                        "success": true,
                        "callUUID": callUUID,
                        "isOnHold": isOnHold,
                    ])
                }
            }
        }

        @objc func swapCalls(
            _ activeCallUUID: String, heldCallUUID: String,
            resolver resolve: @escaping RCTPromiseResolveBlock,
            rejecter reject: @escaping RCTPromiseRejectBlock
        ) {
            guard let activeUUID = UUID(uuidString: activeCallUUID),
                let heldUUID = UUID(uuidString: heldCallUUID)
            else {
                reject("INVALID_UUID", "Invalid UUID format", nil)
                return
            }

            guard activeUUID != heldUUID else {
                reject("INVALID_SWAP", "Active and held call UUIDs must be different", nil)
                return
            }

            let manager = getCallKitManager()
            guard let callController = manager.callKitController else {
                reject("NO_CALLKIT", "CallKit not available", nil)
                return
            }

            guard manager.activeCalls[activeUUID] != nil,
                manager.activeCalls[heldUUID] != nil
            else {
                reject("UNKNOWN_CALL", "Both calls must be registered with CallKit", nil)
                return
            }

            let actions: [CXAction] = [
                CXSetHeldCallAction(call: activeUUID, onHold: true),
                CXSetHeldCallAction(call: heldUUID, onHold: false),
            ]
            let transaction = CXTransaction(actions: actions)

            callController.request(transaction) { error in
                if let error = error {
                    reject("SWAP_CALLS_ERROR", error.localizedDescription, error)
                } else {
                    resolve([
                        "success": true,
                        "activeCallUUID": activeCallUUID,
                        "heldCallUUID": heldCallUUID,
                    ])
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

            guard manager.isCallKitRegistered(uuid) else {
                reject(
                    "UNKNOWN_CALL",
                    "Call was not registered with CallKit or its registration was rejected",
                    nil
                )
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

        @objc func isCallRegistered(
            _ callUUID: String, resolver resolve: @escaping RCTPromiseResolveBlock,
            rejecter reject: @escaping RCTPromiseRejectBlock
        ) {
            guard let uuid = UUID(uuidString: callUUID) else {
                reject("INVALID_UUID", "Invalid UUID format", nil)
                return
            }

            let registered = getCallKitManager().isCallKitRegistered(uuid)
            resolve([
                "registered": registered,
                "callUUID": callUUID,
            ])
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
            if let pendingAction = manager.pendingAnswerActions.removeValue(forKey: uuid) {
                NSLog("TelnyxVoice: reportCallConnected - fulfilling deferred CXAnswerCallAction")
                pendingAction.fulfill()
            } else {
                manager.verifyAudioAfterConnection(for: uuid)
            }

            // The push has been consumed by a connected call. Drop its routing
            // metadata so it cannot be replayed into a later login/connection.
            manager.clearPendingPushData(
                for: manager.pendingPushCallId(for: uuid),
                callUUID: uuid
            )

            resolve(["success": true])
        }

        #if DEBUG
            @objc func simulateAudioSetupRace(
                _ callUUID: String,
                delayMilliseconds: NSNumber,
                resolver resolve: @escaping RCTPromiseResolveBlock,
                rejecter reject: @escaping RCTPromiseRejectBlock
            ) {
                guard let uuid = UUID(uuidString: callUUID) else {
                    reject("INVALID_UUID", "Invalid UUID format", nil)
                    return
                }
                getCallKitManager().simulateAudioSetupRace(
                    for: uuid,
                    delay: delayMilliseconds.doubleValue / 1_000
                )
                resolve(["scheduled": true, "delayMilliseconds": delayMilliseconds])
            }
        #endif

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
            manager.clearPendingPushData(
                for: manager.activeCalls[uuid]?["callId"] as? String,
                callUUID: uuid
            )
            manager.activeCalls.removeValue(forKey: uuid)
            manager.pendingAnswerActions.removeValue(forKey: uuid)?.fail()
            manager.pendingHeldActions.removeValue(forKey: uuid)?.fail()
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
            callUpdate.supportsHolding = true

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
        private let stateLock = NSRecursiveLock()
        private let pendingVoipPushLock = NSRecursiveLock()

        /// Keys carrying one incoming push's routing metadata. They are shared
        /// with the React Native layer, so each write also records which call
        /// owns them and each terminal CallKit event clears only that call.
        private enum PendingPushKey {
            static let action = "pending_push_action"
            static let metadata = "pending_push_metadata"
            static let voipPush = "pending_voip_push"
            static let voipAction = "pending_voip_action"
            static let callKitUUID = "@pending_callkit_uuid"
            static let callKitAnswer = "pending_callkit_answer"
            /// Call id of the push that currently owns the shared keys above.
            static let owner = "telnyx_pending_push_call_id"
        }
        // Keep terminal missed-call invalidation atomic with registration side effects so a
        // delayed CallKit completion cannot restore an already-ended incoming call.
        private let incomingRegistrationQueue = DispatchQueue(
            label: "com.telnyx.react-voice-commons.incoming-registration")
        public lazy var activeCalls = LockedDictionary<UUID, [String: Any]>(lock: stateLock)
        public lazy var pendingAnswerActions = LockedDictionary<UUID, CXAnswerCallAction>(
            lock: stateLock)
        public lazy var pendingHeldActions = LockedDictionary<UUID, CXSetHeldCallAction>(
            lock: stateLock)
        private var audioLifecycleGeneration = 0

        private func advanceAudioLifecycleGeneration() -> Int {
            stateLock.lock()
            defer { stateLock.unlock() }
            audioLifecycleGeneration += 1
            return audioLifecycleGeneration
        }

        private func currentAudioLifecycleGeneration() -> Int {
            stateLock.lock()
            defer { stateLock.unlock() }
            return audioLifecycleGeneration
        }

        fileprivate func markCallKitRegistered(_ callUUID: UUID) {
            guard var callData = activeCalls[callUUID] else {
                return
            }

            callData["isCallKitRegistered"] = true
            activeCalls[callUUID] = callData
        }

        fileprivate func isCallKitRegistered(_ callUUID: UUID) -> Bool {
            guard let callData = activeCalls[callUUID] else {
                return false
            }

            if callData["direction"] as? String == "incoming" {
                return callData["isCallKitRegistered"] as? Bool == true
            }

            return true
        }

        @discardableResult
        fileprivate func performIncomingRegistrationIfOwned(
            _ callUUID: UUID,
            token: String,
            effects: () -> Void
        ) -> Bool {
            return incomingRegistrationQueue.sync {
                guard let callData = activeCalls[callUUID],
                    callData["incomingRegistrationToken"] as? String == token
                else {
                    return false
                }

                effects()
                return true
            }
        }

        fileprivate func invalidateIncomingRegistration(_ callUUID: UUID) {
            incomingRegistrationQueue.sync {
                guard var callData = activeCalls[callUUID] else {
                    return
                }

                callData.removeValue(forKey: "incomingRegistrationToken")
                activeCalls[callUUID] = callData
            }
        }

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
            // Guard against duplicate provider creation (async setupAutomatically can overwrite
            // the provider created by setupSynchronously for VoIP push)
            guard callKitProvider == nil else {
                NSLog("TelnyxVoice: setupCallKit() - provider already exists, skipping to prevent overwrite")
                return
            }

            // Set the initial state only when installing the provider. Re-running setup after
            // CallKit activation must never disable a live WebRTC audio device.
            RTCAudioSession.sharedInstance().useManualAudio = true
            RTCAudioSession.sharedInstance().isAudioEnabled = false

            NotificationCenter.default.addObserver(
                self,
                selector: #selector(handleAudioRouteChange(_:)),
                name: AVAudioSession.routeChangeNotification,
                object: nil)

            _ = installCallKitProvider()
        }

        @objc private func handleAudioRouteChange(_ notification: Notification) {
            let audioSession = AVAudioSession.sharedInstance()
            let reason = notification.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt
            let outputs = audioSession.currentRoute.outputs
            let isSpeakerEnabled = outputs.contains { $0.portType == .builtInSpeaker }
            NSLog(
                "TelnyxVoice: audio route changed; reason=\(reason.map(String.init) ?? "unknown") category=\(audioSession.category.rawValue) mode=\(audioSession.mode.rawValue) options=\(audioSession.categoryOptions.rawValue) speaker=\(isSpeakerEnabled)"
            )

            // Outside a call the session is .playback, which defaults to the speaker. That says
            // nothing about the call's route, so only report routes for the call category.
            guard audioSession.category == .playAndRecord else { return }

            CallKitBridge.shared?.emitAudioSessionEvent(
                "AudioRouteChanged",
                data: [
                    "isSpeakerEnabled": isSpeakerEnabled,
                    "outputPortType": outputs.first?.portType.rawValue ?? "",
                ])
        }

        /// Applies the call audio configuration. CallKit's UI tracks the session's route, and Apple
        /// advises against changing a session's configuration once CallKit has activated it, so
        /// call this before an action that leads to activation. Once applied, later calls change
        /// nothing, because RTCAudioSession only touches the values that differ.
        fileprivate func configureCallAudioSession(reason: String) {
            let webRTCConfig = RTCAudioSessionConfiguration.webRTC()
            // Keep .allowBluetoothA2DP: device testing showed that without it, the CallKit speaker
            // indicator doesn't follow an in-app overrideOutputAudioPort. Apple doesn't document why.
            webRTCConfig.categoryOptions = [
                .allowBluetoothA2DP,
                .duckOthers,
                .allowBluetooth,
                .mixWithOthers,
            ]
            // WebRTC's audio unit applies this global configuration when it starts. Without this,
            // it would replace the options above on the session CallKit just activated.
            RTCAudioSessionConfiguration.setWebRTC(webRTCConfig)

            let rtcAudioSession = RTCAudioSession.sharedInstance()
            rtcAudioSession.lockForConfiguration()
            let optionsBefore = rtcAudioSession.categoryOptions.rawValue
            do {
                try rtcAudioSession.setConfiguration(webRTCConfig)
            } catch {
                NSLog("TelnyxVoice: configureCallAudioSession (\(reason)) error: \(error)")
            }
            NSLog(
                "TelnyxVoice: configureCallAudioSession (\(reason)); requested=\(webRTCConfig.categoryOptions.rawValue) before=\(optionsBefore) after=\(rtcAudioSession.categoryOptions.rawValue)"
            )
            rtcAudioSession.unlockForConfiguration()
        }

        fileprivate func activateWebRTCAudio(
            _ audioSession: AVAudioSession = AVAudioSession.sharedInstance(),
            reason: String
        ) {
            // Normally a no-op: kept so a session that missed pre-activation setup still recovers.
            configureCallAudioSession(reason: reason)

            let rtcAudioSession = RTCAudioSession.sharedInstance()
            rtcAudioSession.lockForConfiguration()
            let wasAudioEnabled = rtcAudioSession.isAudioEnabled
            NSLog("TelnyxVoice: activating WebRTC audio (\(reason)); enabled=\(wasAudioEnabled)")

            var activationSucceeded = false
            do {
                try rtcAudioSession.setActive(true)
                activationSucceeded = true
            } catch {
                NSLog("TelnyxVoice: activateWebRTCAudio activation (\(reason)) error: \(error)")
            }
            if activationSucceeded {
                rtcAudioSession.isAudioEnabled = true
            } else if !wasAudioEnabled {
                rtcAudioSession.isAudioEnabled = false
            }
            rtcAudioSession.unlockForConfiguration()
            if activationSucceeded && !wasAudioEnabled {
                rtcAudioSession.audioSessionDidActivate(audioSession)
            }
        }

        fileprivate func verifyAudioAfterConnection(for callUUID: UUID) {
            // didActivate is asynchronous after CXAnswerCallAction.fulfill(). Verify shortly
            // afterwards so either callback ordering converges on the same idempotent state.
            let verificationGeneration = currentAudioLifecycleGeneration()
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.75) { [weak self] in
                guard let self,
                    self.currentAudioLifecycleGeneration() == verificationGeneration,
                    self.activeCalls[callUUID] != nil
                else { return }
                let rtcAudioSession = RTCAudioSession.sharedInstance()
                rtcAudioSession.lockForConfiguration()
                let isAudioEnabled = rtcAudioSession.isAudioEnabled
                rtcAudioSession.unlockForConfiguration()
                if isAudioEnabled {
                    NSLog("TelnyxVoice: audio verification passed for \(callUUID)")
                } else if AVAudioSession.sharedInstance().category != .playAndRecord {
                    NSLog("TelnyxVoice: audio verification skipped for inactive CallKit session \(callUUID)")
                } else {
                    NSLog("TelnyxVoice: audio verification recovering disabled audio for \(callUUID)")
                    self.activateWebRTCAudio(reason: "connected-call verification")
                }
            }
        }

        #if DEBUG
            fileprivate func simulateAudioSetupRace(for callUUID: UUID, delay: TimeInterval) {
                NSLog("TelnyxVoice: [VSUP-226] scheduling late audio reset in \(delay)s")
                DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
                    let rtcAudioSession = RTCAudioSession.sharedInstance()
                    rtcAudioSession.isAudioEnabled = false
                    NSLog("TelnyxVoice: [VSUP-226] injected late setup reset; enabled=false")
                    self?.verifyAudioAfterConnection(for: callUUID)
                }
            }
        #endif

        private func installCallKitProvider() -> CXProvider {
            // Use the localizedName from the app's bundle display name or fallback
            let appName =
                Bundle.main.object(forInfoDictionaryKey: "CFBundleDisplayName") as? String
                ?? Bundle.main.object(forInfoDictionaryKey: "CFBundleName") as? String
                ?? "Voice Call"

            let configuration = CXProviderConfiguration(localizedName: appName)
            configuration.supportsVideo = false
            configuration.maximumCallGroups = 2
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
            callUpdate.supportsHolding = true

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

                self.pendingAnswerActions.removeValue(forKey: callUUID)?.fail()
                self.pendingHeldActions.removeValue(forKey: callUUID)?.fail()

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

                self.pendingAnswerActions.removeValue(forKey: callUUID)?.fail()
                self.pendingHeldActions.removeValue(forKey: callUUID)?.fail()

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
                let activeSource = activeCall["source"] as? String

                // A missed-call push normally reuses the original incoming
                // push's call_id. End that still-ringing CallKit call and show
                // the notification instead of treating it as a UUID collision.
                if activeSource == "push_notification" || activeSource == "terminated_app_push"
                    || activeSource == "push"
                {
                    NSLog(
                        "TelnyxVoice: Missed call matched active incoming push UUID: \(callUUID)"
                    )
                    // Stop the original report callback from persisting or emitting
                    // this call while the missed-call watchdog report is pending.
                    invalidateIncomingRegistration(callUUID)
                    // This is a second PushKit delivery, so report it to CallKit
                    // with a fresh UUID before ending the original ringing call.
                    reportAndEndWatchdogCall(
                        callUUID: UUID(),
                        callerName: callerName,
                        callerNumber: callerNumber,
                        payload: payload,
                        source: "missed_call_matched_watchdog",
                        endedReason: .remoteEnded
                    ) {
                        finishMissedCall()
                    }
                    return true
                }

                guard activeSource == "missed_call_push" else {
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
            callUpdate.supportsHolding = true

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

        // MARK: - Pending push ownership

        /// Every key that can belong to one incoming push. They are read and
        /// written by both this manager and VoicePnBridge, so ownership is
        /// tracked in `PendingPushKey.owner` and a terminal CallKit event clears
        /// the whole bundle only when it belongs to that call.
        private static let pendingPushKeys = [
            PendingPushKey.action,
            PendingPushKey.metadata,
            PendingPushKey.voipPush,
            PendingPushKey.voipAction,
            PendingPushKey.callKitUUID,
            PendingPushKey.callKitAnswer,
            PendingPushKey.owner,
        ]

        private func normalizedCallId(_ callId: String?) -> String? {
            guard let callId = callId?.trimmingCharacters(in: .whitespacesAndNewlines),
                !callId.isEmpty
            else {
                return nil
            }
            return callId.lowercased()
        }

        private func callIdsMatch(_ lhs: String?, _ rhs: String?) -> Bool {
            guard let lhs = normalizedCallId(lhs), let rhs = normalizedCallId(rhs) else {
                return false
            }
            return lhs == rhs
        }

        /// Every value that can identify one push flow. A push is stored under
        /// its signaling call_id, but a CallKit action may know the same flow by
        /// a different UUID, so both are accepted when matching.
        private func pendingPushIdentifiers(callId: String?, callUUID: UUID?) -> Set<String> {
            var identifiers = Set<String>()
            if let callId = normalizedCallId(callId) {
                identifiers.insert(callId)
            }
            if let callUUID = callUUID {
                identifiers.insert(callUUID.uuidString.lowercased())
            }
            return identifiers
        }

        private func storedPendingPushIdentifiers() -> Set<String> {
            var identifiers = Set<String>()
            let sources: [String?] = [
                UserDefaults.standard.string(forKey: PendingPushKey.owner),
                pendingCallId(fromJsonForKey: PendingPushKey.metadata),
                pendingCallId(fromJsonForKey: PendingPushKey.voipPush),
                UserDefaults.standard.string(forKey: PendingPushKey.callKitUUID),
                UserDefaults.standard.string(forKey: PendingPushKey.callKitAnswer),
            ]
            for source in sources {
                if let identifier = normalizedCallId(source) {
                    identifiers.insert(identifier)
                }
            }
            return identifiers
        }

        /// Stores a push under the lock that `clearPendingVoipPush(ifMatches:)` holds, so a new push
        /// can't land between that method's check and its delete.
        fileprivate func writePendingVoipPush(_ json: String) {
            pendingVoipPushLock.lock()
            defer { pendingVoipPushLock.unlock() }
            UserDefaults.standard.set(json, forKey: "pending_voip_push")
        }

        /// Stores one push together with the call that owns it. `ownerCallId`
        /// should be the push's call_id, or the CallKit UUID when the payload
        /// does not carry one, so a later terminal event can clear exactly this
        /// flow without touching a newer push that arrived in the meantime.
        /// The newest push wins: the shared keys can only hold one flow, and
        /// `clearPendingVoipPush(ifMatches:)` exists so an older flow can't
        /// delete the newer flow's metadata when it ends.
        @discardableResult
        fileprivate func storePendingPush(
            _ payload: [AnyHashable: Any], ownerCallId: String?
        ) -> Bool {
            pendingVoipPushLock.lock()
            defer { pendingVoipPushLock.unlock() }

            let owner = normalizedCallId(ownerCallId)

            let metadataJson = TelnyxCallKitManager.jsonString(from: payload, fallback: "{}")
            let voipPushJson = TelnyxCallKitManager.jsonString(
                from: ["payload": payload],
                fallback: "{\"payload\":{}}"
            )

            UserDefaults.standard.set("incoming_call", forKey: PendingPushKey.action)
            UserDefaults.standard.set(metadataJson, forKey: PendingPushKey.metadata)
            writePendingVoipPush(voipPushJson)
            // CallKit identifiers from a previous flow would otherwise keep
            // matching this bundle and make a stale answer/end clear it.
            for key in [PendingPushKey.callKitAnswer, PendingPushKey.callKitUUID] {
                let existing = normalizedCallId(UserDefaults.standard.string(forKey: key))
                if existing != nil, existing != owner {
                    UserDefaults.standard.removeObject(forKey: key)
                }
            }
            if let owner = owner {
                UserDefaults.standard.set(owner, forKey: PendingPushKey.owner)
            } else {
                UserDefaults.standard.removeObject(forKey: PendingPushKey.owner)
            }
            UserDefaults.standard.synchronize()
            NSLog("TelnyxVoice: Stored pending push for call \(ownerCallId ?? "unknown")")
            return true
        }

        /// Used by VoicePnBridge when React Native supplies the metadata. The
        /// owner is derived from the payload so a later terminal event can
        /// clear it, and an already-active push is never replaced.
        @discardableResult
        func setPendingPushAction(_ action: String, metadata: String) -> Bool {
            pendingVoipPushLock.lock()
            defer { pendingVoipPushLock.unlock() }

            let metadataCallId = normalizedCallId(pendingCallId(fromJsonString: metadata))
            let existingOwner = normalizedCallId(
                UserDefaults.standard.string(forKey: PendingPushKey.owner))
            if let existingOwner = existingOwner,
                let metadataCallId = metadataCallId,
                existingOwner != metadataCallId,
                hasActiveCall(withCallId: existingOwner)
            {
                NSLog(
                    "TelnyxVoice: Keeping pending push for active call \(existingOwner); ignoring metadata for \(metadataCallId)"
                )
                return false
            }

            UserDefaults.standard.set(action, forKey: PendingPushKey.action)
            UserDefaults.standard.set(metadata, forKey: PendingPushKey.metadata)
            // Keep the previous owner only while its call is still live;
            // otherwise it would pin this metadata to an ended call.
            let retainedOwner = existingOwner.flatMap {
                hasActiveCall(withCallId: $0) ? $0 : nil
            }
            if let owner = metadataCallId ?? retainedOwner {
                UserDefaults.standard.set(owner, forKey: PendingPushKey.owner)
            } else {
                UserDefaults.standard.removeObject(forKey: PendingPushKey.owner)
            }
            UserDefaults.standard.synchronize()
            return true
        }

        /// Clears the push state that belongs to `callId`/`callUUID`. Without
        /// an identifier the terminal event can't prove it owns the shared
        /// keys, so nothing is cleared; callers that mean "clear everything"
        /// (`providerDidReset`, bridge init) use `clearPendingVoipPush()`.
        fileprivate func clearPendingPushData(for callId: String?, callUUID: UUID? = nil) {
            let targets = pendingPushIdentifiers(callId: callId, callUUID: callUUID)
            guard !targets.isEmpty else {
                return
            }

            pendingVoipPushLock.lock()
            defer { pendingVoipPushLock.unlock() }
            _ = clearPendingPushDataLocked(targets: targets)
        }

        /// Clears stored push state only when it cannot belong to the answered
        /// call. This stops a connection from consuming another push's metadata
        /// when the two flows overlap.
        fileprivate func clearPendingPushData(mismatching callId: String?, callUUID: UUID?) {
            let targets = pendingPushIdentifiers(callId: callId, callUUID: callUUID)
            guard !targets.isEmpty else {
                return
            }

            pendingVoipPushLock.lock()
            defer { pendingVoipPushLock.unlock() }

            let stored = storedPendingPushIdentifiers()
            guard !stored.isEmpty, stored.isDisjoint(with: targets) else {
                return
            }

            // A bundle still owned by another live call is that call's to
            // consume or clear. Only drop push state nobody can claim anymore.
            guard !stored.contains(where: { hasActiveCall(withCallId: $0) }) else {
                return
            }

            NSLog(
                "TelnyxVoice: Dropping pending push owned by \(stored.sorted().joined(separator: ",")) while answering \(targets.sorted().joined(separator: ","))"
            )
            _ = clearPendingPushDataLocked(targets: [])
        }

        @discardableResult
        private func clearPendingPushDataLocked(targets: Set<String>) -> Bool {
            let stored = storedPendingPushIdentifiers()
            let shouldClear = targets.isEmpty || !stored.isDisjoint(with: targets)
            guard shouldClear else {
                return false
            }

            var cleared = false
            for key in TelnyxCallKitManager.pendingPushKeys {
                if UserDefaults.standard.object(forKey: key) != nil {
                    UserDefaults.standard.removeObject(forKey: key)
                    cleared = true
                }
            }

            if cleared {
                UserDefaults.standard.synchronize()
                let description =
                    targets.isEmpty
                    ? "all calls" : targets.sorted().joined(separator: ",")
                NSLog("TelnyxVoice: Cleared pending push state for \(description)")
            }
            return cleared
        }

        /// Explicit React Native cleanup after it consumed or rejected a push.
        /// The bundle is cleared as a unit so a leftover voice_sdk_id can never
        /// be attached to the next connection.
        func clearPendingVoipPush() -> Bool {
            pendingVoipPushLock.lock()
            defer { pendingVoipPushLock.unlock() }
            return clearPendingPushDataLocked(targets: [])
        }

        /// Explicit React Native cleanup of the action/metadata pair. The VoIP
        /// push payload is left alone because it is cleared by its own method.
        func clearPendingPushAction() -> Bool {
            pendingVoipPushLock.lock()
            defer { pendingVoipPushLock.unlock() }

            let hadData =
                UserDefaults.standard.object(forKey: PendingPushKey.action) != nil
                || UserDefaults.standard.object(forKey: PendingPushKey.metadata) != nil
                || UserDefaults.standard.object(forKey: PendingPushKey.owner) != nil
            UserDefaults.standard.removeObject(forKey: PendingPushKey.action)
            UserDefaults.standard.removeObject(forKey: PendingPushKey.metadata)
            UserDefaults.standard.removeObject(forKey: PendingPushKey.owner)
            if hadData {
                UserDefaults.standard.synchronize()
                NSLog("TelnyxVoice: Cleared pending push action")
            }
            return hadData
        }

        private func hasActiveCall(withCallId callId: String) -> Bool {
            let target = normalizedCallId(callId)
            return activeCalls.values.contains { callData in
                let identifiers = [
                    callData["callId"] as? String,
                    callData["uuid"] as? String,
                ].compactMap { $0 }
                return identifiers.contains { callIdsMatch($0, target) }
            }
        }

        /// Maps a CallKit UUID to the call id that owns its pending push.
        fileprivate func pendingPushCallId(for callUUID: UUID) -> String {
            if let callId = activeCalls[callUUID]?["callId"] as? String,
                normalizedCallId(callId) != nil
            {
                return callId
            }
            return callUUID.uuidString
        }

        /// A force-quit or crash can leave push-only state behind with no live
        /// CallKit call to consume it. Drop it before a fresh login can reuse it.
        fileprivate func purgePendingPushStateIfNoActiveCalls() {
            guard activeCalls.values.isEmpty else {
                return
            }

            pendingVoipPushLock.lock()
            defer { pendingVoipPushLock.unlock() }
            _ = clearPendingPushDataLocked(targets: [])
        }

        /// Clears the stored push only if it still belongs to `callId`. Checking
        /// and deleting in separate bridge calls could delete a newer push for a
        /// different call. A push without a call ID can't belong to a different
        /// call, so it's cleared too.
        func clearPendingVoipPush(ifMatches callId: String) -> Bool {
            pendingVoipPushLock.lock()
            defer { pendingVoipPushLock.unlock() }

            guard UserDefaults.standard.string(forKey: "pending_voip_push") != nil else {
                return false
            }
            if let pendingId = pendingCallId(fromJsonForKey: PendingPushKey.voipPush),
                pendingId.caseInsensitiveCompare(callId) != .orderedSame
            {
                return false
            }

            UserDefaults.standard.removeObject(forKey: "pending_voip_push")
            // The matching voip push identifies the whole bundle, so clear the
            // metadata that would otherwise be replayed into the next login.
            return clearPendingPushDataLocked(targets: [])
        }

        private static func jsonString(from object: Any, fallback: String) -> String {
            guard let data = try? JSONSerialization.data(withJSONObject: object),
                let json = String(data: data, encoding: .utf8)
            else {
                return fallback
            }
            return json
        }

        private func pendingCallId(fromJsonForKey key: String) -> String? {
            return pendingCallId(fromJsonString: UserDefaults.standard.string(forKey: key))
        }

        private func pendingCallId(fromJsonString jsonString: String?) -> String? {
            guard let jsonString = jsonString,
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

            // Store the VoIP push data for VoicePnBridge (same format as AppDelegate was using).
            // Ownership is recorded so this call's terminal event clears exactly this push.
            storePendingPush(
                payload.dictionaryPayload,
                ownerCallId: callId ?? callUUID.uuidString
            )

            activeCalls[callUUID] = [
                "caller": caller,
                "callId": callId as Any,
                "payload": payload.dictionaryPayload,
                "uuid": callUUID.uuidString,
                "direction": "incoming",
                "source": "push",
                "isCallKitRegistered": false,
            ]

            let handle = CXHandle(type: .phoneNumber, value: caller)
            let callUpdate = CXCallUpdate()
            callUpdate.remoteHandle = handle
            callUpdate.hasVideo = false
            callUpdate.localizedCallerName = caller
            callUpdate.supportsHolding = true

            callKitProvider?.reportNewIncomingCall(with: callUUID, update: callUpdate) {
                [weak self] error in
                if let error = error {
                    NSLog("TelnyxVoice: CallKit error: \(error.localizedDescription)")
                    self?.activeCalls.removeValue(forKey: callUUID)
                    self?.clearPendingPushData(for: callId, callUUID: callUUID)
                } else {
                    self?.markCallKitRegistered(callUUID)
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
            pendingAnswerActions.values.forEach { $0.fail() }
            pendingAnswerActions.removeAll()
            pendingHeldActions.values.forEach { $0.fail() }
            pendingHeldActions.removeAll()
            // No call survives a provider reset, so no pending push metadata
            // should survive either.
            _ = clearPendingVoipPush()
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

            guard isCallKitRegistered(action.callUUID) else {
                NSLog("TelnyxVoice: Failing answer for unknown UUID: \(action.callUUID)")
                action.fail()
                return
            }

            guard pendingAnswerActions[action.callUUID] == nil else {
                NSLog("TelnyxVoice: Failing duplicate answer for UUID: \(action.callUUID)")
                action.fail()
                return
            }

            // The answer belongs to this CallKit call. Never let it consume an
            // overlapping push's metadata or voice_sdk_id.
            clearPendingPushData(
                mismatching: activeCalls[action.callUUID]?["callId"] as? String,
                callUUID: action.callUUID
            )

            configureCallAudioSession(reason: "CXAnswerCallAction")

            // Check if this is a programmatic answer (call already answered in WebRTC)
            // vs a user answer from CallKit UI
            if let callData = activeCalls[action.callUUID],
                let isAlreadyAnswered = callData["isAlreadyAnswered"] as? Bool,
                isAlreadyAnswered
            {
                NSLog("TelnyxVoice: Call already answered in WebRTC, skipping emission")
            } else {
                // Notify React Native via CallKit bridge (only for user-initiated answers)
                let eventDelivered = CallKitBridge.shared?.emitCallEvent(
                    "CallKitDidPerformAnswerCallAction", callUUID: action.callUUID,
                    callData: activeCalls[action.callUUID]) ?? false
                if !eventDelivered {
                    UserDefaults.standard.set(action.callUUID.uuidString, forKey: "pending_callkit_answer")
                    UserDefaults.standard.synchronize()
                    NSLog("TelnyxVoice: Stored pending CallKit answer for UUID: \(action.callUUID)")
                }
            }

            // Defer action.fulfill() until reportCallConnected when peer connection is ready
            NSLog("TelnyxVoice: Deferring CXAnswerCallAction.fulfill() until peer connection is ready")
            self.pendingAnswerActions[action.callUUID] = action
        }

        public func provider(_ provider: CXProvider, perform action: CXSetHeldCallAction) {
            NSLog(
                "TelnyxVoice: User requested held=\(action.isOnHold) for UUID: \(action.callUUID)"
            )

            guard activeCalls[action.callUUID] != nil else {
                NSLog("TelnyxVoice: Failing held action for unknown UUID: \(action.callUUID)")
                action.fail()
                return
            }

            guard pendingHeldActions[action.callUUID] == nil else {
                NSLog("TelnyxVoice: Failing duplicate held action for UUID: \(action.callUUID)")
                action.fail()
                return
            }

            // Holding can deactivate the session, which resets its category, so restore the
            // configuration before CallKit reactivates it on resume.
            if !action.isOnHold {
                configureCallAudioSession(reason: "CXSetHeldCallAction resume")
            }

            pendingHeldActions[action.callUUID] = action
            let emitted = CallKitBridge.shared?.emitHeldCallEvent(
                callUUID: action.callUUID,
                isOnHold: action.isOnHold,
                callData: activeCalls[action.callUUID]
            ) ?? false

            guard emitted else {
                pendingHeldActions.removeValue(forKey: action.callUUID)
                action.fail()
                return
            }

            DispatchQueue.main.asyncAfter(deadline: .now() + 10) { [weak self, weak action] in
                guard let self = self, let action = action,
                    self.pendingHeldActions[action.callUUID] === action
                else { return }

                NSLog("TelnyxVoice: Held action timed out for UUID: \(action.callUUID)")
                self.pendingHeldActions.removeValue(forKey: action.callUUID)
                action.fail()
            }
        }

        public func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
            NSLog("TelnyxVoice: User ended call with UUID: \(action.callUUID)")

            guard let callData = activeCalls[action.callUUID] else {
                NSLog("TelnyxVoice: Failing end action for unknown UUID: \(action.callUUID)")
                action.fail()
                return
            }

            // Clear this call's push metadata before the call disappears, so a
            // later login can't pick up a stale voice_sdk_id/attach context.
            clearPendingPushData(
                for: callData["callId"] as? String,
                callUUID: action.callUUID
            )

            // Notify React Native via CallKit bridge
            CallKitBridge.shared?.emitCallEvent(
                "CallKitDidPerformEndCallAction", callUUID: action.callUUID,
                callData: callData)

            _ = advanceAudioLifecycleGeneration()
            activeCalls.removeValue(forKey: action.callUUID)
            pendingAnswerActions.removeValue(forKey: action.callUUID)?.fail()
            pendingHeldActions.removeValue(forKey: action.callUUID)?.fail()
            NSLog("📞 TelnyxVoice: Fulfilling CXEndCallAction for call UUID: \(action.callUUID)")
            action.fulfill()
            NSLog("📞 TelnyxVoice: ✅ CXEndCallAction fulfilled successfully")
        }

        public func provider(_ provider: CXProvider, perform action: CXStartCallAction) {
            NSLog("TelnyxVoice: Starting outgoing call with UUID: \(action.callUUID)")

            configureCallAudioSession(reason: "CXStartCallAction")

            // Notify React Native via CallKit bridge
            CallKitBridge.shared?.emitCallEvent(
                "CallKitDidReceiveStartCallAction", callUUID: action.callUUID,
                callData: activeCalls[action.callUUID])

            let callUpdate = CXCallUpdate()
            callUpdate.remoteHandle = action.handle
            callUpdate.hasVideo = false
            callUpdate.supportsHolding = true
            provider.reportCall(with: action.callUUID, updated: callUpdate)

            NSLog("📞 TelnyxVoice: Fulfilling CXStartCallAction for call UUID: \(action.callUUID)")
            action.fulfill()
            NSLog("📞 TelnyxVoice: ✅ CXStartCallAction fulfilled successfully")
        }

        public func provider(_ provider: CXProvider, timedOutPerforming action: CXAction) {
            if let answerAction = action as? CXAnswerCallAction {
                pendingAnswerActions.removeValue(forKey: answerAction.callUUID)
                clearPendingPushData(
                    for: pendingPushCallId(for: answerAction.callUUID),
                    callUUID: answerAction.callUUID
                )
            } else if let heldAction = action as? CXSetHeldCallAction {
                pendingHeldActions.removeValue(forKey: heldAction.callUUID)
            }
            action.fail()
        }

        public func provider(_ provider: CXProvider, didActivate audioSession: AVAudioSession) {
            NSLog("TelnyxVoice: Audio session activated by CallKit")
            _ = advanceAudioLifecycleGeneration()
            activateWebRTCAudio(audioSession, reason: "CallKit didActivate")

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
            _ = advanceAudioLifecycleGeneration()

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

        private func storePendingVoipPush(_ payload: [AnyHashable: Any]) {
            var ownerCallId: String?
            if let metadata = payload["metadata"] as? [String: Any] {
                ownerCallId = metadata["call_id"] as? String
            } else {
                ownerCallId = payload["call_id"] as? String ?? payload["callId"] as? String
            }

            // Record the owning call alongside the payload so the terminal
            // CallKit event for this call clears exactly this push context.
            TelnyxCallKitManager.shared.storePendingPush(
                payload,
                ownerCallId: ownerCallId
            )
            NSLog(
                "[TelnyxVoipPushHandler] Stored VoIP push data after CallKit registration succeeded"
            )
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
            TelnyxCallKitManager.shared.configureCallAudioSession(reason: "VoIP push")

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
            let registrationToken = UUID().uuidString
            callKitManager.activeCalls[callUUID] = [
                "caller": callerName,
                "handle": callerNumber,
                "callId": callIdString,
                "payload": payload.dictionaryPayload,
                "uuid": callUUID.uuidString,
                "direction": "incoming",
                "source": isAppRunning ? "push_notification" : "terminated_app_push",
                "isCallKitRegistered": false,
                "incomingRegistrationToken": registrationToken,
            ]

            // Report to CallKit immediately
            let handle = CXHandle(type: .phoneNumber, value: callerNumber)
            let callUpdate = CXCallUpdate()
            callUpdate.remoteHandle = handle
            callUpdate.hasVideo = false
            callUpdate.localizedCallerName = callerName
            callUpdate.supportsHolding = true

            callKitProvider.reportNewIncomingCall(with: callUUID, update: callUpdate) { error in
                defer { completion() }

                let handled = callKitManager.performIncomingRegistrationIfOwned(
                    callUUID, token: registrationToken
                ) {
                    if let error = error {
                        let nsError = error as NSError
                        let reason =
                            nsError.domain == CXErrorDomainIncomingCall && nsError.code == 3
                            ? "filteredByDoNotDisturb" : "registrationRejected"
                        NSLog(
                            "[TelnyxVoipPushHandler] CallKit incoming registration rejected: domain=\(nsError.domain), code=\(nsError.code), reason=\(reason)"
                        )
                        callKitManager.activeCalls.removeValue(forKey: callUUID)
                        callKitManager.clearPendingPushData(for: callUUID.uuidString)
                    } else {
                        NSLog(
                            "[TelnyxVoipPushHandler] ✅ CallKit call reported successfully via unified path"
                        )

                        callKitManager.markCallKitRegistered(callUUID)
                        self.storePendingVoipPush(payload.dictionaryPayload)

                        // CRITICAL: Store the CallKit UUID for the React Native CallKitCoordinator
                        // This allows the coordinator to find the existing CallKit call instead of creating a duplicate
                        UserDefaults.standard.set(
                            callUUID.uuidString, forKey: "@pending_callkit_uuid")
                        UserDefaults.standard.synchronize()
                        NSLog(
                            "[TelnyxVoipPushHandler] ✅ Stored CallKit UUID for React Native coordinator: \(callUUID.uuidString)"
                        )

                        // Try to emit push received event if CallKit bridge is available
                        if let callKitBridge = CallKitBridge.shared {
                            let source =
                                isAppRunning ? "push_notification" : "terminated_app_push"
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
                }

                if !handled {
                    NSLog(
                        "[TelnyxVoipPushHandler] Ignoring stale incoming registration completion for ended call: \(callUUID.uuidString)"
                    )
                }
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
