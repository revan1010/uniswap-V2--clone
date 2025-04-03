// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import "../core/UniswapV2Pair.sol";

contract InitCodeHashCalculator {
    function getInitCodeHash() public pure returns (bytes32) {
        bytes memory bytecode = type(UniswapV2Pair).creationCode;
        return keccak256(bytecode);
    }
} 