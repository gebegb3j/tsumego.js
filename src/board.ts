﻿/// <reference path="utils.ts" />
/// <reference path="move.ts" />
/// <reference path="prof.ts" />
/// <reference path="sgf.ts" />

module tsumego {
    'use strict';

    /**
     * A block is represented by a 32 bit signed integer:
     *
     * 0               1               2               3
     *  0 1 2 3 4 5 6 7 0 1 2 3 4 5 6 7 0 1 2 3 4 5 6 7 0 1 2 3 4 5 6 7
     * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
     * | xmin  | xmax  | ymin  | ymax  |     libs      |    size     |c|
     * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
     *
     * The first 2 bytes describe the rectangular boundaries of the block.
     * This implies that blocks must fit in 16x16 board.
     *
     * Next byte contains the number of liberties. Most of the blocks
     * hardly have 20 libs, so 8 bits should be more than enough.
     *
     * The first 7 bits of the last byte contain the number of stones
     * in the block, which gives up to 128 stones. Most of the blocks have
     * less than 15 stones.
     *
     * The last bit is the sign bit of the number and it tells the color
     * of the block: 0 = black, 1 = white. This implies that black blocks
     * are positive and white blocks are negative.
     *
     * Since a block a removed when it loses its last liberty, blocks with
     * libs = 0 or size = 0 do not exist.
     */
    export type block = number;

    export function block(xmin: number, xmax: number, ymin: number, ymax: number, libs: number, size: number, color: number) {
        return xmin | xmax << 4 | ymin << 8 | ymax << 12 | libs << 16 | size << 24 | color & 0x80000000;
    }

    export namespace block {
        /** 
         * The board is represented by a square matrix in which
         * each cell contains either block id or 0, if the intersection
         * is unoccupied. This is why block ids start with 1.
         */
        export type id = number;

        export const xmin = (b: block) => b & 15;
        export const xmax = (b: block) => b >> 4 & 15;
        export const ymin = (b: block) => b >> 8 & 15;
        export const ymax = (b: block) => b >> 12 & 15;
        export const rect = (b: block) => [xmin(b), xmax(b), ymin(b), ymax(b)];
        export const libs = (b: block) => b >> 16 & 255;
        export const size = (b: block) => b >> 24 & 127;

        export const add_libs = (b: block, n: number) => b & ~0xFF0000 | libs(b) + n << 16;
    }

    export class Board {
        /** 
         * The max board size is 16x16 because boundaries
         * of each block are stored in 4 bit integers. 
         */
        size: number;

        /** 
         * table[y * size + x] contains a block id or 0. 
         *
         * When a block is merged with another block,
         * this table isn't changed, but the corresponding
         * two blocks get updated in the list of blocks.
         *
         * When a block is captured, correponding cells in
         * this table are reset to 0.
         */
        private table: block.id[];

        /** 
         * blocks[id] = a block with this block.id
         *
         * When block #1 is merged with block #2, its size is
         * reset to 0 and its libs is set to #2: this trick allows
         * to not modify the board table too often.
         *
         * This means that to get the block libs and other info
         * it's necessary to walk up the chain of merged blocks.
         *
         * When a block is captured, blocks[id] is reset to 0
         * and corresponding elements in the board table are erased.
         */
        private blocks: block[] = [0];

        /**
         * Every time a stone is added, changes in the list of blocks
         * and in the board table are stored in the history so that that
         * stone can be quickly undone later.
         */
        private history: {
            /** 
             * Every time a stone is added to the board,
             * the following record is added to this list:
             *
             * 0               1               2               3
             *  0 1 2 3 4 5 6 7 0 1 2 3 4 5 6 7 0 1 2 3 4 5 6 7 0 1 2 3 4 5 6 7
             * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
             * |   x   |   y   |    changed    |    removed    |               |
             * +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+             
             *
             * The coordinates are stored in the first byte.
             * The number of changed blocks is stored in the 2nd byte.
             * The number of removed stones is stored in the 3rd byte.
             */
            added: number[];

            /**
             * Every time a block is modified, its id and its previous version
             * from blocks[id] is stored in this list. When a block is removed,
             * the coordinates of its stones are added to the history as well.
             */
            changed: number[];

            /**
             * When a block is removed, coordinates of all its stones are stored in the removed list.
             * The format of each entry is: bits 0..3 = x, bits 4..7 = y. The color isn't stored.
             * It's possible to not store the coordinates themselves, but only a bit mask with the
             * size of the block's boundary rectangle. It's debatable whether this would be more
             * efficient.
             */
            removed: number[];
        };

