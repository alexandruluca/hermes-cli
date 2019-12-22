var request = require('request');
var fs = require('fs');
var Promise = require('promise');

module.exports = {

  upload : function(sourcePath, s3uploadUrl){
    return new Promise(function(resolve, reject){

      try {
        var stats = fs.statSync(sourcePath);

        fs.createReadStream(sourcePath).pipe(request({
          method: "PUT",
          url: s3uploadUrl,
          headers: {
            'Content-Length': stats['size']
          }
        }, function(err, res, body){
          if(err){
            reject(new Error('Error uploading the file'));
            return;
          }
          resolve();
        }));

      } catch (e) {
        reject(e.message);
      }
    });
  }
};