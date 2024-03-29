/**
 * Copyright 2004-present Facebook. All Rights Reserved.
 *
 * @providesModule MoviesApp
 * @flow
 */
'use strict';

var React = require('react-native/addons');
var {
  Bundler,
  NavigatorIOS,
  StyleSheet,
} = React;

var SearchScreen = require('./SearchScreen');

var MoviesApp = React.createClass({
  render: function() {
    return (
      <NavigatorIOS
        style={styles.container}
        initialRoute={{
          title: 'Movies',
          component: SearchScreen,
        }}
      />
    );
  }
});

var styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
});

Bundler.registerComponent('MoviesApp', () => MoviesApp);

module.exports = MoviesApp;
