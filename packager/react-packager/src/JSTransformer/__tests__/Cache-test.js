'use strict';

jest
  .dontMock('underscore')
  .dontMock('path')
  .dontMock('q')
  .dontMock('absolute-path')
  .dontMock('../../fb-path-utils')
  .dontMock('../Cache');

var q = require('q');

describe('JSTransformer Cache', function() {
  var Cache;

  beforeEach(function() {
    require('os').tmpDir.mockImpl(function() {
      return 'tmpDir';
    });

    Cache = require('../Cache');

    var FileWatcher = require('../../FileWatcher');
    FileWatcher.prototype.getWatcher = function() {
      return q({
        on: function() {}
      });
    };
  });

  describe('getting/settig', function() {
    it('calls loader callback for uncached file', function() {
      var cache = new Cache({projectRoot: '/rootDir'});
      var loaderCb = jest.genMockFn().mockImpl(function() {
        return q();
      });
      cache.get('/rootDir/someFile', loaderCb);
      expect(loaderCb).toBeCalledWith('/rootDir/someFile');
    });

    pit('gets the value from the loader callback', function() {
      require('fs').stat.mockImpl(function(file, callback) {
        callback(null, {
          mtime: {
            getTime: function() {}
          }
        });
      });
      var cache = new Cache({projectRoot: '/rootDir'});
      var loaderCb = jest.genMockFn().mockImpl(function() {
        return q('lol');
      });
      return cache.get('/rootDir/someFile', loaderCb).then(function(value) {
        expect(value).toBe('lol');
      });
    });

    pit('caches the value after the first call', function() {
      require('fs').stat.mockImpl(function(file, callback) {
        callback(null, {
          mtime: {
            getTime: function() {}
          }
        });
      });
      var cache = new Cache({projectRoot: '/rootDir'});
      var loaderCb = jest.genMockFn().mockImpl(function() {
        return q('lol');
      });
      return cache.get('/rootDir/someFile', loaderCb).then(function() {
        var shouldNotBeCalled = jest.genMockFn();
        return cache.get('/rootDir/someFile', shouldNotBeCalled)
          .then(function(value) {
            expect(shouldNotBeCalled).not.toBeCalled();
            expect(value).toBe('lol');
          });
      });
    });

    pit('it invalidates cache after a file has changed', function() {
      require('fs').stat.mockImpl(function(file, callback) {
        callback(null, {
          mtime: {
            getTime: function() {}
          }
        });
      });
      var FileWatcher = require('../../FileWatcher');
      var triggerChangeFile;
      FileWatcher.prototype.getWatcher = function() {
        return q({
          on: function(type, callback) {
            triggerChangeFile = callback;
          }
        });
      };

      var cache = new Cache({projectRoot: '/rootDir'});
      var loaderCb = jest.genMockFn().mockImpl(function() {
        return q('lol');
      });

      return cache.get('/rootDir/someFile', loaderCb).then(function(value) {
        expect(value).toBe('lol');
        triggerChangeFile('change', 'someFile');
        var loaderCb2 = jest.genMockFn().mockImpl(function() {
          return q('lol2');
        });
        return cache.get('/rootDir/someFile', loaderCb2).then(function(value2) {
          expect(value2).toBe('lol2');
        });
      });
    });
  });

  describe('loading cache from disk', function() {
    var fileStats;

    beforeEach(function() {
      fileStats = {
        '/rootDir/someFile': {
          mtime: {
            getTime: function() {
              return 22;
            }
          }
        },
        '/rootDir/foo': {
          mtime: {
            getTime: function() {
              return 11;
            }
          }
        }
      };

      var fs = require('fs');

      fs.existsSync.mockImpl(function() {
        return true;
      });

      fs.statSync.mockImpl(function(filePath) {
        return fileStats[filePath];
      });

      fs.readFileSync.mockImpl(function() {
        return JSON.stringify({
          '/rootDir/someFile': {
            mtime: 22,
            data: 'oh hai'
          },
          '/rootDir/foo': {
            mtime: 11,
            data: 'lol wat'
          }
        });
      });
    });

    pit('should load cache from disk', function() {
      var cache = new Cache({projectRoot: '/rootDir'});
      var loaderCb = jest.genMockFn();
      return cache.get('/rootDir/someFile', loaderCb).then(function(value) {
        expect(loaderCb).not.toBeCalled();
        expect(value).toBe('oh hai');

        return cache.get('/rootDir/foo', loaderCb).then(function(value) {
          expect(loaderCb).not.toBeCalled();
          expect(value).toBe('lol wat');
        });
      });
    });

    pit('should not load outdated cache', function() {
      require('fs').stat.mockImpl(function(file, callback) {
        callback(null, {
          mtime: {
            getTime: function() {}
          }
        });
      });

      fileStats['/rootDir/foo'].mtime.getTime = function() {
        return 123;
      };

      var cache = new Cache({projectRoot: '/rootDir'});
      var loaderCb = jest.genMockFn().mockImpl(function() {
        return q('new value');
      });

      return cache.get('/rootDir/someFile', loaderCb).then(function(value) {
        expect(loaderCb).not.toBeCalled();
        expect(value).toBe('oh hai');

        return cache.get('/rootDir/foo', loaderCb).then(function(value) {
          expect(loaderCb).toBeCalled();
          expect(value).toBe('new value');
        });
      });
    });
  });

  describe('writing cache to disk', function() {
    it('should write cache to disk', function() {
      var index = 0;
      var mtimes = [10, 20, 30];
      var debounceIndex = 0;
      require('underscore').debounce = function(callback) {
        return function () {
          if (++debounceIndex === 3) {
            callback();
          }
        };
      };

      var fs = require('fs');
      fs.stat.mockImpl(function(file, callback) {
        callback(null, {
          mtime: {
            getTime: function() {
              return mtimes[index++];
            }
          }
        });
      });

      var cache = new Cache({projectRoot: '/rootDir'});
      cache.get('/rootDir/bar', function() {
        return q('bar value');
      });
      cache.get('/rootDir/foo', function() {
        return q('foo value');
      });
      cache.get('/rootDir/baz', function() {
        return q('baz value');
      });

      jest.runAllTimers();
      expect(fs.writeFile).toBeCalled();
    });
  });
});
