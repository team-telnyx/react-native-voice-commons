// AppDelegate.h
//
// Objective-C++ AppDelegate for the Telnyx React Native Voice SDK demo.
// Mirrors the Swift implementation in AppDelegate.swift but is provided as
// a reference for customers whose React Native projects still use AppDelegate.mm.

#import <Expo/EXAppDelegateWrapper.h>
#import <PushKit/PushKit.h>

@interface AppDelegate : EXAppDelegateWrapper <PKPushRegistryDelegate>

@property (nonatomic, strong, nullable) PKPushRegistry *voipRegistry;

@end
