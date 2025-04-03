# Uniswap V2 Frontend - Troubleshooting Guide

## Issue: Error fetching token balance

If you're seeing 'Error fetching token balance' errors:

1. Verify you're on the Holesky testnet in MetaMask
2. Check that your WETH_ADDRESS is correct
3. Use only ETH and WETH for testing initially

## Adding Liquidity Process:

1. Connect your wallet
2. Select Token A (e.g., ETH)
3. Select Token B (e.g., WETH)
4. Enter amounts
5. Click 'Add Liquidity'

## Common Issues:

- ENS errors: Fixed by providing explicit network details
- Contract call errors: Usually means incorrect contract addresses
- 'No token selected' error: Make sure you click on a token in the dropdown

## Testing Tips:

- Get some Holesky ETH from a faucet
- Wrap some ETH to WETH by using the official WETH contract
- Start with small amounts for testing 