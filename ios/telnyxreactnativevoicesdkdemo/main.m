// main.m
//
// Application entry point. In the Swift version of this demo, the
// `@UIApplicationMain` attribute on AppDelegate generated this for us.
// Now that AppDelegate is Objective-C++, we have to provide it explicitly.

#import <UIKit/UIKit.h>
#import "AppDelegate.h"

int main(int argc, char *argv[])
{
  @autoreleasepool {
    return UIApplicationMain(argc, argv, nil, NSStringFromClass([AppDelegate class]));
  }
}
