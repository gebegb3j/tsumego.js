namespace tests {
    const vals = [];

    const args: string[] = isNode ?
        // jake test[abc def] won't work (buggy jake!)
        // so semicolon can be used as the separator too
        process.argv.slice(2).join(' ').split(/[\s;]/) :
        location.search.slice(1).split('&');

    for (const a of args) {
        if (!a) continue;

        // jake test[abc=def] doesn't work either,
        // so `:` can replace `=` if necessary
        const [k, ...v] = a.split(/[=:]/);

        if (v.length < 1)
            vals.push(a);
        else
            vals[k] = a.slice(k.length + 1);
    }

    /**
     * node test qwerty foo=bar
     * jake test[qwerty;foo:bar]
     * /test?qwerty&foo:bar
     */
    export const argv: {
        [index: number]: string;
        mode: 'es5' | 'es6';
        log: boolean;
        benson: boolean;
        logsgf: boolean;
        logfile: string;
    } = vals as any;

    const defs = {
        benson(s) {
            /// uses the benson's test in the solver
            return s ? !!JSON.parse(s) : false;
        },

        log(s) {
            /// enables logging
            return s ? !!JSON.parse(s) : false;
        },

        logsgf(s) {
            /// logs SGF for every solved position
            return s ? !!JSON.parse(s) : false;
        },

        logfile(s) {
            /// the log file
            return s || 'logs.json';
        },

        mode(s) {
            /// if es5, loads some es6 polyfills
            return s || 'es6';
        },
    };

    console.log('args:', args);
    console.log('argv:', argv);

    let maxnamelen = 0;

    for (const name in defs)
        if (name.length > maxnamelen)
            maxnamelen = name.length;

    for (const name in defs) {
        const fn = defs[name];
        const s = /[/]{3}([^\n]+)/.exec(fn)[1].trim();
        const dv = fn(undefined);

        console.log(' ', name.pad(maxnamelen).white(), '-', s, dv === undefined ? 'required'.white() : 'default'.white() + ' = ' + dv);
    }

    for (const name in args) {
        if (/^\d+$/.test(name)) continue;
        console.log('unknown argument:', name);
        process.exit(1);
    }

    for (const name in defs) {
        if (/^\d+$/.test(name)) continue;
        const fn = defs[name];
        argv[name] = fn(argv[name]);
    }
}
