import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { Token } from '../utils/tokens';

interface SwapEventArgs {
  sender: string;
  amount0In: ethers.BigNumber;
  amount1In: ethers.BigNumber;
  amount0Out: ethers.BigNumber;
  amount1Out: ethers.BigNumber;
  to: string;
}

const PAIR_ABI = [
  'event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)'
];

interface SwapEvent {
  timestamp: number;
  amount0In: ethers.BigNumber;
  amount1In: ethers.BigNumber;
  amount0Out: ethers.BigNumber;
  amount1Out: ethers.BigNumber;
  executionPrice: number;
}

export const useSwapHistory = (
  pairAddress: string | undefined,
  token0: Token | null,
  token1: Token | null,
  provider?: ethers.providers.Provider
) => {
  const [swapEvents, setSwapEvents] = useState<SwapEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!pairAddress || !provider || !token0 || !token1) {
      setSwapEvents([]);
      return;
    }

    const pairContract = new ethers.Contract(pairAddress, PAIR_ABI, provider);
    setIsLoading(true);

    // Get the last 1000 blocks of swap events
    const fetchSwapEvents = async () => {
      try {
        const currentBlock = await provider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - 1000);

        const swapFilter = pairContract.filters.Swap();
        const events = await pairContract.queryFilter(swapFilter, fromBlock);
        const blockPromises = events.map(event => provider.getBlock(event.blockNumber));
        const blocks = await Promise.all(blockPromises);

        const processedEvents: SwapEvent[] = events.map((event, index) => {
          const args = event.args as unknown as SwapEventArgs;
          const { amount0In, amount1In, amount0Out, amount1Out } = args;
          
          // Calculate execution price
          let executionPrice;
          if (!amount0In.isZero()) {
            // Token0 was sold for Token1
            const amountIn = parseFloat(ethers.utils.formatUnits(amount0In, token0.decimals));
            const amountOut = parseFloat(ethers.utils.formatUnits(amount1Out, token1.decimals));
            executionPrice = amountOut / amountIn;
          } else {
            // Token1 was sold for Token0
            const amountIn = parseFloat(ethers.utils.formatUnits(amount1In, token1.decimals));
            const amountOut = parseFloat(ethers.utils.formatUnits(amount0Out, token0.decimals));
            executionPrice = amountOut / amountIn;
          }

          return {
            timestamp: blocks[index].timestamp,
            amount0In,
            amount1In,
            amount0Out,
            amount1Out,
            executionPrice,
          };
        });

        setSwapEvents(processedEvents);
      } catch (error) {
        console.error('Error fetching swap events:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSwapEvents();

    // Listen for new swap events
    const handleSwap = async (
      sender: string,
      amount0In: ethers.BigNumber,
      amount1In: ethers.BigNumber,
      amount0Out: ethers.BigNumber,
      amount1Out: ethers.BigNumber,
      to: string,
      event: ethers.Event
    ) => {
      const block = await event.getBlock();
      let executionPrice;
      
      if (!amount0In.isZero()) {
        const amountIn = parseFloat(ethers.utils.formatUnits(amount0In, token0.decimals));
        const amountOut = parseFloat(ethers.utils.formatUnits(amount1Out, token1.decimals));
        executionPrice = amountOut / amountIn;
      } else {
        const amountIn = parseFloat(ethers.utils.formatUnits(amount1In, token1.decimals));
        const amountOut = parseFloat(ethers.utils.formatUnits(amount0Out, token0.decimals));
        executionPrice = amountOut / amountIn;
      }

      const newEvent: SwapEvent = {
        timestamp: block.timestamp,
        amount0In,
        amount1In,
        amount0Out,
        amount1Out,
        executionPrice,
      };

      setSwapEvents(prev => [newEvent, ...prev].slice(0, 100)); // Keep last 100 events
    };

    pairContract.on('Swap', handleSwap);

    return () => {
      pairContract.removeListener('Swap', handleSwap);
    };
  }, [pairAddress, provider, token0, token1]);

  return { swapEvents, isLoading };
}; 