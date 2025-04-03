import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWeb3Context } from '../context/Web3Context';
import { WETH_ADDRESS } from '../constants/addresses';

export const useEthBalance = () => {
  const { account, provider } = useWeb3Context();
  const [ethBalance, setEthBalance] = useState<ethers.BigNumber>(ethers.BigNumber.from(0));
  const [wethBalance, setWethBalance] = useState<ethers.BigNumber>(ethers.BigNumber.from(0));
  const [loading, setLoading] = useState(false);

  const fetchBalances = useCallback(async () => {
    if (!account || !provider) {
      setEthBalance(ethers.BigNumber.from(0));
      setWethBalance(ethers.BigNumber.from(0));
      return;
    }

    try {
      setLoading(true);
      
      // Get ETH balance
      const eth = await provider.getBalance(account);
      setEthBalance(eth);
      
      // Get WETH balance
      try {
        const wethContract = new ethers.Contract(
          WETH_ADDRESS,
          ['function balanceOf(address) view returns (uint)'],
          provider
        );
        
        const weth = await wethContract.balanceOf(account);
        setWethBalance(weth);
      } catch (error) {
        console.error('Error fetching WETH balance:', error);
        setWethBalance(ethers.BigNumber.from(0));
      }
    } catch (error) {
      console.error('Error fetching ETH balance:', error);
      setEthBalance(ethers.BigNumber.from(0));
    } finally {
      setLoading(false);
    }
  }, [account, provider]);

  useEffect(() => {
    fetchBalances();
    
    // Set up polling for balance updates
    const intervalId = setInterval(fetchBalances, 15000); // Poll every 15 seconds
    
    return () => clearInterval(intervalId);
  }, [fetchBalances]);

  return {
    ethBalance,
    wethBalance,
    loading,
    refetch: fetchBalances
  };
}; 