import Foundation
import React
import AVFoundation

@objc(VoicePnBridge)
class VoicePnBridge: NSObject {
    
    @objc
    static func requiresMainQueueSetup() -> Bool {
        return false
    }
    
    // MARK: - UserDefaults-based methods for VoIP push handling
    
    @objc
    func getPendingPushAction(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        let action = UserDefaults.standard.string(forKey: "pending_push_action")
        let metadata = UserDefaults.standard.string(forKey: "pending_push_metadata")
        
        NSLog("[VoicePnBridge] getPendingPushAction - action: \(action ?? "nil"), metadata: \(metadata ?? "nil")")
        
        let result: [String: Any?] = [
            "action": action,
            "metadata": metadata
        ]
        
        resolve(result)
    }
    
    @objc
    func setPendingPushAction(_ action: String, metadata: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        let stored = TelnyxCallKitManager.shared.setPendingPushAction(action, metadata: metadata)
        NSLog("[VoicePnBridge] setPendingPushAction - action: \(action), metadata: \(metadata), stored: \(stored)")
        resolve(stored)
    }
    
    @objc
    func clearPendingPushAction(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        let cleared = TelnyxCallKitManager.shared.clearPendingPushAction()
        NSLog("[VoicePnBridge] clearPendingPushAction - cleared: \(cleared)")
        resolve(cleared)
    }
    
    // MARK: - Additional UserDefaults methods from UserDefaultsModule
    
    @objc
    func getVoipToken(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        let token = UserDefaults.standard.string(forKey: "voip_push_token")
        NSLog("[VoicePnBridge] getVoipToken called. token=\(token ?? "(nil)")")
        resolve(token)
    }
    
    @objc
    func getPendingVoipPush(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        let pending = UserDefaults.standard.string(forKey: "pending_voip_push")
        NSLog("[VoicePnBridge] getPendingVoipPush called. pending=\(pending ?? "(nil)")")
        resolve(pending)
    }
    
    @objc
    func clearPendingVoipPush(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        let cleared = TelnyxCallKitManager.shared.clearPendingVoipPush()
        NSLog("[VoicePnBridge] clearPendingVoipPush called. cleared: \(cleared)")
        resolve(cleared)
    }
    
    @objc
    func clearPendingVoipPushIfMatches(_ callId: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        let cleared = TelnyxCallKitManager.shared.clearPendingVoipPush(ifMatches: callId)
        NSLog("[VoicePnBridge] clearPendingVoipPushIfMatches called. callId=\(callId), cleared=\(cleared)")
        resolve(cleared)
    }

    @objc
    func getPendingCallKitAnswer(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        let answer = UserDefaults.standard.string(forKey: "pending_callkit_answer")
        NSLog("[VoicePnBridge] getPendingCallKitAnswer - answer: \(answer ?? "nil")")
        resolve(answer)
    }

    @objc
    func clearPendingCallKitAnswer(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        UserDefaults.standard.removeObject(forKey: "pending_callkit_answer")
        UserDefaults.standard.synchronize()
        NSLog("[VoicePnBridge] clearPendingCallKitAnswer - cleared")
        resolve(true)
    }

    @objc
    func getPendingVoipAction(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        let pending = UserDefaults.standard.string(forKey: "pending_voip_action")
        NSLog("[VoicePnBridge] getPendingVoipAction called. pending=\(pending ?? "(nil)")")
        resolve(pending)
    }
    
    @objc
    func clearPendingVoipAction(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        UserDefaults.standard.removeObject(forKey: "pending_voip_action")
        UserDefaults.standard.synchronize()
        NSLog("[VoicePnBridge] clearPendingVoipAction called. Cleared key pending_voip_action")
        resolve(true)
    }

    @objc
    func setMissedCallNotificationsEnabled(_ enabled: Bool, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        UserDefaults.standard.set(enabled, forKey: TelnyxVoiceUserDefaultsKey.missedCallNotificationsEnabled)
        UserDefaults.standard.synchronize()
        NSLog("[VoicePnBridge] setMissedCallNotificationsEnabled called. enabled=\(enabled)")
        resolve(true)
    }

    @objc
    func getMissedCallNotificationsEnabled(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        if UserDefaults.standard.object(forKey: TelnyxVoiceUserDefaultsKey.missedCallNotificationsEnabled) == nil {
            resolve(true)
            return
        }

        resolve(UserDefaults.standard.bool(forKey: TelnyxVoiceUserDefaultsKey.missedCallNotificationsEnabled))
    }

    @objc
    func setSpeakerEnabled(_ enabled: Bool, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        do {
            let audioSession = AVAudioSession.sharedInstance()
            // The Telnyx/WebRTC call setup is expected to configure a .playAndRecord-compatible
            // session. Passing .none clears only the speaker override; accessories/session options
            // can still decide the resulting output route.
            try audioSession.overrideOutputAudioPort(enabled ? .speaker : .none)
            let actualEnabled = audioSession.currentRoute.outputs.contains { output in
                output.portType == .builtInSpeaker
            }
            NSLog("[VoicePnBridge] setSpeakerEnabled called. requested=\(enabled), actual=\(actualEnabled)")
            resolve(actualEnabled)
        } catch {
            NSLog("[VoicePnBridge] setSpeakerEnabled failed. enabled=\(enabled), error=\(error)")
            reject("SET_SPEAKER_ENABLED_ERROR", error.localizedDescription, error)
        }
    }

    @objc
    func isSpeakerEnabled(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        let isEnabled = AVAudioSession.sharedInstance().currentRoute.outputs.contains { output in
            output.portType == .builtInSpeaker
        }
        resolve(isEnabled)
    }
}
