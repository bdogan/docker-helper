// Test script

var docker = require('./docker.js');

// Report Error
var errorCallback = function (err) {
  console.error('Test failed!', err);
  process.exit(1);
};

// Report Test Progress
var reportProgress = function(stdout) {
  if (!stdout) return;
  console.log('Return:' + stdout.trim());
};

// Running container hello-world
docker
  .run_container('hello-world', 'hello-world')
  .then(reportProgress, errorCallback)
  .then(docker.remove_container.bind(docker, 'hello-world'), errorCallback)
  .then(reportProgress)
  .then(function(){
    console.log('All tests passed');
    process.exit(0);
  });
