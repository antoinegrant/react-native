// Copyright 2004-present Facebook. All Rights Reserved.

#import "RCTShadowText.h"

#import "RCTConvert.h"
#import "RCTLog.h"

#import "RCTShadowRawText.h"
#import "RCTUtils.h"

NSString *const RCTIsHighlightedAttributeName = @"IsHighlightedAttributeName";
NSString *const RCTReactTagAttributeName = @"ReactTagAttributeName";

static css_dim_t RCTMeasure(void *context, float width)
{
  RCTShadowText *shadowText = (__bridge RCTShadowText *)context;
  if (isnan(width)) width = MAXFLOAT;
  CGSize computedSize = [[shadowText attributedString] boundingRectWithSize:(CGSize){width, CGFLOAT_MAX} options:NSStringDrawingUsesLineFragmentOrigin context:nil].size;
  
  css_dim_t result;
  result.dimensions[CSS_WIDTH] = RCTCeilPixelValue(computedSize.width);
  result.dimensions[CSS_HEIGHT] = RCTCeilPixelValue(computedSize.height);
  return result;
}

@implementation RCTShadowText
{
  NSAttributedString *_cachedAttributedString;
  NSAttributedString *_cachedReactTagAttributedString;
  UIFont *_font;
}

- (instancetype)init
{
  if ((self = [super init])) {
    _fontSize = NAN;
    _isHighlighted = NO;
  }
  return self;
}

- (NSAttributedString *)reactTagAttributedString
{
  if (![self isTextDirty] && _cachedReactTagAttributedString) {
    return _cachedReactTagAttributedString;
  }

  NSMutableAttributedString *attributedString = [[NSMutableAttributedString alloc] init];
  for (RCTShadowView *child in [self reactSubviews]) {
    if ([child isKindOfClass:[RCTShadowText class]]) {
      RCTShadowText *shadowText = (RCTShadowText *)child;
      [attributedString appendAttributedString:[shadowText reactTagAttributedString]];
    } else if ([child isKindOfClass:[RCTShadowRawText class]]) {
      RCTShadowRawText *shadowRawText = (RCTShadowRawText *)child;
      [attributedString appendAttributedString:[[NSAttributedString alloc] initWithString:[shadowRawText text] ?: @""]];
    } else {
      RCTLogError(@"<Text> can't have any children except <Text> or raw strings");
    }
  }

  [self _addAttribute:RCTReactTagAttributeName
            withValue:self.reactTag
   toAttributedString:attributedString];

  _cachedReactTagAttributedString = attributedString;
  return _cachedReactTagAttributedString;
}

- (NSAttributedString *)attributedString
{
  return [self _attributedStringWithFontFamily:nil
                                      fontSize:0
                                    fontWeight:nil];
}

- (NSAttributedString *)_attributedStringWithFontFamily:(NSString *)fontFamily
                                               fontSize:(CGFloat)fontSize
                                             fontWeight:(NSString *)fontWeight
{
  if (![self isTextDirty] && _cachedAttributedString) {
    return _cachedAttributedString;
  }

  // while we're updating the attributed string, also update the react tag attributed string
  [self reactTagAttributedString];

  if (_fontSize && !isnan(_fontSize)) {
    fontSize = _fontSize;
  }
  if (_fontWeight) {
    fontWeight = _fontWeight;
  }
  if (_fontFamily) {
    fontFamily = _fontFamily;
  }

  NSMutableAttributedString *attributedString = [[NSMutableAttributedString alloc] init];
  for (RCTShadowView *child in [self reactSubviews]) {
    if ([child isKindOfClass:[RCTShadowText class]]) {
      RCTShadowText *shadowText = (RCTShadowText *)child;
      [attributedString appendAttributedString:[shadowText _attributedStringWithFontFamily:fontFamily fontSize:fontSize fontWeight:fontWeight]];
    } else if ([child isKindOfClass:[RCTShadowRawText class]]) {
      RCTShadowRawText *shadowRawText = (RCTShadowRawText *)child;
      [attributedString appendAttributedString:[[NSAttributedString alloc] initWithString:[shadowRawText text] ?: @""]];
    } else {
      RCTLogError(@"<Text> can't have any children except <Text> or raw strings");
    }

    [child setTextComputed];
  }

  if (_color) {
    [self _addAttribute:NSForegroundColorAttributeName withValue:self.color toAttributedString:attributedString];
  }
  if (_isHighlighted) {
    [self _addAttribute:RCTIsHighlightedAttributeName withValue:@YES toAttributedString:attributedString];
  }
  if (_textBackgroundColor) {
    [self _addAttribute:NSBackgroundColorAttributeName withValue:self.textBackgroundColor toAttributedString:attributedString];
  }

  _font = [RCTConvert UIFont:nil withFamily:fontFamily size:@(fontSize) weight:fontWeight];
  [self _addAttribute:NSFontAttributeName withValue:_font toAttributedString:attributedString];

  [self _setParagraphStyleOnAttributedString:attributedString];

  // create a non-mutable attributedString for use by the Text system which avoids copies down the line
  _cachedAttributedString = [[NSAttributedString alloc] initWithAttributedString:attributedString];
  [self dirtyLayout];

  return _cachedAttributedString;
}

