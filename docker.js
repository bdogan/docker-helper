'use strict';

var exec = require('child_process').exec,
    Q = require('q');

module.exports = (function()
{
  // Holds running config
  var ___isRunning = false;

  var ___command_options = {
    // exec command options global
  };

  // Holds server config
  var server_config;

  // Parse env parameters
  function parse_env_parameters(stdout) {
    if (!stdout) return {};
    // Clean comments
    stdout = stdout.replace(/(#.*\n*|export\s)/gm, '').split('\n');
    // Let's parse
    var _env = {};
    stdout.map(function(line){
      if (!line || !line.trim() || !line.match(/^\w+=\".*\"/)) return;
      line = line.trim();
      _env[line.split("=")[0]] = line.split("=")[1].replace(/\"(.*)\"/, "$1");
    });
    return _env;
  }

  // Run cli command
  function cli_command(command, options) {
    var deferred = Q.defer();
    exec(command, (options || ___command_options), function (err, stdout, stderr) {
      if (err) return deferred.reject(err);
      deferred.resolve(stdout);
    });
    return deferred.promise;
  }

  // Get platform mac, win, linux
  function get_platform(){
    if (['darwin', 'win32', 'win64'].indexOf(process.platform) === -1) return 'linux';
    if (['darwin'].indexOf(process.platform) === -1) return 'win';
    return 'mac';
  }

  // Parse tab delimited results
  function parse_result(stdout, headers){
    if (!stdout) return [];
    var lines = stdout.split('\n');
    headers = typeof headers == "undefined" ? true : headers;
    var data = [];
    lines.map(function(line){
      if (!line || !line.trim() || typeof line != "string") return;
      line = line.trim();
      // Possible header
      if (data.length === 0 && headers === true) {
        headers = {};
        line.split(/\s{2,}/).map(function(header) {
          headers[header] = line.match(new RegExp(header + "\\s{2,}")) ? line.match(new RegExp(header + "\\s{2,}"))[0].length : 99999;
        });
        return;
      }
      var row = {};
      //headers.map(function(header){ row[header] = undefined; });
      var cursor = 0;
      var cursorLocation = 0;
      Object.keys(headers).map(function(header){
        row[header] = line.slice(cursorLocation, cursorLocation + headers[header]).trim();
        cursorLocation += headers[header];
      });
      data.push(row);
    });
    return data;
  }

  // Start docker instance
  function start_docker_instance() {
    var deferred = Q.defer();
    // Check is already running
    if (___isRunning === true) {
      deferred.resolve();
      return deferred.promise;
    }
    // Get platform
    var platform = get_platform();
    // Check docker command is working
    cli_command('docker ps')
      .then(function(){
        // There is no problem for docker
        ___isRunning = true;
        return deferred.resolve();
      }, function(err){
        // If platform linux and error exists so not need docker-machine
        if (platform === 'linux') return deferred.reject(err);
        // Select start script
        var startScript = './scripts/' + platform + '_docker_instance_start.sh';
        // Orginal docker start scripts without shell integration
        cli_command(startScript)
          .then(cli_command.bind(this, 'docker-machine env default'), deferred.reject)
          .then(function(stdout){
            // Get env variables for rest of commands
            ___command_options.env = parse_env_parameters(stdout);
            ___isRunning = true;
            deferred.resolve(stdout);
          }, deferred.reject);
      });

    return deferred.promise;
  }

  // Holds core
  var ___docker = {
    // Run container command
    container_command: function(name, command)
    {
      var deferred = Q.defer();

      exec("docker exec " + name + " " + command, ___command_options, function (err, stdout, stderr) {
        if (err) return deferred.reject(err);
        deferred.resolve(stdout);
      });

      return deferred.promise;
    },
    containers: function(allFlag) {
      allFlag = typeof allFlag != "boolean" ? true : allFlag;
      return cli_command("docker ps" + (allFlag ? " -a" : "")).then(parse_result);
    },
    // Run container
    run_container: function(image, name, args)
    {
      var deferred = new Q.defer();
      exec("docker ps --filter name=" + name + " -q", ___command_options, function (err, stdout, stderr) {
        if (err) return deferred.reject(err);
        if (stdout.trim() != "") return deferred.resolve();

        exec("docker ps -a --filter name=" + name + " -q", ___command_options, function (err, stdout, stderr) {
          if (err) return deferred.reject(err);
          if (stdout.trim() != "") return ___docker.start_container(name).then(function(stdout){
            deferred.resolve(stdout);
          },
          function(err){
            deferred.reject(err);
          });
          console.log("Run container " + name + " ...");
          exec("docker run -d " + (args || '') + " --name " + name + " " + image, ___command_options, function (err, stdout, stderr) {
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
      exec("docker ps -a --filter 'name=" + name + "' -q", ___command_options, function (err, stdout, stderr) {
        if (err || stdout.trim() == "") return deferred.resolve();
        exec("docker rm -f " + (stdout.replace(/\n/gi, ' ').trim()), ___command_options, function (err, stdout, stderr) {
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
      exec("docker start " + id, ___command_options, function (err, stdout, stderr) {
        if (err) return deferred.reject(err);
        deferred.resolve(stdout);
      });
      return deferred.promise;
    }
  };

  // Run docket-machine if exists before execute command
  Object.keys(___docker).map(function(name){
    if (typeof(___docker[name]) != 'function') return;
    var ___method = ___docker[name];
    ___docker[name] = function() {
      var ___args = arguments;
      return start_docker_instance()
        .then(function(){
          return ___method.apply(___docker, ___args);
        }, function(err){
          console.error("Failed docker-machine start", err);
          exit(1);
        });
    };
  });



  return ___docker;
})();
