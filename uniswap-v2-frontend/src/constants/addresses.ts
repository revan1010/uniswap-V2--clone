import { Token } from '../utils/tokens';

// Tenderly Mainnet Fork addresses
export const FACTORY_ADDRESS = '0x5818d74896686365a802978A764738dE4F61Aa2d';
export const ROUTER_ADDRESS = '0x6F97623d5971C1Ac431f12bF9A196dC618f70Ba7';
export const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';

// Tenderly Mainnet RPC URL
export const RPC_URL = 'https://virtual.mainnet.rpc.tenderly.co/fa02c8a1-8a8b-4d14-b568-1b73006cbea8';

// Test tokens to display in the UI
export const TEST_TOKENS: Token[] = [
  {
    symbol: 'ETH',
    name: 'Ethereum',
    address: 'ETH',
    decimals: 18,
    logoURI: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png'
  },
  {
    symbol: 'WETH',
    name: 'Wrapped Ether',
    address: WETH_ADDRESS,
    decimals: 18,
    logoURI: 'https://assets.coingecko.com/coins/images/2518/small/weth.png'
  },
  {
    symbol: 'SUSHI',
    name: 'SushiToken',
    address: '0x6B3595068778DD592e39A122f4f5a5cF09C90fE2',
    decimals: 18,
    logoURI: 'https://assets.coingecko.com/coins/images/12271/small/512x512_Logo_no_chop.png'
  },
  // Add some popular mainnet tokens (since we're using a mainnet fork)
  {
    symbol: 'USDC',
    name: 'USD Coin',
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    decimals: 6,
    logoURI: 'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png'
  },
  {
    symbol: 'USDT',
    name: 'Tether USD',
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    decimals: 6,
    logoURI: 'https://assets.coingecko.com/coins/images/325/small/Tether.png'
  },
  {
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    decimals: 18,
    logoURI: 'https://assets.coingecko.com/coins/images/9956/small/dai-multi-collateral-mcd.png'
  },
  {
    symbol: 'UNI',
    name: 'Uniswap',
    address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
    decimals: 18,
    logoURI: 'https://assets.coingecko.com/coins/images/12504/small/uniswap-uni.png'
  },
  {
    symbol: 'LINK',
    name: 'Chainlink',
    address: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
    decimals: 18,
    logoURI: 'https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png'
  }
]; 