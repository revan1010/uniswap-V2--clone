// SPDX-License-Identifier: MIT
pragma solidity 0.8.29;

import "forge-std/Test.sol";
import "../src/core/UniswapV2Factory.sol";
import "../src/core/UniswapV2Pair.sol";
import "../src/core/test/ERC20.sol";

contract UniswapV2FactoryTest is Test {
    UniswapV2Factory factory;
    ERC20 tokenA;
    ERC20 tokenB;
    address feeTo;

    function setUp() public {
        // Deploy the factory
        factory = new UniswapV2Factory(address(this));
        
        // Deploy test tokens
        tokenA = new ERC20(1000000 ether); // 1M tokens
        tokenB = new ERC20(1000000 ether); // 1M tokens
        
        feeTo = address(0xdead);
    }

    function test_CreatePair() public {
        address pair = factory.createPair(address(tokenA), address(tokenB));
        
        assertEq(factory.allPairsLength(), 1);
        assertEq(factory.getPair(address(tokenA), address(tokenB)), pair);
        assertEq(factory.getPair(address(tokenB), address(tokenA)), pair);
        
        // Test pair properties
        UniswapV2Pair pairContract = UniswapV2Pair(pair);
        assertEq(pairContract.factory(), address(factory));
        assertEq(pairContract.token0(), address(tokenA) < address(tokenB) ? address(tokenA) : address(tokenB));
        assertEq(pairContract.token1(), address(tokenA) < address(tokenB) ? address(tokenB) : address(tokenA));
    }

    function test_CreatePairFailsForSameTokens() public {
        vm.expectRevert("UniswapV2: IDENTICAL_ADDRESSES");
        factory.createPair(address(tokenA), address(tokenA));
    }

    function test_CreatePairFailsForZeroAddress() public {
        vm.expectRevert("UniswapV2: ZERO_ADDRESS");
        factory.createPair(address(0), address(tokenA));
        
        vm.expectRevert("UniswapV2: ZERO_ADDRESS");
        factory.createPair(address(tokenA), address(0));
    }

    function test_CreatePairFailsForExistingPair() public {
        factory.createPair(address(tokenA), address(tokenB));
        
        vm.expectRevert("UniswapV2: PAIR_EXISTS");
        factory.createPair(address(tokenA), address(tokenB));
        
        vm.expectRevert("UniswapV2: PAIR_EXISTS");
        factory.createPair(address(tokenB), address(tokenA));
    }

    function test_SetFeeTo() public {
        // Only feeToSetter can set feeTo
        vm.prank(address(0xbad));
        vm.expectRevert("UniswapV2: FORBIDDEN");
        factory.setFeeTo(feeTo);

        // feeToSetter can set feeTo
        factory.setFeeTo(feeTo);
        assertEq(factory.feeTo(), feeTo);
    }

    function test_SetFeeToSetter() public {
        address newFeeToSetter = address(0xbeef);

        // Only current feeToSetter can set new feeToSetter
        vm.prank(address(0xbad));
        vm.expectRevert("UniswapV2: FORBIDDEN");
        factory.setFeeToSetter(newFeeToSetter);

        // Current feeToSetter can set new feeToSetter
        factory.setFeeToSetter(newFeeToSetter);
        assertEq(factory.feeToSetter(), newFeeToSetter);

        // Old feeToSetter can no longer set new feeToSetter
        vm.expectRevert("UniswapV2: FORBIDDEN");
        factory.setFeeToSetter(address(this));
    }
} 