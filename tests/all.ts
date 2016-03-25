/// <reference path="../src/search.ts" />

/// <reference path="infra.ts" />
/// <reference path="es6aiter.ts" />

/// <reference path="src/utils.ts" />
/// <reference path="src/gf2.ts" />
/// <reference path="src/sgf.ts" />
/// <reference path="src/dcnn.ts" />
/// <reference path="src/board.ts" />
/// <reference path="src/uceyes.ts" />
/// <reference path="src/search.ts" />
/// <reference path="src/benson.ts" />

namespace tests {
    console.log('\nTotal:', ((Date.now() - _dt0) / 1000).toFixed(1).white() + 's');

    tsumego.profile.log();

    // process.exit(0) somehow prevents stream
    // buffers from being flushed to files
    if (isNode && ut.failed)
        process.exit(1);
}