import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWeb3Context } from '../context/Web3Context';
import { FACTORY_ADDRESS } from '../constants/addresses';
import { FACTORY_ABI } from '../constants/abis/factory';
import { PAIR_ABI } from '../constants/abis/pair';
import { ERC20_ABI } from '../constants/abis/erc20';
import { Token } from '../utils/tokens';
import { WETH_ADDRESS } from '../constants/addresses';

interface PairInfo {
  address: string;
  token0: Token;
  token1: Token;
  reserves: {
    reserve0: ethers.BigNumber;
    reserve1: ethers.BigNumber;
  };
  totalSupply: ethers.BigNumber;
}

export const useAllPairs = () => {
  const { provider } = useWeb3Context();
  const [pairs, setPairs] = useState<PairInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAllPairs = async () => {
      if (!provider) {
        setLoading(false);
        return;
      }

      try {
        // Get factory contract
        const factoryContract = new ethers.Contract(
          FACTORY_ADDRESS,
          FACTORY_ABI,
          provider
        );

        // Get total number of pairs
        const allPairsLength = await factoryContract.allPairsLength();
        console.log(`Total pairs: ${allPairsLength.toString()}`);

        // Fetch all pair addresses
        const pairPromises = [];
        for (let i = 0; i < allPairsLength.toNumber(); i++) {
          pairPromises.push(factoryContract.allPairs(i));
        }
        const pairAddresses = await Promise.all(pairPromises);

        // Fetch details for each pair
        const pairDetailsPromises = pairAddresses.map(async (pairAddress) => {
          const pairContract = new ethers.Contract(
            pairAddress,
            PAIR_ABI,
            provider
          );

          // Get token addresses
          const [token0Address, token1Address] = await Promise.all([
            pairContract.token0(),
            pairContract.token1()
          ]);

          // Get token details
          const token0Contract = new ethers.Contract(
            token0Address,
            ERC20_ABI,
            provider
          );
          const token1Contract = new ethers.Contract(
            token1Address,
            ERC20_ABI,
            provider
          );

          // Fetch token details in parallel
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

          const token0: Token = {
            address: token0Address,
            symbol: token0Symbol,
            name: token0Name,
            decimals: token0Decimals,
            logoURI: token0Address.toLowerCase() === WETH_ADDRESS.toLowerCase() 
              ? 'https://assets.coingecko.com/coins/images/2518/small/weth.png'
              : `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/${token0Address}/logo.png`
          };

          const token1: Token = {
            address: token1Address,
            symbol: token1Symbol,
            name: token1Name,
            decimals: token1Decimals,
            logoURI: token1Address.toLowerCase() === WETH_ADDRESS.toLowerCase()
              ? 'https://assets.coingecko.com/coins/images/2518/small/weth.png'
              : `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/${token1Address}/logo.png`
          };

          return {
            address: pairAddress,
            token0,
            token1,
            reserves: {
              reserve0: reserves[0],
              reserve1: reserves[1]
            },
            totalSupply
          };
        });

        const pairDetails = await Promise.all(pairDetailsPromises);
        setPairs(pairDetails);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching pairs:', err);
        setError(err instanceof Error ? err.message : 'Error fetching pairs');
        setLoading(false);
      }
    };

    fetchAllPairs();
  }, [provider]);

  return { pairs, loading, error };
}; 