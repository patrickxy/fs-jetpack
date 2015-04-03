"use strict";

describe('copy |', function () {

    var fse = require('fs-extra');
    var pathUtil = require('path');
    var helper = require('./support/spec_helper');
    var jetpack = require('..');

    beforeEach(helper.beforeEach);
    afterEach(helper.afterEach);

    it("copies a file", function (done) {

        var preparations = function () {
            helper.clearWorkingDir();
            fse.outputFileSync('file.txt', 'abc');
        };

        var expectations = function () {
            expect('file.txt').toBeFileWithContent('abc');
            expect('file_1.txt').toBeFileWithContent('abc');
        };

        // SYNC
        preparations();
        jetpack.copy('file.txt', 'file_1.txt');
        expectations();

        // ASYNC
        preparations();
        jetpack.copyAsync('file.txt', 'file_1.txt')
        .then(function () {
            expectations();
            done();
        });
    });

    it("can copy file to nonexistent directory (will create directory)", function (done) {

        var preparations = function () {
            helper.clearWorkingDir();
            fse.outputFileSync('file.txt', 'abc');
        };

        var expectations = function () {
            expect('file.txt').toBeFileWithContent('abc');
            expect('dir/dir/file.txt').toBeFileWithContent('abc');
        };

        // SYNC
        preparations();
        jetpack.copy('file.txt', 'dir/dir/file.txt');
        expectations();

        // ASYNC
        preparations();
        jetpack.copyAsync('file.txt', 'dir/dir/file.txt')
        .then(function () {
            expectations();
            done();
        });
    });

    it("copies empty directory", function (done) {

        var preparations = function () {
            helper.clearWorkingDir();
            fse.mkdirsSync('dir');
        };

        var expectations = function () {
            expect('a/dir').toBeDirectory();
        };

        // SYNC
        preparations();
        jetpack.copy('dir', 'a/dir');
        expectations();

        // ASYNC
        preparations();
        jetpack.copyAsync('dir', 'a/dir')
        .then(function () {
            expectations();
            done();
        });
    });

    it("copies a tree of files", function (done) {

        var preparations = function () {
            helper.clearWorkingDir();
            fse.outputFileSync('a/f1.txt', 'abc');
            fse.outputFileSync('a/b/f2.txt', '123');
            fse.mkdirsSync('a/b/c');
        };

        var expectations = function () {
            expect('dir/a/f1.txt').toBeFileWithContent('abc');
            expect('dir/a/b/c').toBeDirectory();
            expect('dir/a/b/f2.txt').toBeFileWithContent('123');
        };

        // SYNC
        preparations();
        jetpack.copy('a', 'dir/a');
        expectations();

        // ASYNC
        preparations();
        jetpack.copyAsync('a', 'dir/a')
        .then(function () {
            expectations();
            done();
        });
    });

    it("generates nice error if source path doesn't exist", function (done) {

        var expectations = function (err) {
            expect(err.code).toBe('ENOENT');
            expect(err.message).toMatch(/^Path to copy doesn't exist/);
        };

        // SYNC
        try {
            jetpack.copy('a', 'b');
            throw "to make sure this code throws"
        } catch (err) {
            expectations(err);
        }

        // ASYNC
        jetpack.copyAsync('a', 'b')
        .catch(function (err) {
            expectations(err);
            done();
        });
    });

    it("respects internal CWD of jetpack instance", function (done) {

        var preparations = function () {
            helper.clearWorkingDir();
            fse.outputFileSync('a/b.txt', 'abc');
        };

        var expectations = function () {
            expect('a/b.txt').toBeFileWithContent('abc');
            expect('a/x.txt').toBeFileWithContent('abc');
        };

        var jetContext = jetpack.cwd('a');

        // SYNC
        preparations();
        jetContext.copy('b.txt', 'x.txt');
        expectations();

        // ASYNC
        preparations();
        jetContext.copyAsync('b.txt', 'x.txt')
        .then(function () {
            expectations();
            done();
        });
    });

    describe('overwriting behaviour', function () {

        it("does not overwrite by default", function (done) {

            var preparations = function () {
                helper.clearWorkingDir();
                fse.outputFileSync('a/file.txt', 'abc');
                fse.mkdirsSync('b');
            };

            var expectations = function (err) {
                expect(err.code).toBe('EEXIST');
                expect(err.message).toMatch(/^Destination path already exists/);
            };

            // SYNC
            preparations();
            try {
                jetpack.copy('a', 'b');
                throw "to make sure this code throws";
            } catch (err) {
                expectations(err);
            }

            // ASYNC
            preparations();
            jetpack.copyAsync('a', 'b')
            .catch(function (err) {
                expectations(err);
                done();
            });
        });

        it("overwrites if it was specified", function (done) {

            var preparations = function () {
                helper.clearWorkingDir();
                fse.outputFileSync('a/file.txt', 'abc');
                fse.outputFileSync('b/file.txt', 'xyz');
            };

            var expectations = function () {
                expect('a/file.txt').toBeFileWithContent('abc');
                expect('b/file.txt').toBeFileWithContent('abc');
            };

            // SYNC
            preparations();
            jetpack.copy('a', 'b', { overwrite: true });
            expectations();

            // ASYNC
            preparations();
            jetpack.copyAsync('a', 'b', { overwrite: true })
            .then(function () {
                expectations();
                done();
            });
        });

    });

    describe('filter what to copy |', function () {

        it("copies only paths matching", function (done) {

            var preparations = function () {
                helper.clearWorkingDir();
                fse.outputFileSync('dir/file.txt', '1');
                fse.outputFileSync('dir/file.md', 'm1');
                fse.outputFileSync('dir/a/file.txt', '2');
                fse.outputFileSync('dir/a/file.md', 'm2');
                fse.outputFileSync('dir/a/b/file.txt', '3');
                fse.outputFileSync('dir/a/b/file.md', 'm3');
            };

            var expectations = function () {
                expect('copy/file.txt').toBeFileWithContent('1');
                expect('copy/file.md').not.toExist();
                expect('copy/a/file.txt').toBeFileWithContent('2');
                expect('copy/a/file.md').not.toExist();
                expect('copy/a/b/file.txt').toBeFileWithContent('3');
                expect('copy/a/b/file.md').not.toExist();
            };

            // SYNC
            preparations();
            jetpack.copy('dir', 'copy', { matching: '*.txt' });
            expectations();

            // ASYNC
            preparations();
            jetpack.copyAsync('dir', 'copy', { matching: '*.txt' })
            .then(function () {
                expectations();
                done();
            });
        });

        it("copies only paths matching and anchored to ./", function (done) {

            var preparations = function () {
                helper.clearWorkingDir();
                fse.outputFileSync('dir/file.txt', '1');
                fse.outputFileSync('dir/a/file.txt', '2');
                fse.outputFileSync('dir/a/b/file.txt', '3');
            };

            var expectations = function () {
                expect('copy/file.txt').not.toExist();
                expect('copy/a/file.txt').toBeFileWithContent('2');
                expect('copy/a/b/file.txt').not.toExist();
            };

            // SYNC
            preparations();
            jetpack.copy('dir', 'copy', { matching: './a/*.txt' });
            expectations();

            // ASYNC
            preparations();
            jetpack.copyAsync('dir', 'copy', { matching: './a/*.txt' })
            .then(function () {
                expectations();
                done();
            });
        });

        it("works also if copying single file", function (done) {

            var preparations = function () {
                helper.clearWorkingDir();
                fse.outputFileSync('a', '1');
            };

            var expectations = function () {
                expect('b').not.toExist();
            };

            // SYNC
            preparations();
            jetpack.copy('a', 'b', { matching: 'x' });
            expectations();

            // ASYNC
            preparations();
            jetpack.copyAsync('a', 'b', { matching: 'x' })
            .then(function () {
                expectations();
                done();
            });
        });

        it('can use negation patterns', function (done) {

            var preparations = function () {
                helper.clearWorkingDir();
                fse.mkdirsSync('dir/a/b');
                fse.mkdirsSync('dir/a/c');
            };

            var expectations = function () {
                expect('copy/a/b').toBeDirectory();
                expect('copy/a/c').not.toExist();
            };

            // SYNC
            preparations();
            jetpack.copy('dir', 'copy', { matching: ['b', '!c'] });
            expectations();

            // ASYNC
            preparations();
            jetpack.copyAsync('dir', 'copy', { matching: ['b', '!c'] })
            .then(function () {
                expectations();
                done();
            });
        });

    });

    describe('*nix specyfic |', function () {

        if (process.platform === 'win32') {
            return;
        }

        it('copies also file permissions', function (done) {

            var preparations = function () {
                helper.clearWorkingDir();
                fse.outputFileSync('a/b/c.txt', 'abc');
                fse.chmodSync('a/b', '700');
                fse.chmodSync('a/b/c.txt', '711');
            };

            var expectations = function () {
                expect('x/b').toHaveMode('700');
                expect('x/b/c.txt').toHaveMode('711');
            };

            // SYNC
            preparations();
            jetpack.copy('a', 'x');
            expectations();

            // AYNC
            preparations();
            jetpack.copyAsync('a', 'x')
            .then(function () {
                expectations();
                done();
            });
        });

    });

});
