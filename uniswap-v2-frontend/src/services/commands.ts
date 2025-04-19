import { ethers } from 'ethers';
import { useWeb3Context } from '../context/Web3Context';
import { Token, parseAmount } from '../utils/tokens';
import { TEST_TOKENS, WETH_ADDRESS } from '../constants/addresses';
import { findBestPath } from '../utils/pathFinder';

// Helper function to find token by symbol
const findTokenBySymbol = (symbol: string): Token | null => {
  const upperSymbol = symbol.toUpperCase();
  return TEST_TOKENS.find(token => token.symbol.toUpperCase() === upperSymbol) || null;
};

// Helper function to get gas settings
const getGasSettings = (isEstimationFailed = false) => {
  return {
    gasLimit: isEstimationFailed ? 1000000 : 500000,
    gasPrice: ethers.utils.parseUnits(isEstimationFailed ? "150" : "100", "gwei")
  };
};

export interface CommandExecutor {
  swapTokens: (params: {
    amount: string;
    tokenIn: string;
    tokenOut: string;
    exactType: 'input' | 'output';
  }) => Promise<{
    success: boolean;
    error?: string;
    txHash?: string;
  }>;
  
  addLiquidity: (params: {
    token0: string;
    token1: string;
    amount0: string;
    amount1?: string; // Optional - if not provided, will calculate optimal amount
  }) => Promise<{
    success: boolean;
    error?: string;
    txHash?: string;
    optimalAmount?: string;
  }>;

  removeLiquidity: (params: {
    token0: string;
    token1: string;
    lpTokenAmount: string;
  }) => Promise<{
    success: boolean;
    error?: string;
    txHash?: string;
  }>;
  
  getPoolReserves: (params: {
    token0: string;
    token1: string;
  }) => Promise<{
    success: boolean;
    error?: string;
    reserves?: {
      token0Amount: string;
      token1Amount: string;
    };
  }>;
  
  getSwapCount: (params: { 
    token0?: string;
    token1?: string;
    timeframe: string;
  }) => Promise<{
    success: boolean;
    error?: string;
    count?: number;
  }>;
}

