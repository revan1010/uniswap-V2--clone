import React, { useEffect, useRef, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { ethers } from 'ethers';
import { Token } from '../utils/tokens';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface SwapEvent {
  sender: string;
  amount0In: ethers.BigNumber;
  amount1In: ethers.BigNumber;
  amount0Out: ethers.BigNumber;
  amount1Out: ethers.BigNumber;
  to: string;
  price: number;
}

interface SwapPriceDistributionProps {
  token0: Token;
  token1: Token;
  pairAddress: string;
  provider: ethers.providers.Provider;
}

export const SwapPriceDistribution: React.FC<SwapPriceDistributionProps> = ({
  token0,
  token1,
  pairAddress,
  provider
}) => {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<ChartJS | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasData, setHasData] = useState(false);
  const [chartData, setChartData] = useState<{
    labels: string[];
    data: number[];
  } | null>(null);

  // Create and update chart
  const createOrUpdateChart = () => {
    if (!chartRef.current || !chartData) return;

    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions
    const container = containerRef.current;
    if (container) {
      const { width, height } = container.getBoundingClientRect();
      chartRef.current.width = width;
      chartRef.current.height = height;
    }

    // Destroy existing chart
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    // Create new chart
    chartInstance.current = new ChartJS(ctx, {
      type: 'bar',
      data: {
        labels: chartData.labels,
        datasets: [{
          label: 'Swap Count',
          data: chartData.data,
          backgroundColor: '#ec4899',
          borderColor: '#be185d',
          borderWidth: 1,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            title: {
              display: true,
              text: `Price (${token1.symbol}/${token0.symbol})`,
              color: '#e5e7eb',
            },
            grid: {
              color: '#374151',
            },
            ticks: {
              color: '#9ca3af',
            }
          },
          y: {
            title: {
              display: true,
              text: 'Number of Swaps',
              color: '#e5e7eb',
            },
            grid: {
              color: '#374151',
            },
            ticks: {
              color: '#9ca3af',
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: 'Swap Price Distribution',
            color: '#e5e7eb',
            font: {
              size: 16,
            }
          },
          legend: {
            labels: {
              color: '#e5e7eb',
            }
          },
          tooltip: {
            backgroundColor: '#1f2937',
            titleColor: '#e5e7eb',
            bodyColor: '#e5e7eb',
            borderColor: '#374151',
            borderWidth: 1,
          }
        },
      }
    });
  };

  // Handle resize
  useEffect(() => {
    const resizeObserver = new ResizeObserver(() => {
      if (chartData) {
        createOrUpdateChart();
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [chartData, token0, token1]);

  // Fetch data
  useEffect(() => {
    const fetchSwapEvents = async () => {
      try {
        setIsLoading(true);
        setError(null);
        setChartData(null);

        // Swap event topic
        const swapTopic = ethers.utils.id("Swap(address,uint256,uint256,uint256,uint256,address)");
        
        // Get the last 1000 blocks of events
        const currentBlock = await provider.getBlockNumber();
        const fromBlock = currentBlock - 1000;
        
        // Query logs
        const logs = await provider.getLogs({
          address: pairAddress,
          topics: [swapTopic],
          fromBlock,
          toBlock: 'latest'
        });

        if (logs.length === 0) {
          setHasData(false);
          setIsLoading(false);
          return;
        }

        // Parse events
        const iface = new ethers.utils.Interface([
          "event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)"
        ]);

        const swapEvents: SwapEvent[] = logs.map(log => {
          const event = iface.parseLog(log);
          const { sender, to, amount0In, amount1In, amount0Out, amount1Out } = event.args;
          
          let price: number;
          if (!amount0In.isZero()) {
            price = parseFloat(ethers.utils.formatUnits(amount1Out, token1.decimals)) / 
                   parseFloat(ethers.utils.formatUnits(amount0In, token0.decimals));
          } else {
            price = parseFloat(ethers.utils.formatUnits(amount1In, token1.decimals)) / 
                   parseFloat(ethers.utils.formatUnits(amount0Out, token0.decimals));
          }
          
          return {
            sender,
            to,
            amount0In,
            amount1In,
            amount0Out,
            amount1Out,
            price
          };
        });

        // Create price distribution
        const prices = swapEvents.map(event => event.price);
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const range = max - min;
        const bucketCount = 20;
        const bucketSize = range / bucketCount;

        const buckets = new Array(bucketCount).fill(0);
        prices.forEach(price => {
          const bucketIndex = Math.min(
            Math.floor((price - min) / bucketSize),
            bucketCount - 1
          );
          buckets[bucketIndex]++;
        });

        const labels = buckets.map((_, i) => 
          (min + (i * bucketSize)).toFixed(6)
        );

        setChartData({ labels, data: buckets });
        setHasData(true);
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching swap events:', error);
        setError('Failed to load swap history. Please try again later.');
        setIsLoading(false);
      }
    };

    fetchSwapEvents();
  }, [token0, token1, pairAddress, provider]);

  // Create/update chart when data changes
  useEffect(() => {
    if (chartData) {
      // Small delay to ensure the DOM is ready
      const timer = setTimeout(() => {
        createOrUpdateChart();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [chartData]);

  if (isLoading) {
    return (
      <div className="w-full h-96 bg-darker rounded-lg p-4 flex items-center justify-center">
        <div className="text-white">Loading swap history...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-96 bg-darker rounded-lg p-4 flex items-center justify-center">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="w-full h-96 bg-darker rounded-lg p-4 flex items-center justify-center">
        <div className="text-gray-400">No swap history available for this pair</div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-96 bg-darker rounded-lg p-4">
      <canvas ref={chartRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}; 