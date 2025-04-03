// SPDX-License-Identifier: MIT
pragma solidity 0.8.29;

import './ERC20.sol';

contract DeflatingERC20 is ERC20 {
    constructor(uint _totalSupply) ERC20(_totalSupply) {}

    function transfer(address to, uint value) public override returns (bool) {
        uint256 deflatingAmount = value / 100;
        uint256 transferAmount = value - deflatingAmount;
        return super.transfer(to, transferAmount);
    }

    function transferFrom(address from, address to, uint value) public override returns (bool) {
        uint256 deflatingAmount = value / 100;
        uint256 transferAmount = value - deflatingAmount;
        return super.transferFrom(from, to, transferAmount);
    }
}
