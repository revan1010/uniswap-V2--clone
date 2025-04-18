import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWeb3Context } from '../context/Web3Context';
import TokenSelector from './TokenSelector';
import { Token, parseAmount, formatAmount } from '../utils/tokens';
import { usePair } from '../hooks/usePairs';
import { TEST_TOKENS, WETH_ADDRESS } from '../constants/addresses';
import { useTokenBalance } from '../hooks/useTokenBalance';
import { PairInfo } from '../hooks/usePairs';
import { PairsList } from './PairsList';
import { ReservesCurve } from './ReservesCurve';
import { BsGearFill, BsPlusCircleFill, BsDashCircleFill } from 'react-icons/bs';
import { FaExchangeAlt } from 'react-icons/fa';
import { BiWater } from 'react-icons/bi';

type PoolAction = 'add' | 'remove';

export const Pool: React.FC = () => {
  const { account, routerContract, factoryContract, signer, isConnected, getERC20Contract } = useWeb3Context();
  const [activeTab, setActiveTab] = useState<'add' | 'remove'>('add');
  const [tokenA, setTokenA] = useState<Token | null>(null);
  const [tokenB, setTokenB] = useState<Token | null>(null);
  const [amountA, setAmountA] = useState('');
  const [amountB, setAmountB] = useState('');
  const [userPairs, setUserPairs] = useState<PairInfo[]>([]);
  const [selectedPair, setSelectedPair] = useState<PairInfo | null>(null);
  const [liquidity, setLiquidity] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isWrapping, setIsWrapping] = useState(false);
  const [wrapAmount, setWrapAmount] = useState('');
  
  // Add state variables that were previously in renderRemoveLiquidity
  const [lpTokenBalance, setLpTokenBalance] = useState<string>("0");
  const [removalPercentage, setRemovalPercentage] = useState<number>(100);
  const [returnAmountA, setReturnAmountA] = useState<string>("0");
  const [returnAmountB, setReturnAmountB] = useState<string>("0");

  // Get pair information if both tokens are selected
  const { pair } = usePair(
    tokenA?.address || '',
    tokenB?.address || ''
  );

  // Get token balances
  const { balance: balanceA, refetch: refetchBalanceA } = useTokenBalance(tokenA?.address || '');
  const { balance: balanceB, refetch: refetchBalanceB } = useTokenBalance(tokenB?.address || '');

  // Define fetchUserPairs before using it in effects
  const fetchUserPairs = useCallback(async () => {
    if (!account || !factoryContract) {
      console.log('Missing account or factory contract');
      return;
    }

    try {
      console.log('Getting pairs length...');
      const pairsLength = await factoryContract.allPairsLength();
      const totalPairs = parseInt(pairsLength.toString());
      console.log('Total pairs:', totalPairs);
      
      const userPairsData: PairInfo[] = [];

      for (let i = 0; i < totalPairs; i++) {
        console.log('Checking pair', i);
        const pairAddress = await factoryContract.allPairs(i);
        const pairContract = new ethers.Contract(
          pairAddress,
          [
            'function balanceOf(address) view returns (uint)',
            'function totalSupply() view returns (uint)',
            'function token0() view returns (address)',
            'function token1() view returns (address)',
            'function getReserves() view returns (uint112, uint112, uint32)'
          ],
          factoryContract.provider
        );

        const userBalance = await pairContract.balanceOf(account);
        console.log('User balance for pair', i, ':', userBalance.toString());
        
        // Only include pairs where the user has liquidity
        if (userBalance.gt(0)) {
          console.log('Found user liquidity in pair', i);
          const token0Address = await pairContract.token0();
          const token1Address = await pairContract.token1();
          
          // Get token contracts
          const token0Contract = new ethers.Contract(
            token0Address,
            [
              'function symbol() view returns (string)',
              'function name() view returns (string)',
              'function decimals() view returns (uint8)'
            ],
            factoryContract.provider
          );
          
          const token1Contract = new ethers.Contract(
            token1Address,
            [
              'function symbol() view returns (string)',
              'function name() view returns (string)',
              'function decimals() view returns (uint8)'
            ],
            factoryContract.provider
          );
          
          // Get token details
          const [
            token0Symbol,
            token0Name,
            token0Decimals,
            token1Symbol,
            token1Name,
            token1Decimals,
            reserves,
            totalSupply
          ] = await Promise.all([
            token0Contract.symbol(),
            token0Contract.name(),
            token0Contract.decimals(),
            token1Contract.symbol(),
            token1Contract.name(),
            token1Contract.decimals(),
            pairContract.getReserves(),
            pairContract.totalSupply()
          ]);
          
          userPairsData.push({
            address: pairAddress,
            token0: {
              address: token0Address,
              symbol: token0Symbol,
              name: token0Name,
              decimals: token0Decimals
            },
            token1: {
              address: token1Address,
              symbol: token1Symbol,
              name: token1Name,
              decimals: token1Decimals
            },
            reserves: {
              reserve0: reserves[0],
              reserve1: reserves[1],
              blockTimestampLast: reserves[2]
            },
            totalSupply
          });
        }
      }
      
      console.log('Found user pairs:', userPairsData);
      setUserPairs(userPairsData);
    } catch (error) {
      console.error('Error fetching user pairs:', error);
    }
  }, [account, factoryContract]);

  // Initialize with some test tokens
  useEffect(() => {
    if (TEST_TOKENS.length >= 2) {
      setTokenA(TEST_TOKENS[0]);
      setTokenB(TEST_TOKENS[1]);
    }
  }, []);

  // Add effect to fetch user pairs when component mounts
  useEffect(() => {
    if (account && factoryContract) {
      console.log('Fetching user pairs...');
      fetchUserPairs();
    }
  }, [account, factoryContract, fetchUserPairs]);

  // Add effect to reset user pairs when account changes
  useEffect(() => {
    if (!account) {
      setUserPairs([]);
      setSelectedPair(null);
    }
  }, [account]);

  const calculateAmountB = useCallback(async () => {
    if (!pair || !tokenA || !tokenB || !amountA || amountA === '0') {
      setAmountB('');
      return;
    }

    try {
      const amountAValue = parseAmount(amountA, tokenA.decimals);
      
      // Make sure reserves match the token order
      let reserve0 = pair.reserves.reserve0;
      let reserve1 = pair.reserves.reserve1;
      
      if (tokenA.address.toLowerCase() !== pair.token0.address.toLowerCase()) {
        [reserve0, reserve1] = [reserve1, reserve0];
      }
      
      // Calculate amount B based on the constant product formula
      if (reserve0.isZero() || reserve1.isZero()) {
        // If reserves are zero, allow any amount for first liquidity provision
        setAmountB('');
        return;
      }
      
      const amountB = amountAValue.mul(reserve1).div(reserve0);
      setAmountB(formatAmount(amountB.toString(), tokenB.decimals));
    } catch (error) {
      console.error('Error calculating output:', error);
      setAmountB('');
    }
  }, [pair, tokenA, tokenB, amountA]);

  // Function to add liquidity
  const handleAddLiquidity = async () => {
    try {
      if (!account || !signer || !routerContract) {
        alert("Please connect your wallet first");
        return;
      }

      if (!tokenA || !tokenB) {
        alert("Please select both tokens");
        return;
      }

      if (tokenA.address === tokenB.address) {
        alert("Cannot add liquidity with the same token");
        return;
      }

      // Make sure both input values are valid
      if (!amountA || !amountB) {
        alert("Please enter valid amounts for both tokens");
        return;
      }

      setIsProcessing(true);

      // Check if one of the tokens is ETH
      const isTokenAEth = tokenA.address === "ETH";
      const isTokenBEth = tokenB.address === "ETH";

      // Prepare the amounts with the correct decimals
      const parsedAmountA = parseAmount(amountA, tokenA.decimals);
      const parsedAmountB = parseAmount(amountB, tokenB.decimals);

      // Set deadline 20 minutes from now
      const deadline = Math.floor(Date.now() / 1000) + 20 * 60;
      
      // Set appropriate gas limit to avoid estimation errors
      const overrides = {
        gasLimit: 3000000,
        gasPrice: ethers.utils.parseUnits("50", "gwei")
      };

      // Handle token approvals if needed (not needed for ETH)
      if (!isTokenAEth) {
        // Use the existing getERC20Contract from the top-level component
        const tokenAContract = getERC20Contract(tokenA.address);
        if (!tokenAContract) {
          throw new Error(`Could not get contract for token ${tokenA.symbol}`);
        }

        console.log(`Checking allowance for token ${tokenA.symbol}...`);
        const allowanceA = await tokenAContract.allowance(account, routerContract.address);
        
        if (allowanceA.lt(parsedAmountA)) {
          console.log(`Approving ${tokenA.symbol}...`);
          const approveTxA = await tokenAContract.approve(
            routerContract.address,
            ethers.constants.MaxUint256,
            { ...overrides }
          );
          await approveTxA.wait();
          console.log(`${tokenA.symbol} approved`);
        }
      }

      if (!isTokenBEth) {
        // Use the existing getERC20Contract from the top-level component
        const tokenBContract = getERC20Contract(tokenB.address);
        if (!tokenBContract) {
          throw new Error(`Could not get contract for token ${tokenB.symbol}`);
        }

        console.log(`Checking allowance for token ${tokenB.symbol}...`);
        const allowanceB = await tokenBContract.allowance(account, routerContract.address);
        
        if (allowanceB.lt(parsedAmountB)) {
          console.log(`Approving ${tokenB.symbol}...`);
          const approveTxB = await tokenBContract.approve(
            routerContract.address,
            ethers.constants.MaxUint256,
            { ...overrides }
          );
          await approveTxB.wait();
          console.log(`${tokenB.symbol} approved`);
        }
      }

      // Add liquidity based on whether one of the tokens is ETH
      if (isTokenAEth) {
        // ETH + Token liquidity
        console.log(`Adding liquidity ETH + ${tokenB.symbol}...`);
        
        // Calculate slippage tolerance (0.5%)
        const amountTokenMin = parsedAmountB.mul(995).div(1000);
        const amountETHMin = parsedAmountA.mul(995).div(1000);
        
        const tx = await routerContract.addLiquidityETH(
          tokenB.address,
          parsedAmountB,
          amountTokenMin,
          amountETHMin,
          account,
          deadline,
          { 
            ...overrides,
            value: parsedAmountA 
          }
        );
        await tx.wait();
        console.log("Added liquidity ETH + Token!");
      } else if (isTokenBEth) {
        // Token + ETH liquidity
        console.log(`Adding liquidity ${tokenA.symbol} + ETH...`);
        
        // Calculate slippage tolerance (0.5%)
        const amountTokenMin = parsedAmountA.mul(995).div(1000);
        const amountETHMin = parsedAmountB.mul(995).div(1000);
        
        const tx = await routerContract.addLiquidityETH(
          tokenA.address,
          parsedAmountA,
          amountTokenMin,
          amountETHMin,
          account,
          deadline,
          { 
            ...overrides,
            value: parsedAmountB 
          }
        );
        await tx.wait();
        console.log("Added liquidity Token + ETH!");
      } else {
        // Token + Token liquidity
        console.log(`Adding liquidity ${tokenA.symbol} + ${tokenB.symbol}...`);
        
        // Calculate slippage tolerance (0.5%)
        const amountAMin = parsedAmountA.mul(995).div(1000);
        const amountBMin = parsedAmountB.mul(995).div(1000);
        
        const tx = await routerContract.addLiquidity(
          tokenA.address,
          tokenB.address,
          parsedAmountA,
          parsedAmountB,
          amountAMin,
          amountBMin,
          account,
          deadline,
          { ...overrides }
        );
        await tx.wait();
        console.log("Added liquidity Token + Token!");
      }

      // Reset form
      setAmountA("");
      setAmountB("");
      
      // Show success message
      alert("Liquidity added successfully!");

      // Refresh pair data
      fetchUserPairs();

    } catch (error) {
      console.error("Error in token approval or adding liquidity:", error);
      
      // Extract relevant error message
      let errorMessage = "Failed to add liquidity";
      if (error instanceof Error) {
        // Check for specific error messages
        if (error.message.includes("insufficient allowance")) {
          errorMessage = "Token approval failed. Please try again.";
        } else if (error.message.includes("insufficient balance")) {
          errorMessage = "You don't have enough balance for one of the tokens.";
        } else if (error.message.includes("cannot estimate gas")) {
          errorMessage = "Cannot estimate gas. Try setting a higher gas limit or different token amounts.";
        } else {
          errorMessage = `Error: ${error.message}`;
        }
      }
      
      alert(errorMessage);
      
    } finally {
      setIsProcessing(false);
    }
  };

  // Function to remove liquidity
  const handleRemoveLiquidity = async () => {
    if (!selectedPair || !account || !routerContract || !liquidity || !signer) return;
    
    try {
      setIsProcessing(true);
      
      const liquidityAmount = parseAmount(liquidity, 18); // LP tokens have 18 decimals
      
      // Set min amounts to 95% (5% slippage)
      const amountAMin = ethers.BigNumber.from(0); // You can set this to a percentage of expected output
      const amountBMin = ethers.BigNumber.from(0); // You can set this to a percentage of expected output
      
      const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes from now
      
      // Set appropriate gas limit to avoid estimation errors
      const overrides = {
        gasLimit: 3000000,
        gasPrice: ethers.utils.parseUnits("50", "gwei")
      };
      
      // Approve LP token if needed
      const pairContract = new ethers.Contract(
        selectedPair.address,
        [
          'function approve(address, uint) returns (bool)',
          'function allowance(address, address) view returns (uint)'
        ],
        signer
      );
      
      const allowance = await pairContract.allowance(account, routerContract.address);
      if (allowance.lt(liquidityAmount)) {
        const approveTx = await pairContract.approve(
          routerContract.address,
          ethers.constants.MaxUint256,
          { ...overrides }
        );
        await approveTx.wait();
      }
      
      // Remove liquidity
      const tx = await routerContract.removeLiquidity(
        selectedPair.token0.address,
        selectedPair.token1.address,
        liquidityAmount,
        amountAMin,
        amountBMin,
        account,
        deadline,
        { ...overrides }
      );
      
      await tx.wait();
      
      // Reset form and refresh data
      setLiquidity('');
      setSelectedPair(null);
      fetchUserPairs();
      alert("Liquidity removed successfully!");

    } catch (error) {
      console.error('Error removing liquidity:', error);
      
      // Extract relevant error message
      let errorMessage = "Failed to remove liquidity";
      if (error instanceof Error) {
        errorMessage = `Error: ${error.message}`;
      }
      
      alert(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  // Function to wrap ETH
  const handleWrapEth = async () => {
    if (!signer || !account || !wrapAmount || parseFloat(wrapAmount) <= 0) return;
    
    try {
      setIsWrapping(true);
      
      // Get WETH contract
      const wethContract = new ethers.Contract(
        WETH_ADDRESS,
        [
          'function deposit() payable',
          'function withdraw(uint wad)'
        ],
        signer
      );
      
      // Wrap ETH by sending it to the WETH contract
      const tx = await wethContract.deposit({
        value: parseAmount(wrapAmount, 18)
      });
      
      await tx.wait();
      
      // Reset the wrap amount
      setWrapAmount('');
      
      // Refresh balances
      if (tokenA?.address === WETH_ADDRESS) {
        refetchBalanceA();
      }
      if (tokenB?.address === WETH_ADDRESS) {
        refetchBalanceB();
      }
      
      alert('Successfully wrapped ETH to WETH!');

    } catch (error) {
      console.error('Error wrapping ETH:', error);
      alert('Error wrapping ETH. See console for details.');
    } finally {
      setIsWrapping(false);
    }
  };

  // If amountA changes and pair exists, calculate amountB
  useEffect(() => {
    if (activeTab === 'add') {
      calculateAmountB();
    }
  }, [amountA, tokenA, tokenB, pair, activeTab, calculateAmountB]);

  // Add this function to fetch the LP token balance for a selected pair
  const fetchLPTokenBalance = useCallback(async (pairAddress: string) => {
    if (!account || !signer) return "0";
    
    try {
      const pairContract = new ethers.Contract(
        pairAddress,
        [
          'function balanceOf(address) view returns (uint)',
          'function decimals() view returns (uint8)'
        ],
        signer
      );
      
      const balance = await pairContract.balanceOf(account);
      const decimals = await pairContract.decimals();
      
      return formatAmount(balance.toString(), decimals);
    } catch (error) {
      console.error("Error fetching LP token balance:", error);
      return "0";
    }
  }, [account, signer]);

  // Move the useEffect hooks to component level
  useEffect(() => {
    if (selectedPair && activeTab === 'remove') {
      fetchLPTokenBalance(selectedPair.address).then(balance => {
        setLpTokenBalance(balance);
        // Set initial liquidity amount to the full balance
        setLiquidity(balance);
      });
    }
  }, [selectedPair, activeTab, fetchLPTokenBalance]);
  
  useEffect(() => {
    if (selectedPair && liquidity && parseFloat(liquidity) > 0) {
      try {
        // Convert liquidity amount to BigNumber with 18 decimals (LP tokens always have 18 decimals)
        const liquidityBN = ethers.utils.parseUnits(liquidity, 18);
        
        // Calculate amounts based on the proportion of total supply
        const amount0 = selectedPair.reserves.reserve0.mul(liquidityBN).div(selectedPair.totalSupply);
        const amount1 = selectedPair.reserves.reserve1.mul(liquidityBN).div(selectedPair.totalSupply);
        
        // Format amounts with proper decimals
        const tokenAAmount = formatAmount(
          amount0.toString(),
          selectedPair.token0.decimals
        );
        
        const tokenBAmount = formatAmount(
          amount1.toString(),
          selectedPair.token1.decimals
        );
        
        setReturnAmountA(tokenAAmount);
        setReturnAmountB(tokenBAmount);
      } catch (error) {
        console.error("Error calculating return amounts:", error);
        setReturnAmountA("0");
        setReturnAmountB("0");
      }
    } else {
      setReturnAmountA("0");
      setReturnAmountB("0");
    }
  }, [selectedPair, liquidity]);

  // Modify renderRemoveLiquidity to use the state from component level
  const renderRemoveLiquidity = () => {
    // Handle percentage selection
    const handlePercentageSelect = (percentage: number) => {
      setRemovalPercentage(percentage);
      
      if (lpTokenBalance && parseFloat(lpTokenBalance) > 0) {
        // Calculate the amount based on percentage
        const newAmount = (parseFloat(lpTokenBalance) * percentage / 100).toFixed(18);
        setLiquidity(newAmount);
      }
    };
    
    return (
      <div className="p-6 bg-darker rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4 text-white">Remove Liquidity</h2>
        
        {!isConnected ? (
          <div className="text-center p-4 bg-dark rounded">
            <p className="text-gray-400">Please connect your wallet to remove liquidity.</p>
          </div>
        ) : userPairs.length === 0 ? (
          <div className="text-center p-4 bg-dark rounded">
            <p className="mb-2 text-gray-300">You haven't added liquidity to any pools yet.</p>
            <p className="text-sm text-gray-400">
              Switch to the "Add" tab to create a new liquidity position.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-1">Select Pool</label>
              <select
                className="w-full p-2 border rounded bg-dark text-white border-gray-700"
                value={selectedPair ? selectedPair.address : ''}
                onChange={(e) => {
                  const pair = userPairs.find(p => p.address === e.target.value) || null;
                  setSelectedPair(pair);
                }}
              >
                <option value="">Select a pool</option>
                {userPairs.map((pair) => (
                  <option key={pair.address} value={pair.address}>
                    {pair.token0.symbol} / {pair.token1.symbol}
                  </option>
                ))}
              </select>
            </div>
            
            {selectedPair && (
              <>
                <div className="p-3 mb-4 bg-dark rounded border border-gray-700">
                  <h3 className="font-medium mb-1 text-gray-300">Pool Information</h3>
                  <div className="text-sm text-gray-400">
                    <div className="flex justify-between mb-1">
                      <span>{selectedPair.token0.symbol}:</span>
                      <span>{formatAmount(selectedPair.reserves.reserve0.toString(), selectedPair.token0.decimals)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{selectedPair.token1.symbol}:</span>
                      <span>{formatAmount(selectedPair.reserves.reserve1.toString(), selectedPair.token1.decimals)}</span>
                    </div>
                  </div>
                </div>
                
                <div className="mb-1">
                  <div className="flex justify-between text-sm text-gray-300">
                    <span>Your LP Token Balance:</span> 
                    <span>{lpTokenBalance}</span>
                  </div>
                </div>
                
                <div className="mb-1">
                  <label className="block text-sm font-medium text-gray-300 mb-1">How much to remove?</label>
                  <div className="grid grid-cols-4 gap-2 mb-2">
                    {[25, 50, 75, 100].map((percentage) => (
                      <button
                        key={percentage}
                        className={`py-1 px-2 rounded text-sm ${
                          removalPercentage === percentage 
                            ? 'bg-primary text-white' 
                            : 'bg-dark text-gray-400 hover:bg-opacity-80'
                        }`}
                        onClick={() => handlePercentageSelect(percentage)}
                      >
                        {percentage}%
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-1">Amount of LP Tokens to Burn</label>
                  <input
                    type="number"
                    value={liquidity}
                    onChange={(e) => {
                      setLiquidity(e.target.value);
                      // Calculate percentage for the UI
                      if (parseFloat(lpTokenBalance) > 0 && parseFloat(e.target.value) > 0) {
                        const newPercentage = Math.min(100, 
                          Math.round((parseFloat(e.target.value) / parseFloat(lpTokenBalance)) * 100)
                        );
                        setRemovalPercentage(newPercentage);
                      } else {
                        setRemovalPercentage(0);
                      }
                    }}
                    placeholder="0.0"
                    className="w-full p-2 border rounded bg-dark text-white border-gray-700"
                  />
                </div>
                
                <div className="p-3 mb-4 bg-dark rounded border border-blue-800">
                  <h3 className="font-medium mb-1 text-blue-400">You Will Receive</h3>
                  <div className="text-sm text-white">
                    <div className="flex justify-between mb-1">
                      <span>{selectedPair.token0.symbol}:</span>
                      <span>{returnAmountA}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{selectedPair.token1.symbol}:</span>
                      <span>{returnAmountB}</span>
                    </div>
                  </div>
                </div>
                
                <div className="p-3 mb-4 bg-dark text-blue-400 rounded-md text-sm border border-blue-800">
                  <p>
                    <strong>Note:</strong> When you remove liquidity, you'll receive both tokens from 
                    the pool proportional to your share. Make sure you are ready to receive these assets.
                  </p>
                </div>
              </>
            )}
            
            <button
              onClick={handleRemoveLiquidity}
              disabled={!selectedPair || !liquidity || parseFloat(liquidity) <= 0 || isProcessing}
              className={`w-full py-2 rounded font-medium ${
                !selectedPair || !liquidity || parseFloat(liquidity) <= 0 || isProcessing
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-red-600 text-white hover:bg-red-700'
              }`}
            >
              {isProcessing ? 'Processing...' : 'Remove Liquidity'}
            </button>
          </>
        )}
      </div>
    );
  };

  // Add the renderAddLiquidity function back
  const renderAddLiquidity = () => {
    return (
      <div className="space-y-4">
        {/* Token A Input */}
        <div className="relative">
          <div className="bg-gray-900/50 rounded-xl p-4">
            <div className="flex justify-between mb-2">
              <label className="text-sm text-gray-400">Token A</label>
              {tokenA && (
                <span className="text-sm text-gray-400">
                  Balance: {formatAmount(balanceA.toString(), tokenA.decimals)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={amountA}
                onChange={(e) => setAmountA(e.target.value)}
                className="w-full bg-transparent text-2xl font-medium focus:outline-none text-white"
                placeholder="0.0"
              />
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 transition-colors min-w-[140px]">
                <TokenSelector
                  selectedToken={tokenA}
                  onSelectToken={setTokenA}
                  otherSelectedToken={tokenB}
                />
              </div>
            </div>
          </div>

          {/* Plus Icon */}
          <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
            <div className="w-8 h-8 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center">
              <BsPlusCircleFill className="w-5 h-5 text-pink-500" />
            </div>
          </div>

          {/* Token B Input */}
          <div className="bg-gray-900/50 rounded-xl p-4 mt-2">
            <div className="flex justify-between mb-2">
              <label className="text-sm text-gray-400">Token B</label>
              {tokenB && (
                <span className="text-sm text-gray-400">
                  Balance: {formatAmount(balanceB.toString(), tokenB.decimals)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={amountB}
                onChange={(e) => setAmountB(e.target.value)}
                className="w-full bg-transparent text-2xl font-medium focus:outline-none text-white"
                placeholder="0.0"
              />
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 transition-colors min-w-[140px]">
                <TokenSelector
                  selectedToken={tokenB}
                  onSelectToken={setTokenB}
                  otherSelectedToken={tokenA}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Pool Information */}
        {pair && (
          <div className="bg-gray-900/50 rounded-xl p-4">
            <h3 className="text-xl font-medium mb-4">Pool Information</h3>
            <div className="space-y-3">
             
          
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Token A: {pair.token0.symbol}</span>
                <span className="text-white">{formatAmount(pair.reserves.reserve0.toString(), pair.token0.decimals)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Token B: {pair.token1.symbol}</span>
                <span className="text-white">{formatAmount(pair.reserves.reserve1.toString(), pair.token1.decimals)}</span>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={handleAddLiquidity}
          disabled={!tokenA || !tokenB || !amountA || !amountB || isProcessing || !isConnected}
          className="w-full bg-gradient-to-r from-pink-500 to-purple-500 text-white py-4 rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:from-pink-600 hover:to-purple-600 transition-all"
        >
          {!isConnected 
            ? 'Connect Wallet' 
            : isProcessing 
              ? 'Processing...' 
              : 'Add Liquidity'
          }
        </button>
      </div>
    );
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent flex items-center gap-2">
            <BiWater className="w-6 h-6" />
            Pool
          </h2>
          <button className="p-2 rounded-xl hover:bg-gray-700/50 transition-colors">
            <BsGearFill className="w-5 h-5 text-gray-400 hover:text-white" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 p-1 bg-gray-900/50 rounded-xl mb-6">
          <button
            onClick={() => setActiveTab('add')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-all ${
              activeTab === 'add'
                ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-lg'
                : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
            }`}
          >
            <BsPlusCircleFill className="w-4 h-4" />
            Add
          </button>
          <button
            onClick={() => setActiveTab('remove')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-all ${
              activeTab === 'remove'
                ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-lg'
                : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
            }`}
          >
            <BsDashCircleFill className="w-4 h-4" />
            Remove
          </button>
        </div>

        {/* Add Liquidity Form */}
        {activeTab === 'add' ? renderAddLiquidity() : renderRemoveLiquidity()}
      </div>

      {/* Add the PairsList component */}
      <div className="w-full max-w-3xl mx-auto">
        <PairsList />
      </div>

      {/* Add reserves curve if we have a pool */}
      {selectedPair && tokenA && tokenB && pair && (
        <div className="mt-8">
          <h3 className="text-xl font-semibold text-white mb-4">Reserves Curve</h3>
          <ReservesCurve
            token0={tokenA}
            token1={tokenB}
            reserve0={pair.reserves.reserve0}
            reserve1={pair.reserves.reserve1}
            currentPoint={{
              x: parseFloat(ethers.utils.formatUnits(pair.reserves.reserve0, tokenA.decimals)),
              y: parseFloat(ethers.utils.formatUnits(pair.reserves.reserve1, tokenB.decimals))
            }}
          />
        </div>
      )}
    </div>
  );
}; 