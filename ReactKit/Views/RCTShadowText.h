// Copyright 2004-present Facebook. All Rights Reserved.

#import "RCTShadowView.h"

extern NSString *const RCTIsHighlightedAttributeName;
extern NSString *const RCTReactTagAttributeName;

@interface RCTShadowText : RCTShadowView

@property (nonatomic, assign) NSWritingDirection writingDirection;
@property (nonatomic, strong) UIColor *textBackgroundColor;
@property (nonatomic, strong) UIColor *color;
@property (nonatomic, strong) UIFont *font;
@property (nonatomic, copy) NSString *fontFamily;
@property (nonatomic, assign) CGFloat fontSize;
@property (nonatomic, copy) NSString *fontWeight;
@property (nonatomic, assign) BOOL isHighlighted;
@property (nonatomic, assign) CGFloat lineHeight;
@property (nonatomic, assign) NSInteger maxNumberOfLines;
@property (nonatomic, assign) CGSize shadowOffset;
@property (nonatomic, assign) NSTextAlignment textAlign;
@property (nonatomic, assign) NSLineBreakMode truncationMode;

- (NSAttributedString *)attributedString;
- (NSAttributedString *)reactTagAttributedString;

@end