        private _hash: string;

        constructor(size: uint);
        constructor(size: uint, rows: string[]);
        constructor(sgf: string | SGF.Node);

        constructor(size, setup?) {
            if (typeof size === 'string' || typeof size === 'object')
                this.initFromSGF(size);
            else if (typeof size === 'number') {
                this.init(size);
                if (setup instanceof Array)
                    this.initFromTXT(setup);
            }
        }

        private init(size: number) {
            if (size > 16)
                throw Error(`Board ${size}x${size} is too big. Up to 16x16 boards are supported.`);

            this.size = size;
            this.table = new Array(size * size);
            this.history = { added: [], changed: [], removed: [] };
        }

        private initFromTXT(rows: string[]) {
            rows.map((row, y) => {
                row.replace(/\s/g, '').split('').map((chr, x) => {
                    let c = chr == 'X' ? +1 : chr == 'O' ? -1 : 0;
                    if (c && !this.play(x, y, c))
                        throw new Error('Invalid setup.');
                });
            });
        }

        private initFromSGF(source: string | SGF.Node) {
            const sgf = typeof source === 'string' ? SGF.parse(source) : source;
            if (!sgf) throw new SyntaxError('Invalid SGF: ' + source);
            const setup = sgf.steps[0]; // ;FF[4]SZ[19]...
            const size = +setup['SZ'];

            this.init(size);

            const place = (tag: string, color: number) => {
                const stones = setup[tag];
                if (!stones) return;

                for (const xy of stones) {
                    const x = s2n(xy, 0);
                    const y = s2n(xy, 1);

                    if (!this.play(x, y, color))
                        throw new Error(tag + '[' + xy + '] cannot be added.');
                }
            };

            place('AW', -1);
            place('AB', +1);
        }

        /** 
         * Clones the board and all the history of moves.
         * This method is exceptionally slow.
         */
        fork(): Board {
            const json = JSON.parse(JSON.stringify(this));
            Object.setPrototypeOf(json, Board.prototype);
            return json as Board;
        }

        get(x: number, y: number): block;
        get(xy: XY): block;

        get(x: number, y?: number): block {
            if (y === void 0) {
                y = XY.y(x);
                x = XY.x(x);
            }

            return this.inBounds(x, y) ? this.blocks[this.table[y * this.size + x]] : 0;
        }

        /** Returns block id or zero. The block data can be read from blocks[id]. */
        private getBlockId(x: number, y: number) {
            if (!this.isInBounds(x, y))
                return 0;

            let b, i = this.table[y * this.size + x];

            while (i && !block.size(b = this.blocks[i]))
                i = block.libs(b);

            return i;
        }

        /** Returns the four neighbors of the stone in the [L, R, T, B] format. */
        private getNbBlockIds(x: number, y: number) {
            return [
                this.getBlockId(x - 1, y),
                this.getBlockId(x + 1, y),
                this.getBlockId(x, y - 1),
                this.getBlockId(x, y + 1)
            ];
        }

        /** 
         * Adjusts libs of the four neighboring blocks
         * of the given color by the given quantity. 
         */
        private adjust(x: number, y: number, color: number, quantity: number) {
            const neighbors = this.getNbBlockIds(x, y);

            next: for (let i = 0; i < 4; i++) {
                const id = neighbors[i];
                const b = this.blocks[id];

                if (b * color <= 0)
                    continue;

                for (let j = 0; j < i; j++)
                    if (neighbors[j] == id)
                        continue next;

                this.change(id, block.add_libs(b, quantity));

            }
        }

        private remove(id: block.id) {
            const b = this.blocks[id];
            const [xmin, xmax, ymin, ymax] = block.rect(b);

            this.change(id, 0);

            for (let y = ymin; y <= ymax; y++) {
                for (let x = xmin; x <= xmax; x++) {
                    const i = y * this.size + x;

                    if (this.table[i] == id) {
                        this.adjust(x, y, -b, +1);
                        this.table[i] = 0;
                        this.history.removed.push(x | y << 4);
                    }
                }
            }
        }

        /** Changes the block data and makes an appropriate record in the history. */
        private change(id: block.id, b: block) {
            // adding a new block corresponds to a change from
            // blocks[blocks.length - 1] -> b
            this.history.changed.push(id, this.blocks[id] || 0);
            this.blocks[id] = b;
        }

