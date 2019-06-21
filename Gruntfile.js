module.exports = function (grunt) {
    'use strict';

    require('load-grunt-tasks')(grunt, {
        pattern: ['grunt-*']
    });
    require('time-grunt')(grunt);

    var config = {
        src: 'src',
        web: 'web',
        pkg: require('./package.json'),
        banner: grunt.file.read('./LICENSE_BANNER'),
        jsFiles: module.exports.jsFiles
    };

    grunt.initConfig({
        conf: config,

        concat: {
            options: {
                process: true,
                sourceMap: true,
                banner: '<%= conf.banner %>'
            },
            js: {
                src: '<%= conf.jsFiles %>',
                dest: '<%= conf.pkg.name %>.js'
            }
        },
        uglify: {
            jsmin: {
                options: {
                    mangle: true,
                    compress: true,
                    sourceMap: true,
                    banner: '<%= conf.banner %>'
                },
                src: '<%= conf.pkg.name %>.js',
                dest: '<%= conf.pkg.name %>.min.js'
            }
        },
        cssmin: {
            options: {
                shorthandCompacting: false,
                roundingPrecision: -1
            },
            main: {
                files: {
                    '<%= conf.pkg.name %>.min.css': ['<%= conf.pkg.name %>.css']
                }
            }
        },
        eslint: {
            source: {
                src: [
                    '<%= conf.src %>/**/*.js',
                    '!<%= conf.src %>/{banner,footer}.js',
                    'Gruntfile.js'],
            },
            options: {
                configFile: '.eslintrc'
            }
        },
        watch: {
            jsdoc2md: {
                files: ['<%= conf.src %>/**/*.js'],
                tasks: ['build', 'jsdoc2md']
            },
            scripts: {
                files: ['<%= conf.src %>/**/*.js', '<%= conf.web %>/stock.js'],
                tasks: ['docs']
            },
            jasmineRunner: {
                files: ['<%= conf.spec %>/**/*.js'],
                tasks: ['jasmine:specs:build']
            },
            tests: {
                files: ['<%= conf.src %>/**/*.js', '<%= conf.spec %>/**/*.js'],
                tasks: ['test']
            },
            reload: {
                files: ['<%= conf.pkg.name %>.js',
                    '<%= conf.pkg.name %>css',
                    '<%= conf.web %>/js/<%= conf.pkg.name %>.js',
                    '<%= conf.web %>/css/<%= conf.pkg.name %>.css',
                    '<%= conf.pkg.name %>.min.js'],
                options: {
                    livereload: true
                }
            }
        },
        connect: {
            server: {
                options: {
                    port: process.env.PORT || 8888,
                    base: '.'
                }
            }
        },
        jsdoc2md: {
            dist: {
                src: 'dc.js',
                dest: 'web/docs/api-latest.md'
            }
        },
        copy: {
            'dc-to-gh': {
                files: [
                    {
                        expand: true,
                        flatten: true,
                        src: [
                            '<%= conf.pkg.name %>.css', '<%= conf.pkg.name %>.min.css',
                            'node_modules/bootstrap/dist/css/bootstrap.css'
                        ],
                        dest: '<%= conf.web %>/css/'
                    },
                    {
                        expand: true,
                        flatten: true,
                        nonull: true,
                        src: [
                            '<%= conf.pkg.name %>.js',
                            '<%= conf.pkg.name %>.js.map',
                            '<%= conf.pkg.name %>.min.js',
                            '<%= conf.pkg.name %>.min.js.map',
                            'node_modules/d3/dist/d3.js',
                            'node_modules/crossfilter2/crossfilter.js',
                            'node_modules/dc/dc.js'
                        ],
                        dest: '<%= conf.web %>/js/'
                    }
                ]
            }
        },

        'gh-pages': {
            options: {
                base: '<%= conf.web %>',
                message: 'Synced from from master branch.'
            },
            src: ['**']
        },
        shell: {
            hooks: {
                command: 'cp -n scripts/pre-commit.sh .git/hooks/pre-commit' +
                    ' || echo \'Cowardly refusing to overwrite your existing git pre-commit hook.\''
            }
        },
        browserify: {
            dev: {
                src: '<%= conf.pkg.name %>.js',
                dest: 'bundle.js',
                options: {
                    browserifyOptions: {
                        standalone: 'dc'
                    }
                }
            }
        }
    });

    // task aliases
    grunt.registerTask('build', ['concat', 'uglify', 'cssmin']);
    grunt.registerTask('docs', ['build', 'copy']);
    grunt.registerTask('web', ['docs', 'gh-pages']);
    grunt.registerTask('server', ['build', 'connect:server', 'watch:scripts']);
    grunt.registerTask('test', ['build', 'jasmine:specs']);
    grunt.registerTask('test-browserify', ['build', 'browserify', 'jasmine:browserify']);
    grunt.registerTask('coverage', ['build', 'jasmine:coverage']);
    grunt.registerTask('ci', ['test', 'jasmine:specs:build', 'connect:server', 'saucelabs-jasmine']);
    grunt.registerTask('ci-pull', ['test', 'jasmine:specs:build', 'connect:server']);
    grunt.registerTask('lint', ['jshint']);
    grunt.registerTask('default', ['build', 'shell:hooks']);
    //grunt.registerTask('jsdoc', ['build', 'jsdoc2md', 'watch:jsdoc2md']);
};

module.exports.jsFiles = [
    'src/banner.js',   // NOTE: keep this first
    'src/core.js',
    'src/xfilter.js',
    'src/nanocube-queries.js',
    'src/fgb-queries.js',
    'src/filter-handler.js',
    'src/footer.js'  // NOTE: keep this last
];
