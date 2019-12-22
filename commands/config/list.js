/**
  list.js - implments the 'hermes config list' command
*/
var Command = require('ronin').Command;
const config = require('../../config');
const getUsage = require('command-line-usage')

/**
  ConfigListCommand - prints the value of the config object
*/
var ConfigListCommand = module.exports = Command.extend({
    desc: 'This command lists the configuration.',

    /**
      help - returns the usage statement for the command
    */
    help: function() {
        return getUsage([
          {
            content: 'Usage: ' + this.program.name + ' ' + this.name
          },
          {
            content: 'Prints all available configuration properties\n\n###'
          }
        ]);
    },

    /**
      run - execution of the command, prints the whole config object
    */
    run: function () {
      console.log(JSON.stringify(config, null, ' '));
    }
  });
