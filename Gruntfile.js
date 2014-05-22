/*global module:false*/
module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    // Task configuration.
    jshint: {
      options: {
        curly: true,
        eqeqeq: true,
        immed: true,
        latedef: true,
        newcap: true,
        noarg: true,
        sub: true,
        undef: true,
        unused: true,
        boss: true,
        eqnull: true,
        globals: {
          require: true
        }
      },
      gruntfile: {
        src: 'Gruntfile.js'
      },
      crawler: {
        src: 'crawler.js',
        options: {
          node: true
        }
      },
      specs: {
        src: 'tests/**/*.js',
        options: {
          node: true,
          globals: {
            beforeEach: true,
            describe: true,
            expect: true,
            it: true,
            jasmine: true,
            setTimeout: true,
            spyOn: true,
            afterEach: true
          }
        }
      }
    }
  });

  // These plugins provide necessary tasks.
  grunt.loadNpmTasks('grunt-contrib-jshint');

  // Default task.
  grunt.registerTask('default', ['jshint']);

};
