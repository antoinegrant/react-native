// Copyright 2004-present Facebook. All Rights Reserved.

#import "RCTUtils.h"

#import <CommonCrypto/CommonCrypto.h>
#import <mach/mach_time.h>
#import <objc/runtime.h>
#import <UIKit/UIKit.h>

NSString *RCTJSONStringify(id jsonObject, NSError **error)
{
  NSData *jsonData = [NSJSONSerialization dataWithJSONObject:jsonObject options:0 error:error];
  return jsonData ? [[NSString alloc] initWithData:jsonData encoding:NSUTF8StringEncoding] : nil;
}

id RCTJSONParse(NSString *jsonString, NSError **error)
{
  NSData *jsonData = [jsonString dataUsingEncoding:NSUTF8StringEncoding];
  return [NSJSONSerialization JSONObjectWithData:jsonData options:NSJSONReadingAllowFragments error:error];
}

NSString *RCTMD5Hash(NSString *string)
{
  const char *str = [string UTF8String];
  unsigned char result[CC_MD5_DIGEST_LENGTH];
  CC_MD5(str, (CC_LONG)strlen(str), result);

  return [NSString stringWithFormat:@"%02x%02x%02x%02x%02x%02x%02x%02x%02x%02x%02x%02x%02x%02x%02x%02x",
          result[0], result[1], result[2], result[3],
          result[4], result[5], result[6], result[7],
          result[8], result[9], result[10], result[11],
          result[12], result[13], result[14], result[15]
          ];
}

CGFloat RCTScreenScale()
{
  static CGFloat scale = -1;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    if (![NSThread isMainThread]) {
      dispatch_sync(dispatch_get_main_queue(), ^{
        scale = [UIScreen mainScreen].scale;
      });
    } else {
      scale = [UIScreen mainScreen].scale;
    }
  });

  return scale;
}

CGFloat RCTRoundPixelValue(CGFloat value)
{
  CGFloat scale = RCTScreenScale();
  return round(value * scale) / scale;
}

CGFloat RCTCeilPixelValue(CGFloat value)
{
  CGFloat scale = RCTScreenScale();
  return ceil(value * scale) / scale;
}

CGFloat RCTFloorPixelValue(CGFloat value)
{
  CGFloat scale = RCTScreenScale();
  return floor(value * scale) / scale;
}

NSTimeInterval RCTTGetAbsoluteTime(void)
{
  static struct mach_timebase_info tb_info = {0};
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    int ret = mach_timebase_info(&tb_info);
    assert(0 == ret);
  });
  
  uint64_t timeInNanoseconds = (mach_absolute_time() * tb_info.numer) / tb_info.denom;
  return ((NSTimeInterval)timeInNanoseconds) / 1000000;
}

void RCTSwapClassMethods(Class cls, SEL original, SEL replacement)
{
  Method originalMethod = class_getClassMethod(cls, original);
  IMP originalImplementation = method_getImplementation(originalMethod);
  const char *originalArgTypes = method_getTypeEncoding(originalMethod);
  
  Method replacementMethod = class_getClassMethod(cls, replacement);
  IMP replacementImplementation = method_getImplementation(replacementMethod);
  const char *replacementArgTypes = method_getTypeEncoding(replacementMethod);
  
  if (class_addMethod(cls, original, replacementImplementation, replacementArgTypes))
  {
    class_replaceMethod(cls, replacement, originalImplementation, originalArgTypes);
  }
  else
  {
    method_exchangeImplementations(originalMethod, replacementMethod);
  }
}

void RCTSwapInstanceMethods(Class cls, SEL original, SEL replacement)
{
  Method originalMethod = class_getInstanceMethod(cls, original);
  IMP originalImplementation = method_getImplementation(originalMethod);
  const char *originalArgTypes = method_getTypeEncoding(originalMethod);
  
  Method replacementMethod = class_getInstanceMethod(cls, replacement);
  IMP replacementImplementation = method_getImplementation(replacementMethod);
  const char *replacementArgTypes = method_getTypeEncoding(replacementMethod);
  
  if (class_addMethod(cls, original, replacementImplementation, replacementArgTypes))
  {
    class_replaceMethod(cls, replacement, originalImplementation, originalArgTypes);
  }
  else
  {
    method_exchangeImplementations(originalMethod, replacementMethod);
  }
}