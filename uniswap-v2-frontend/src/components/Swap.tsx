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

// Add a utility function at the top of the file to help with gas estimation
const getGasSettings = (isEstimationFailed = false) => {
  return {
    gasLimit: isEstimationFailed ? 1000000 : 500000, // Increased gas limits
    gasPrice: ethers.utils.parseUnits(isEstimationFailed ? "150" : "100", "gwei")
  };
};

export const Swap: React.FC = () => {
  const { account, routerContract, isConnected, signer, connectWallet } = useWeb3Context();
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
    console.log("Calculate Output Called", {
      hasRouter: !!routerContract,
      hasTokenIn: !!tokenIn,
      hasTokenOut: !!tokenOut,
      inputAmount,
      pairExists
    });

    if (
      !routerContract ||
      !tokenIn ||
      !tokenOut ||
      !inputAmount ||
      inputAmount === '0' ||
      !pairExists
    ) {
      console.log("Calculation skipped due to missing requirements");
      if (manualOutputUpdate || inputAmount === '') {
        return;
      }
      setOutputAmount('');
      return;
    }

    try {
      console.log("Calculating output amount...");
      const amountIn = parseAmount(inputAmount, tokenIn.decimals);
      const path = [tokenIn.address, tokenOut.address];
      
      console.log("Getting amounts out for:", {
        amountIn: amountIn.toString(),
        path
      });
      
      const amounts = await routerContract.getAmountsOut(amountIn, path);
      const amountOut = amounts[1];
      
      console.log("Calculation result:", {
        amountOut: amountOut.toString(),
        formatted: formatAmount(amountOut, tokenOut.decimals)
      });
      
      setOutputAmount(formatAmount(amountOut, tokenOut.decimals));
      
      // Calculate price impact
      if (pair) {
        let reserve0 = pair.reserves.reserve0;
        let reserve1 = pair.reserves.reserve1;
        
        console.log("Pair reserves:", {
          reserve0: reserve0.toString(),
          reserve1: reserve1.toString()
        });
        
        if (tokenIn.address.toLowerCase() !== pair.token0.address.toLowerCase()) {
          [reserve0, reserve1] = [reserve1, reserve0];
        }
        
        const impact = calculatePriceImpact(reserve0, reserve1, amountIn);
        setPriceImpact(impact);
      }
    } catch (error) {
      console.error('Error calculating output:', error);
    }
  }, [routerContract, tokenIn, tokenOut, inputAmount, pairExists, pair, manualOutputUpdate]);

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
      
      setInputAmount(formatAmount(amountIn, tokenIn.decimals));
      
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
    
    if (!routerContract) {
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
      
      // Construct the path
      const path = [
        isEthIn ? WETH_ADDRESS : tokenIn.address,
        isEthOut ? WETH_ADDRESS : tokenOut.address
      ];
      
      console.log("Swap path:", path);
      
      const amountIn = parseAmount(inputAmount, tokenIn.decimals);
      const amountOutMin = parseAmount(
        (parseFloat(outputAmount) * 0.95).toString(), // 5% slippage
        tokenOut.decimals
      );
      
      console.log("Swap amounts:", {
        amountIn: amountIn.toString(),
        amountOutMin: amountOutMin.toString()
      });

      // Get initial gas settings
      let overrides = getGasSettings();
      const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes
      
      try {
        // Check approval first if not ETH
        if (!isEthIn && signer) {
          const tokenContract = new ethers.Contract(
            tokenIn.address,
            ['function allowance(address,address) view returns (uint256)'],
            signer
          );
          const allowance = await tokenContract.allowance(account, routerContract.address);
          if (allowance.lt(amountIn)) {
            await handleApprove();
          }
        }

        // Check pool liquidity first
        const amounts = await routerContract.getAmountsOut(amountIn, path);
        console.log("Amounts out:", amounts.map((a: ethers.BigNumber) => a.toString()));
        
        if (amounts[amounts.length - 1].lt(amountOutMin)) {
          throw new Error("Insufficient liquidity for this trade");
        }
        
        let tx;
        
        if (isEthIn) {
          console.log("Swapping ETH for tokens with value:", amountIn.toString());
          tx = await routerContract.swapExactETHForTokensSupportingFeeOnTransferTokens(
            amountOutMin,
            path,
            account,
            deadline,
            { 
              ...overrides,
              value: amountIn 
            }
          );
        } else if (isEthOut) {
          console.log("Swapping tokens for ETH");
          tx = await routerContract.swapExactTokensForETHSupportingFeeOnTransferTokens(
            amountIn,
            amountOutMin,
            path,
            account,
            deadline,
            overrides
          );
        } else {
          console.log("Swapping tokens for tokens");
          tx = await routerContract.swapExactTokensForTokensSupportingFeeOnTransferTokens(
            amountIn,
            amountOutMin,
            path,
            account,
            deadline,
            overrides
          );
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
          const newAmountOutMin = amountOutMin.mul(90).div(100);
          
          if (isEthIn) {
            await routerContract.swapExactETHForTokensSupportingFeeOnTransferTokens(
              newAmountOutMin,
              path,
              account,
              deadline,
              { 
                ...overrides,
                value: amountIn 
              }
            );
          } else {
            throw new Error("Please try again with a smaller amount or more slippage tolerance");
          }
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

  return (
    <div className="space-y-4">
      <div className="bg-light rounded-lg shadow-md p-4 w-full max-w-md mx-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-white">Swap</h3>
          <button className="text-gray-400 hover:text-white" onClick={() => {}}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        
        {/* Input amount */}
        <div className="bg-dark rounded-lg p-4 mb-2">
          <div className="flex justify-between mb-2">
            <div className="text-sm text-gray-400">You pay</div>
            {tokenIn && (
              <div className="text-sm text-gray-400">
                Balance: {formatAmount(balanceIn.toString(), tokenIn.decimals)}
              </div>
            )}
          </div>
          <div className="flex items-center">
            <input
              type="text"
              className="bg-transparent text-white text-2xl font-medium focus:outline-none w-full"
              placeholder="0.0"
              value={inputAmount}
              onChange={(e) => handleInputChange(e.target.value)}
            />
            <TokenSelector
              selectedToken={tokenIn}
              onSelectToken={setTokenIn}
              otherSelectedToken={tokenOut}
              label="You pay"
            />
          </div>
        </div>
        
        {/* Swap direction button */}
        <div className="flex justify-center -my-3 z-10 relative">
          <button
            className="bg-dark rounded-full p-2 border border-light hover:border-primary transition-colors"
            onClick={switchTokens}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" viewBox="0 0 20 20" fill="currentColor">
              <path d="M5 12a1 1 0 102 0V6.414l1.293 1.293a1 1 0 001.414-1.414l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L5 6.414V12zM15 8a1 1 0 10-2 0v5.586l-1.293-1.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L15 13.586V8z" />
            </svg>
          </button>
        </div>
        
        {/* Output amount */}
        <div className="bg-dark rounded-lg p-4 mb-4">
          <div className="flex justify-between mb-2">
            <div className="text-sm text-gray-400">You receive</div>
            {tokenOut && (
              <div className="text-sm text-gray-400">
                Balance: {formatAmount(balanceOut.toString(), tokenOut.decimals)}
              </div>
            )}
          </div>
          <div className="flex items-center">
            <input
              type="text"
              className="bg-transparent text-white text-2xl font-medium focus:outline-none w-full"
              placeholder="0.0"
              value={outputAmount}
              onChange={(e) => handleOutputChange(e.target.value)}
            />
            <TokenSelector
              selectedToken={tokenOut}
              onSelectToken={setTokenOut}
              otherSelectedToken={tokenIn}
              label="You receive"
            />
          </div>
        </div>
        
        {/* Price information */}
        {tokenIn && tokenOut && inputAmount && outputAmount && (
          <div className="bg-darker rounded-lg p-3 mb-4 text-sm">
            <div className="flex justify-between mb-1">
              <div className="text-gray-400">Price</div>
              <div className="text-white">
                {(() => {
                  // Determine if tokens are ETH or WETH
                  const isEthIn = tokenIn.address === "ETH";
                  const isEthOut = tokenOut.address === "ETH";
                  
                  if (isEthIn && tokenOut.address === WETH_ADDRESS) {
                    return '1 ETH = 1 WETH';
                  } else if (isEthOut && tokenIn.address === WETH_ADDRESS) {
                    return '1 WETH = 1 ETH';
                  } else if (parseFloat(inputAmount) > 0) {
                    return `1 ${tokenIn.symbol} = ${(parseFloat(outputAmount) / parseFloat(inputAmount)).toFixed(6)} ${tokenOut.symbol}`;
                  } else if (parseFloat(outputAmount) > 0) {
                    return `1 ${tokenOut.symbol} = ${(parseFloat(inputAmount) / parseFloat(outputAmount)).toFixed(6)} ${tokenIn.symbol}`;
                  } else {
                    return `1 ${tokenIn.symbol} = 0.00 ${tokenOut.symbol}`;
                  }
                })()}
              </div>
            </div>
            
            {/* Only show price impact if this is not a direct ETH-WETH swap */}
            {priceImpact !== null && (() => {
              // Determine if tokens are ETH or WETH
              const isEthIn = tokenIn.address === "ETH";
              const isEthOut = tokenOut.address === "ETH";
              
              return !(isEthIn && tokenOut.address === WETH_ADDRESS) && 
                     !(isEthOut && tokenIn.address === WETH_ADDRESS);
            })() && (
              <div className="flex justify-between">
                <div className="text-gray-400">Price Impact</div>
                <div className={`${priceImpact > 5 ? 'text-red-500' : priceImpact > 1 ? 'text-yellow-500' : 'text-green-500'}`}>
                  {priceImpact.toFixed(2)}%
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Action button */}
        <button
          className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
            !isConnected || !tokenIn || !tokenOut || !inputAmount || !outputAmount
              ? 'bg-lighter text-gray-400 cursor-not-allowed'
              : swapStatus === 'success'
                ? 'bg-green-600 text-white'
                : swapStatus === 'retrying'
                  ? 'bg-yellow-600 text-white'
                  : 'bg-primary text-white hover:bg-opacity-90'
          }`}
          disabled={!isConnected || !tokenIn || !tokenOut || !inputAmount || !outputAmount || isApproving || isSwapping}
          onClick={isConnected ? handleSwap : () => {}}
        >
          {getButtonText()}
        </button>
      </div>

      {/* Charts section */}
      {pair && tokenIn && tokenOut && (
        <div className="w-full max-w-3xl mx-auto space-y-4">
          <ReservesCurve
            token0={tokenIn}
            token1={tokenOut}
            reserve0={pair.reserves.reserve0}
            reserve1={pair.reserves.reserve1}
          />
          <PriceDistributionChart
            pairAddress={pair.address}
            token0={tokenIn}
            token1={tokenOut}
          />
        </div>
      )}
    </div>
  );
}; 