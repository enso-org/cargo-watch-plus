const chokidar = require('chokidar')
const fs = require('fs')
const path = require('path');
const ignore =  require('ignore')
const yargs = require('yargs/yargs')
const yargsUtils = require('yargs')
const child_process = require('node:child_process');
const { performance } = require('perf_hooks');

// ==================
// === Arg Parser ===
// ==================

const args = yargs(process.argv.slice(3))
    .usage(
        `https://github.com/enso-org/cargo-watch-plus\n` +
        `Watches over your Cargo project’s source.\n\n` +
        `USAGE:\n` +
        `cargo watch-plus [FLAGS] [OPTIONS]`
    )
    .option('c', {group: 'FLAGS', alias: 'clear', describe: `Clear the screen before each run.`, type: 'bool'})
    .option('ignore-nothing', {group: 'FLAGS', describe: `Ignore nothing, not even 'target/' and '.git/'.`, type: 'bool'})
    .option('debug', {group: 'FLAGS', describe: `Show debug output.`, type: 'bool'})
    .option('why', {group: 'FLAGS', describe: `Show paths that changed.`, type: 'bool'})
    .option('q', {group: 'FLAGS', alias: 'quiet', describe: `Suppress output from cargo-watch-plus itself.`, type: 'bool'})
    .option('no-gitignore', {group: 'FLAGS', describe: `Don’t use '.gitignore' files.`, type: 'bool'})
    .option('no-ignore', {group: 'FLAGS', describe: `Don’t use '.ignore' files.`, type: 'bool'})

    .option('no-restart', {group: 'FLAGS', describe: `Don’t restart command while it’s still running.`, type: 'bool'})
    .option('poll', {group: 'FLAGS', describe: `Force use of polling for file changes.`, type: 'bool'})
    .option('postpone', {group: 'FLAGS', describe: `Postpone first run until a file changes.`, type: 'bool'})
    .option('watch-when-idle', {group: 'FLAGS', describe: `Ignore events emitted while the commands run.`, type: 'bool'})

    .option('x', {group: 'OPTIONS', alias: 'exec', describe: `Cargo command(s) to execute on changes. Defaults to 'check'.`, type: 'array'})
    .option('s', {group: 'OPTIONS', alias: 'shell', describe: `Shell command(s) to execute on changes.`, type: 'array'})
    .option('d', {group: 'OPTIONS', alias: 'delay', describe: `File updates debounce delay in seconds.`, type: 'number', default: 0.5})
    // .option('features', {group: 'OPTIONS', describe: `List of features passed to cargo invocations.`, type: 'array'})
    .option('i', {group: 'OPTIONS', alias: 'ignore', describe: `Ignore a glob/gitignore-style pattern.`, type: 'array'})
    // .option('B', {group: 'OPTIONS', describe: `Inject RUST_BACKTRACE=VALUE (generally you want to set it to 1) into the environment.`, type: 'string'})
    .option('use-shell', {group: 'OPTIONS', describe: `Use a different shell. E.g. --use-shell=bash`, type: 'string'})
    .option('w', {group: 'OPTIONS', alias: 'watch', describe: `Watch specific file(s) or folder(s).`, type: 'string', default: '.'})
    .option('C', {group: 'OPTIONS', alias: 'workdir', describe: `Change working directory before running command. Defaults to crate root.`, type: 'string'})
    .epilog(
        `Cargo commands (-x) are always executed before shell commands (-s). You can use the '- command' ` +
        `style instead, note you'll need to use full commands, it won't prefix 'cargo' for you.\n\n` +
        `By default, your entire project is watched, except for the 'target' and '.git' folders, and your `+
        `'.ignore' and '.gitignore' files are used to filter paths.`)

    .help('help')
    .wrap(yargsUtils.terminalWidth())
    .argv

if (args.exec == null && args.shell == null) {
    args.exec = ['check']
}

// ===========
// === CWD ===
// ===========

const crateRoot = process.argv[2]
if (args.workdir != null) {
    process.chdir(args.workdir)
} else {
    process.chdir(crateRoot)
}

// ===============
// === Logging ===
// ===============

function log(...logArgs) {
    if (args.quiet !== true) {
        console.log(...logArgs)
    }
}

function debug(...logArgs) {
    if (args.debug === true) {
        console.log(...logArgs)
    }
}

function logWhy(...logArgs) {
    if (args.why === true || args.debug === true) {
        console.log(...logArgs)
    }
}

// =================
// === GitIgnore ===
// =================

class GitIgnore {
    constructor(file, rules) {
        this.file = file
        this.path = path.dirname(file)
        this.ignore = ignore().add(rules)
    }

    ignores(path) {
        return this.ignore.ignores(path)
    }
}

// ======================
// === GitIgnoreWatch ===
// ======================

