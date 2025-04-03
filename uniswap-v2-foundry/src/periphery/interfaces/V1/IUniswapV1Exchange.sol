// SPDX-License-Identifier: MIT
pragma solidity >=0.5.0;

interface IUniswapV1Exchange {
    function balanceOf(address owner) external view returns (uint);
    function transferFrom(address from, address to, uint value) external returns (bool);
    function removeLiquidity(uint liquidity, uint amountTokenMin, uint amountETHMin, uint deadline) external returns (uint amountETH, uint amountToken);
    function tokenToEthSwapInput(uint, uint, uint) external returns (uint);
    function ethToTokenSwapInput(uint, uint) external payable returns (uint);
}
