﻿module tsumego {
    'use strict';

    export type int = number;
    export type uint = number;
    export type XIndex = uint;
    export type YIndex = uint;

    /** Positive values = black.
        Negative values = white. */
    export type Color = int;

    export module Color {
        export const alias = (color: Color) => color > 0 ? 'B' : 'W';
    }

    export interface Result<Move> {
        color: Color;

        /** Tells where in the path the repetition occured. */
        repd?: number;

        /** The winning move.
            If the only solution is a loss, no move is stored. */
        move?: Move;
    }
}