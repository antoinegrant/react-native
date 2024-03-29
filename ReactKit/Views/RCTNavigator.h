// Copyright 2004-present Facebook. All Rights Reserved.

#import <UIKit/UIKit.h>

@class RCTJavaScriptEventDispatcher;

@interface RCTNavigator : UIView <UINavigationControllerDelegate>

@property (nonatomic, strong) UIView *reactNavSuperviewLink;
@property (nonatomic, assign) NSInteger requestedTopOfStack;

- (instancetype)initWithFrame:(CGRect)frame
              eventDispatcher:(RCTJavaScriptEventDispatcher *)eventDispatcher;

/**
 * Schedules a JavaScript navigation and prevents `UIKit` from navigating until
 * JavaScript has sent its scheduled navigation.
 *
 * @returns Whether or not a JavaScript driven navigation could be
 * scheduled/reserved. If returning `NO`, JavaScript should usually just do
 * nothing at all.
 */
- (BOOL)requestSchedulingJavaScriptNavigation;

@end
