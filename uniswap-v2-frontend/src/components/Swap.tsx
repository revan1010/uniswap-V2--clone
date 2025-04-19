import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWeb3Context } from '../context/Web3Context';
import TokenSelector from './TokenSelector';
import { Token, parseAmount, formatAmount } from '../utils/tokens';
import { usePair } from '../hooks/usePair';
import { TEST_TOKENS, WETH_ADDRESS } from '../constants/addresses';
import { useTokenBalance } from '../hooks/useTokenBalance';
import { ReservesCurve } from './ReservesCurve';
import { PriceDistributionChart } from './PriceDistributionChart';
import { SwapRoute } from './SwapRoute';
import { findBestPath, getAmountsForPath, calculateMultiHopPriceImpact } from '../utils/pathFinder';
import { SwapPriceDistribution } from './SwapPriceDistribution';

// Add a utility function at the top of the file to help with gas estimation
const getGasSettings = (isEstimationFailed = false) => {
  return {
    gasLimit: isEstimationFailed ? 1000000 : 500000, // Increased gas limits
    gasPrice: ethers.utils.parseUnits(isEstimationFailed ? "150" : "100", "gwei")
  };
};

export const Swap: React.FC = () => {
  const { account, routerContract, isConnected, signer, provider, connectWallet } = useWeb3Context();
  const [tokenIn, setTokenIn] = useState<Token | null>(null);
  const [tokenOut, setTokenOut] = useState<Token | null>(null);
  const [inputAmount, setInputAmount] = useState('');
  const [outputAmount, setOutputAmount] = useState('');
  const [swapDirection, setSwapDirection] = useState<'exactIn' | 'exactOut'>('exactIn');
  const [isApproving, setIsApproving] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [swapStatus, setSwapStatus] = useState<'idle' | 'approving' | 'estimating' | 'retrying' | 'swapping' | 'success'>('idle');
  const [priceImpact, setPriceImpact] = useState<number | null>(null);

  // Add manual update flags to prevent unwanted state resets
  const [manualInputUpdate, setManualInputUpdate] = useState(false);
  const [manualOutputUpdate, setManualOutputUpdate] = useState(false);

  // Get pair information if both tokens are selected
  const { pair, exists: pairExists } = usePair(
    tokenIn?.address || '',
    tokenOut?.address || ''
  );

  // Get token balances
  const { balance: balanceIn } = useTokenBalance(tokenIn?.address || null);
  const { balance: balanceOut } = useTokenBalance(tokenOut?.address || null);

  // Initialize with some test tokens
  useEffect(() => {
    if (TEST_TOKENS.length >= 2) {
      setTokenIn(TEST_TOKENS[0]);
      setTokenOut(TEST_TOKENS[1]);
    }
  }, []);

  // Debug log when tokens or pair changes
  useEffect(() => {
    console.log("Token or pair state changed:", {
      tokenIn: tokenIn?.address,
      tokenOut: tokenOut?.address,
      pairExists,
      pairAddress: pair?.address,
      reserves: pair ? {
        reserve0: pair.reserves.reserve0.toString(),
        reserve1: pair.reserves.reserve1.toString()
      } : null
    });
  }, [tokenIn, tokenOut, pair, pairExists]);

  const switchTokens = () => {
    setTokenIn(tokenOut);
    setTokenOut(tokenIn);
    setInputAmount(outputAmount);
    setOutputAmount(inputAmount);
    setSwapDirection(swapDirection === 'exactIn' ? 'exactOut' : 'exactIn');
  };

  const calculateOutput = useCallback(async () => {
    if (
      !routerContract ||
      !tokenIn ||
      !tokenOut ||
      !inputAmount ||
      inputAmount === '0' ||
      !provider
    ) {
      if (manualOutputUpdate || inputAmount === '') {
        return;
      }
      setOutputAmount('');
      return;
    }

    try {
      const amountIn = parseAmount(inputAmount, tokenIn.decimals);
      
      // Find the best path
      const path = await findBestPath(tokenIn, tokenOut, provider);
      setCurrentPath(path);
      
      // Get amounts for the path using router contract
      const pathAddresses = path.map(token => 
        token.address === "ETH" ? WETH_ADDRESS : token.address
      );
      
      const amounts = await routerContract.getAmountsOut(amountIn, pathAddresses);
      const amountOut = amounts[amounts.length - 1];
      
      // Format the output amount
      const formattedOutput = formatAmount(amountOut.toString(), tokenOut.decimals);
      setOutputAmount(formattedOutput);
      
      // Set formatted amounts for display with proper TypeScript types
      const formattedAmounts = amounts.map((amount: ethers.BigNumber, index: number) => 
        formatAmount(amount.toString(), path[index].decimals)
      );
      setPathAmounts(formattedAmounts);
      
      // Calculate price impact
      const impact = await calculateMultiHopPriceImpact(pathAddresses, amountIn, amountOut, provider);
      setPriceImpact(impact);

      // Debug log
      console.log('Swap calculation:', {
        inputAmount,
        amountIn: amountIn.toString(),
        amountOut: amountOut.toString(),
        formattedOutput,
        impact
      });
    } catch (error) {
      console.error('Error calculating output:', error);
      setOutputAmount('');
    }
  }, [routerContract, tokenIn, tokenOut, inputAmount, provider, manualOutputUpdate]);

  const calculateInput = useCallback(async () => {
    if (
      !routerContract ||
      !tokenIn ||
      !tokenOut ||
      !outputAmount ||
      outputAmount === '0' ||
      !pairExists
    ) {
      // Don't reset inputAmount if we're not explicitly calculating
      if (manualInputUpdate || outputAmount === '') {
        return;
      }
      setInputAmount('');
      return;
    }

    // Skip calculation if the user is manually entering both values
    if (manualInputUpdate) {
      return;
    }

    try {
      const amountOut = parseAmount(outputAmount, tokenOut.decimals);
      
      // Get the input amount
      const path = [tokenIn.address, tokenOut.address];
      
      const amounts = await routerContract.getAmountsIn(amountOut, path);
      const amountIn = amounts[0];
      
      setInputAmount(formatAmount(amountIn.toString(), tokenIn.decimals));
      
      // Calculate price impact
      if (pair) {
        let reserve0 = pair.reserves.reserve0;
        let reserve1 = pair.reserves.reserve1;
        
        // Make sure reserves match the token order
        if (tokenIn.address.toLowerCase() !== pair.token0.address.toLowerCase()) {
          [reserve0, reserve1] = [reserve1, reserve0];
        }
        
        // Calculate price impact
        const impact = calculatePriceImpact(reserve0, reserve1, amountIn);
        setPriceImpact(impact);
      }
    } catch (error) {
      console.error('Error calculating input:', error);
      // Don't clear input if there's an error - keep existing value
    }
  }, [routerContract, tokenIn, tokenOut, outputAmount, pairExists, pair, manualInputUpdate]);

  // Calculate price impact
  const calculatePriceImpact = (reserveIn: ethers.BigNumber, reserveOut: ethers.BigNumber, amountIn: ethers.BigNumber): number => {
    // Using the constant product formula: x * y = k
    // Calculate the new reserves after the swap
    const amountInWithFee = amountIn.mul(997); // 0.3% fee
    const numerator = amountInWithFee.mul(reserveOut);
    const denominator = reserveIn.mul(1000).add(amountInWithFee);
    const newAmountOut = numerator.div(denominator);
    
    // Calculate spot price (price before swap)
    const spotPrice = reserveIn.mul(ethers.utils.parseUnits('1', 18)).div(reserveOut);
    
    // Calculate execution price (price including the swap)
    const executionPrice = amountIn.mul(ethers.utils.parseUnits('1', 18)).div(newAmountOut);
    
    // Calculate price impact as a percentage
    const impact = executionPrice.sub(spotPrice).mul(10000).div(spotPrice).toNumber() / 100;
    
    return impact;
  };

  // Effect to trigger calculation when values change
  useEffect(() => {
    // Only calculate if we have all necessary data
    if (tokenIn && tokenOut && pairExists) {
      if (swapDirection === 'exactIn' && inputAmount && !manualOutputUpdate) {
        calculateOutput();
      } else if (swapDirection === 'exactOut' && outputAmount && !manualInputUpdate) {
        calculateInput();
      }
    }
  }, [
    swapDirection, 
    calculateOutput, 
    calculateInput, 
    tokenIn, 
    tokenOut, 
    inputAmount, 
    outputAmount,
    pairExists,
    manualInputUpdate,
    manualOutputUpdate
  ]);

  // Reset manual flags when tokens change
  useEffect(() => {
    setManualInputUpdate(false);
    setManualOutputUpdate(false);
  }, [tokenIn, tokenOut]);

  const handleInputChange = (value: string) => {
    console.log("Input changed:", value);
    setInputAmount(value);
    setManualInputUpdate(false);
    setManualOutputUpdate(false);
    
    if (value) {
      setSwapDirection('exactIn');
    }
  };

  const handleOutputChange = (value: string) => {
    setOutputAmount(value);
    setManualInputUpdate(false);
    setManualOutputUpdate(false);
    
    if (value) {
      setSwapDirection('exactOut');
    }
  };

  const handleApprove = async () => {
    if (!tokenIn || !account || !routerContract || !signer) return;
    
    try {
      setIsApproving(true);
      setSwapStatus('approving');
      
      // Get ERC20 contract
      const erc20Contract = new ethers.Contract(
        tokenIn.address,
        [
          'function approve(address spender, uint256 amount) returns (bool)',
          'function allowance(address owner, address spender) view returns (uint256)'
        ],
        signer
      );
      
      // Approve
      const tx = await erc20Contract.approve(
        routerContract.address,
        ethers.constants.MaxUint256
      );
      
      await tx.wait();
      
    } catch (error) {
      console.error('Error approving token:', error);
    } finally {
      setIsApproving(false);
      setSwapStatus('idle');
    }
  };

  const handleSwap = async () => {
    if (!tokenIn || !tokenOut || !account) {
      console.log("Missing tokens or account", { tokenIn, tokenOut, account });
      return;
    }
    
    if (!routerContract || !provider) {
      console.log("Router contract is null - reconnecting wallet");
      alert("Connection to the network is not established. Please reconnect your wallet.");
      await connectWallet();
      return;
    }
    
    try {
      setIsSwapping(true);
      setSwapStatus('estimating');
      
      const isEthIn = tokenIn.address === "ETH";
      const isEthOut = tokenOut.address === "ETH";
      
      // Find the best path
      const path = await findBestPath(tokenIn, tokenOut, provider);
      const pathAddresses = path.map(token => 
        token.address === "ETH" ? WETH_ADDRESS : token.address
      );
      
      console.log("Swap function called:", swapDirection === 'exactIn' ? 'swapExactTokensForTokens' : 'swapTokensForExactTokens');
      
      // Parse amounts based on swap direction
      let amountIn, amountInMax, amountOut, amountOutMin;
      if (swapDirection === 'exactIn') {
        amountIn = parseAmount(inputAmount, tokenIn.decimals);
        amountOutMin = parseAmount(
          (parseFloat(outputAmount) * 0.95).toString(), // 5% slippage
          tokenOut.decimals
        );
      } else {
        amountOut = parseAmount(outputAmount, tokenOut.decimals);
        amountInMax = parseAmount(
          (parseFloat(inputAmount) * 1.05).toString(), // 5% slippage
          tokenIn.decimals
        );
      }
      
      console.log("Swap amounts:", {
        direction: swapDirection,
        amountIn: amountIn?.toString(),
        amountInMax: amountInMax?.toString(),
        amountOut: amountOut?.toString(),
        amountOutMin: amountOutMin?.toString()
      });

      // Get initial gas settings
      let overrides = getGasSettings();
      const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
      
      try {
        // Check approval first if not ETH
        if (!isEthIn && signer) {
          const tokenContract = new ethers.Contract(
            tokenIn.address,
            ['function allowance(address,address) view returns (uint256)'],
            signer
          );
          const allowance = await tokenContract.allowance(account, routerContract.address);
          const requiredAmount = swapDirection === 'exactIn' ? amountIn : amountInMax;
          if (allowance.lt(requiredAmount)) {
            await handleApprove();
          }
        }

        let tx;
        
        if (swapDirection === 'exactIn') {
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
        
        setSwapStatus('swapping');
        await tx.wait();
        setSwapStatus('success');
        
      } catch (error: any) {
        console.error("Swap error:", error);
        
        if (error.message.includes("gas") || error.message.includes("estimate")) {
          console.log("Retrying with higher gas...");
          setSwapStatus('retrying');
          
          // Retry with higher gas and 10% more slippage
          overrides = getGasSettings(true);
          
          if (swapDirection === 'exactIn') {
            if (!amountOutMin) return;
            const newAmountOutMin = amountOutMin.mul(90).div(100);
            if (isEthIn) {
              await routerContract.swapExactETHForTokensSupportingFeeOnTransferTokens(
                newAmountOutMin,
                pathAddresses,
                account,
                deadline,
                { 
                  ...overrides,
                  value: amountIn 
                }
              );
            }
          } else {
            if (!amountInMax || !amountOut) return;
            const newAmountInMax = amountInMax.mul(110).div(100);
            if (isEthIn) {
              await routerContract.swapETHForExactTokens(
                amountOut,
                pathAddresses,
                account,
                deadline,
                { 
                  ...overrides,
                  value: newAmountInMax 
                }
              );
            }
          }
          throw new Error("Please try again with a smaller amount or more slippage tolerance");
        } else if (error.message.includes("INSUFFICIENT_OUTPUT_AMOUNT")) {
          throw new Error("Price impact too high. Try a smaller trade size.");
        } else {
          throw error;
        }
      }
      
    } catch (error: any) {
      console.error("Final error:", error);
      alert(error.message || "Swap failed. Please try again with different parameters.");
      setSwapStatus('idle');
    } finally {
      setIsSwapping(false);
    }
  };

  const getButtonText = () => {
    if (!isConnected) return 'Connect Wallet';
    if (!routerContract) return 'Network Connection Issue';
    if (!tokenIn || !tokenOut) return 'Select Tokens';
    if (!inputAmount || !outputAmount) return 'Enter Amount';
    
    if (swapStatus === 'approving') return 'Approving...';
    if (swapStatus === 'estimating') return 'Estimating Gas...';
    if (swapStatus === 'retrying') return 'Retrying with Higher Gas...';
    if (swapStatus === 'swapping') return 'Swapping...';
    
    // Special cases for direct conversions
    if (tokenIn.address === "ETH" && tokenOut.address === WETH_ADDRESS) return 'Wrap ETH';
    if (tokenIn.address === WETH_ADDRESS && tokenOut.address === "ETH") return 'Unwrap ETH';
    return 'Swap';
  };

  // Add state for path and amounts
  const [currentPath, setCurrentPath] = useState<Token[]>([]);
  const [pathAmounts, setPathAmounts] = useState<string[]>([]);

  return (
    <div className="space-y-4">
      <div className="glass-effect rounded-2xl shadow-xl p-6 w-full max-w-md mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold gradient-text">Swap</h3>
          <button className="p-2 rounded-xl hover:bg-gray-800/50 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 hover:text-white" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        
        {/* Input amount */}
        <div className="bg-gray-900/30 backdrop-blur-md rounded-xl p-4 mb-2 z-10">
          <div className="flex justify-between mb-2">
            <div className="text-sm text-gray-400">You pay</div>
            {tokenIn && (
              <div className="text-sm text-gray-400">
                Balance: {formatAmount(balanceIn.toString(), tokenIn.decimals)}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              className="bg-transparent text-2xl font-medium focus:outline-none w-full text-white"
              placeholder="0.0"
              value={inputAmount}
              onChange={(e) => handleInputChange(e.target.value)}
            />
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-800/50 hover:bg-gray-800 transition-colors min-w-[140px]">
              <TokenSelector
                selectedToken={tokenIn}
                onSelectToken={setTokenIn}
                otherSelectedToken={tokenOut}
                label="You pay"
              />
            </div>
          </div>
        </div>
        
        {/* Swap direction button */}
        <div className="flex justify-center -my-3 z-10 relative">
          <button
            className="bg-gray-900/50 backdrop-blur-md rounded-full p-2 border border-gray-700/50 hover:border-pink-500/50 transition-all duration-200 hover:shadow-lg hover:shadow-pink-500/20"
            onClick={switchTokens}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-pink-500" viewBox="0 0 20 20" fill="currentColor">
              <path d="M5 12a1 1 0 102 0V6.414l1.293 1.293a1 1 0 001.414-1.414l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L5 6.414V12zM15 8a1 1 0 10-2 0v5.586l-1.293-1.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L15 13.586V8z" />
            </svg>
          </button>
        </div>
        
        {/* Output amount */}
        <div className="bg-gray-900/30 backdrop-blur-md rounded-xl p-4 mb-4">
          <div className="flex justify-between mb-2">
            <div className="text-sm text-gray-400">You receive</div>
            {tokenOut && (
              <div className="text-sm text-gray-400">
                Balance: {formatAmount(balanceOut.toString(), tokenOut.decimals)}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              className="bg-transparent text-2xl font-medium focus:outline-none w-full text-white"
              placeholder="0.0"
              value={outputAmount}
              onChange={(e) => handleOutputChange(e.target.value)}
            />
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-800/50 hover:bg-gray-800 transition-colors min-w-[140px]">
              <TokenSelector
                selectedToken={tokenOut}
                onSelectToken={setTokenOut}
                otherSelectedToken={tokenIn}
                label="You receive"
              />
            </div>
          </div>
        </div>
        
        {/* Route information */}
        {currentPath.length > 0 && (
          <div className="bg-gray-900/30 backdrop-blur-md rounded-xl p-3 mb-4">
            <SwapRoute path={currentPath} amounts={pathAmounts} />
          </div>
        )}
        
        {/* Price information */}
        {tokenIn && tokenOut && inputAmount && outputAmount && (
          <div className="bg-gray-900/30 backdrop-blur-md rounded-xl p-4 mb-4 text-sm space-y-2">
            <div className="flex justify-between items-center">
              <div className="text-gray-400">Rate</div>
              <div className="text-white font-medium">
                {(() => {
                  const isEthIn = tokenIn.address === "ETH";
                  const isEthOut = tokenOut.address === "ETH";
                  
                  if (isEthIn && tokenOut.address === WETH_ADDRESS) {
                    return '1 ETH = 1 WETH';
                  } else if (isEthOut && tokenIn.address === WETH_ADDRESS) {
                    return '1 WETH = 1 ETH';
                  } else {
                    const amountInBN = parseAmount(inputAmount, tokenIn.decimals);
                    const amountOutBN = parseAmount(outputAmount, tokenOut.decimals);
                    
                    if (amountInBN && amountOutBN && !amountInBN.isZero()) {
                      const scaleFactor = ethers.BigNumber.from(10).pow(18);
                      const price = amountOutBN.mul(scaleFactor).div(amountInBN);
                      const priceFormatted = formatAmount(price.toString(), 18);
                      return `1 ${tokenIn.symbol} = ${priceFormatted} ${tokenOut.symbol}`;
                    } else {
                      return `1 ${tokenIn.symbol} = 0.00 ${tokenOut.symbol}`;
                    }
                  }
                })()}
              </div>
            </div>
            
            {/* Only show price impact if this is not a direct ETH-WETH swap */}
            {priceImpact !== null && (() => {
              const isEthIn = tokenIn.address === "ETH";
              const isEthOut = tokenOut.address === "ETH";
              
              return !(isEthIn && tokenOut.address === WETH_ADDRESS) && 
                     !(isEthOut && tokenIn.address === WETH_ADDRESS);
            })() && (
              <div className="flex justify-between items-center">
                <div className="text-gray-400">Price Impact</div>
                <div className={`font-medium ${
                  priceImpact > 5 
                    ? 'text-red-500' 
                    : priceImpact > 1 
                      ? 'text-yellow-500' 
                      : 'text-green-500'
                }`}>
                  {priceImpact.toFixed(2)}%
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Action button */}
        <button
          className={`w-full py-4 px-6 rounded-xl font-semibold transition-all duration-200 ${
            !isConnected || !tokenIn || !tokenOut || !inputAmount || !outputAmount
              ? 'bg-gray-700/50 text-gray-400 cursor-not-allowed'
              : swapStatus === 'success'
                ? 'bg-green-500/80 text-white hover:bg-green-600/80'
                : swapStatus === 'retrying'
                  ? 'bg-yellow-500/80 text-white'
                  : 'bg-gradient-to-r from-pink-500 to-purple-500 text-white hover:from-pink-600 hover:to-purple-600 hover:shadow-lg hover:shadow-pink-500/20'
          }`}
          disabled={!isConnected || !tokenIn || !tokenOut || !inputAmount || !outputAmount || isApproving || isSwapping}
          onClick={isConnected ? handleSwap : () => {}}
        >
          {getButtonText()}
        </button>
      </div>

      {/* Add reserves curve and price distribution if we have a pair */}
      {tokenIn && tokenOut && pair && provider && (
        <>
          <div className="mt-8">
            <h3 className="text-xl font-semibold gradient-text mb-4">Reserves Curve</h3>
            <div className="glass-effect rounded-2xl p-6">
              <ReservesCurve
                token0={tokenIn}
                token1={tokenOut}
                reserve0={pair.reserves.reserve0}
                reserve1={pair.reserves.reserve1}
              />
            </div>
          </div>

          <div className="mt-8">
            <h3 className="text-xl font-semibold gradient-text mb-4">Historical Swap Prices</h3>
            <div className="glass-effect rounded-2xl p-6">
              <SwapPriceDistribution
                token0={tokenIn}
                token1={tokenOut}
                pairAddress={pair.address}
                provider={provider}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}; 