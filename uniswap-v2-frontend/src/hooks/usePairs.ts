import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWeb3Context } from '../context/Web3Context';
import { ERC20_ABI, PAIR_ABI } from '../constants/abis';

export interface PairInfo {
  address: string;
  token0: {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
  };
  token1: {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
  };
  reserves: {
    reserve0: ethers.BigNumber;
    reserve1: ethers.BigNumber;
    blockTimestampLast: number;
  };
  totalSupply: ethers.BigNumber;
}

export const usePairs = () => {
  const { provider, factoryContract } = useWeb3Context();
  const [pairs, setPairs] = useState<PairInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPairs = useCallback(async () => {
    if (!provider || !factoryContract) return;

    try {
      setLoading(true);
      
      // Get the total number of pairs
      const pairsLength = await factoryContract.allPairsLength();
      const totalPairs = parseInt(pairsLength.toString());
      
      const pairsData: PairInfo[] = [];
      
      // Fetch each pair
      for (let i = 0; i < totalPairs; i++) {
        const pairAddress = await factoryContract.allPairs(i);
        const pairContract = new ethers.Contract(pairAddress, PAIR_ABI, provider);
        
        // Get token addresses
        const token0Address = await pairContract.token0();
        const token1Address = await pairContract.token1();
        
        // Create token contracts
        const token0Contract = new ethers.Contract(token0Address, ERC20_ABI, provider);
        const token1Contract = new ethers.Contract(token1Address, ERC20_ABI, provider);
        
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
        
        pairsData.push({
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
      
      setPairs(pairsData);
    } catch (error) {
      console.error('Error fetching pairs:', error);
    } finally {
      setLoading(false);
    }
  }, [provider, factoryContract]);

  useEffect(() => {
    fetchPairs();
  }, [fetchPairs]);

  return { pairs, loading, refetch: fetchPairs };
};

export const usePair = (tokenA: string, tokenB: string) => {
  const { provider, factoryContract } = useWeb3Context();
  const [pair, setPair] = useState<PairInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [exists, setExists] = useState(false);

  const fetchPair = useCallback(async () => {
    if (!provider || !factoryContract || !tokenA || !tokenB) {
      setPair(null);
      setExists(false);
      return;
    }

    // Don't try to get pair with ETH directly - ETH is not an ERC20
    if (tokenA === 'ETH' || tokenB === 'ETH') {
      setPair(null);
      setExists(false);
      return;
    }

    try {
      setLoading(true);
      
      // Verify both token contracts exist before proceeding
      try {
        const codeA = await provider.getCode(tokenA);
        const codeB = await provider.getCode(tokenB);
        
        if (codeA === '0x' || codeB === '0x') {
          console.error(`One of the tokens is not a valid contract`);
          setPair(null);
          setExists(false);
          return;
        }
      } catch (error) {
        console.error('Error checking token contracts:', error);
        setPair(null);
        setExists(false);
        return;
      }
      
      // Check if tokens are the same
      if (tokenA.toLowerCase() === tokenB.toLowerCase()) {
        setPair(null);
        setExists(false);
        return;
      }
      
      // Get the pair address with error handling
      let pairAddress;
      try {
        pairAddress = await factoryContract.getPair(tokenA, tokenB);
      } catch (error) {
        console.error('Error getting pair address:', error);
        setPair(null);
        setExists(false);
        return;
      }
      
      if (pairAddress === ethers.constants.AddressZero) {
        setPair(null);
        setExists(false);
        return;
      }
      
      setExists(true);
      
      try {
        const pairContract = new ethers.Contract(pairAddress, PAIR_ABI, provider);
        
        // Get token addresses
        const token0Address = await pairContract.token0();
        const token1Address = await pairContract.token1();
        
        // Create token contracts
        const token0Contract = new ethers.Contract(token0Address, ERC20_ABI, provider);
        const token1Contract = new ethers.Contract(token1Address, ERC20_ABI, provider);
        
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
        
        setPair({
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
      } catch (error) {
        console.error('Error fetching pair details:', error);
        setPair(null);
      }
    } catch (error) {
      console.error('Error fetching pair:', error);
      setPair(null);
    } finally {
      setLoading(false);
    }
  }, [provider, factoryContract, tokenA, tokenB]);

  useEffect(() => {
    fetchPair();
  }, [fetchPair]);

  return { pair, loading, exists, refetch: fetchPair };
}; 