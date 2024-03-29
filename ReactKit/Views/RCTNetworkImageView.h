// Copyright 2004-present Facebook. All Rights Reserved.

#import <UIKit/UIKit.h>

@class RCTImageDownloader;

@interface RCTNetworkImageView : UIView

- (instancetype)initWithFrame:(CGRect)frame imageDownloader:(RCTImageDownloader *)imageDownloader;

/**
 * An image that will appear while the view is loading the image from the network,
 * or when imageURL is nil. Defaults to nil.
 */
@property (nonatomic, strong) UIImage *defaultImage;

/**
 * Specify a URL for an image. The image will be asynchronously loaded and displayed.
 */
@property (nonatomic, strong) NSURL *imageURL;

/**
 * By default, changing imageURL will reset whatever existing image was present
 * and revert to defaultImage while the new image loads. In certain obscure cases you
 * may want to disable this behavior and instead keep displaying the previous image
 * while the new one loads. In this case, pass NO for resetToDefaultImageWhileLoading.
 * (If you set imageURL to nil, however, resetToDefaultImageWhileLoading is ignored;
 * that will always reset to the default image.)
 */
- (void)setImageURL:(NSURL *)imageURL resetToDefaultImageWhileLoading:(BOOL)reset;

@end