        inBounds(x: number, y: number): boolean;
        inBounds(xy: XY): boolean;

        inBounds(x: number, y?: number): boolean {
            if (y === void 0) {
                y = XY.y(x);
                x = XY.x(x);
            }

            const n = this.size;
            return x >= 0 && x < n && y >= 0 && y < n;
        }

        private isInBounds(x: number, y: number) {
            const n = this.size;
            return x >= 0 && x < n && y >= 0 && y < n;
        }

        /** 
         * Returns the number of captured stones + 1.
         * If the move cannot be played, returns 0.
         * The move can be undone.
         */
        //@profile.time
        play(x: number, y: number, color: number): number {
            const size = this.size, t = this.table;

            if (!this.inBounds(x, y) || t[y * size + x])
                return 0;

            const n_changed = this.history.changed.length / 2; // id1, b1, id2, b2, ...
            const n_removed = this.history.removed.length;

            const ids: block.id[] = this.getNbBlockIds(x, y);
            const nbs: block[] = [0, 0, 0, 0];
            const lib = [0, 0, 0, 0];

            for (let i = 0; i < 4; i++)
                nbs[i] = this.blocks[ids[i]],
                lib[i] = block.libs(nbs[i]);

            // remove captured blocks            

            let result = 0;

            for (let i = 0; i < 4; i++)
                if (lib[i] == 1 && color * nbs[i] < 0)
                    result += block.size(nbs[i]),
                    this.remove(ids[i]);

            if (result == 0
                /* L */ && (nbs[0] * color < 0 || lib[0] == 1 || x == 0)
                /* R */ && (nbs[1] * color < 0 || lib[1] == 1 || x == size - 1)
                /* T */ && (nbs[2] * color < 0 || lib[2] == 1 || y == 0)
                /* B */ && (nbs[3] * color < 0 || lib[3] == 1 || y == size - 1)) {
                // suicide is not allowed
                return 0;
            }            

            // take away a lib of every neighboring group

            this.adjust(x, y, color, -1);

            // new group id = min of neighboring group ids

            let id_new = this.blocks.length;
            let is_new = true;

            for (let i = 0; i < 4; i++)
                if (nbs[i] * color > 0 && ids[i] < id_new)
                    id_new = ids[i],
                    is_new = false;

            t[y * size + x] = id_new;
            this._hash = null;

            if (is_new) {
                // create a new block if the new stone has no neighbors
                let n = 0;

                for (let i = 0; i < 4; i++)
                    if (!nbs[i] || lib[i] == 1)
                        n++;

                this.change(id_new, block(x, x, y, y, n, 1, color));
            } else {
                // merge neighbors into one block

                const fids = [id_new];

                // find blocks that need to be merged

                for (let i = 0; i < 4; i++)
                    if (nbs[i] * color > 0 && ids[i] != id_new)
                        fids.push(ids[i]);

                let size_new = 1;

                let xmin_new = x;
                let xmax_new = x;
                let ymin_new = y;
                let ymax_new = y;

                for (let i = 0; i < fids.length; i++) {
                    const id = fids[i];
                    const b = this.blocks[id];

                    size_new += block.size(b);

                    const [xmin, xmax, ymin, ymax] = block.rect(b);

                    xmin_new = min(xmin_new, xmin);
                    ymin_new = min(ymin_new, ymin);
                    xmax_new = max(xmax_new, xmax);
                    ymax_new = max(ymax_new, ymax);

                    // make the merged block point to the new block

                    if (id != id_new)
                        this.change(id, block(xmin, xmax, ymin, ymax, id_new, 0, color));
                }

                let libs_new = 0;

                // libs need to be counted in the rectangle extended by 1 intersection

                for (let y = max(ymin_new - 1, 0); y <= min(ymax_new + 1, this.size - 1); y++) {
                    for (let x = max(xmin_new - 1, 0); x <= min(xmax_new + 1, this.size - 1); x++) {
                        if (!t[y * size + x]) {
                            const is_lib =
                                this.getBlockId(x - 1, y) == id_new ||
                                this.getBlockId(x + 1, y) == id_new ||
                                this.getBlockId(x, y - 1) == id_new ||
                                this.getBlockId(x, y + 1) == id_new;

                            if (is_lib)
                                libs_new++;
                        }
                    }
                }

                this.change(id_new, block(xmin_new, xmax_new, ymin_new, ymax_new, libs_new, size_new, color));
            }

            this.history.added.push(x | y << 4
                | this.history.changed.length / 2 - n_changed << 8
                | this.history.removed.length - n_removed << 8);

            return result + 1;
        }

