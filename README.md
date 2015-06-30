It's a simplistic tsumego solver in JS based on ideas explained by Martin Muller in his numerous papers. At the moment this solver doesn't implement any advanced algorithms and is able to solve only basic problems in which all possible moves (up to ~10) and the target are set manually:

```
......OX
XO..OOOX
.XOOXXXX
.XXX....
```

It's an example of a problem that this solver can handle: it can figure out that if O plays first, it lives without a ko.
