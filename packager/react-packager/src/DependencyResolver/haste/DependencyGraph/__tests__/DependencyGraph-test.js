'use strict';

jest
  .dontMock('../index')
  .dontMock('q')
  .dontMock('path')
  .dontMock('absolute-path')
  .dontMock('../../../../fb-path-utils')
  .dontMock('../docblock')
  .setMock('../../../ModuleDescriptor', function(data) {return data;});

var q = require('q');

describe('DependencyGraph', function() {
  var DependencyGraph;
  var fileWatcher;
  var fs;

  beforeEach(function() {
    fs = require('fs');
    DependencyGraph = require('../index');

    fileWatcher = {
      getWatcher: function() {
        return q({
          on: function() {
            return this;
          }
        });
      }
    };
  });

  describe('getOrderedDependencies', function() {
    pit('should get dependencies', function() {
      var root = '/root';
      fs.__setMockFilesystem({
        'root': {
          'index.js': [
            '/**',
            ' * @providesModule index',
            ' */',
            'require("a")'
          ].join('\n'),
          'a.js': [
            '/**',
            ' * @providesModule a',
            ' */',
          ].join('\n'),
        }
      });

      var dgraph = new DependencyGraph({root: root, fileWatcher: fileWatcher});
      return dgraph.load().then(function() {
        expect(dgraph.getOrderedDependencies('/root/index.js'))
          .toEqual([
            {id: 'index', path: '/root/index.js', dependencies: ['a']},
            {id: 'a', path: '/root/a.js', dependencies: []},
          ]);
      });
    });

    pit('should get recursive dependencies', function() {
      var root = '/root';
      fs.__setMockFilesystem({
        'root': {
          'index.js': [
            '/**',
            ' * @providesModule index',
            ' */',
            'require("a")',
          ].join('\n'),
          'a.js': [
            '/**',
            ' * @providesModule a',
            ' */',
            'require("index")',
          ].join('\n'),
        }
      });

      var dgraph = new DependencyGraph({root: root, fileWatcher: fileWatcher});
      return dgraph.load().then(function() {
        expect(dgraph.getOrderedDependencies('/root/index.js'))
          .toEqual([
            {id: 'index', path: '/root/index.js', dependencies: ['a']},
            {id: 'a', path: '/root/a.js', dependencies: ['index']},
          ]);
      });
    });

    pit('should work with packages', function() {
      var root = '/root';
      fs.__setMockFilesystem({
        'root': {
          'index.js': [
            '/**',
            ' * @providesModule index',
            ' */',
            'require("aPackage")',
          ].join('\n'),
          'aPackage': {
            'package.json': JSON.stringify({
              name: 'aPackage',
              main: 'main.js'
            }),
            'main.js': 'lol'
          }
        }
      });

      var dgraph = new DependencyGraph({root: root, fileWatcher: fileWatcher});
      return dgraph.load().then(function() {
        expect(dgraph.getOrderedDependencies('/root/index.js'))
          .toEqual([
            {id: 'index', path: '/root/index.js', dependencies: ['aPackage']},
            { id: 'aPackage/main',
              path: '/root/aPackage/main.js',
              dependencies: []
            },
          ]);
      });
    });

    pit('can have multiple modules with the same name', function() {
      var root = '/root';
      fs.__setMockFilesystem({
        'root': {
          'index.js': [
            '/**',
            ' * @providesModule index',
            ' */',
            'require("b")',
          ].join('\n'),
          'b.js': [
            '/**',
            ' * @providesModule b',
            ' */',
          ].join('\n'),
          'c.js': [
            '/**',
            ' * @providesModule c',
            ' */',
          ].join('\n'),
          'somedir': {
            'somefile.js': [
              '/**',
              ' * @providesModule index',
              ' */',
              'require("c")',
            ].join('\n')
          }
        }
      });

      var dgraph = new DependencyGraph({root: root, fileWatcher: fileWatcher});
      return dgraph.load().then(function() {
        expect(dgraph.getOrderedDependencies('/root/somedir/somefile.js'))
          .toEqual([
            { id: 'index',
              path: '/root/somedir/somefile.js',
              dependencies: ['c']
            },
            { id: 'c',
              path: '/root/c.js',
              dependencies: []
            },
          ]);
      });
    });

    pit('providesModule wins when conflict with package', function() {
      var root = '/root';
      fs.__setMockFilesystem({
        'root': {
          'index.js': [
            '/**',
            ' * @providesModule index',
            ' */',
            'require("aPackage")',
          ].join('\n'),
          'b.js': [
            '/**',
            ' * @providesModule aPackage',
            ' */',
          ].join('\n'),
          'aPackage': {
            'package.json': JSON.stringify({
              name: 'aPackage',
              main: 'main.js'
            }),
            'main.js': 'lol'
          }
        }
      });

      var dgraph = new DependencyGraph({root: root, fileWatcher: fileWatcher});
      return dgraph.load().then(function() {
        expect(dgraph.getOrderedDependencies('/root/index.js'))
          .toEqual([
            { id: 'index',
              path: '/root/index.js',
              dependencies: ['aPackage']
            },
            { id: 'aPackage',
              path: '/root/b.js',
              dependencies: []
            },
          ]);
      });
    });

    pit('should be forgiving with missing requires', function() {
      var root = '/root';
      fs.__setMockFilesystem({
        'root': {
          'index.js': [
            '/**',
            ' * @providesModule index',
            ' */',
            'require("lolomg")',
          ].join('\n')
        }
      });

      var dgraph = new DependencyGraph({root: root, fileWatcher: fileWatcher});
      return dgraph.load().then(function() {
        expect(dgraph.getOrderedDependencies('/root/index.js'))
          .toEqual([
            { id: 'index',
              path: '/root/index.js',
              dependencies: ['lolomg']
            }
          ]);
      });
    });

    pit('should work with packages with subdirs', function() {
      var root = '/root';
      fs.__setMockFilesystem({
        'root': {
          'index.js': [
            '/**',
            ' * @providesModule index',
            ' */',
            'require("aPackage/subdir/lolynot")',
          ].join('\n'),
          'aPackage': {
            'package.json': JSON.stringify({
              name: 'aPackage',
              main: 'main.js'
            }),
            'main.js': 'lol',
            'subdir': {
              'lolynot.js': 'lolynot'
            }
          }
        }
      });

      var dgraph = new DependencyGraph({root: root, fileWatcher: fileWatcher});
      return dgraph.load().then(function() {
        expect(dgraph.getOrderedDependencies('/root/index.js'))
          .toEqual([
            { id: 'index',
              path: '/root/index.js',
              dependencies: ['aPackage/subdir/lolynot']
            },
            { id: 'aPackage/subdir/lolynot',
              path: '/root/aPackage/subdir/lolynot.js',
              dependencies: []
            },
          ]);
      });
    });

    pit('should work with packages with symlinked subdirs', function() {
      var root = '/root';
      fs.__setMockFilesystem({
        'symlinkedPackage': {
          'package.json': JSON.stringify({
            name: 'aPackage',
            main: 'main.js'
          }),
          'main.js': 'lol',
          'subdir': {
            'lolynot.js': 'lolynot'
          }
        },
        'root': {
          'index.js': [
            '/**',
            ' * @providesModule index',
            ' */',
            'require("aPackage/subdir/lolynot")',
          ].join('\n'),
          'aPackage': { SYMLINK: '/symlinkedPackage' },
        }
      });

      var dgraph = new DependencyGraph({root: root, fileWatcher: fileWatcher});
      return dgraph.load().then(function() {
        expect(dgraph.getOrderedDependencies('/root/index.js'))
          .toEqual([
            { id: 'index',
              path: '/root/index.js',
              dependencies: ['aPackage/subdir/lolynot']
            },
            { id: 'aPackage/subdir/lolynot',
              path: '/symlinkedPackage/subdir/lolynot.js',
              dependencies: []
            },
          ]);
      });
    });

    pit('should work with relative modules in packages', function() {
      var root = '/root';
      fs.__setMockFilesystem({
        'root': {
          'index.js': [
            '/**',
            ' * @providesModule index',
            ' */',
            'require("aPackage")',
          ].join('\n'),
          'aPackage': {
            'package.json': JSON.stringify({
              name: 'aPackage',
              main: 'main.js'
            }),
            'main.js': 'require("./subdir/lolynot")',
            'subdir': {
              'lolynot.js': 'require("../other")'
            },
            'other.js': 'some code'
          }
        }
      });

      var dgraph = new DependencyGraph({root: root, fileWatcher: fileWatcher});
      return dgraph.load().then(function() {
        expect(dgraph.getOrderedDependencies('/root/index.js'))
          .toEqual([
            { id: 'index',
              path: '/root/index.js',
              dependencies: ['aPackage']
            },
            { id: 'aPackage/main',
              path: '/root/aPackage/main.js',
              dependencies: ['./subdir/lolynot']
            },
            { id: 'aPackage/subdir/lolynot',
              path: '/root/aPackage/subdir/lolynot.js',
              dependencies: ['../other']
            },
            { id: 'aPackage/other',
              path: '/root/aPackage/other.js',
              dependencies: []
            },
          ]);
      });
    });
  });

  describe('file watch updating', function() {
    var fileWatcher;
    var triggerFileChange;

    beforeEach(function() {
      fileWatcher = {
        getWatcher: function() {
          return q({
            on: function(eventType, callback) {
              if (eventType !== 'all') {
                throw new Error('Can only handle "all" event in watcher.');
              }
              triggerFileChange = callback;
              return this;
            }
          });
        }
      };
    });

    pit('updates module dependencies', function() {
      var root = '/root';
      var filesystem = fs.__setMockFilesystem({
        'root': {
          'index.js': [
            '/**',
            ' * @providesModule index',
            ' */',
            'require("aPackage")',
            'require("foo")'
          ].join('\n'),
          'foo': [
            '/**',
            ' * @providesModule foo',
            ' */',
            'require("aPackage")'
          ].join('\n'),
          'aPackage': {
            'package.json': JSON.stringify({
              name: 'aPackage',
              main: 'main.js'
            }),
            'main.js': 'main',
          }
        }
      });

      var dgraph = new DependencyGraph({root: root, fileWatcher: fileWatcher});
      return dgraph.load().then(function() {
        filesystem.root['index.js'] =
          filesystem.root['index.js'].replace('require("foo")', '');
        triggerFileChange('change', 'index.js');
        return dgraph.load().then(function() {
          expect(dgraph.getOrderedDependencies('/root/index.js'))
            .toEqual([
            { id: 'index',
              path: '/root/index.js',
              dependencies: ['aPackage']
            },
            { id: 'aPackage/main',
              path: '/root/aPackage/main.js',
              dependencies: []
            },
          ]);
        });
      });
    });

    pit('updates module dependencies on file change', function() {
      var root = '/root';
      var filesystem = fs.__setMockFilesystem({
        'root': {
          'index.js': [
            '/**',
            ' * @providesModule index',
            ' */',
            'require("aPackage")',
            'require("foo")'
          ].join('\n'),
          'foo.js': [
            '/**',
            ' * @providesModule foo',
            ' */',
            'require("aPackage")'
          ].join('\n'),
          'aPackage': {
            'package.json': JSON.stringify({
              name: 'aPackage',
              main: 'main.js'
            }),
            'main.js': 'main',
          }
        }
      });

      var dgraph = new DependencyGraph({root: root, fileWatcher: fileWatcher});
      return dgraph.load().then(function() {
        filesystem.root['index.js'] =
          filesystem.root['index.js'].replace('require("foo")', '');
        triggerFileChange('change', 'index.js');
        return dgraph.load().then(function() {
          expect(dgraph.getOrderedDependencies('/root/index.js'))
            .toEqual([
            { id: 'index',
              path: '/root/index.js',
              dependencies: ['aPackage']
            },
            { id: 'aPackage/main',
              path: '/root/aPackage/main.js',
              dependencies: []
            },
          ]);
        });
      });
    });

    pit('updates module dependencies on file delete', function() {
      var root = '/root';
      var filesystem = fs.__setMockFilesystem({
        'root': {
          'index.js': [
            '/**',
            ' * @providesModule index',
            ' */',
            'require("aPackage")',
            'require("foo")'
          ].join('\n'),
          'foo.js': [
            '/**',
            ' * @providesModule foo',
            ' */',
            'require("aPackage")'
          ].join('\n'),
          'aPackage': {
            'package.json': JSON.stringify({
              name: 'aPackage',
              main: 'main.js'
            }),
            'main.js': 'main',
          }
        }
      });

      var dgraph = new DependencyGraph({root: root, fileWatcher: fileWatcher});
      return dgraph.load().then(function() {
        delete filesystem.root.foo;
        triggerFileChange('delete', 'foo.js');
        return dgraph.load().then(function() {
          expect(dgraph.getOrderedDependencies('/root/index.js'))
            .toEqual([
            { id: 'index',
              path: '/root/index.js',
              dependencies: ['aPackage', 'foo']
            },
            { id: 'aPackage/main',
              path: '/root/aPackage/main.js',
              dependencies: []
            },
          ]);
        });
      });
    });

    pit('updates module dependencies on file add', function() {
      var root = '/root';
      var filesystem = fs.__setMockFilesystem({
        'root': {
          'index.js': [
            '/**',
            ' * @providesModule index',
            ' */',
            'require("aPackage")',
            'require("foo")'
          ].join('\n'),
          'foo.js': [
            '/**',
            ' * @providesModule foo',
            ' */',
            'require("aPackage")'
          ].join('\n'),
          'aPackage': {
            'package.json': JSON.stringify({
              name: 'aPackage',
              main: 'main.js'
            }),
            'main.js': 'main',
          }
        }
      });

      var dgraph = new DependencyGraph({root: root, fileWatcher: fileWatcher});
      return dgraph.load().then(function() {
        filesystem.root['bar.js'] = [
          '/**',
          ' * @providesModule bar',
          ' */',
          'require("foo")'
        ].join('\n');
        triggerFileChange('add', 'bar.js');

        filesystem.root.aPackage['main.js'] = 'require("bar")';
        triggerFileChange('change', 'aPackage/main.js');

        return dgraph.load().then(function() {
          expect(dgraph.getOrderedDependencies('/root/index.js'))
            .toEqual([
            { id: 'index',
              path: '/root/index.js',
              dependencies: ['aPackage', 'foo']
            },
            { id: 'aPackage/main',
              path: '/root/aPackage/main.js',
              dependencies: ['bar']
            },
            { id: 'bar',
              path: '/root/bar.js',
              dependencies: ['foo']
            },
            { id: 'foo',
              path: '/root/foo.js',
              dependencies: ['aPackage']
            },
          ]);
        });
      });
    });

    pit('runs changes through ignore filter', function() {
      var root = '/root';
      var filesystem = fs.__setMockFilesystem({
        'root': {
          'index.js': [
            '/**',
            ' * @providesModule index',
            ' */',
            'require("aPackage")',
            'require("foo")'
          ].join('\n'),
          'foo.js': [
            '/**',
            ' * @providesModule foo',
            ' */',
            'require("aPackage")'
          ].join('\n'),
          'aPackage': {
            'package.json': JSON.stringify({
              name: 'aPackage',
              main: 'main.js'
            }),
            'main.js': 'main',
          }
        }
      });

      var dgraph = new DependencyGraph({
        root: root,
        fileWatcher: fileWatcher,
        ignoreFilePath: function(filePath) {
          if (filePath === '/root/bar.js') {
            return true;
          }
          return false;
        }
      });
      return dgraph.load().then(function() {
        filesystem.root['bar.js'] = [
          '/**',
          ' * @providesModule bar',
          ' */',
          'require("foo")'
        ].join('\n');
        triggerFileChange('add', 'bar.js');

        filesystem.root.aPackage['main.js'] = 'require("bar")';
        triggerFileChange('change', 'aPackage/main.js');

        return dgraph.load().then(function() {
          expect(dgraph.getOrderedDependencies('/root/index.js'))
            .toEqual([
              { id: 'index',
                path: '/root/index.js',
                dependencies: ['aPackage', 'foo']
              },
              { id: 'aPackage/main',
                path: '/root/aPackage/main.js',
                dependencies: ['bar']
              },
              { id: 'foo',
                path: '/root/foo.js',
                dependencies: ['aPackage']
              },
            ]);
        });
      });
    });

    pit('should ignore directory updates', function() {
      var root = '/root';
      var filesystem = fs.__setMockFilesystem({
        'root': {
          'index.js': [
            '/**',
            ' * @providesModule index',
            ' */',
            'require("aPackage")',
            'require("foo")'
          ].join('\n'),
          'foo.js': [
            '/**',
            ' * @providesModule foo',
            ' */',
            'require("aPackage")'
          ].join('\n'),
          'aPackage': {
            'package.json': JSON.stringify({
              name: 'aPackage',
              main: 'main.js'
            }),
            'main.js': 'main',
          }
        }
      });
      var dgraph = new DependencyGraph({root: root, fileWatcher: fileWatcher});
      return dgraph.load().then(function() {
        triggerFileChange('change', 'aPackage', '/root', {
          isDirectory: function(){ return true; }
        });
        return dgraph.load().then(function() {
          expect(dgraph.getOrderedDependencies('/root/index.js'))
            .toEqual([
              { id: 'index',
                path: '/root/index.js',
                dependencies: ['aPackage', 'foo']
              },
              { id: 'aPackage/main',
                path: '/root/aPackage/main.js',
                dependencies: []
              },
              { id: 'foo',
                path: '/root/foo.js',
                dependencies: ['aPackage']
              },
            ]);
        });
      });
    });
  });
});
