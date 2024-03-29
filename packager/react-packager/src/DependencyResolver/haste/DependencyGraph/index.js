'use strict';

var ModuleDescriptor = require('../../ModuleDescriptor');
var q = require('q');
var fs = require('fs');
var docblock = require('./docblock');
var path = require('path');
var isAbsolutePath = require('absolute-path');
var debug = require('debug')('DependecyGraph');

var readFile = q.nfbind(fs.readFile);
var readDir = q.nfbind(fs.readdir);
var lstat = q.nfbind(fs.lstat);
var realpath = q.nfbind(fs.realpath);

function DependecyGraph(options) {
  this._root = options.root;
  this._ignoreFilePath = options.ignoreFilePath || function(){};
  this._loaded = false;
  this._queue = [this._root];
  this._graph = Object.create(null);
  this._packageByRoot = Object.create(null);
  this._packagesById = Object.create(null);
  this._moduleById = Object.create(null);
  this._fileWatcher = options.fileWatcher;

  // Kick off the search process to precompute the dependency graph.
  this._init();
}

DependecyGraph.prototype.load = function() {
  return this._loading || (this._loading = this._search());
};

/**
 * Given an entry file return an array of all the dependent module descriptors.
 */
DependecyGraph.prototype.getOrderedDependencies = function(entryPath) {
  var absolutePath;
  if (!isAbsolutePath(entryPath)) {
    absolutePath = path.join(this._root, entryPath);
  } else {
    absolutePath = entryPath;
  }

  var module = this._graph[absolutePath];
  if (module == null) {
    throw new Error('Module with path "' + absolutePath + '" is not in graph');
  }

  var self = this;
  var deps = [];
  var visited = Object.create(null);

  // Node haste sucks. Id's aren't unique. So to make sure our entry point
  // is the thing that ends up in our dependency list.
  var graphMap = Object.create(this._moduleById);
  graphMap[module.id] = module;

  // Recursively collect the dependency list.
  function collect(module) {
    deps.push(module);

    module.dependencies.forEach(function(name) {
      var id = sansExtJs(name);
      var dep = self.resolveDependency(module, id);

      if (dep == null) {
        debug(
          'WARNING: Cannot find required module `%s` from module `%s`.',
          name,
          module.id
        );
        return;
      }

      if (!visited[dep.id]) {
        visited[dep.id] = true;
        collect(dep);
      }
    });
  }

  visited[module.id] = true;
  collect(module);

  return deps;
};

/**
 * Given a module descriptor `fromModule` return the module descriptor for
 * the required module `depModuleId`. It could be top-level or relative,
 * or both.
 */
DependecyGraph.prototype.resolveDependency = function(
  fromModule,
  depModuleId
) {
  var packageJson, modulePath, dep;

  // Package relative modules starts with '.' or '..'.
  if (depModuleId[0] !== '.') {

    // 1. `depModuleId` is simply a top-level `providesModule`.
    // 2. `depModuleId` is a package module but given the full path from the
    //     package, i.e. package_name/module_name
    if (this._moduleById[sansExtJs(depModuleId)]) {
      return this._moduleById[sansExtJs(depModuleId)];
    }

    // 3. `depModuleId` is a package and it's depending on the "main"
    //    resolution.
    packageJson = this._packagesById[depModuleId];

    // We are being forgiving here and raising an error because we could be
    // processing a file that uses it's own require system.
    if (packageJson == null) {
      debug(
        'WARNING: Cannot find required module `%s` from module `%s`.',
        depModuleId,
        fromModule.id
      );
      return;
    }

    var main = packageJson.main || 'index';
    modulePath = withExtJs(path.join(packageJson._root, main));
    dep = this._graph[modulePath];
    if (dep == null) {
      throw new Error(
        'Cannot find package main file for pacakge: ' + packageJson._root
      );
    }
    return dep;
  } else {

    // 4. `depModuleId` is a module defined in a package relative to
    //    `fromModule`.
    packageJson = this._lookupPackage(fromModule.path);

    if (packageJson == null) {
      throw new Error(
        'Expected relative module lookup from ' + fromModule.id + ' to ' +
        depModuleId + ' to be within a package but no package.json found.'
      );
    }

    // Example: depModuleId: ../a/b
    //          fromModule.path: /x/y/z
    //          modulePath: /x/y/a/b
    var dir = path.dirname(fromModule.path);
    modulePath = withExtJs(path.join(dir, depModuleId));

    dep = this._graph[modulePath];
    if (dep == null) {
      debug(
        'WARNING: Cannot find required module `%s` from module `%s`.' +
        ' Inferred required module path is %s',
        depModuleId,
        fromModule.id,
        modulePath
      );
      return null;
    }

    return dep;
  }
};

/**
 * Intiates the filewatcher and kicks off the search process.
 */
DependecyGraph.prototype._init = function() {
  var processChange = this._processFileChange.bind(this);
  var loadingWatcher = this._fileWatcher.getWatcher();

  this._loading = this.load()
    .then(function() {
      return loadingWatcher;
    })
    .then(function(watcher) {
      watcher.on('all', processChange);
    });
};

/**
 * Implements a DFS over the file system looking for modules and packages.
 */
