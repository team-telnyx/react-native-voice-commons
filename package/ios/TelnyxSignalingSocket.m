#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(TelnyxSignalingSocket, RCTEventEmitter)
RCT_EXTERN_METHOD(connect:(nonnull NSNumber *)socketId
                  url:(NSString *)url
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(send:(nonnull NSNumber *)socketId message:(NSString *)message)
RCT_EXTERN_METHOD(close:(nonnull NSNumber *)socketId)
@end
