// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import "../src/test/InitCodeHashCalculator.sol";

contract InitCodeHashTest is Test {
    InitCodeHashCalculator public calculator;

    function setUp() public {
        calculator = new InitCodeHashCalculator();
    }

    function test_GetInitCodeHash() public {
        bytes32 initCodeHash = calculator.getInitCodeHash();
        console.logBytes32(initCodeHash);
    }
} 