// Test script

var docker = require('./docker.js');

// Report Error
var errorCallback = function (err) {
  console.error('Test failed!', err);
  process.exit(1);
};

// Report Test Progress
var reportProgress = function(stdout) {
  console.log('Returns', stdout);
};

// Running container hello-world
docker
  .run_container('hello-world', 'hello-world')
  .then(reportProgress, errorCallback)
  .then(docker.remove_container.bind(docker, 'hello-world'), errorCallback)
  .then(reportProgress, errorCallback)
  .then(docker.containers)
  .then(reportProgress, errorCallback)
  .then(function(){
    console.log('All tests passed');
    process.exit(0);
  });
