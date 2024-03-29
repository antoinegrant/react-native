// Copyright 2004-present Facebook. All Rights Reserved.

#import "RCTNavItemManager.h"

#import "RCTConvert.h"
#import "RCTNavItem.h"

@implementation RCTNavItemManager

- (UIView *)viewWithEventDispatcher:(RCTJavaScriptEventDispatcher *)eventDispatcher
{
  return [[RCTNavItem alloc] initWithFrame:CGRectZero];
}

RCT_EXPORT_VIEW_PROPERTY(title)
RCT_EXPORT_VIEW_PROPERTY(rightButtonTitle);
RCT_EXPORT_VIEW_PROPERTY(backButtonTitle);
RCT_EXPORT_VIEW_PROPERTY(tintColor);
RCT_EXPORT_VIEW_PROPERTY(barTintColor);
RCT_EXPORT_VIEW_PROPERTY(titleTextColor);

@end

