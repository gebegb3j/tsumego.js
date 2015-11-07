/// <reference path="kb.ts" />
/// <reference path="xhr.ts" />
/// <reference path="preview.ts" />
/// <reference path="../src/solver.ts" />
/// <reference path="wgo/wgo.d.ts" />

declare var goban: WGo.BasicPlayer;
declare var board: tsumego.Board;

window['goban'] = null;
window['board'] = null;

module testbench {
    import stone = tsumego.stone;
    import Board = tsumego.Board;
    import profile = tsumego.profile;

    /** In SGF a B stone at x = 8, y = 2
        is written as B[ic] on a 9x9 goban
        it corresponds to J7 - the I letter
        is skipped and the y coordinate is
        counted from the bottom starting from 1. */
    const xy2s = (m: stone) => !stone.hascoords(m) ? null :
        String.fromCharCode(0x41 + (stone.x(m) > 7 ? stone.x(m) - 1 : stone.x(m))) +
        (goban.board.size - stone.y(m));

    const c2s = (c: number) => c > 0 ? 'B' : 'W';
    const cm2s = (c: number, m: stone) => c2s(c) + (Number.isFinite(m) ? ' plays at ' + xy2s(m) : ' passes');
    const cw2s = (c: number, m: stone) => c2s(c) + ' wins by ' + (Number.isFinite(m) ? xy2s(m) : 'passing');

    function s2s(c: number, s: stone) {
        let isDraw = stone.color(s) == 0;
        let isLoss = s * c < 0;

        return c2s(c) + ' ' + (isLoss ? 'loses' : (isDraw ? 'draws' : 'wins') + ' with ' + xy2s(s));
    }

    /** shared transposition table for black and white */
    export var tt = new tsumego.TT;

    function solve(board: Board, color: number, nkotreats: number = 0, log = false) {
        profile.reset();

        const rs = tsumego.solve({
            root: board,
            color: color,
            nkt: nkotreats,
            tt: tt,
            expand: tsumego.generators.Basic(rzone),
            status: status
        });

        if (log) {
            profile.log();
            console.log(s2s(color, rs));
        }

        return rs;
    }

    class CancellationToken {
        cancelled = false;
    }

    function sleep(ms: number) {
        return new Promise<void>(resolve => setTimeout(resolve, ms));
    }

    function dbgsolve(board: Board, color: number, nkotreats = 0) {
        let log = true;

        const player = {
            play(move: stone) {
                if (!log) return;

                const node = new WGo.KNode({
                    _edited: true,
                    move: {
                        pass: !move,
                        x: stone.x(move),
                        y: stone.y(move),
                        c: stone.color(move) > 0 ? WGo.B : WGo.W
                    }
                });

                goban.kifuReader.node.appendChild(node);
                goban.next(goban.kifuReader.node.children.length - 1);
            },

            undo() {
                if (!log) return;
                goban.previous();
            },

            done(color: number, move: stone, note?: string) {
                if (!log) return;

                const comment = `${cw2s(color, move) } ${note ? '(' + note + ')' : ''}\n`;
                const node = goban.kifuReader.node;

                node.comment = node.comment || '';
                node.comment += comment;

                goban.update();
            },

            loss(color: number) {
                if (!log) return;

                const comment = c2s(color) + ' loses\n';
                const node = goban.kifuReader.node;

                node.comment = node.comment || '';
                node.comment += comment;

                goban.update();
            }
        };

        const solver = tsumego.solve.start({
            root: board,
            color: color,
            nkt: nkotreats,
            tt: tt,
            expand: tsumego.generators.Basic(rzone),
            status: status,
            player: player,
            alive: (b: Board) => tsumego.benson.alive(b, aim)
        });

        window['solver'] = solver;

        let tick = 0;
        let result: stone;

        const next = () => {
            const {done, value} = solver.next();
            !done && tick++;
            result = value;

            if (log)
                location.hash = '#hash=' + (0x100000000 + board.hash).toString(16).slice(-8) + '&step=' + tick;
        };

        const stepOver = (ct: CancellationToken) => {
            const hash = board.hash;

            do {
                next();
            } while (board.hash != hash && !ct.cancelled);

            next();
        };

        const stepOut = () => {
            /*
            log = false;
            const n = solver.depth;
            while (solver.depth >= n)
                next();
            log = true;
            renderSGF(solver.current.node.toString('SGF'));
            */
        };

        keyboard.hook(keyboard.Key.F10, event => {
            event.preventDefault();
            const ct = new CancellationToken;
            const hook = keyboard.hook(keyboard.Key.Esc, event => {
                event.preventDefault();
                console.log('cancelling...');
                ct.cancelled = true;
            });

            stepOver(ct);
        });

        keyboard.hook(keyboard.Key.F11, event => {
            if (!event.shiftKey) {
                event.preventDefault();
                if (event.ctrlKey)
                    debugger;
                next();
            } else {
                // Shift+F11
                event.preventDefault();
                stepOut();
            }
        });

        console.log(c2s(color), 'to play with', nkotreats, 'external ko treats\n',
            'F11 - step into\n',
            'Ctrl+F11 - step into and debug\n',
            'F10 - step over\n',
            'Shift+F11 - step out\n',
            'G - go to a certain step\n');

        keyboard.hook('G'.charCodeAt(0), event => {
            event.preventDefault();
            const stopat = +prompt('Step #:');
            if (!stopat) return;
            console.log('skipping first', stopat, 'steps...');
            while (tick < stopat)
                next();
            renderBoard();
        });
    }

