// AppDelegate.mm
//
// Objective-C++ AppDelegate for the Telnyx React Native Voice SDK demo.
//
// This is a port of AppDelegate.swift. It demonstrates how to integrate
// the react-voice-commons SDK (TelnyxVoipPushHandler) from Objective-C++
// in an Expo SDK 53 / React Native 0.79 project.
//
// Customers on a bare React Native template (which still uses .mm by default)
// can use this file as a reference. The key calls are:
//   - [TelnyxVoipPushHandler initializeVoipRegistration]
//   - [[TelnyxVoipPushHandler shared] handleVoipTokenUpdate:type:]
//   - [[TelnyxVoipPushHandler shared] handleVoipPush:type:completion:]

#import "AppDelegate.h"

#import <AVFoundation/AVFoundation.h>
#import <CallKit/CallKit.h>
#import <React/RCTBundleURLProvider.h>
#import <React/RCTLinkingManager.h>

// TelnyxVoiceCommons is a Swift module shipped via the react-voice-commons-sdk
// CocoaPods spec. The @objc-annotated TelnyxVoipPushHandler class is exposed
// to Objective-C through the auto-generated Swift interface header.
//
// NOTE: TelnyxVoiceCommons is built as a Swift static library (no
// `use_frameworks!`), so we cannot import it via `@import TelnyxVoiceCommons;`
// from a .mm file (that would require enabling -fcxx-modules, which conflicts
// with React Native's Fabric C++ headers). Instead we add
// `${PODS_CONFIGURATION_BUILD_DIR}/TelnyxVoiceCommons/Swift Compatibility Header`
// to HEADER_SEARCH_PATHS in the Xcode project and import the generated
// Swift interface header directly.
#import "TelnyxVoiceCommons-Swift.h"

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application
    didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  self.moduleName = @"main";
  self.initialProps = @{};

  BOOL result = [super application:application didFinishLaunchingWithOptions:launchOptions];

  // Initialize VoIP push registry via react-voice-commons.
  // This delegates to RNVoipPushNotificationManager under the hood.
  [TelnyxVoipPushHandler initializeVoipRegistration];

  return result;
}

- (NSURL *)bundleURL
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings]
      jsBundleURLForBundleRoot:@".expo/.virtual-metro-entry"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

#pragma mark - VoIP Push Notifications (PKPushRegistryDelegate)

- (void)pushRegistry:(PKPushRegistry *)registry
    didUpdatePushCredentials:(PKPushCredentials *)pushCredentials
                     forType:(PKPushType)type
{
  [[TelnyxVoipPushHandler shared] handleVoipTokenUpdate:pushCredentials type:type];
}

- (void)pushRegistry:(PKPushRegistry *)registry
    didReceiveIncomingPushWithPayload:(PKPushPayload *)payload
                              forType:(PKPushType)type
                withCompletionHandler:(void (^)(void))completion
{
  // CRITICAL: TelnyxVoipPushHandler synchronously reports the call to CallKit
  // before invoking the completion handler. Do not wrap this in a dispatch_async
  // or iOS will terminate the app on cold launch.
  [[TelnyxVoipPushHandler shared] handleVoipPush:payload type:type completion:completion];
}

#pragma mark - Linking API

- (BOOL)application:(UIApplication *)application
            openURL:(NSURL *)url
            options:(NSDictionary<UIApplicationOpenURLOptionsKey, id> *)options
{
  return [super application:application openURL:url options:options] ||
         [RCTLinkingManager application:application openURL:url options:options];
}

#pragma mark - Universal Links

- (BOOL)application:(UIApplication *)application
    continueUserActivity:(nonnull NSUserActivity *)userActivity
      restorationHandler:
          (nonnull void (^)(NSArray<id<UIUserActivityRestoring>> *_Nullable))restorationHandler
{
  BOOL linkingResult = [RCTLinkingManager application:application
                                  continueUserActivity:userActivity
                                    restorationHandler:restorationHandler];
  return [super application:application
       continueUserActivity:userActivity
         restorationHandler:restorationHandler] ||
         linkingResult;
}

@end
