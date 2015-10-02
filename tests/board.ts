﻿/// <reference path="infra.ts" />

module tests {
    import block = tsumego.block;
    import sumlibs = tsumego.sumlibs;
    import Board = tsumego.Board;

    ut.group($ => { 
        /// board

        $.test($ => {
            /// blocks
            const b = new Board(5);            

            const moves: [string, number, () => void][] = [
                ['+A5', 1, () => {
                    $(b.toString()).equal([
                        '   A',
                        ' 5 X',
                    ].join('\n'));

                    $(b.blocks.map(block.toString)).equal([null,
                        '+ [0, 0]x[0, 0] libs=2 size=1'
                    ]);
                }],

                ['-B5', 1, () => {
                    $(b.toString()).equal([
                        '   A B',
                        ' 5 X O',
                    ].join('\n'));

                    $(b.blocks.map(block.toString)).equal([null,
                        '+ [0, 0]x[0, 0] libs=1 size=1',
                        '- [1, 1]x[0, 0] libs=2 size=1'
                    ]);
                }],

                ['+B4', 1, () => {
                    $(b.toString()).equal([
                        '   A B',
                        ' 5 X O',
                        ' 4 - X',
                    ].join('\n'));

                    $(b.blocks.map(block.toString)).equal([null,
                        '+ [0, 0]x[0, 0] libs=1 size=1',
                        '- [1, 1]x[0, 0] libs=1 size=1',
                        '+ [1, 1]x[1, 1] libs=3 size=1'
                    ]);
                }],

                ['-C5', 1, () => {
                    $(b.toString()).equal([
                        '   A B C',
                        ' 5 X O O',
                        ' 4 - X -',
                    ].join('\n'));

                    $(b.blocks.map(block.toString)).equal([null,
                        '+ [0, 0]x[0, 0] libs=1 size=1',
                        '- [1, 2]x[0, 0] libs=2 size=2',
                        '+ [1, 1]x[1, 1] libs=3 size=1'
                    ]);
                }],

                ['+A4', 1, () => {
                    $(b.toString()).equal([
                        '   A B C',
                        ' 5 X O O',
                        ' 4 X X -',
                    ].join('\n'));

                    $(b.blocks.map(block.toString)).equal([null,
                        '+ [0, 1]x[0, 1] libs=3 size=3',
                        '- [1, 2]x[0, 0] libs=2 size=2',
                        '+ [0, 0]x[0, 0] libs=1 size=0'
                    ]);
                }],

                ['-E5', 1, () => {
                    $(b.toString()).equal([
                        '   A B C D E',
                        ' 5 X O O - O',
                        ' 4 X X - - -',
                    ].join('\n'));

                    $(b.blocks.map(block.toString)).equal([null,
                        '+ [0, 1]x[0, 1] libs=3 size=3',
                        '- [1, 2]x[0, 0] libs=2 size=2',
                        '+ [0, 0]x[0, 0] libs=1 size=0',
                        '- [4, 4]x[0, 0] libs=2 size=1'
                    ]);
                }],

                ['+A1', 1, () => {
                    $(b.toString()).equal([
                        '   A B C D E',
                        ' 5 X O O - O',
                        ' 4 X X - - -',
                        ' 3 - - - - -',
                        ' 2 - - - - -',
                        ' 1 X - - - -',
                    ].join('\n'));

                    $(b.blocks.map(block.toString)).equal([null,
                        '+ [0, 1]x[0, 1] libs=3 size=3',
                        '- [1, 2]x[0, 0] libs=2 size=2',
                        '+ [0, 0]x[0, 0] libs=1 size=0',
                        '- [4, 4]x[0, 0] libs=2 size=1',
                        '+ [0, 0]x[4, 4] libs=2 size=1',
                    ]);
                }],

                ['-D2', 1, () => {
                    $(b.toString()).equal([
                        '   A B C D E',
                        ' 5 X O O - O',
                        ' 4 X X - - -',
                        ' 3 - - - - -',
                        ' 2 - - - O -',
                        ' 1 X - - - -',
                    ].join('\n'));

                    $(b.blocks.map(block.toString)).equal([null,
                        '+ [0, 1]x[0, 1] libs=3 size=3',
                        '- [1, 2]x[0, 0] libs=2 size=2',
                        '+ [0, 0]x[0, 0] libs=1 size=0',
                        '- [4, 4]x[0, 0] libs=2 size=1',
                        '+ [0, 0]x[4, 4] libs=2 size=1',
                        '- [3, 3]x[3, 3] libs=4 size=1',
                    ]);
                }],
            ];

            // play and undo all the moves a few times
            for (let j = 0; j < 1e4; j++) {
                $(b.blocks).equal([0]);

                // play all the moves
                for (let i = 0; i < moves.length; i++) {
                    const [m, r, test] = moves[i];
                    const x = m.charCodeAt(1) - 0x41;
                    const y = b.size - +m.slice(2);
                    const c = m[0] == '+' ? +1 : -1;
                    const result = b.play(x, y, c);

                    try {
                        $(result).equal(r);
                        test();
                    } catch (reason) {
                        const error = new Error(`Failed to play #${i} x=${x} y=${y} c=${c}`);
                        error.reason = reason;
                        throw error;
                    }
                }

                // undo all the moves
                for (let i = moves.length - 1; i > 0; i--) {
                    const [m, r, test] = moves[i - 1];
                    b.undo();

                    try {
                        test();
                    } catch (reason) {
                        const error = new Error(`Failed to undo #${i}`);
                        error.reason = reason;
                        throw error;
                    }
                }

                b.undo();
                $(b.blocks).equal([0]);
            }
        });

        $.test($ => { 
            /// empty 3x3
            const board = new Board(3);

            $(board.toString('SGF')).equal('(;FF[4]SZ[3])');
            $(board.toString()).equal('   A\n 3 -');
            $(board.hash()).equal('3x3()');
        });

        $.test($ => { 
            /// 5x5 with a stone
            const board = new Board(5);
            board.play(2, 2, +1);

            $(board.toString('SGF')).equal('(;FF[4]SZ[5]AB[cc])');
            $(board.toString()).equal('   A B C\n 5 - - -\n 4 - - -\n 3 - - X');
            $(board.hash()).equal('5x5(;;--X)');
        });

        $.test($ => { 
            /// empty 3x3 from sgf
            const board = new Board(`(;FF[4]SZ[3])`);
            $(board.toString('SGF')).equal('(;FF[4]SZ[3])');
        });

        $.test($ => { 
            /// serialization
            const board = new Board(`
           (;FF[4]SZ[9]
             AW[bb][cb][cc][cd][de][df][cg][ch][dh][ai][bi][ci]
             AB[ba][ab][ac][bc][bd][be][cf][bg][bh])`);

            $(board.toString('SGF')).equal('(;FF[4]SZ[9]'
                + 'AB[ba][ab][ac][bc][bd][be][cf][bg][bh]'
                + 'AW[bb][cb][cc][cd][de][df][cg][ch][dh][ai][bi][ci])');

            $(board.toString()).equal([
                '   A B C D',
                ' 9 - X - -',
                ' 8 X O O -',
                ' 7 X X O -',
                ' 6 - X O -',
                ' 5 - X - O',
                ' 4 - - X O',
                ' 3 - X O -',
                ' 2 - X O O',
                ' 1 O O O -'
            ].join('\n'));

            $(board.hash()).equal('9x9(-X;XOO;XXO;-XO;-X-O;--XO;-XO;-XOO;OOO)');
        });

        $.test($ => { 
            /// 9x9 from txt to txt
            const board = new Board(9, [
                '-X-------',
                'XOO------',
                'XXO-----X',
                '-XO------',
                '-X-O-----',
                '--XO-----',
                '-XO------',
                '-XOO-----',
                'OOO------'
            ]);

            $(board + '').equal([
                '   A B C D E F G H J',
                ' 9 - X - - - - - - -',
                ' 8 X O O - - - - - -',
                ' 7 X X O - - - - - X',
                ' 6 - X O - - - - - -',
                ' 5 - X - O - - - - -',
                ' 4 - - X O - - - - -',
                ' 3 - X O - - - - - -',
                ' 2 - X O O - - - - -',
                ' 1 O O O - - - - - -'
            ].join('\n'));
        });

        $.test($ => { 
            /// total libs
            const b = new Board(5);

            $(sumlibs(b, +1)).equal(0);
            $(sumlibs(b, -1)).equal(0);

            b.play(0, 0, +1);

            $(sumlibs(b, +1)).equal(2);
            $(sumlibs(b, -1)).equal(0);

            b.play(1, 0, +1);

            $(sumlibs(b, +1)).equal(3);
            $(sumlibs(b, -1)).equal(0);

            b.play(4, 0, +1);

            $(sumlibs(b, +1)).equal(5);
            $(sumlibs(b, -1)).equal(0);

            b.play(3, 0, +1);

            $(sumlibs(b, +1)).equal(5);
            $(sumlibs(b, -1)).equal(0);

            b.play(2, 0, +1);

            $(sumlibs(b, +1)).equal(5);
            $(sumlibs(b, -1)).equal(0);

            b.play(0, 1, -1);

            $(sumlibs(b, +1)).equal(4);
            $(sumlibs(b, -1)).equal(2);

            b.play(1, 1, -1);

            $(sumlibs(b, +1)).equal(3);
            $(sumlibs(b, -1)).equal(3);

            b.play(4, 1, -1);

            $(sumlibs(b, +1)).equal(2);
            $(sumlibs(b, -1)).equal(5);

            b.play(3, 1, -1);

            $(sumlibs(b, +1)).equal(1);
            $(sumlibs(b, -1)).equal(5);

            b.play(2, 1, -1);

            $(sumlibs(b, +1)).equal(0);
            $(sumlibs(b, -1)).equal(10);
        });

        $.test($ => { 
            /// capture
            const b = new Board(9, [
                'X-XXOOOO',
                'XX-XXOOX',
                '--XOO-OX',
                '--XOOOXX',
                '---XXX--']);

            const n = b.play(5, 2, +1);

            // board is 9x9 so the rightmost column is empty
            $(n).equal(5 + 1);

            $(b + '').equal(
                '   A B C D E F G H\n' +
                ' 9 X - X X O O O O\n' +
                ' 8 X X - X X O O X\n' +
                ' 7 - - X - - X O X\n' +
                ' 6 - - X - - - X X\n' +
                ' 5 - - - X X X - -');
        });

        $.test($ => {
            /// captured block releases libs

            const b = new Board(9, [
                'O X',
                '- -'
            ]);

            const r = b.play(0, 1, 1);

            $(r).equal(2);

            $(b.toString('RL-')).equal([
                ' 0 3',
                ' 3 0'
            ].join('\n'));
        });

        $.test($ => {
            /// suicide #1

            const b = new Board(9, [
                '- X',
                'X X'
            ]);

            const r = b.play(0, 0, -1);

            $(r).equal(0);
        });

        $.test($ => {
            /// suicide #2

            const b = new Board(9, [
                '- O X',
                'X X X'
            ]);

            const r = b.play(0, 0, -1);

            $(r).equal(0);
        });

        $.test($ => {
            /// suicide #3

            const b = new Board(9, [
                '- O X',
                'O X X',
                'X X X'
            ]);

            const r = b.play(0, 0, -1);

            $(r).equal(0);
        });

        $.test($ => {
            /// suicide #4

            const b = new Board(9, [
                '- O X',
                'O O X',
                'X X X'
            ]);

            const r = b.play(0, 0, -1);

            $(r).equal(0);
        });
    });
}