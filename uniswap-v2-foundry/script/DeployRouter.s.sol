// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import "../src/periphery/UniswapV2Router02.sol";

contract DeployRouter is Script {
    function run() public {
        // Use existing contracts
        address factoryAddress = 0x41116A26212bEF1c22273733fc8A9E86f6182F99; // Factory deployed on Holesky
        
        // Get WETH address from env or use fallback
        address wethAddress = vm.envOr("WETH_ADDRESS", address(0xc2c4e9f30483EE668c9526ac2347F7892F509851));
        console.log("Using WETH at:", wethAddress);
        console.log("Using Factory at:", factoryAddress);
        
        vm.startBroadcast();

        // Deploy Router only
        UniswapV2Router02 router = new UniswapV2Router02(factoryAddress, wethAddress);
        console.log("UniswapV2Router02 deployed at:", address(router));

        vm.stopBroadcast();
    }
} 