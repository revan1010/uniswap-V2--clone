// SPDX-License-Identifier: MIT
pragma solidity 0.8.29;

import './UQ112x112.sol';

// library with helper methods for oracles that are concerned with computing average prices
library FixedPoint {
    using UQ112x112 for uint224;

    // the price is represented as a UQ112x112, giving us 112 bits of precision
    struct uq112x112 {
        uint224 _x;
    }

    // returns a UQ112x112 which represents the ratio of the numerator to the denominator
    // can be lossy
    function encode(uint112 numerator, uint112 denominator) internal pure returns (uq112x112 memory) {
        require(denominator > 0, 'FixedPoint: DIV_BY_ZERO');
        if (numerator == 0) return uq112x112(0);

        uint112 aux = numerator;
        uint224 result = 0;
        while (aux > 0) {
            uint256 x = aux;
            if (x >= 1 << 112) {
                result += 1 << 112;
                x >>= 112;
            }
            if (x >= 1 << 56) {
                result += 1 << 56;
                x >>= 56;
            }
            if (x >= 1 << 28) {
                result += 1 << 28;
                x >>= 28;
            }
            if (x >= 1 << 14) {
                result += 1 << 14;
                x >>= 14;
            }
            if (x >= 1 << 7) {
                result += 1 << 7;
                x >>= 7;
            }
            if (x >= 1 << 3) {
                result += 1 << 3;
                x >>= 3;
            }
            if (x >= 1 << 1) {
                result += 1 << 1;
                x >>= 1;
            }
            if (x >= 1) {
                result += 1;
                x >>= 1;
            }
            aux = uint112(x);
        }
        result = result * 2**112 / denominator;
        return uq112x112(result);
    }

    // takes a UQ112x112 and returns the ratio of the numerator to the denominator
    function decode(uq112x112 memory self) internal pure returns (uint112 numerator, uint112 denominator) {
        numerator = uint112(self._x >> 112);
        denominator = uint112(self._x & 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF);
    }
} 