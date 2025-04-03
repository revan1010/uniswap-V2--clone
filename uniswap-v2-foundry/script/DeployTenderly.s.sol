// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import "../src/core/UniswapV2Factory.sol";
import "../src/periphery/UniswapV2Router02.sol";
import "../src/periphery/interfaces/IWETH.sol";

contract DeployTenderly is Script {
    function run() public {
        // Get WETH address from env (using mainnet WETH)
        address wethAddress = vm.envOr("WETH_ADDRESS", address(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2));
        console.log("Using WETH at:", wethAddress);

        vm.startBroadcast();

        // Deploy Factory
        address feeToSetter = vm.envOr("FEE_TO_SETTER", msg.sender);
        UniswapV2Factory factory = new UniswapV2Factory(feeToSetter);
        console.log("UniswapV2Factory deployed at:", address(factory));

        // Deploy Router
        UniswapV2Router02 router = new UniswapV2Router02(address(factory), wethAddress);
        console.log("UniswapV2Router02 deployed at:", address(router));

        vm.stopBroadcast();
        
        // Print deployment summary
        console.log("\n=== Deployment Summary ===");
        console.log("Network: Tenderly Mainnet Fork");
        console.log("WETH Address:", wethAddress);
        console.log("Factory Address:", address(factory));
        console.log("Router Address:", address(router));
        console.log("==========================\n");
        
        // Suggest next steps
        console.log("Next steps:");
        console.log("1. Copy these addresses to your frontend application");
        console.log("2. Update your frontend to connect to the Tenderly RPC URL");
        console.log("3. Test creating pools and swapping tokens");
    }
} 