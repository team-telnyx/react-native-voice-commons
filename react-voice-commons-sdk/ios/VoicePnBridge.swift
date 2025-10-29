import Foundation
import React

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
        UserDefaults.standard.set(action, forKey: "pending_push_action")
        UserDefaults.standard.set(metadata, forKey: "pending_push_metadata")
        UserDefaults.standard.synchronize()
        
        NSLog("[VoicePnBridge] setPendingPushAction - action: \(action), metadata: \(metadata)")
        resolve(true)
    }
    
    @objc
    func clearPendingPushAction(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        UserDefaults.standard.removeObject(forKey: "pending_push_action")
        UserDefaults.standard.removeObject(forKey: "pending_push_metadata")
        UserDefaults.standard.synchronize()
        
        NSLog("[VoicePnBridge] clearPendingPushAction - cleared pending push data")
        resolve(true)
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
        UserDefaults.standard.removeObject(forKey: "pending_voip_push")
        UserDefaults.standard.synchronize()
        NSLog("[VoicePnBridge] clearPendingVoipPush called. Cleared key pending_voip_push")
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
}