export const createCommandExecutor = (
  account: string | null,
  routerContract: ethers.Contract | null,
  provider: ethers.providers.Provider | null,
  signer: ethers.Signer | null
): CommandExecutor => {
  const executeSwap = async (params: {
    amount: string;
    tokenIn: string;
    tokenOut: string;
    exactType: 'input' | 'output';
  }) => {
    try {
      if (!account || !routerContract || !provider || !signer) {
        return {
          success: false,
          error: 'Wallet not connected'
        };
      }

      // Find tokens
      const tokenIn = findTokenBySymbol(params.tokenIn);
      const tokenOut = findTokenBySymbol(params.tokenOut);

      if (!tokenIn || !tokenOut) {
        return {
          success: false,
          error: 'Invalid token symbols'
        };
      }

      const isExactInput = params.exactType === 'input';
      const amount = parseAmount(params.amount, isExactInput ? tokenIn.decimals : tokenOut.decimals);
      
      // Find best path
      const path = await findBestPath(tokenIn, tokenOut, provider);
      const pathAddresses = path.map(token => 
        token.address === "ETH" ? WETH_ADDRESS : token.address
      );

      // Get amounts for slippage calculation
      let amountIn, amountInMax, amountOut, amountOutMin;
      if (isExactInput) {
        const amounts = await routerContract.getAmountsOut(amount, pathAddresses);
        amountIn = amount;
        amountOutMin = amounts[amounts.length - 1].mul(95).div(100); // 5% slippage
      } else {
        const amounts = await routerContract.getAmountsIn(amount, pathAddresses);
        amountOut = amount;
        amountInMax = amounts[0].mul(105).div(100); // 5% slippage
      }

      // Setup transaction parameters
      const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes
      let overrides = getGasSettings();

      // Check approval if not ETH
      const isEthIn = tokenIn.address === "ETH";
      if (!isEthIn) {
        const tokenContract = new ethers.Contract(
          tokenIn.address,
          ['function allowance(address,address) view returns (uint256)'],
          signer
        );
        const allowance = await tokenContract.allowance(account, routerContract.address);
        const requiredAmount = isExactInput ? amountIn : amountInMax;
        if (allowance.lt(requiredAmount)) {
          // Approve
          const erc20Contract = new ethers.Contract(
            tokenIn.address,
            ['function approve(address spender, uint256 amount) returns (bool)'],
            signer
          );
          const approveTx = await erc20Contract.approve(
            routerContract.address,
            ethers.constants.MaxUint256
          );
          await approveTx.wait();
        }
      }

      // Execute swap
      const isEthOut = tokenOut.address === "ETH";
      let tx;

      if (isExactInput) {
        // Exact input swaps
        if (isEthIn) {
          tx = await routerContract.swapExactETHForTokensSupportingFeeOnTransferTokens(
            amountOutMin,
            pathAddresses,
            account,
            deadline,
            { 
              ...overrides,
              value: amountIn 
            }
          );
        } else if (isEthOut) {
          tx = await routerContract.swapExactTokensForETHSupportingFeeOnTransferTokens(
            amountIn,
            amountOutMin,
            pathAddresses,
            account,
            deadline,
            overrides
          );
        } else {
          tx = await routerContract.swapExactTokensForTokensSupportingFeeOnTransferTokens(
            amountIn,
            amountOutMin,
            pathAddresses,
            account,
            deadline,
            overrides
          );
        }
      } else {
        // Exact output swaps
        if (isEthIn) {
          tx = await routerContract.swapETHForExactTokens(
            amountOut,
            pathAddresses,
            account,
            deadline,
            { 
              ...overrides,
              value: amountInMax 
            }
          );
        } else if (isEthOut) {
          tx = await routerContract.swapTokensForExactETH(
            amountOut,
            amountInMax,
            pathAddresses,
            account,
            deadline,
            overrides
          );
        } else {
          tx = await routerContract.swapTokensForExactTokens(
            amountOut,
            amountInMax,
            pathAddresses,
            account,
            deadline,
            overrides
          );
        }
      }

      const receipt = await tx.wait();

      return {
        success: true,
        txHash: receipt.transactionHash
      };

    } catch (error: any) {
      console.error('Swap execution error:', error);
      return {
        success: false,
        error: error.message || 'Failed to execute swap'
      };
    }
  };

  const getPoolReserves = async (params: { token0: string; token1: string }) => {
    try {
      if (!provider) {
        return {
          success: false,
          error: 'Provider not available'
        };
      }

      const token0 = findTokenBySymbol(params.token0);
      const token1 = findTokenBySymbol(params.token1);

      if (!token0 || !token1) {
        return {
          success: false,
          error: 'Invalid token symbols'
        };
      }

      // Get factory contract
      const factoryContract = new ethers.Contract(
        routerContract?.factory(),
        ['function getPair(address,address) view returns (address)'],
        provider
      );

      // Get pair address
      const pairAddress = await factoryContract.getPair(token0.address, token1.address);
      
      if (pairAddress === ethers.constants.AddressZero) {
        return {
          success: false,
          error: 'Pool does not exist'
        };
      }

      // Get pair contract
      const pairContract = new ethers.Contract(
        pairAddress,
        [
          'function getReserves() view returns (uint112,uint112,uint32)',
          'function token0() view returns (address)',
          'function token1() view returns (address)'
        ],
        provider
      );

      const [reserve0, reserve1] = await pairContract.getReserves();
      const actualToken0 = await pairContract.token0();

      // Make sure reserves match the token order in the query
      const [token0Reserve, token1Reserve] = 
        token0.address.toLowerCase() === actualToken0.toLowerCase()
          ? [reserve0, reserve1]
          : [reserve1, reserve0];

      return {
        success: true,
        reserves: {
          token0Amount: ethers.utils.formatUnits(token0Reserve, token0.decimals),
          token1Amount: ethers.utils.formatUnits(token1Reserve, token1.decimals)
        }
      };

    } catch (error: any) {
      console.error('Get reserves error:', error);
      return {
        success: false,
        error: error.message || 'Failed to get pool reserves'
      };
    }
  };

  const getSwapCount = async (params: { 
    token0?: string;
    token1?: string;
    timeframe: string;
  }) => {
    try {
      if (!provider || !routerContract) {
        return {
          success: false,
          error: 'Provider not available'
        };
      }

      // Get factory contract
      const factoryContract = new ethers.Contract(
        await routerContract.factory(),
        [
          'function getPair(address,address) view returns (address)',
          'function allPairs(uint) view returns (address)',
          'function allPairsLength() view returns (uint)'
        ],
        provider
      );

      const swapTopic = ethers.utils.id("Swap(address,uint256,uint256,uint256,uint256,address)");

      // If specific tokens are provided, get swaps for that pool only
      if (params.token0 && params.token1) {
        const token0 = findTokenBySymbol(params.token0);
        const token1 = findTokenBySymbol(params.token1);

        if (!token0 || !token1) {
          return {
            success: false,
            error: 'Invalid token symbols'
          };
        }

        const pairAddress = await factoryContract.getPair(
          token0.address === 'ETH' ? WETH_ADDRESS : token0.address,
          token1.address === 'ETH' ? WETH_ADDRESS : token1.address
        );

        if (pairAddress === ethers.constants.AddressZero) {
          return {
            success: false,
            error: 'Pool does not exist'
          };
        }

        // Get latest block for reference
        const latestBlock = await provider.getBlock('latest');
        let fromBlock;

        // Use simpler block-based filtering
        switch (params.timeframe) {
          case 'today':
            // Approximately last 6500 blocks (24 hours)
            fromBlock = Math.max(0, latestBlock.number - 6500);
            break;
          case 'this week':
            // Last 45500 blocks (7 days)
            fromBlock = Math.max(0, latestBlock.number - 45500);
            break;
          case 'this month':
            // Last 195000 blocks (30 days)
            fromBlock = Math.max(0, latestBlock.number - 195000);
            break;
          case 'all time':
            fromBlock = 0;
            break;
          default:
            fromBlock = Math.max(0, latestBlock.number - 6500); // Default to 24 hours
        }

        const logs = await provider.getLogs({
          address: pairAddress,
          topics: [swapTopic],
          fromBlock,
          toBlock: 'latest'
        });

        return {
          success: true,
          count: logs.length
        };
      }
      
      // If no specific tokens provided, count swaps across recent pools
      let totalSwaps = 0;
      const pairsLength = await factoryContract.allPairsLength();
      
      // Get latest block for reference
      const latestBlock = await provider.getBlock('latest');
      let fromBlock;

      // Use simpler block-based filtering
      switch (params.timeframe) {
        case 'today':
          fromBlock = Math.max(0, latestBlock.number - 6500);
          break;
        case 'this week':
          fromBlock = Math.max(0, latestBlock.number - 45500);
          break;
        case 'this month':
          fromBlock = Math.max(0, latestBlock.number - 195000);
          break;
        case 'all time':
          fromBlock = 0;
          break;
        default:
          fromBlock = Math.max(0, latestBlock.number - 6500);
      }

      // Only look at the most recent pools for better performance
      const poolsToCheck = Math.min(10, pairsLength.toNumber());
      
      for (let i = 0; i < poolsToCheck; i++) {
        try {
          const pairAddress = await factoryContract.allPairs(i);
          const logs = await provider.getLogs({
            address: pairAddress,
            topics: [swapTopic],
            fromBlock,
            toBlock: 'latest'
          });
          totalSwaps += logs.length;
        } catch (e) {
          console.error(`Error getting swaps for pair ${i}:`, e);
        }
      }

      return {
        success: true,
        count: totalSwaps
      };

    } catch (error: any) {
      console.error('Get swap count error:', error);
      return {
        success: false,
        error: error.message || 'Failed to get swap count'
      };
    }
  };

  const addLiquidity = async (params: {
    token0: string;
    token1: string;
    amount0: string;
    amount1?: string;
  }) => {
    try {
      if (!account || !routerContract || !provider || !signer) {
        return {
          success: false,
          error: 'Wallet not connected'
        };
      }

      // Find tokens
      const token0 = findTokenBySymbol(params.token0);
      const token1 = findTokenBySymbol(params.token1);

      if (!token0 || !token1) {
        return {
          success: false,
          error: 'Invalid token symbols'
        };
      }

      // Parse first amount
      const amount0 = parseAmount(params.amount0, token0.decimals);
      
      let amount1: ethers.BigNumber;
      
      // If amount1 not provided, calculate optimal amount based on reserves
      if (!params.amount1) {
        const reserves = await getPoolReserves({ 
          token0: params.token0, 
          token1: params.token1 
        });
        
        if (reserves.success && reserves.reserves) {
          const reserve0 = parseAmount(reserves.reserves.token0Amount, token0.decimals);
          const reserve1 = parseAmount(reserves.reserves.token1Amount, token1.decimals);
          amount1 = amount0.mul(reserve1).div(reserve0);
        } else {
          // New pool - user must specify both amounts
          return {
            success: false,
            error: 'For new pools, both token amounts must be specified'
          };
        }
      } else {
        amount1 = parseAmount(params.amount1, token1.decimals);
      }

      // Calculate minimum amounts (1% slippage tolerance)
      const amount0Min = amount0.mul(99).div(100);
      const amount1Min = amount1.mul(99).div(100);

      // Setup transaction parameters
      const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes
      let overrides = getGasSettings();

      // Check approvals
      const isEth0 = token0.address === "ETH";
      const isEth1 = token1.address === "ETH";

      if (!isEth0) {
        const token0Contract = new ethers.Contract(
          token0.address,
          ['function allowance(address,address) view returns (uint256)'],
          signer
        );
        const allowance0 = await token0Contract.allowance(account, routerContract.address);
        if (allowance0.lt(amount0)) {
          const erc20Contract = new ethers.Contract(
            token0.address,
            ['function approve(address spender, uint256 amount) returns (bool)'],
            signer
          );
          const approveTx = await erc20Contract.approve(
            routerContract.address,
            ethers.constants.MaxUint256
          );
          await approveTx.wait();
        }
      }

      if (!isEth1) {
        const token1Contract = new ethers.Contract(
          token1.address,
          ['function allowance(address,address) view returns (uint256)'],
          signer
        );
        const allowance1 = await token1Contract.allowance(account, routerContract.address);
        if (allowance1.lt(amount1)) {
          const erc20Contract = new ethers.Contract(
            token1.address,
            ['function approve(address spender, uint256 amount) returns (bool)'],
            signer
          );
          const approveTx = await erc20Contract.approve(
            routerContract.address,
            ethers.constants.MaxUint256
          );
          await approveTx.wait();
        }
      }

      // Execute add liquidity
      let tx;
      if (isEth0 || isEth1) {
        const ethAmount = isEth0 ? amount0 : amount1;
        const tokenAmount = isEth0 ? amount1 : amount0;
        const tokenAddress = isEth0 ? token1.address : token0.address;
        const ethMin = isEth0 ? amount0Min : amount1Min;
        const tokenMin = isEth0 ? amount1Min : amount0Min;

        tx = await routerContract.addLiquidityETH(
          tokenAddress,
          tokenAmount,
          tokenMin,
          ethMin,
          account,
          deadline,
          {
            ...overrides,
            value: ethAmount
          }
        );
      } else {
        tx = await routerContract.addLiquidity(
          token0.address,
          token1.address,
          amount0,
          amount1,
          amount0Min,
          amount1Min,
          account,
          deadline,
          overrides
        );
      }

      const receipt = await tx.wait();

      return {
        success: true,
        txHash: receipt.transactionHash,
        optimalAmount: params.amount1 ? undefined : ethers.utils.formatUnits(amount1, token1.decimals)
      };

    } catch (error: any) {
      console.error('Add liquidity error:', error);
      return {
        success: false,
        error: error.message || 'Failed to add liquidity'
      };
    }
  };

  const removeLiquidity = async (params: {
    token0: string;
    token1: string;
    lpTokenAmount: string;
  }) => {
    try {
      if (!account || !routerContract || !provider || !signer) {
        return {
          success: false,
          error: 'Wallet not connected'
        };
      }

      // Find tokens
      const token0 = findTokenBySymbol(params.token0);
      const token1 = findTokenBySymbol(params.token1);

      if (!token0 || !token1) {
        return {
          success: false,
          error: 'Invalid token symbols'
        };
      }

      // Get pair contract
      const factoryContract = new ethers.Contract(
        await routerContract.factory(),
        ['function getPair(address,address) view returns (address)'],
        provider
      );
      const pairAddress = await factoryContract.getPair(token0.address, token1.address);
      
      if (pairAddress === ethers.constants.AddressZero) {
        return {
          success: false,
          error: 'Pool does not exist'
        };
      }

      // Parse LP token amount and get LP token contract with full ERC20 interface
      const lpTokenContract = new ethers.Contract(
        pairAddress,
        [
          'function decimals() view returns (uint8)',
          'function totalSupply() view returns (uint256)',
          'function balanceOf(address) view returns (uint256)',
          'function allowance(address,address) view returns (uint256)',
          'function approve(address spender, uint256 amount) returns (bool)'
        ],
        signer // Note: Changed from provider to signer since we need to call approve
      );
      const lpDecimals = await lpTokenContract.decimals();
      const liquidity = parseAmount(params.lpTokenAmount, lpDecimals);

      // Check LP token balance
      const lpBalance = await lpTokenContract.balanceOf(account);
      if (lpBalance.lt(liquidity)) {
        return {
          success: false,
          error: 'Insufficient LP token balance'
        };
      }

      // Approve LP tokens if needed
      const allowance = await lpTokenContract.allowance(account, routerContract.address);
      if (allowance.lt(liquidity)) {
        const approveTx = await lpTokenContract.approve(
          routerContract.address,
          ethers.constants.MaxUint256
        );
        await approveTx.wait();
      }

      // Calculate minimum amounts (1% slippage tolerance)
      const totalSupply = await lpTokenContract.totalSupply();
      const reserves = await getPoolReserves({ token0: params.token0, token1: params.token1 });
      
      if (!reserves.success || !reserves.reserves) {
        return {
          success: false,
          error: 'Failed to get pool reserves'
        };
      }

      const reserve0 = parseAmount(reserves.reserves.token0Amount, token0.decimals);
      const reserve1 = parseAmount(reserves.reserves.token1Amount, token1.decimals);
      
      const amount0Min = reserve0.mul(liquidity).div(totalSupply).mul(99).div(100);
      const amount1Min = reserve1.mul(liquidity).div(totalSupply).mul(99).div(100);

      // Setup transaction parameters
      const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes
      let overrides = getGasSettings();

      // Execute remove liquidity
      let tx;
      const isEth0 = token0.address === "ETH";
      const isEth1 = token1.address === "ETH";

      if (isEth0 || isEth1) {
        const tokenAddress = isEth0 ? token1.address : token0.address;
        const tokenAmountMin = isEth0 ? amount1Min : amount0Min;
        const ethAmountMin = isEth0 ? amount0Min : amount1Min;

        tx = await routerContract.removeLiquidityETH(
          tokenAddress,
          liquidity,
          tokenAmountMin,
          ethAmountMin,
          account,
          deadline,
          overrides
        );
      } else {
        tx = await routerContract.removeLiquidity(
          token0.address,
          token1.address,
          liquidity,
          amount0Min,
          amount1Min,
          account,
          deadline,
          overrides
        );
      }

      const receipt = await tx.wait();

      return {
        success: true,
        txHash: receipt.transactionHash
      };

    } catch (error: any) {
      console.error('Remove liquidity error:', error);
      return {
        success: false,
        error: error.message || 'Failed to remove liquidity'
      };
    }
  };

  return {
    swapTokens: executeSwap,
    getPoolReserves,
    getSwapCount,
    addLiquidity,
    removeLiquidity
  };
}; 