- (UIFont *)font
{
  return _font ?: [RCTConvert UIFont:nil withFamily:_fontFamily size:@(_fontSize) weight:_fontWeight];
}

- (void)_addAttribute:(NSString *)attribute withValue:(id)attributeValue toAttributedString:(NSMutableAttributedString *)attributedString
{
  [attributedString enumerateAttribute:attribute inRange:NSMakeRange(0, [attributedString length]) options:0 usingBlock:^(id value, NSRange range, BOOL *stop) {
    if (!value) {
      [attributedString addAttribute:attribute value:attributeValue range:range];
    }
  }];
}

/*
 * LineHeight works the same way line-height works in the web: if children and self have
 * varying lineHeights, we simply take the max.
 */
- (void)_setParagraphStyleOnAttributedString:(NSMutableAttributedString *)attributedString
{
  // check if we have lineHeight set on self
  __block BOOL hasParagraphStyle = NO;
  if (_lineHeight || _textAlign) {
    hasParagraphStyle = YES;
  }

  if (!_lineHeight) {
    self.lineHeight = 0.0;
  }

  // check for lineHeight on each of our children, update the max as we go (in self.lineHeight)
  [attributedString enumerateAttribute:NSParagraphStyleAttributeName inRange:NSMakeRange(0, [attributedString length]) options:0 usingBlock:^(id value, NSRange range, BOOL *stop) {
    if (value) {
      NSParagraphStyle *paragraphStyle = (NSParagraphStyle *)value;
      if ([paragraphStyle maximumLineHeight] > _lineHeight) {
        self.lineHeight = [paragraphStyle maximumLineHeight];
      }
      hasParagraphStyle = YES;
    }
  }];

  // TODO: umm, these can'e be null, so we're mapping left to natural - is that right?
  self.textAlign = _textAlign ?: NSTextAlignmentNatural;
  self.writingDirection = _writingDirection ?: NSWritingDirectionNatural;

  // if we found anything, set it :D
  if (hasParagraphStyle) {
    NSMutableParagraphStyle *paragraphStyle = [[NSMutableParagraphStyle alloc] init];
    paragraphStyle.baseWritingDirection = _writingDirection;
    paragraphStyle.minimumLineHeight = _lineHeight;
    paragraphStyle.maximumLineHeight = _lineHeight;
    [paragraphStyle setAlignment:_textAlign];
    [attributedString addAttribute:NSParagraphStyleAttributeName
                             value:paragraphStyle
                             range:(NSRange){0, attributedString.length}];
  }
}

- (void)fillCSSNode:(css_node_t *)node
{
  [super fillCSSNode:node];
  node->measure = RCTMeasure;
  node->children_count = 0;
}

- (void)insertReactSubview:(RCTShadowView *)subview atIndex:(NSInteger)atIndex
{
  [super insertReactSubview:subview atIndex:atIndex];
  [self cssNode]->children_count = 0;
}

- (void)removeReactSubview:(RCTShadowView *)subview
{
  [super removeReactSubview:subview];
  [self cssNode]->children_count = 0;
}

#define RCT_TEXT_PROPERTY(setProp, ivar, type) \
- (void)set##setProp:(type)value;              \
{                                              \
  ivar = value;                                \
  [self dirtyText];                            \
}

RCT_TEXT_PROPERTY(TextBackgroundColor, _textBackgroundColor, UIColor *);
RCT_TEXT_PROPERTY(Color, _color, UIColor *);
RCT_TEXT_PROPERTY(FontFamily, _fontFamily, NSString *);
RCT_TEXT_PROPERTY(FontSize, _fontSize, CGFloat);
RCT_TEXT_PROPERTY(FontWeight, _fontWeight, NSString *);
RCT_TEXT_PROPERTY(LineHeight, _lineHeight, CGFloat);
RCT_TEXT_PROPERTY(MaxNumberOfLines, _maxNumberOfLines, NSInteger);
RCT_TEXT_PROPERTY(ShadowOffset, _shadowOffset, CGSize);
RCT_TEXT_PROPERTY(TextAlign, _textAlign, NSTextAlignment);
RCT_TEXT_PROPERTY(TruncationMode, _truncationMode, NSLineBreakMode);
RCT_TEXT_PROPERTY(IsHighlighted, _isHighlighted, BOOL);
RCT_TEXT_PROPERTY(Font, _font, UIFont *);

@end
