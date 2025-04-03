import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWeb3Context } from '../context/Web3Context';
import { WETH_ADDRESS } from '../constants/addresses';

export const useTokenBalance = (tokenAddress: string | null) => {
  const { account, provider, getERC20Contract } = useWeb3Context();
  const [balance, setBalance] = useState<ethers.BigNumber>(ethers.BigNumber.from(0));
  const [loading, setLoading] = useState(false);

  const fetchBalance = useCallback(async () => {
    if (!account || !provider || !tokenAddress || tokenAddress === '') {
      setBalance(ethers.BigNumber.from(0));
      return;
    }

    try {
      setLoading(true);
      
      // Special case for ETH (not an ERC20 token)
      if (tokenAddress === 'ETH') {
        const ethBalance = await provider.getBalance(account);
        setBalance(ethBalance);
        return;
      }
      
      // For ERC20 tokens - verify contract exists before calling
      try {
        const code = await provider.getCode(tokenAddress);
        // If no code at address, it's not a contract
        if (code === '0x') {
          console.error(`No contract at address: ${tokenAddress}`);
          setBalance(ethers.BigNumber.from(0));
          return;
        }
        
        const tokenContract = getERC20Contract(tokenAddress);
        if (tokenContract) {
          const tokenBalance = await tokenContract.balanceOf(account);
          setBalance(tokenBalance);
        }
      } catch (error) {
        console.error('Error fetching token balance:', error);
        setBalance(ethers.BigNumber.from(0));
      }
    } catch (error) {
      console.error('Error fetching token balance:', error);
      setBalance(ethers.BigNumber.from(0));
    } finally {
      setLoading(false);
    }
  }, [account, provider, tokenAddress, getERC20Contract]);

  useEffect(() => {
    fetchBalance();

    // Set up polling for balance updates
    const intervalId = setInterval(fetchBalance, 15000); // Poll every 15 seconds

    return () => clearInterval(intervalId);
  }, [fetchBalance]);

  return { balance, loading, refetch: fetchBalance };
};

export const useEthBalance = () => {
  return useTokenBalance('ETH');
};

export const useWethBalance = () => {
  return useTokenBalance(WETH_ADDRESS);
}; 