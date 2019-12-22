var fs = require('fs');
var path = require('path');

module.exports = {

  ensureAbsolutePath : function(filepath){
    if(!filepath || filepath.length == 0){
      return '';
    }

    var dirname = path.dirname(filepath);
    var isAbsolute = path.isAbsolute(dirname);

    var newpath = filepath;
    if(isAbsolute === false){
      var cwd2 = process.cwd();
      newpath = path.join(cwd2, newpath);
    }
    return newpath;
  },

  isPathAccessible : function(path){

    try {
      fs.accessSync(path);
      return true;
    } catch (e) {
      return false;
    }

  }
}