        /** Reverts the last move. */
        undo() {
            const move = this.history.added.pop();

            const x = move & 15;
            const y = move >> 4 & 15;
            const n_changed = move >> 8 & 255;

            for (let i = 0; i < n_changed; i++) {
                const b = this.history.changed.pop();
                const id = this.history.changed.pop();

                // the block was removed - restore its stones
                if (!this.blocks[id]) {
                    let n = block.size(b);

                    while (n-- > 0) {
                        const r = this.history.removed.pop();

                        const rx = r & 15;
                        const ry = r >> 4 & 15;

                        this.table[ry * this.size + rx] = id;
                    }
                }

                this.blocks[id] = b;

                // whena new block is added, the corresponding
                // record in the history looks like changing
                // the last block from 0 to something
                if (id == this.blocks.length - 1 && !b)
                    this.blocks.pop();
            }
        }

        totalLibs(color: number): number {
            let total = 0;

            for (let i = 1; i < this.blocks.length; i++) {
                const b = this.blocks[i];

                if (b * color > 0)
                    total += block.libs(b);
            }

            return total;
        }

        eulern(color: number, q: number = 2): number {
            let n1 = 0, n2 = 0, n3 = 0;

            for (let x = -1; x <= this.size; x++) {
                for (let y = -1; y <= this.size; y++) {
                    const a = +((this.get(x, y) * color) > 0);
                    const b = +((this.get(x + 1, y) * color) > 0);
                    const c = +((this.get(x + 1, y + 1) * color) > 0);
                    const d = +((this.get(x, y + 1) * color) > 0);

                    switch (a + b + c + d) {
                        case 1: n1++; break;
                        case 2: if (a == c) n2++; break;
                        case 3: n3++; break;
                    }
                }
            }

            return (n1 - n3 + q * n2) / 4;
        }

        hash(): string {
            if (!this._hash) {
                const n = this.size;
                let h = '', len = 0;

                for (let y = 0; y < n; y++) {
                    let rx = h.length;

                    for (let x = 0; x < n; x++) {
                        const b = this.get(x, y);
                        h += b > 0 ? 'X' : b < 0 ? 'O' : '-';
                        if (b) len = rx = h.length;
                    }

                    h = h.slice(0, rx) + ';';
                }

                this._hash = n + 'x' + n + '(' + h.slice(0, len) + ')';
            }

            return this._hash;
        }

        private toStringSGF() {
            const take = (pf: string, fn: (g: number) => boolean) => {
                let list = '';

                for (let y = 0; y < this.size; y++)
                    for (let x = 0; x < this.size; x++)
                        if (fn(this.get(x, y)))
                            list += '[' + n2s(x) + n2s(y) + ']';

                return list && pf + list;
            }

            return '(;FF[4]SZ[' + this.size + ']'
                + take('AB', c => c > 0)
                + take('AW', c => c < 0) + ')';
        }

        private toStringTXT(mode = '') {
            const hideLabels = /L-/.test(mode);
            const showLibsNum = /R/.test(mode);

            let xmax = 0, ymax = 0, s = '';

            for (let x = 0; x < this.size; x++)
                for (let y = 0; y < this.size; y++)
                    if (this.get(x, y))
                        xmax = max(x, xmax),
                        ymax = max(y, ymax);

            if (!hideLabels) {
                s += '  ';

                for (let x = 0; x <= xmax; x++)
                    s += ' ' + String.fromCharCode(0x41 + (x < 8 ? x : x + 1)); // skip I
            }

            for (let y = 0; y <= ymax; y++) {
                if (s)
                    s += '\n';

                if (!hideLabels) {
                    const n = (this.size - y) + '';
                    s += n.length < 2 ? ' ' + n : n;;
                }

                for (let x = 0; x <= xmax; x++) {
                    const b = this.get(x, y);

                    s += ' ';

                    s += showLibsNum ? block.libs(b) :
                        b > 0 ? 'X' :
                            b < 0 ? 'O' :
                                '-';
                }
            }

            return s;
        }

        toString(mode?: string): string {
            return mode == 'SGF' ?
                this.toStringSGF() :
                this.toStringTXT(mode);
        }
    }
}
