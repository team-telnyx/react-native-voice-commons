#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(CallKitBridge, RCTEventEmitter)

RCT_EXTERN_METHOD(startOutgoingCall:(NSString *)callUUID 
                  handle:(NSString *)handle 
                  displayName:(NSString *)displayName
                  resolver:(RCTPromiseResolveBlock)resolve 
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(reportIncomingCall:(NSString *)callUUID 
                  handle:(NSString *)handle 
                  displayName:(NSString *)displayName
                  resolver:(RCTPromiseResolveBlock)resolve 
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(answerCall:(NSString *)callUUID 
                  resolver:(RCTPromiseResolveBlock)resolve 
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(endCall:(NSString *)callUUID 
                  resolver:(RCTPromiseResolveBlock)resolve 
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(reportCallConnected:(NSString *)callUUID 
                  resolver:(RCTPromiseResolveBlock)resolve 
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(reportCallEnded:(NSString *)callUUID 
                  reason:(nonnull NSNumber *)reason
                  resolver:(RCTPromiseResolveBlock)resolve 
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(updateCall:(NSString *)callUUID 
                  displayName:(NSString *)displayName 
                  handle:(NSString *)handle
                  resolver:(RCTPromiseResolveBlock)resolve 
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getActiveCalls:(RCTPromiseResolveBlock)resolve 
                  rejecter:(RCTPromiseRejectBlock)reject)

@end