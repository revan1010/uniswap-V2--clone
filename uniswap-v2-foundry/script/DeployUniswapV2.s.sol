// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import "../src/core/UniswapV2Factory.sol";
import "../src/periphery/UniswapV2Router02.sol";
import "../src/periphery/interfaces/IWETH.sol";

contract DeployWETH is Script {
    function run() public returns (address) {
        vm.startBroadcast();
        // Mock WETH deployment - in real deployment you'd use the actual WETH address for the network
        MockWETH weth = new MockWETH();
        vm.stopBroadcast();

        console.log("WETH deployed at:", address(weth));
        return address(weth);
    }
}

contract DeployUniswapV2 is Script {
    function run() public {
        address wethAddress;
        
        // Check if we should use an existing WETH
        string memory existingWETH = vm.envOr("WETH_ADDRESS", string(""));
        if (bytes(existingWETH).length > 0) {
            wethAddress = vm.parseAddress(existingWETH);
            console.log("Using existing WETH at:", wethAddress);
        } else {
            // Deploy a mock WETH
            DeployWETH deployWETH = new DeployWETH();
            wethAddress = deployWETH.run();
        }

        vm.startBroadcast();

        // Deploy Factory
        address feeToSetter = vm.envOr("FEE_TO_SETTER", msg.sender);
        UniswapV2Factory factory = new UniswapV2Factory(feeToSetter);
        console.log("UniswapV2Factory deployed at:", address(factory));

        // Deploy Router
        UniswapV2Router02 router = new UniswapV2Router02(address(factory), wethAddress);
        console.log("UniswapV2Router02 deployed at:", address(router));

        vm.stopBroadcast();
    }
}

// Simple WETH mock for testing
contract MockWETH {
    string public name = "Wrapped Ether";
    string public symbol = "WETH";
    uint8 public decimals = 18;

    event Approval(address indexed src, address indexed guy, uint wad);
    event Transfer(address indexed src, address indexed dst, uint wad);
    event Deposit(address indexed dst, uint wad);
    event Withdrawal(address indexed src, uint wad);

    mapping(address => uint) public balanceOf;
    mapping(address => mapping(address => uint)) public allowance;

    receive() external payable {
        deposit();
    }

    function deposit() public payable {
        balanceOf[msg.sender] += msg.value;
        emit Deposit(msg.sender, msg.value);
    }

    function withdraw(uint wad) public {
        require(balanceOf[msg.sender] >= wad);
        balanceOf[msg.sender] -= wad;
        payable(msg.sender).transfer(wad);
        emit Withdrawal(msg.sender, wad);
    }

    function totalSupply() public view returns (uint) {
        return address(this).balance;
    }

    function approve(address guy, uint wad) public returns (bool) {
        allowance[msg.sender][guy] = wad;
        emit Approval(msg.sender, guy, wad);
        return true;
    }

    function transfer(address dst, uint wad) public returns (bool) {
        return transferFrom(msg.sender, dst, wad);
    }

    function transferFrom(address src, address dst, uint wad) public returns (bool) {
        require(balanceOf[src] >= wad);

        if (src != msg.sender && allowance[src][msg.sender] != type(uint).max) {
            require(allowance[src][msg.sender] >= wad);
            allowance[src][msg.sender] -= wad;
        }

        balanceOf[src] -= wad;
        balanceOf[dst] += wad;

        emit Transfer(src, dst, wad);

        return true;
    }
} 