import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { useWeb3Context } from '../context/Web3Context';

interface Pair {
  address: string;
  token0: { address: string };
  token1: { address: string };
  reserves: {
    reserve0: ethers.BigNumber;
    reserve1: ethers.BigNumber;
  };
}

export const usePair = (tokenA: string, tokenB: string) => {
  const { factoryContract } = useWeb3Context();
  const [pair, setPair] = useState<Pair | null>(null);
  const [exists, setExists] = useState(false);

  useEffect(() => {
    const fetchPair = async () => {
      if (!factoryContract || !tokenA || !tokenB) {
        console.log("Missing requirements for pair fetch:", {
          hasFactory: !!factoryContract,
          tokenA,
          tokenB
        });
        return;
      }

      try {
        console.log("Fetching pair for tokens:", {
          tokenA,
          tokenB
        });
        
        const pairAddress = await factoryContract.getPair(tokenA, tokenB);
        console.log("Pair address:", pairAddress);
        
        if (pairAddress === '0x0000000000000000000000000000000000000000') {
          console.log("Pair does not exist");
          setExists(false);
          setPair(null);
          return;
        }

        // Get pair contract
        const pairContract = new ethers.Contract(
          pairAddress,
          [
            'function token0() view returns (address)',
            'function token1() view returns (address)',
            'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)'
          ],
          factoryContract.provider
        );

        // Get pair data
        const [token0, token1, reserves] = await Promise.all([
          pairContract.token0(),
          pairContract.token1(),
          pairContract.getReserves()
        ]);

        console.log("Pair data fetched:", {
          token0,
          token1,
          reserves: {
            reserve0: reserves[0].toString(),
            reserve1: reserves[1].toString()
          }
        });

        setPair({
          address: pairAddress,
          token0: { address: token0 },
          token1: { address: token1 },
          reserves: {
            reserve0: reserves[0],
            reserve1: reserves[1]
          }
        });
        setExists(true);
      } catch (error) {
        console.error('Error fetching pair:', error);
        setExists(false);
        setPair(null);
      }
    };

    fetchPair();
  }, [factoryContract, tokenA, tokenB]);

  return { pair, exists };
}; 