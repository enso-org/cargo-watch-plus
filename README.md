## 👋 Introduction
This library was developed in response to difficulties encountered while using [cargo-watch](https://github.com/watchexec/cargo-watch) for development of [Enso](https://github.com/enso-org/enso). Addressing these issues proved to be challenging, while creation of this library required only a single evening of effort, leveraging well-established and production-ready JavaScript libraries outlined in this document. Functioning in a manner akin to [cargo-watch](https://github.com/watchexec/cargo-watch), this library operates more effectively across multiple systems, mitigating multiple important concerns, including:

- [Cargo-watch exhibits erratic performance on modern MacOS, potentially causing indefinite loops.](https://github.com/watchexec/cargo-watch/issues/242)
- [Cargo-watch may loop endlessly when employed within complex Git repositories.](https://github.com/watchexec/cargo-watch/issues/241)
- [Cargo-watch lacks support for certain `.gitignore` syntax, including negative patterns.](https://github.com/watchexec/watchexec/issues/166)
- [Cargo-watch misconstrues certain syntax in the `.gitignore file`, leading to the erroneous monitoring of files that should be exempt.](https://github.com/watchexec/watchexec/issues/203) 

<br/>

## ⚙️ How this library is made?
This library is a concise wrapper, comprising less than [300 lines of code](https://github.com/enso-org/cargo-watch-plus/blob/main/js/src/index.js), over the following libraries:
- [Chokidar](https://www.npmjs.com/package/chokidar), a highly efficient, cross-platform file watching library, which is utilized in [Brunch](https://brunch.io/),
[Microsoft's Visual Studio Code](https://github.com/microsoft/vscode),
[gulp](https://github.com/gulpjs/gulp/),
[karma](https://karma-runner.github.io/),
[PM2](https://github.com/Unitech/PM2),
[browserify](http://browserify.org/),
[webpack](https://webpack.github.io/),
[BrowserSync](https://www.browsersync.io/),
and other similar tools listed [here](https://www.npmjs.com/browse/depended/chokidar).
- [Ignore](https://www.npmjs.com/package/ignore), a manager, filter and parser of the [.gitignore spec 2.22.1](https://git-scm.com/docs/gitignore/2.22.1). This tool is utilized by [eslint](https://eslint.org), [gitbook](https://www.gitbook.com), and other applications as noted [here](https://www.npmjs.com/browse/depended/ignore). The library is fully tested and encompasses over **five hundred** unit tests.

<br/>

## 📖 Usage

To install this library, run `cargo install cargo-watch-plus`. Then, use `cargo watch-plus --help` to see what you can do. By default, when you run `cargo watch-plus` in your project, it runs `cargo check` if any file has been changed.

This library was designed as in-place replacement for `cargo-watch` and implements the same options. If you notice any differences, please let us know and we'll fix them.

<br/>

## 👎 Downsides
The only disadvantage of this library is that it is not implemented in pure Rust. On the other hand, it bases on high-quality production-tested libraries, so it should provide you with consistent, good results across different operating systems.
