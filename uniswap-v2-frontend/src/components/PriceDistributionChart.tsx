import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Token } from '../utils/tokens';
import { useSwapHistory } from '../hooks/useSwapHistory';
import { useWeb3Context } from '../context/Web3Context';

interface PriceDistributionChartProps {
  pairAddress?: string;
  token0: Token | null;
  token1: Token | null;
}

export const PriceDistributionChart: React.FC<PriceDistributionChartProps> = ({
  pairAddress,
  token0,
  token1,
}) => {
  const { provider } = useWeb3Context();
  const { swapEvents, isLoading } = useSwapHistory(
    pairAddress,
    token0,
    token1,
    provider || undefined
  );

  const data = useMemo(() => {
    if (!swapEvents.length) return [];

    // Calculate price ranges for the histogram
    const prices = swapEvents.map(event => event.executionPrice);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const range = maxPrice - minPrice;
    const numBins = 20;
    const binSize = range / numBins;

    // Create bins
    const bins = Array(numBins).fill(0);
    prices.forEach(price => {
      const binIndex = Math.min(
        Math.floor((price - minPrice) / binSize),
        numBins - 1
      );
      bins[binIndex]++;
    });

    // Create data points for the chart
    return bins.map((count, index) => ({
      price: (minPrice + (index + 0.5) * binSize).toFixed(6),
      count,
    }));
  }, [swapEvents]);

  if (!token0 || !token1 || !data.length) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="w-full h-64 bg-dark rounded-lg p-4">
        <h3 className="text-white text-lg mb-4">Price Distribution</h3>
        <div className="flex items-center justify-center h-full">
          <p className="text-gray-400">Loading swap history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-80 bg-dark rounded-lg p-4">
      <h3 className="text-white text-lg mb-2">Price Distribution</h3>
      <p className="text-gray-400 text-sm mb-4">
        Shows how many swaps occurred at different price levels. Taller bars indicate more frequent trading at that price.
      </p>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 30, bottom: 40, left: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#444" />
          <XAxis
            dataKey="price"
            stroke="#888"
            label={{
              value: `Price (${token1.symbol} per ${token0.symbol})`,
              position: 'bottom',
              fill: '#888',
              offset: 20
            }}
            tickFormatter={(value) => parseFloat(value).toFixed(4)}
          />
          <YAxis
            stroke="#888"
            label={{
              value: 'Number of Trades',
              angle: -90,
              position: 'left',
              fill: '#888',
              offset: 40
            }}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#222', border: 'none', padding: '10px' }}
            labelStyle={{ color: '#888', marginBottom: '5px' }}
            formatter={(value: number) => [`${value} trades`, 'Trading Volume']}
            labelFormatter={(price) => {
              const formattedPrice = parseFloat(price).toFixed(6);
              return `Price Range: ${formattedPrice} ${token1.symbol} per ${token0.symbol}`;
            }}
          />
          <Bar 
            dataKey="count" 
            fill="#ff007a"
            name="Number of Trades"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}; 