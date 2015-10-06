namespace tests {
    'use strict';

    import rand = tsumego.rand.LCG.NR01;
    import Net = tsumego.ann.SimpleLayeredNetwork;

    ut.group($ => {
        /// ann

        $.test($ => {
            /// simple 2:2:1 net #1

            const net = new Net(2);

            net.add([
                [0.1, 0.8],
                [0.4, 0.6]
            ]);

            net.add([
                [0.3, 0.9]
            ]);

            const input = [0.35, 0.9];

            const output1 = net.apply(input);
            $(output1).equal([0.6902834929076443]);

            net.adjust([0.5]);

            const output2 = net.apply(input);
            $(output2).equal([0.6820185832642942]);
        });

        $.test($ => {
            /// simple 2:2:1 net #2

            const net = new Net(2);

            net.add([
                [0.1, 0.5],
                [0.3, 0.2]
            ]);

            net.add([
                [0.2, 0.1]
            ]);

            const input = [0.1, 0.7];

            const output1 = net.apply(input);
            $(output1).equal([0.5429061854494511]);

            net.adjust([1.0]);

            const output2 = net.apply(input);
            $(output2).equal([0.5609479467866498]);
        });

        $.test($ => {
            /// simple letters

            const letters = {
                A: [0, 0, 1, 0, 0,
                    0, 1, 0, 1, 0,
                    1, 0, 0, 0, 1,
                    1, 1, 1, 1, 1,
                    1, 0, 0, 0, 1,
                    1, 0, 0, 0, 1,
                    1, 0, 0, 0, 1],

                B: [1, 1, 1, 1, 0,
                    1, 0, 0, 0, 1,
                    1, 0, 0, 0, 1,
                    1, 1, 1, 1, 0,
                    1, 0, 0, 0, 1,
                    1, 0, 0, 0, 1,
                    1, 1, 1, 1, 0],

                C: [1, 1, 1, 1, 1,
                    1, 0, 0, 0, 0,
                    1, 0, 0, 0, 0,
                    1, 0, 0, 0, 0,
                    1, 0, 0, 0, 0,
                    1, 0, 0, 0, 0,
                    1, 1, 1, 1, 1],

                D: [1, 1, 1, 1, 0,
                    1, 0, 0, 0, 1,
                    1, 0, 0, 0, 1,
                    1, 0, 0, 0, 1,
                    1, 0, 0, 0, 1,
                    1, 0, 0, 0, 1,
                    1, 1, 1, 1, 0]
            };

            const net = new Net(letters.A.length);

            net.add(letters.A.length, rand(0));
            net.add(letters.A.length, rand(0));
            net.add(4, rand(0));

            for (let i = 0; i < 500; i++) {
                net.apply(letters.A);
                net.adjust([1, 0, 0, 0]);

                net.apply(letters.B);
                net.adjust([0, 1, 0, 0]);

                net.apply(letters.C);
                net.adjust([0, 0, 1, 0]);

                net.apply(letters.D);
                net.adjust([0, 0, 0, 1]);
            }

            $(net.apply(letters.A).map(x => x * 100 | 0)).equal([94, 5, 0, 0]);
            $(net.apply(letters.B).map(x => x * 100 | 0)).equal([6, 90, 0, 10]);
            $(net.apply(letters.C).map(x => x * 100 | 0)).equal([0, 0, 90, 16]);
            $(net.apply(letters.D).map(x => x * 100 | 0)).equal([0, 8, 8, 84]);
        });
    });
}