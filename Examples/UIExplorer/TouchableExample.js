/**
 * Copyright 2004-present Facebook. All Rights Reserved.
 *
 * @providesModule TouchableExample
 */
'use strict';

var React = require('react-native');
var {
  PixelRatio,
  Image,
  StyleSheet,
  Text,
  TouchableHighlight,
  View,
} = React;

exports.title = '<Touchable*> and onPress';
exports.examples = [
{
  title: '<TouchableHighlight>',
  description: 'TouchableHighlight works by adding an extra view with a ' +
    'black background under the single child view.  This works best when the ' +
    'child view is fully opaque, although it can be made to work as a simple ' +
    'background color change as well with the activeOpacity and ' +
    'underlayColor props.',
  render: function() {
    return (
      <View>
        <View style={styles.row}>
          <TouchableHighlight
            style={styles.wrapper}
            onPress={() => console.log('stock THW image - highlight')}>
            <Image
              source={heartImage}
              style={styles.image}
            />
          </TouchableHighlight>
          <TouchableHighlight
            style={styles.wrapper}
            activeOpacity={1}
            animationVelocity={0}
            underlayColor="rgb(210, 230, 255)"
            onPress={() => console.log('custom THW text - hightlight')}>
            <View style={styles.wrapperCustom}>
              <Text style={styles.text}>
                Tap Here For Custom Highlight!
              </Text>
            </View>
          </TouchableHighlight>
        </View>
      </View>
    );
  },
}, {
  title: '<Text onPress={fn}> with highlight',
  render: function() {
    return <TextOnPressBox />;
  },
}];

var TextOnPressBox = React.createClass({
  getInitialState: function() {
    return {
      timesPressed: 0,
    };
  },
  textOnPress: function() {
    this.setState({
      timesPressed: this.state.timesPressed + 1,
    });
  },
  render: function() {
    var textLog = '';
    if (this.state.timesPressed > 1) {
      textLog = this.state.timesPressed + 'x text onPress';
    } else if (this.state.timesPressed > 0) {
      textLog = 'text onPress';
    }

    return (
      <View>
        <Text
          style={styles.textBlock}
          onPress={this.textOnPress}>
          Text has built-in onPress handling
        </Text>
        <View style={styles.logBox}>
          <Text>
            {textLog}
          </Text>
        </View>
      </View>
    );
  }
});

var heartImage = {uri: 'https://pbs.twimg.com/media/BlXBfT3CQAA6cVZ.png:small'};

var styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  icon: {
    width: 24,
    height: 24,
  },
  image: {
    width: 50,
    height: 50,
  },
  text: {
    fontSize: 16,
  },
  wrapper: {
    borderRadius: 8,
  },
  wrapperCustom: {
    borderRadius: 8,
    padding: 6,
  },
  logBox: {
    padding: 20,
    margin: 10,
    borderWidth: 1 / PixelRatio.get(),
    borderColor: '#f0f0f0',
    backgroundColor: '#f9f9f9',
  },
  textBlock: {
    fontWeight: 'bold',
    color: 'blue',
  },
});