/** Watches '.gitignore' files. If they change, the `FileWatcher` is reloaded. */
class GitIgnoreWatch {
    constructor(fileWatch) {
        this.isReady = false
        this.fileWatch = fileWatch
        this.files = []
        const ignoreFiles = []
        if (args.noGitignore !== true) {
            ignoreFiles.push('.gitignore')
        }
        if (args.noIgnore !== true) {
            ignoreFiles.push('.ignore')
        }
        this.watch = chokidar.watch(ignoreFiles, {
            followSymlinks: true,
            persistent: true
        });
        this.watch
            .on('add', path => this.add(path))
            .on('change', path => this.change(path))
            .on('unlink', path => this.remove(path))
            .on('ready', () => this.ready())
    }

    ready() {
        this.isReady = true
        this.reloadFileWatch()
    }

    add(path) {
        debug(`A '.gitignore' file added at '${path}'.`)
        this.files.push(path)
        this.reloadFileWatch()
    }

    remove(path) {
        debug(`A '.gitignore' file removed at '${path}'.`)
        this.files.remove(path)
        this.reloadFileWatch()
    }

    change(path) {
        debug(`A '.gitignore' file changed at '${path}'.`)
        this.reloadFileWatch()
    }

    reloadFileWatch() {
        if (this.isReady) {
            const gitIgnores = []
            for (const file of this.files) {
                const content = fs.readFileSync(file, {encoding: 'utf8', flag: 'r'})
                const lines = content.split('\n').map(t => t.trim())
                const nonCommentLines = lines.filter(t => t.length > 0 && !t.startsWith('#'))
                const fileRules = nonCommentLines.map(t => t.startsWith('\\#') ? t.substring(1) : t)
                gitIgnores.push(new GitIgnore(file, fileRules))
            }
            this.fileWatch.start(gitIgnores)
        }
    }
}

// =================
// === FileWatch ===
// =================

class FileWatch {
    constructor() {
        this.gitIgnores = []
        this.lastCommandTime = -999 // To make sure the first run time diff is big.
        this.isReady = false
        this.watch = null
        this.runningCommands = new Set()
    }

    start(gitIgnores) {
        if (args.ignoreNothing !== true) {
            const argIgnores = args.ignore ?? []
            this.gitIgnores = gitIgnores
            this.gitIgnores.push(new GitIgnore('./default', ['target', '.git', ...argIgnores]))
        }
        if (this.watch == null) {
            log('Starting a new file watch.')
            this.watch = chokidar.watch(args.watch, {
                followSymlinks: true,
                persistent: true
            });

            this.watch
                .on('add', path => this.on('add', path))
                .on('change', path => this.on('change', path))
                .on('unlink', path => this.on('unlink', path))
                .on('ready', () => this.ready());
        }
    }

    ready() {
        this.isReady = true
        log('File watch is ready.')
        if(args.postpone === true) {
            log('Postponing initial run.')
        } else {
            this.runCommands()
        }
    }

    isIgnored(file) {
        for (const gitIgnore of this.gitIgnores) {
            let relPath = path.relative(gitIgnore.path, file)
            if (!(relPath.startsWith('..') && !path.isAbsolute(relPath))) {
                if (gitIgnore.ignores(relPath)) {
                    return gitIgnore
                }
            }
        }
        return null
    }

    on(event, file) {
        const notReady = !this.isReady
        const ignored = notReady ? null : this.isIgnored(file)
        const msg = notReady ? 'INIT ' : ignored != null ? `IGNORED (${ignored.file}) ` : ''
        const info = `[${event}] ${msg}${file}`
        if (notReady || ignored != null) {
            debug(info)
            return
        }
        logWhy(info)
        this.runCommands()
    }

    runCommands() {
        const time = performance.now()
        const time_diff_s = (time - this.lastCommandTime)/1000
        const time_diff_s_round = Math.round(time_diff_s * 100) / 100
        this.lastCommandTime = time
        if(args.watchWhenIdle === true && this.runningCommands.size > 0) {
            debug(`Skipping update. There are ${this.runningCommands.size} running commands.`)
            return
        }
        if (time_diff_s < args.delay) {
            debug(`Skipping update. Last update was < ${args.delay}s ago (${time_diff_s_round}s).`)
            return
        }
        if(args.clear === true) {
            console.clear()
        }
        const execCommands = args.exec ?? []
        const shellCommands = args.shell ?? []
        const commands = execCommands.map(t => `cargo ${t}`).concat(shellCommands)
        for (const command of commands) {
            if(args.noRestart && this.runningCommands.has(command)) {
                debug(`Command '${command}' is already running, skipping re-run.`)
            } else {
                debug(`Running '${command}'.`)
                this.runningCommands.add(command)
                const cmdArgs = command.split(' ')
                child_process.spawn(cmdArgs[0], cmdArgs.slice(1) , {stdio: 'inherit', shell: args.useShell}, () =>
                    this.runningCommands.delete(command)
                )
            }
        }
    }
}

// ============
// === Main ===
// ============

debug(`Starting cargo-watch-plus with arguments:`)
debug(args)

new GitIgnoreWatch(new FileWatch());
