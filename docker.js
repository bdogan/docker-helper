'use strict';

var exec = require('child_process').exec,
    Q = require('q');

module.exports = (function()
{
  // Holds running config
  var ___isRunning = false;

  // Start docker instance
  function start_docker_instance() {
    var deferred = Q.defer();
    if (___isRunning === true) return deferred.resolve();
    // Get platform
    var platform = (function(){
      if (['darwin', 'win32', 'win64'].indexOf(process.platform) === -1) return 'linux';
      if (['darwin'].indexOf(process.platform) === -1) return 'win';
      return 'mac';
    })();
    // Check operating system differ then linux
    if (platform === 'linux') {
      ___isRunning = true;
      return deferred.resolve();
    }
    // Check docker instance already running
    exec('docker ps', function (err, stdout, stderr) {
      if (!err) {
        ___isRunning = true;
        return deferred.resolve();
      }
      if (err && platform === 'linux') return deferred.reject(err);
      // Select start script
      var startScript = './scripts/' + platform + '_docker_instance_start.sh';
      exec(startScript, function (err, stdout, stderr) {
        if (err) return deferred.reject(err);
        ___isRunning = true;
        deferred.resolve(stdout);
      });
    });

    return deferred.promise;
  }

  // Holds core
  var ___docker = {
    // Run container command
    container_command: function(name, command)
    {
      var deferred = Q.defer();

      exec("docker exec " + name + " " + command, function (err, stdout, stderr) {
        if (err) return deferred.reject(err);
        deferred.resolve(stdout);
      });

      return deferred.promise;
    },
    // Run cli command
    command: function(command)
    {
      var deferred = Q.defer();

      exec(command, function (err, stdout, stderr) {
        if (err) return deferred.reject(err);
        deferred.resolve(stdout);
      });

      return deferred.promise;
    },
    // Run cli command
    run_container: function(image, name, args)
    {
      var deferred = new Q.defer();
      exec("docker ps --filter name=" + name + " -q", function (err, stdout, stderr) {
        if (err) return deferred.reject(err);
        if (stdout.trim() != "") return deferred.resolve();

        exec("docker ps -a --filter name=" + name + " -q", function (err, stdout, stderr) {
          if (err) return deferred.reject(err);
          if (stdout.trim() != "") return ___docker.start_container(name).then(function(stdout){
            deferred.resolve(stdout);
          },
          function(err){
            deferred.reject(err);
          });
          console.log("Run container " + name + " ...");
          exec("docker run -d " + (args || '') + " --name " + name + " " + image, function (err, stdout, stderr) {
            if (err) return deferred.reject(err);
            deferred.resolve(stdout);
          });
        });
      });
      return deferred.promise;
    },
    // Remove Docker container
    remove_container: function (name)
    {
      var deferred = Q.defer();
      console.log("Remove container " + name + " ...");
      exec("docker ps -a --filter 'name=" + name + "' -q", function (err, stdout, stderr) {
        if (err || stdout.trim() == "") return deferred.resolve();
        exec("docker rm -f " + (stdout.replace(/\n/gi, ' ').trim()), function (err, stdout, stderr) {
          if (err) return deferred.reject(err);
          deferred.resolve();
        });
      });
      return deferred.promise;
    },
    // Start Docker container
    start_container: function(id, callback)
    {
      var deferred = new Q.defer();
      console.log("Starting container " + id + " ...");
      exec("docker start " + id, function (err, stdout, stderr) {
        if (err) return deferred.reject(err);
        deferred.resolve(stdout);
      });
      return deferred.promise;
    }
  };

  return ___docker;
})();
