import { ethers } from 'ethers';

export interface Token {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI: string;
}

export const formatAmount = (
  amount: string | number,
  decimals: number = 18,
  displayDecimals: number = 6
): string => {
  const formattedAmount = ethers.utils.formatUnits(
    typeof amount === 'string' ? amount : amount.toString(),
    decimals
  );
  
  const parts = formattedAmount.split('.');
  if (parts.length === 1) return parts[0];
  
  const integerPart = parts[0];
  const decimalPart = parts[1].slice(0, displayDecimals);
  
  return `${integerPart}${decimalPart ? '.' + decimalPart : ''}`;
};

export const parseAmount = (
  amount: string,
  decimals: number = 18
): ethers.BigNumber => {
  try {
    return ethers.utils.parseUnits(amount || '0', decimals);
  } catch (error) {
    console.error('Error parsing amount:', error);
    return ethers.BigNumber.from(0);
  }
};

export const truncateAddress = (address: string, start: number = 6, end: number = 4): string => {
  if (!address) return '';
  if (address.length <= start + end) return address;
  return `${address.slice(0, start)}...${address.slice(-end)}`;
};

export const sortTokens = (tokenA: string, tokenB: string): [string, string] => {
  return tokenA.toLowerCase() < tokenB.toLowerCase()
    ? [tokenA, tokenB]
    : [tokenB, tokenA];
};

export const calculatePriceImpact = (
  inputAmount: ethers.BigNumber,
  outputAmount: ethers.BigNumber,
  reserveIn: ethers.BigNumber,
  reserveOut: ethers.BigNumber
): number => {
  if (inputAmount.isZero() || outputAmount.isZero() || reserveIn.isZero() || reserveOut.isZero()) {
    return 0;
  }

  // Calculate the spot price
  const spotPrice = reserveIn.mul(ethers.utils.parseUnits('1', 18)).div(reserveOut);
  
  // Calculate execution price
  const executionPrice = inputAmount.mul(ethers.utils.parseUnits('1', 18)).div(outputAmount);
  
  // Calculate price impact as a percentage
  const priceImpact = executionPrice.sub(spotPrice).mul(10000).div(spotPrice).toNumber() / 100;
  
  return priceImpact;
}; 