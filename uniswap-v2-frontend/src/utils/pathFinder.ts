import { ethers } from 'ethers';
import { Token } from './tokens';
import { FACTORY_ADDRESS, TEST_TOKENS } from '../constants/addresses';
import { FACTORY_ABI } from '../constants/abis/factory';
import { PAIR_ABI } from '../constants/abis/pair';

interface PathNode {
  token: Token;
  pairs: string[];
  path: Token[];
}

export async function findBestPath(
  tokenIn: Token,
  tokenOut: Token,
  provider: ethers.providers.Provider,
  maxHops: number = 3
): Promise<Token[]> {
  const factoryContract = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);
  const visited = new Set<string>();
  const queue: PathNode[] = [{
    token: tokenIn,
    pairs: [],
    path: [tokenIn]
  }];
  
  const bestPathByToken = new Map<string, Token[]>();
  bestPathByToken.set(tokenIn.address.toLowerCase(), [tokenIn]);

  while (queue.length > 0) {
    const { token, pairs, path } = queue.shift()!;
    
    if (path.length > maxHops + 1) continue;
    
    // Check if we found a path to tokenOut
    if (token.address.toLowerCase() === tokenOut.address.toLowerCase()) {
      return path;
    }

    // Skip if we've visited this token through a shorter or equal path
    const tokenKey = token.address.toLowerCase();
    if (visited.has(tokenKey)) continue;
    visited.add(tokenKey);

    // Find all pairs that include the current token
    for (const t of TEST_TOKENS) {
      if (t.address.toLowerCase() === token.address.toLowerCase()) continue;
      
      try {
        const pair = await factoryContract.getPair(token.address, t.address);
        if (pair === ethers.constants.AddressZero) continue;
        
        // Check if pair has liquidity
        const pairContract = new ethers.Contract(pair, PAIR_ABI, provider);
        const [reserve0, reserve1] = await pairContract.getReserves();
        if (reserve0.isZero() || reserve1.isZero()) continue;

        // Add to queue if we haven't processed this pair
        if (!pairs.includes(pair.toLowerCase())) {
          queue.push({
            token: t,
            pairs: [...pairs, pair.toLowerCase()],
            path: [...path, t]
          });
        }
      } catch (error) {
        console.error('Error checking pair:', error);
      }
    }
  }

  // If no path found, return direct path (might not exist)
  return [tokenIn, tokenOut];
}

// Get amounts for a path
export async function getAmountsForPath(
  amountIn: ethers.BigNumber,
  path: Token[],
  provider: ethers.providers.Provider
): Promise<ethers.BigNumber[]> {
  const factoryContract = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);
  const amounts: ethers.BigNumber[] = [amountIn];
  
  for (let i = 0; i < path.length - 1; i++) {
    const pair = await factoryContract.getPair(path[i].address, path[i + 1].address);
    const pairContract = new ethers.Contract(pair, PAIR_ABI, provider);
    const [reserve0, reserve1] = await pairContract.getReserves();
    const [token0] = await Promise.all([pairContract.token0()]);
    
    const [reserveIn, reserveOut] = path[i].address.toLowerCase() === token0.toLowerCase() 
      ? [reserve0, reserve1] 
      : [reserve1, reserve0];
    
    // Calculate output amount using the constant product formula
    const amountInWithFee = amounts[i].mul(997);
    const numerator = amountInWithFee.mul(reserveOut);
    const denominator = reserveIn.mul(1000).add(amountInWithFee);
    const amountOut = numerator.div(denominator);
    
    amounts.push(amountOut);
  }
  
  return amounts;
}

export async function calculateMultiHopPriceImpact(
  path: string[],
  amountIn: ethers.BigNumber,
  amountOut: ethers.BigNumber,
  provider: ethers.providers.Provider
): Promise<number> {
  try {
    // Get mid price for the path without impact
    const midPrice = await getMidPriceForPath(path, provider);
    const expectedAmountOut = amountIn.mul(midPrice).div(ethers.constants.WeiPerEther);
    
    // Calculate price impact as percentage difference between expected and actual output
    const impact = expectedAmountOut.sub(amountOut).mul(10000).div(expectedAmountOut);
    return impact.toNumber() / 100; // Convert to percentage
  } catch (error) {
    console.error('Error calculating price impact:', error);
    return 0;
  }
}

async function getMidPriceForPath(
  path: string[],
  provider: ethers.providers.Provider
): Promise<ethers.BigNumber> {
  let price = ethers.constants.WeiPerEther; // Start with 1e18 as base
  
  // For each pair in the path
  for (let i = 0; i < path.length - 1; i++) {
    const token0 = path[i];
    const token1 = path[i + 1];
    const pair = await getPairContract(token0, token1, provider);
    const [reserve0, reserve1] = await pair.getReserves();
    
    // Calculate spot price for this pair
    const spotPrice = token0.toLowerCase() < token1.toLowerCase()
      ? reserve1.mul(ethers.constants.WeiPerEther).div(reserve0)
      : reserve0.mul(ethers.constants.WeiPerEther).div(reserve1);
    
    // Multiply running price by this pair's price
    price = price.mul(spotPrice).div(ethers.constants.WeiPerEther);
  }
  
  return price;
}

async function getPairContract(
  token0: string,
  token1: string,
  provider: ethers.providers.Provider
): Promise<ethers.Contract> {
  const factoryContract = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);
  const pairAddress = await factoryContract.getPair(token0, token1);
  return new ethers.Contract(pairAddress, PAIR_ABI, provider);
} 