DependecyGraph.prototype._search = function() {
  var self = this;
  var dir = this._queue.shift();

  if (dir == null) {
    return q.Promise.resolve(this._graph);
  }

  // Steps:
  // 1. Read a dir and stat all the entries.
  // 2. Filter the files and queue up the directories.
  // 3. Process any package.json in the files
  // 4. recur.
  return readDir(dir)
    .then(function(files){
      return q.all(files.map(function(filePath) {
        return realpath(path.join(dir, filePath));
      }));
    })
    .then(function(filePaths) {
      filePaths = filePaths.filter(function(filePath) {
        return !self._ignoreFilePath(filePath);
      });

      var statsP = filePaths.map(function(filePath) {
        return lstat(filePath);
      });

      return [
        filePaths,
        q.all(statsP)
      ];
    })
    .spread(function(files, stats) {
      var modulePaths = files.filter(function(filePath, i) {
        if (stats[i].isDirectory()) {
          self._queue.push(filePath);
          return false;
        }

        if (stats[i].isSymbolicLink()) {
          return false;
        }

        return filePath.match(/\.js$/);
      });

      var processing = self._findAndProcessPackage(files, dir)
        .then(function() {
          return q.all(modulePaths.map(self._processModule.bind(self)));
        });

      return q.all([
        processing,
        self._search()
      ]);
    })
    .then(function() {
      return self;
    });
};

/**
 * Given a list of files find a `package.json` file, and if found parse it
 * and update indices.
 */
DependecyGraph.prototype._findAndProcessPackage = function(files, root) {
  var self = this;

  var packagePath;
  for (var i = 0; i < files.length ; i++) {
    var file = files[i];
    if (path.basename(file) === 'package.json') {
      packagePath = file;
      break;
    }
  }

  if (packagePath != null) {
    return readFile(packagePath, 'utf8')
      .then(function(content) {
        var packageJson = JSON.parse(content);
        if (packageJson.name == null) {

          debug(
            'WARNING: package.json `%s` is missing a name field',
            packagePath
          );
          return q();
        }

        packageJson._root = root;
        self._packageByRoot[root] = packageJson;
        self._packagesById[packageJson.name] = packageJson;

        return packageJson;
      });
  } else {
    return q();
  }
};

/**
 * Parse a module and update indices.
 */
DependecyGraph.prototype._processModule = function(modulePath) {
  var self = this;
  return readFile(modulePath, 'utf8')
    .then(function(content) {
      var moduleDocBlock = docblock.parseAsObject(content);
      var moduleData = { path: path.resolve(modulePath) };
      if (moduleDocBlock.providesModule || moduleDocBlock.provides) {
        moduleData.id =
          moduleDocBlock.providesModule || moduleDocBlock.provides;
      } else {
        moduleData.id = self._lookupName(modulePath);
      }
      moduleData.dependencies = extractRequires(content);

      var module = new ModuleDescriptor(moduleData);
      self._updateGraphWithModule(module);
      return module;
    });
};

/**
 * Compute the name of module relative to a package it may belong to.
 */
DependecyGraph.prototype._lookupName = function(modulePath) {
  var packageJson = this._lookupPackage(modulePath);
  if (packageJson == null) {
    return path.resolve(modulePath);
  } else {
    var relativePath =
      sansExtJs(path.relative(packageJson._root, modulePath));
    return path.join(packageJson.name, relativePath);
  }
};

/**
 * Update the graph and idices with the module.
 */
DependecyGraph.prototype._updateGraphWithModule = function(module) {
  this._graph[module.path] = module;

  if (this._moduleById[module.id]) {
    debug(
      'WARNING: Top-level module name conflict `%s`.\n' +
      'module with path `%s` will replace `%s`',
      module.id,
      module.path,
      this._moduleById[module.id].path
    );
  }

  this._moduleById[module.id] = module;
};

/**
 * Find the nearest package to a module.
 */
DependecyGraph.prototype._lookupPackage = function(modulePath) {
  var root = this._root;
  var packageByRoot = this._packageByRoot;

  /**
   * Auxiliary function to recursively lookup a package.
   */
  function lookupPackage(currDir) {
    // ideally we stop once we're outside root and this can be a simple child
    // dir check. However, we have to support modules that was symlinked inside
    // our project root.
    if (!path.relative(root, currDir) === '' || currDir === '.'
        || currDir === '/') {
      return null;
    } else {
      var packageJson = packageByRoot[currDir];
      if (packageJson) {
        return packageJson;
      } else {
        return lookupPackage(path.dirname(currDir));
      }
    }
  }

  return lookupPackage(path.dirname(modulePath));
};

/**
 * Process a filewatcher change event.
 */
DependecyGraph.prototype._processFileChange = function(eventType, filePath, root, stat) {
  var absPath = path.join(this._root, filePath);
  if (this._ignoreFilePath(absPath)) {
    return;
  }

  if (eventType === 'delete') {
    var module = this._graph[absPath];
    if (module == null) {
      return;
    }

    delete this._graph[module];

    // Others may keep a reference so we mark it as deleted.
    module.deleted = true;

    // Modules may have same id.
    if (this._moduleById[module.id] === module) {
      delete this._moduleById[module.id];
    }
  } else if (!(stat && stat.isDirectory())) {
    var self = this;
    this._loading = this._loading.then(function() {
      return self._processModule(absPath);
    });
  }
};

/**
 * Extract all required modules from a `code` string.
 */
var requireRe = /\brequire\s*\(\s*[\'"]([^"\']+)["\']\s*\)/g;
var blockCommentRe = /\/\*(.|\n)*?\*\//g;
var lineCommentRe = /\/\/.+(\n|$)/g;
function extractRequires(code) {
  var deps = [];

  code
    .replace(blockCommentRe, '')
    .replace(lineCommentRe, '')
    .replace(requireRe, function(match, dep) {
      deps.push(dep);
    });

  return deps;
}

/**
 * `file` without the .js extension.
 */
function sansExtJs(file) {
  if (file.match(/\.js$/)) {
    return file.slice(0, -3);
  } else {
    return file;
  }
}

/**
 * `file` with the .js extension.
 */
function withExtJs(file) {
  if (file.match(/\.js$/)) {
    return file;
  } else {
    return file + '.js';
  }
}

module.exports = DependecyGraph;
