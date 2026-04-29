import Foundation
import React
import os

#if os(iOS)
    import CallKit
    import AVFoundation
    import UIKit
    import PushKit
    import WebRTC

    // MARK: - Public release-mode logger
    // Uses the Swift `Logger` API (iOS 14+) which has reliable string-
    // interpolation privacy hints. Filter in Console.app with:
    //   subsystem:com.telnyx.voice
    // The `, privacy: .public` interpolation flag forces the message body
    // to render as plain text instead of <private> in release builds.
    //
    // The `os_log` Swift overload loses the %{public}@ marker across the
    // bridge in some toolchains, so we deliberately use Logger here, not
    // os_log, and we do NOT call NSLog (whose arguments are also redacted
    // in release builds).
    @objc public class TXLog: NSObject {
        public static let subsystem = "com.telnyx.voice"

        // Logger is iOS 14+; we re-create per call (cheap) so we don't have
        // to gate a static property with @available, which Swift won't allow
        // at file scope. For iOS 13 fallback we use the C os_log %s format.
        @objc public static func info(_ tag: String, _ message: String) {
            if #available(iOS 14.0, *) {
                let logger = Logger(subsystem: subsystem, category: "Telnyx")
                logger.info("[\(tag, privacy: .public)] \(message, privacy: .public)")
            } else {
                let log = OSLog(subsystem: subsystem, category: "Telnyx")
                os_log("[%{public}s] %{public}s", log: log, type: .info, tag, message)
            }
        }

        @objc public static func error(_ tag: String, _ message: String) {
            if #available(iOS 14.0, *) {
                let logger = Logger(subsystem: subsystem, category: "Telnyx")
                logger.error("[\(tag, privacy: .public)] ❌ \(message, privacy: .public)")
            } else {
                let log = OSLog(subsystem: subsystem, category: "Telnyx")
                os_log("[%{public}s] ❌ %{public}s", log: log, type: .error, tag, message)
            }
        }

        @objc public static func warn(_ tag: String, _ message: String) {
            if #available(iOS 14.0, *) {
                let logger = Logger(subsystem: subsystem, category: "Telnyx")
                logger.warning("[\(tag, privacy: .public)] ⚠️ \(message, privacy: .public)")
            } else {
                let log = OSLog(subsystem: subsystem, category: "Telnyx")
                os_log("[%{public}s] ⚠️ %{public}s", log: log, type: .default, tag, message)
            }
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
                let elapsed = manager.pendingAnswerAt.map { Date().timeIntervalSince($0) } ?? -1
                TXLog.info(
                    "CallKit",
                    "reportCallConnected - fulfilling deferred CXAnswerCallAction after \(String(format: "%.2f", elapsed))s UUID=\(uuid.uuidString)"
                )
                pendingAction.fulfill()
                manager.pendingAnswerAction = nil
                manager.pendingAnswerAt = nil
                manager.pendingAnswerWatchdog?.cancel()
                manager.pendingAnswerWatchdog = nil
            } else {
                TXLog.info("CallKit", "reportCallConnected - no pending action UUID=\(uuid.uuidString)")
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

        // Release-safe log bridge for JS. Writes via os_log with %{public}@
        // so Console.app shows the message in release builds (not <private>).
        // Level: "info" | "warn" | "error".
        @objc func publicLog(
            _ tag: String, level: String, message: String,
            resolver resolve: @escaping RCTPromiseResolveBlock,
            rejecter reject: @escaping RCTPromiseRejectBlock
        ) {
            switch level {
            case "error": TXLog.error(tag, message)
            case "warn": TXLog.warn(tag, message)
            default: TXLog.info(tag, message)
            }
            resolve(["success": true])
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
        public var pendingAnswerAt: Date?
        public var pendingAnswerWatchdog: DispatchWorkItem?

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

        public func setupSynchronously() {
            // Only initialize once
            guard callKitProvider == nil else {
                NSLog("TelnyxVoice: CallKit already setup, skipping")
                return
            }

            // CRITICAL: Setup CallKit synchronously for terminated app VoIP push handling
            // This MUST happen in the same run loop as the VoIP push
            NSLog("TelnyxVoice: Synchronous CallKit setup for terminated app scenario...")
            setupCallKit()
            NSLog("TelnyxVoice: ✅ CallKit provider ready for terminated app handling")
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

            callKitProvider = CXProvider(configuration: configuration)
            callKitProvider?.setDelegate(self, queue: nil)
            callKitController = CXCallController()

            NSLog("TelnyxVoice: CallKit provider and controller created")
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
            TXLog.info("CallKit", "ANSWER ACTION received - UUID=\(action.callUUID.uuidString)")

            // Check if this is a programmatic answer (call already answered in WebRTC)
            // vs a user answer from CallKit UI
            if let callData = activeCalls[action.callUUID],
                let isAlreadyAnswered = callData["isAlreadyAnswered"] as? Bool,
                isAlreadyAnswered
            {
                TXLog.info("CallKit", "Call already answered in WebRTC, skipping emission UUID=\(action.callUUID.uuidString)")
            } else {
                let hasBridge = CallKitBridge.shared != nil
                TXLog.info("CallKit", "Emitting CallKitDidPerformAnswerCallAction to RN (bridgeReady=\(hasBridge)) UUID=\(action.callUUID.uuidString)")
                CallKitBridge.shared?.emitCallEvent(
                    "CallKitDidPerformAnswerCallAction", callUUID: action.callUUID,
                    callData: activeCalls[action.callUUID])
            }

            // Defer action.fulfill() until reportCallConnected when peer connection is ready
            TXLog.info("CallKit", "Deferring CXAnswerCallAction.fulfill() until peer connection is ready UUID=\(action.callUUID.uuidString)")
            self.pendingAnswerAction = action
            self.pendingAnswerAt = Date()

            // Watchdog: if JS never signals reportCallConnected within 15s log
            // loudly so the failure is visible in Console.app. We do NOT
            // fulfill here — that would hide the bug.
            self.pendingAnswerWatchdog?.cancel()
            let uuidStr = action.callUUID.uuidString
            let watchdog = DispatchWorkItem { [weak self] in
                guard let self = self else { return }
                if let pending = self.pendingAnswerAction, pending.callUUID.uuidString == uuidStr {
                    let elapsed = self.pendingAnswerAt.map { Date().timeIntervalSince($0) } ?? -1
                    TXLog.error(
                        "CallKit.Watchdog",
                        "Peer connection NEVER became ready after \(String(format: "%.1f", elapsed))s — call stuck on 'connecting' UUID=\(uuidStr). Check SessionManager / WebSocket / INVITE logs above."
                    )
                }
            }
            self.pendingAnswerWatchdog = watchdog
            DispatchQueue.main.asyncAfter(deadline: .now() + 15, execute: watchdog)
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

            // Configure audio session early for VoIP call
            let audioSession = AVAudioSession.sharedInstance()
            do {
                try audioSession.setCategory(.playAndRecord, mode: .voiceChat)
                NSLog("Succeeded to activate audio session")
            } catch {
                NSLog("Failed to activate audio session: \(error)")
            }
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

            // Use call_id as CallKit UUID to ensure matching with WebRTC
            guard let callIdString = callId, let callUUID = UUID(uuidString: callIdString) else {
                NSLog(
                    "[TelnyxVoipPushHandler] ❌ No valid call_id found in payload, cannot process call"
                )
                completion()
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
            callKitManager.setupSynchronously()

            // Ensure we have a valid CallKit provider after setup
            guard let callKitProvider = callKitManager.callKitProvider else {
                NSLog(
                    "[TelnyxVoipPushHandler] ❌ FATAL: CallKit provider not available after synchronous setup!"
                )
                completion()
                return
            }

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
