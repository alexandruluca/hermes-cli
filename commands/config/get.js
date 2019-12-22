/**
  get.js - implments the 'hermes config get' command
*/
var Command = require('ronin').Command;
const config = require('../../config');
var objectPath = require("object-path");
const getUsage = require('command-line-usage')

/**
  ConfigGetCommand - prints the value of a config property
*/
var ConfigGetCommand = module.exports = Command.extend({
    desc: 'This command prints the value of a config property',

    /**
      help - returns the usage statement for the command
    */
    help: function() {
        return getUsage([
          {
            content: 'Usage: ' + this.program.name + ' ' + this.name + ' <configuration property or path>'
          },
          {
            content: 'Prints the value of a config property. The specified property can be a property or a dot-separated path\n\n###'
          }
        ]);
    },

    /**
      run - execution of the command
      parameters:
      path - string, a property or property path used to extract the
            configuration value from the config object
    */
    run: function (path) {
      if(!path || path.length == 0){
        console.log('\nError: Missing path for configuration property');
        console.log(this.help());
        return;
      }
      console.log('config', path, ':', objectPath.get(config, path, "not found"));
    }
  });
