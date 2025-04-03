// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import "forge-std/Test.sol";
import "../src/core/UniswapV2Factory.sol";
import "../src/core/UniswapV2Pair.sol";
import "../src/core/test/ERC20.sol";

contract UniswapV2PairTest is Test {
    UniswapV2Factory factory;
    UniswapV2Pair pair;
    ERC20 token0;
    ERC20 token1;
    address feeTo;

    function setUp() public {
        // Deploy tokens
        token0 = new ERC20(1000000 ether);
        token1 = new ERC20(1000000 ether);
        
        // Ensure token0 address is less than token1
        if (address(token0) > address(token1)) {
            (token0, token1) = (token1, token0);
        }

        // Deploy factory and pair
        factory = new UniswapV2Factory(address(this));
        pair = UniswapV2Pair(factory.createPair(address(token0), address(token1)));
        feeTo = address(0xdead);
    }

    function test_Mint() public {
        uint amount0 = 1 ether;
        uint amount1 = 4 ether;

        token0.transfer(address(pair), amount0);
        token1.transfer(address(pair), amount1);

        uint liquidity = pair.mint(address(this));
        
        // First mint should create liquidity equal to geometric mean minus MINIMUM_LIQUIDITY
        uint expectedLiquidity = sqrt(amount0 * amount1) - 1000;
        assertEq(liquidity, expectedLiquidity);
        assertEq(pair.totalSupply(), expectedLiquidity + 1000); // Including MINIMUM_LIQUIDITY
        assertEq(pair.balanceOf(address(this)), expectedLiquidity);
    }

    function test_Burn() public {
        uint amount0 = 1 ether;
        uint amount1 = 4 ether;

        // Initial balances
        uint initialBalance0 = token0.balanceOf(address(this));
        uint initialBalance1 = token1.balanceOf(address(this));

        token0.transfer(address(pair), amount0);
        token1.transfer(address(pair), amount1);

        uint liquidity = pair.mint(address(this));
        
        pair.transfer(address(pair), liquidity);
        pair.burn(address(this));
        
        // After burning all liquidity (except MINIMUM_LIQUIDITY), balances should be almost back to initial
        assertEq(pair.balanceOf(address(this)), 0);
        assertApproxEqAbs(token0.balanceOf(address(this)), initialBalance0, 2000); // Allow for larger rounding
        assertApproxEqAbs(token1.balanceOf(address(this)), initialBalance1, 2000); // Allow for larger rounding
        assertEq(pair.totalSupply(), 1000); // Only MINIMUM_LIQUIDITY remains
    }

    function test_Swap() public {
        // Add initial liquidity
        uint amount0 = 5 ether;
        uint amount1 = 10 ether;
        token0.transfer(address(pair), amount0);
        token1.transfer(address(pair), amount1);
        pair.mint(address(this));

        // Prepare for swap
        uint swapAmount = 1 ether;
        uint expectedOutput = 1.6 ether; // Calculated based on xy=k formula
        token0.transfer(address(pair), swapAmount);

        // Perform swap
        pair.swap(0, expectedOutput, address(this), "");

        // Verify balances
        (uint reserve0, uint reserve1,) = pair.getReserves();
        assertEq(reserve0, amount0 + swapAmount);
        assertEq(reserve1, amount1 - expectedOutput);
    }

    function test_SwapFailsForInsufficientOutput() public {
        // Add initial liquidity
        uint amount0 = 5 ether;
        uint amount1 = 10 ether;
        token0.transfer(address(pair), amount0);
        token1.transfer(address(pair), amount1);
        pair.mint(address(this));

        // Try to swap with insufficient output
        uint swapAmount = 1 ether;
        token0.transfer(address(pair), swapAmount);

        vm.expectRevert("UniswapV2: K");
        pair.swap(0, 2 ether, address(this), ""); // Trying to get too much output
    }

    function test_Initialize() public {
        // Test that only factory can initialize
        vm.expectRevert("UniswapV2: FORBIDDEN");
        pair.initialize(address(token0), address(token1));
    }

    function test_MintFee() public {
        // Set feeTo address
        factory.setFeeTo(feeTo);
        
        // Add initial liquidity
        uint amount0 = 1000 ether;
        uint amount1 = 1000 ether;
        token0.transfer(address(pair), amount0);
        token1.transfer(address(pair), amount1);
        pair.mint(address(this));

        // Simulate some swaps to accumulate fees
        token0.transfer(address(pair), 100 ether);
        pair.swap(0, 90 ether, address(this), "");

        // Add more liquidity to trigger fee
        token0.transfer(address(pair), amount0);
        token1.transfer(address(pair), amount1);
        pair.mint(address(this));

        // Check that fee was minted to feeTo
        assertGt(pair.balanceOf(feeTo), 0, "Fee should be minted to feeTo");
    }

    function test_Skim() public {
        // Add initial liquidity
        uint amount0 = 1 ether;
        uint amount1 = 4 ether;
        token0.transfer(address(pair), amount0);
        token1.transfer(address(pair), amount1);
        pair.mint(address(this));

        // Transfer extra tokens to pair
        uint extra0 = 0.1 ether;
        uint extra1 = 0.4 ether;
        token0.transfer(address(pair), extra0);
        token1.transfer(address(pair), extra1);

        // Record balances before skim
        uint balance0Before = token0.balanceOf(address(this));
        uint balance1Before = token1.balanceOf(address(this));

        // Skim extra tokens
        pair.skim(address(this));

        // Check that extra tokens were returned
        assertEq(token0.balanceOf(address(this)), balance0Before + extra0);
        assertEq(token1.balanceOf(address(this)), balance1Before + extra1);
    }

    function test_Sync() public {
        // Add initial liquidity
        uint amount0 = 1 ether;
        uint amount1 = 4 ether;
        token0.transfer(address(pair), amount0);
        token1.transfer(address(pair), amount1);
        pair.mint(address(this));

        // Transfer extra tokens to pair
        uint extra0 = 0.1 ether;
        uint extra1 = 0.4 ether;
        token0.transfer(address(pair), extra0);
        token1.transfer(address(pair), extra1);

        // Sync reserves
        pair.sync();

        // Check that reserves were updated
        (uint reserve0, uint reserve1,) = pair.getReserves();
        assertEq(reserve0, amount0 + extra0);
        assertEq(reserve1, amount1 + extra1);
    }

    function test_MintWithZeroLiquidity() public {
        // Try to mint with amounts that would result in liquidity less than MINIMUM_LIQUIDITY
        uint amount0 = 100;
        uint amount1 = 100;
        token0.transfer(address(pair), amount0);
        token1.transfer(address(pair), amount1);

        // The sqrt of (100 * 100) = 100, which is less than MINIMUM_LIQUIDITY (1000)
        // This should cause the liquidity calculation to underflow
        vm.expectRevert();
        pair.mint(address(this));
    }

    function test_BurnWithZeroLiquidity() public {
        // Add some liquidity first
        uint amount0 = 1000 ether;
        uint amount1 = 1000 ether;
        token0.transfer(address(pair), amount0);
        token1.transfer(address(pair), amount1);
        pair.mint(address(this));

        // Burn all liquidity
        uint liquidity = pair.balanceOf(address(this));
        pair.transfer(address(pair), liquidity);
        pair.burn(address(this));

        // Try to burn again with no liquidity
        vm.expectRevert("UniswapV2: INSUFFICIENT_LIQUIDITY_BURNED");
        pair.burn(address(this));
    }

    function test_SwapWithInvalidTo() public {
        // Add initial liquidity
        uint amount0 = 1 ether;
        uint amount1 = 4 ether;
        token0.transfer(address(pair), amount0);
        token1.transfer(address(pair), amount1);
        pair.mint(address(this));

        // Try to swap to token address
        vm.expectRevert("UniswapV2: INVALID_TO");
        pair.swap(0.1 ether, 0, address(token0), "");
    }

    function test_SwapWithInsufficientOutput() public {
        // Add initial liquidity
        uint amount0 = 1 ether;
        uint amount1 = 4 ether;
        token0.transfer(address(pair), amount0);
        token1.transfer(address(pair), amount1);
        pair.mint(address(this));

        // Try to swap with insufficient output
        vm.expectRevert("UniswapV2: INSUFFICIENT_LIQUIDITY");
        pair.swap(2 ether, 0, address(this), "");
    }

    function test_SwapWithInsufficientInput() public {
        // Add initial liquidity
        uint amount0 = 1 ether;
        uint amount1 = 4 ether;
        token0.transfer(address(pair), amount0);
        token1.transfer(address(pair), amount1);
        pair.mint(address(this));

        // Try to swap with no input
        vm.expectRevert("UniswapV2: INSUFFICIENT_INPUT_AMOUNT");
        pair.swap(0.1 ether, 0, address(this), "");
    }

    function test_UpdateWithZeroReserves() public {
        // Add initial liquidity
        uint amount0 = 1 ether;
        uint amount1 = 4 ether;
        token0.transfer(address(pair), amount0);
        token1.transfer(address(pair), amount1);
        pair.mint(address(this));

        // Transfer all tokens out to make reserves zero
        pair.skim(address(this));

        // Add more tokens but don't mint liquidity
        token0.transfer(address(pair), amount0);
        token1.transfer(address(pair), amount1);

        // Call sync to update reserves
        pair.sync();

        // Check that price accumulators didn't update
        assertEq(pair.price0CumulativeLast(), 0);
        assertEq(pair.price1CumulativeLast(), 0);
    }

    function test_UpdateWithOverflow() public {
        // Deploy tokens with large supply
        token0 = new ERC20(type(uint256).max);
        token1 = new ERC20(type(uint256).max);
        
        // Create new pair with these tokens
        pair = UniswapV2Pair(factory.createPair(address(token0), address(token1)));

        // Try to update with values that would overflow uint112
        uint largeAmount = type(uint112).max;
        token0.transfer(address(pair), largeAmount);
        token1.transfer(address(pair), largeAmount);

        // First sync should work
        pair.sync();

        // Transfer one more token to cause overflow
        token0.transfer(address(pair), 1);
        token1.transfer(address(pair), 1);

        vm.expectRevert("UniswapV2: OVERFLOW");
        pair.sync();
    }

    function test_MintFeeWithNoGrowth() public {
        // Set feeTo address
        factory.setFeeTo(feeTo);
        
        // Add initial liquidity
        uint amount0 = 1000 ether;
        uint amount1 = 1000 ether;
        token0.transfer(address(pair), amount0);
        token1.transfer(address(pair), amount1);
        pair.mint(address(this));

        // Add same amount of liquidity again
        token0.transfer(address(pair), amount0);
        token1.transfer(address(pair), amount1);
        pair.mint(address(this));

        // Check that no fee was minted since k didn't grow
        assertEq(pair.balanceOf(feeTo), 0);
    }

    function test_MintFeeWithZeroKLast() public {
        // Set feeTo address
        factory.setFeeTo(feeTo);
        
        // Add initial liquidity
        uint amount0 = 1000 ether;
        uint amount1 = 1000 ether;
        token0.transfer(address(pair), amount0);
        token1.transfer(address(pair), amount1);
        pair.mint(address(this));

        // Check that no fee was minted since kLast is 0
        assertEq(pair.balanceOf(feeTo), 0);
    }

    function test_SwapWithCallback() public {
        // Add initial liquidity
        uint amount0 = 5 ether;
        uint amount1 = 10 ether;
        token0.transfer(address(pair), amount0);
        token1.transfer(address(pair), amount1);
        pair.mint(address(this));

        // Create a contract that implements IUniswapV2Callee
        bytes memory data = abi.encodeWithSignature("uniswapV2Call(address,uint256,uint256,bytes)", 
            address(this), 0, 1 ether, "");
        
        // Try to swap with callback
        vm.expectRevert(); // The callback will fail since the contract doesn't implement the interface
        pair.swap(0, 1 ether, address(this), data);
    }

    function test_UpdateInSameBlock() public {
        // Add initial liquidity
        uint amount0 = 1 ether;
        uint amount1 = 4 ether;
        token0.transfer(address(pair), amount0);
        token1.transfer(address(pair), amount1);
        pair.mint(address(this));

        // Call sync twice in the same block
        pair.sync();
        pair.sync();

        // Check that price accumulators didn't update
        assertEq(pair.price0CumulativeLast(), 0);
        assertEq(pair.price1CumulativeLast(), 0);
    }

    function test_UpdateWithOneZeroReserve() public {
        // Add initial liquidity
        uint amount0 = 1 ether;
        uint amount1 = 4 ether;
        token0.transfer(address(pair), amount0);
        token1.transfer(address(pair), amount1);
        pair.mint(address(this));

        // Remove all of token0 using skim
        pair.skim(address(this));

        // Add more token1 and sync
        token1.transfer(address(pair), 1 ether);
        pair.sync();

        // Check that price accumulators didn't update
        assertEq(pair.price0CumulativeLast(), 0);
        assertEq(pair.price1CumulativeLast(), 0);
    }

    function test_MintFeeWithSmallerK() public {
        // Set feeTo address
        factory.setFeeTo(feeTo);
        
        // Add initial liquidity
        uint amount0 = 1000 ether;
        uint amount1 = 1000 ether;
        token0.transfer(address(pair), amount0);
        token1.transfer(address(pair), amount1);
        pair.mint(address(this));

        // Remove some liquidity to make k smaller
        uint liquidity = pair.balanceOf(address(this));
        pair.transfer(address(pair), liquidity / 2);
        pair.burn(address(this));

        // Add same amount of liquidity again
        token0.transfer(address(pair), amount0 / 2);
        token1.transfer(address(pair), amount1 / 2);
        pair.mint(address(this));

        // Check that no fee was minted since k didn't grow
        assertEq(pair.balanceOf(feeTo), 0);
    }

    function test_UpdateWithBothZeroReserves() public {
        // Add initial liquidity
        uint amount0 = 1 ether;
        uint amount1 = 4 ether;
        token0.transfer(address(pair), amount0);
        token1.transfer(address(pair), amount1);
        pair.mint(address(this));

        // Remove all tokens using skim
        pair.skim(address(this));

        // Wait for next block
        vm.roll(block.number + 1);
        vm.warp(block.timestamp + 15);

        // Add more tokens and sync
        token0.transfer(address(pair), amount0);
        token1.transfer(address(pair), amount1);
        pair.sync();

        // Price accumulators should be updated since we have non-zero reserves after sync
        // and time has elapsed
        assertGt(pair.price0CumulativeLast(), 0);
        assertGt(pair.price1CumulativeLast(), 0);
    }

    function test_UpdateWithOneZeroReserveAndTimeElapsed() public {
        // Add initial liquidity
        uint amount0 = 1 ether;
        uint amount1 = 4 ether;
        token0.transfer(address(pair), amount0);
        token1.transfer(address(pair), amount1);
        pair.mint(address(this));

        // Remove all of token0 using skim
        pair.skim(address(this));

        // Wait for next block
        vm.roll(block.number + 1);
        vm.warp(block.timestamp + 15);

        // Add more token1 and sync
        token1.transfer(address(pair), 1 ether);
        pair.sync();

        // Price accumulators should be updated since we have non-zero reserves after sync
        // and time has elapsed
        assertGt(pair.price0CumulativeLast(), 0);
        assertGt(pair.price1CumulativeLast(), 0);
    }

    function test_MintFeeWithTinyGrowth() public {
        // Set feeTo address
        factory.setFeeTo(feeTo);
        
        // Add initial liquidity
        uint amount0 = 1000 ether;
        uint amount1 = 1000 ether;
        token0.transfer(address(pair), amount0);
        token1.transfer(address(pair), amount1);
        pair.mint(address(this));

        // Add slightly more liquidity
        token0.transfer(address(pair), 1);
        token1.transfer(address(pair), 1);
        pair.mint(address(this));

        // Check that no fee was minted since growth was too small
        assertEq(pair.balanceOf(feeTo), 0);
    }

    function test_UpdateWithTimeElapsedAndOneZeroReserve() public {
        // Add initial liquidity
        uint amount0 = 1 ether;
        uint amount1 = 4 ether;
        token0.transfer(address(pair), amount0);
        token1.transfer(address(pair), amount1);
        pair.mint(address(this));

        // Record initial price accumulators
        uint price0Before = pair.price0CumulativeLast();
        uint price1Before = pair.price1CumulativeLast();

        // Remove all of token0 using skim
        pair.skim(address(this));

        // Wait for next block
        vm.roll(block.number + 1);
        vm.warp(block.timestamp + 15);

        // Add more token1 and sync
        token1.transfer(address(pair), 1 ether);
        pair.sync();

        // Price accumulators should have updated based on the old reserves
        assertGt(pair.price0CumulativeLast(), price0Before);
        assertGt(pair.price1CumulativeLast(), price1Before);
    }

    function test_UpdateWithNoTimeElapsed() public {
        // Add initial liquidity
        uint amount0 = 1 ether;
        uint amount1 = 4 ether;
        token0.transfer(address(pair), amount0);
        token1.transfer(address(pair), amount1);
        pair.mint(address(this));

        // Call sync in the same block
        pair.sync();

        // Price accumulators should not update when no time has elapsed
        assertEq(pair.price0CumulativeLast(), 0);
        assertEq(pair.price1CumulativeLast(), 0);
    }

    function test_MintFeeWithZeroLiquidity() public {
        // Set feeTo address
        factory.setFeeTo(feeTo);
        
        // Add initial liquidity
        uint amount0 = 1000 ether;
        uint amount1 = 1000 ether;
        token0.transfer(address(pair), amount0);
        token1.transfer(address(pair), amount1);
        pair.mint(address(this));

        // Remove all liquidity
        uint liquidity = pair.balanceOf(address(this));
        pair.transfer(address(pair), liquidity);
        pair.burn(address(this));

        // Add more liquidity to trigger fee calculation
        token0.transfer(address(pair), amount0);
        token1.transfer(address(pair), amount1);
        pair.mint(address(this));

        // Check that no fee was minted since previous liquidity was 0
        assertEq(pair.balanceOf(feeTo), 0);
    }

    function test_MintFeeWithZeroKLastAndFeeOn() public {
        // Set feeTo address
        factory.setFeeTo(feeTo);
        
        // Add initial liquidity with kLast = 0
        uint amount0 = 1000 ether;
        uint amount1 = 1000 ether;
        token0.transfer(address(pair), amount0);
        token1.transfer(address(pair), amount1);
        
        // Ensure kLast is 0 before minting
        assertEq(pair.kLast(), 0);
        
        // Mint liquidity
        pair.mint(address(this));

        // Check that no fee was minted since kLast was 0
        assertEq(pair.balanceOf(feeTo), 0);
    }

    function test_UpdateWithBothZeroReservesAndTimeElapsed() public {
        // Add initial liquidity
        uint amount0 = 1 ether;
        uint amount1 = 4 ether;
        token0.transfer(address(pair), amount0);
        token1.transfer(address(pair), amount1);
        pair.mint(address(this));

        // Record initial price accumulators
        uint price0Before = pair.price0CumulativeLast();
        uint price1Before = pair.price1CumulativeLast();

        // Remove all tokens using skim
        pair.skim(address(this));

        // Wait for next block
        vm.roll(block.number + 1);
        vm.warp(block.timestamp + 15);

        // Add more tokens and sync
        token0.transfer(address(pair), amount0);
        token1.transfer(address(pair), amount1);
        pair.sync();

        // Price accumulators should have updated based on the old reserves
        assertGt(pair.price0CumulativeLast(), price0Before);
        assertGt(pair.price1CumulativeLast(), price1Before);
    }

    function sqrt(uint y) internal pure returns (uint z) {
        if (y > 3) {
            z = y;
            uint x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
} 