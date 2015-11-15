﻿declare const process;

interface Error {
    stack: string;
    reason: Error;
}

interface String {
    red(): string;
    cyan(): string;
    white(): string;
}

namespace tests {
    export const isNode = typeof process === 'object';
}

// https://en.wikipedia.org/wiki/ANSI_escape_code#Colors
namespace tests {
    Object.assign(String.prototype, {
        red() {
            return isNode ? '\x1b[31;1m' + this + '\x1b[0m' : this;
        },

        cyan() {
            return isNode ? '\x1b[36;1m' + this + '\x1b[0m' : this;
        },

        white() {
            return isNode ? '\x1b[37;1m' + this + '\x1b[0m' : this;
        },
    });

    export function ErrorWithReason(message: string, reason: Error) {
        const error = Error(message);
        error.reason = reason;
        throw error;
    }
}

namespace tests.ut {
    export interface TestContext {
        /** Example: $(1 + 2).equal(3); */
        <T>(value: T): ValueContext<T>;
    }

    export interface GroupContext {
        test(test: ($: TestContext) => string|void, name?: string): void;
    }

    const fname = (f: Function) => /\/\/\/ (.+)[\r\n]/.exec(f + '')[1].trim();

    let testid = 0;
    let indent = '';
    export let failed = false;

    declare const process;
    declare const location;

    const filter: string = typeof location === 'object' ?
        location.hash.slice(1) :
        process.argv[2];

    if (filter)
        console.warn('tests filtered by: ' + JSON.stringify(filter));

    export function group(init: ($: GroupContext) => void, gname = fname(init)) {
        const _indent = indent;
        console.log(indent + gname.cyan());
        indent += '  ';

        init({
            test: (test, tname = fname(test)) => {
                tname = (('   `' + ++testid).slice(-4) + '` ').white() + tname;

                if (filter && tname.indexOf(filter) < 0 && gname.indexOf(filter) < 0)
                    return;

                const logs = [];

                try {
                    const _console_log = console.log;

                    console.log = (...args) => {
                        logs.push([...args].join(' '));
                    };

                    const started = new Date;
                    let comment;

                    if (isNode)
                        process.title = tname + ' @ ' + started.toLocaleTimeString();

                    try {
                        comment = test(expect);
                    } finally {
                        console.log = _console_log;
                    }

                    const duration = +new Date - +started;
                    console.log(indent + tname, (duration / 1000).toFixed(1).white() + 's', comment || '');
                } catch (err) {
                    failed = true;
                    console.log(indent + tname, 'failed'.red());

                    for (const log of logs)
                        console.log(log);

                    while (err) {
                        console.log(err && err.stack || err);
                        err = err.reason;
                    }
                }
            }
        });

        indent = _indent;
    }

    function assert(x: boolean, m = 'assertion failed', f = {}) {
        if (x) return;
        const e = new Error(m);
        for (const i in f)
            e[i] = f;
        if (typeof location === 'object' && /^#debug$/.test(location.hash))
            debugger;
        throw e;
    }

    function expect<T>(x: T) {
        return new ValueContext(x);
    }

    export class ValueContext<T> {
        constructor(private value: T) {

        }

        /** Checks strict === equality. */
        equal(y: T) {
            match(y)(this.value);
        }

        belong(y: T[]) {
            if (y.indexOf(this.value) < 0)
                throw Error(`${JSON.stringify(this.value) } cannot be found in ${JSON.stringify(y) }`);
        }
    }

    function match(pattern) {
        if (typeof pattern === 'string')
            return match.text(pattern);

        if (typeof pattern === 'number' || pattern === null || pattern === undefined || pattern === false || pattern === true)
            return match.primitive(pattern);

        if (typeof pattern === 'object' && pattern.constructor === Object)
            return match.dictionary(pattern);

        if (pattern instanceof Array)
            return match.array(pattern);

        throw new Error(`Unrecognized pattern: ${pattern}.`);
    }

    module match {
        export function text(pattern: string) {
            return (value: string) => {
                if (value !== pattern) {
                    assert(false, 'The two strings do not match:'
                        + '\n lhs: ' + stringify(value)
                        + '\n lhs: ' + stringify(pattern)
                        + '\ndiff: ' + strdiff(value, pattern));
                }
            };
        }

        export function primitive<T extends number | void>(pattern: T) {
            return (value: T) => {
                if (value !== pattern)
                    assert(false, `${value} !== ${pattern}`);
            };
        }

        export function dictionary<T extends {}>(pattern: T) {
            return (value: T) => {
                for (const key in pattern) {
                    try {
                        match(pattern[key])(value[key]);
                    } catch (err) {
                        throw MatchError(`[${key}] has a wrong value`, err);
                    }
                }

                for (const key in value) {
                    if (!(key in pattern))
                        throw Error(`[${key}] should be absent`);
                }
            };
        }

        export function array<T>(pattern: any[]) {
            return (value: T[]) => {
                for (let i = 0; i < pattern.length; i++) {
                    try {
                        match(pattern[i])(value[i]);
                    } catch (err) {
                        throw MatchError(`[${i}] has a wrong value`, err);
                    }
                }

                assert(pattern.length == value.length, `.length: ${value.length} > ${pattern.length}`);
            };
        }
    }

    function MatchError(message: string, reason: Error) {
        const err = new Error(message);
        err.reason = reason;
        return err;
    }

    function stringify(value) {
        return typeof value === 'string' ? stringifyString(value) :
            value + '';
    }

    function stringifyString(string: string) {
        const escaped = string
            .replace(/"/gm, '\\"')
            .replace(/\n/gm, '\\n');

        return '"' + escaped + '"';
    }

    function strdiff(lhs: string, rhs: string) {
        for (let i = 0; i < lhs.length || i < rhs.length; i++)
            if (lhs.charAt(i) !== rhs.charAt(i))
                return '.slice(' + i + ') = '
                    + stringify(truncate(lhs, i, i + 5))
                    + ' vs '
                    + stringify(truncate(rhs, i, i + 5));

        return '(identical)';
    }

    function truncate(s: string, i, j: number) {
        const w = s.slice(i, j);
        return j < s.length ? w : w + '...';
    }
}

declare const require: Function;
declare const global;

try {
    require('source-map-support').install();

    if (!global.Symbol) {
        console.warn('loading Symbol polyfill');
        global.Symbol = require('es6-symbol');
    }

    try {
        new Function('function*f(){}');
    } catch (err) {
        console.warn('loading the regenerator runtime');
        global.regeneratorRuntime = require('../regenerator-runtime');
    }
} catch (e) {
    console.warn(e);
}

const _dt0 = Date.now();