    function status(b: Board) {
        return b.get(stone.x(aim), stone.y(aim)) < 0 ? -1 : +1;
    }

    var rzone: stone[], aim;

    Promise.resolve().then(() => {
        if (!location.search) {
            return send('GET', '/problems/manifest.json').then(data => {
                const manifest = JSON.parse(data);

                for (const dir of manifest.dirs) {
                    const header = document.createElement('h3');
                    const section = document.createElement('div');

                    header.textContent = dir.description || 'Unnamed';

                    document.body.appendChild(header);
                    document.body.appendChild(section);

                    for (const path of dir.problems) {
                        send('GET', '/problems/' + path).then(sgf => {
                            const root = SGF.parse(sgf);

                            for (let nvar = 0; nvar <= root.vars.length; nvar++) {
                                const board = new Board(root, nvar);
                                const html = renderPreview(board);
                                const preview = document.createElement('a');

                                preview.className = 'tsumego-preview';
                                preview.href = '?' + path.replace('.sgf', '') + ':' + nvar;
                                section.appendChild(preview);
                                preview.innerHTML = html;
                            }
                        }).catch(err => {
                            console.log(err.stack);
                        });
                    }
                }
            });
        } else {
            const [, source, bw, nkt, nvar] = /^\?([^:]+)(?::(B|W)([+-]\d+))?(?::(\d+))?/.exec(location.search);

            document.title = source;

            return Promise.resolve().then(() => {
                return source.slice(0, 1) == '(' ?
                    source :
                    send('GET', '/problems/' + source + '.sgf');
            }).then(sgfdata => {
                const sgf = SGF.parse(sgfdata);
                const setup = sgf.steps[0];

                board = new Board(sgfdata, nvar && +nvar);
                aim = stone.fromString(setup['MA'][0]);
                rzone = setup['SL'].map(stone.fromString);

                board = board.fork(); // drop the history of moves

                console.log(sgfdata);
                console.log(board + '');
                console.log(board.toStringSGF());

                setTimeout(() => renderBoard());
                dbgsolve(board, bw == 'W' ? -1 : +1, +nkt);
            });
        }
    }).catch(err => {
        console.error(err.stack);
        alert(err);
    });

    function renderBoard() {
        goban = new WGo.BasicPlayer(document.body, {
            // a C{...] tag is needed to
            // enable the comment box in wgo
            sgf: board.toStringSGF('WGo')
        });

        goban.setCoordinates(true);
        goban.kifuReader.allowIllegalMoves(true);
    }

    function makeMove(x: number, y: number, c: number) {
        const node = new WGo.KNode({
            _edited: true,
            move: {
                x: x,
                y: y,
                c: c > 0 ? WGo.B : WGo.W
            }
        });

        goban.kifuReader.node.appendChild(node);
        goban.next(goban.kifuReader.node.children.length - 1);
    }

    function parse(si: string, size: number): stone {
        const x = si.charCodeAt(0) - 65;
        const y = size - +/\d+/.exec(si)[0];

        return stone(x, y, 0);
    }

    window['$'] = data => {
        const cmd = data.toString().trim().split(' ');
        const col = cmd[0].toLowerCase();

        switch (col) {
            case 'x':
            case 'o':
                const xy = cmd[1] && cmd[1].toUpperCase();
                const c = cmd[0].toUpperCase() == 'O' ? -1 : +1;

                if (/^[a-z]\d+$/i.test(xy)) {
                    const p = parse(xy, board.size);

                    if (!board.play(stone(stone.x(p), stone.y(p), c))) {
                        console.log(col, 'cannot play at', xy);
                    } else {
                        console.log(board + '');
                        makeMove(stone.x(p), stone.y(p), c);
                    }
                } else {
                    const move = solve(board, c, !xy ? 0 : +xy, true);

                    if (!stone.hascoords(move) || move * c < 0) {
                        console.log(col, 'passes');
                    } else {
                        board.play(move);
                        console.log(board + '');
                        makeMove(stone.x(move), stone.y(move), c);
                    }
                }
                break;

            case 'undo':
                let n = +(cmd[1] || 1);

                while (n-- > 0) {
                    const move = board.undo();

                    if (move) {
                        console.log('undo ' + stone.toString(move));
                    } else {
                        console.log('nothing to undo');
                        break;
                    }
                }

                console.log(board + '');
                break;

            case 'path':
                let move: stone, moves: stone[] = [];

                while (move = board.undo())
                    moves.unshift(move);

                for (move of moves) {
                    console.log(board + '');
                    board.play(move);
                }

                console.log(board + '');
                break;

            default:
                console.log('unknown command');
        }
    };
}
