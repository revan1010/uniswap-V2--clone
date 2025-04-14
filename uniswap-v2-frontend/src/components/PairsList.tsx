import React from 'react';
import { useAllPairs } from '../hooks/useAllPairs';
import { formatAmount } from '../utils/tokens';

export const PairsList: React.FC = () => {
  const { pairs, loading, error } = useAllPairs();

  if (loading) {
    return (
      <div className="p-4 bg-darker rounded-lg">
        <div className="animate-pulse flex space-x-4">
          <div className="flex-1 space-y-4 py-1">
            <div className="h-4 bg-gray-700 rounded w-3/4"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-700 rounded"></div>
              <div className="h-4 bg-gray-700 rounded w-5/6"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-darker rounded-lg text-red-400">
        Error loading pairs: {error}
      </div>
    );
  }

  if (!pairs.length) {
    return (
      <div className="p-4 bg-darker rounded-lg text-gray-400">
        No liquidity pairs found. Create the first pair!
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-white mb-4">Available Pairs</h2>
      {pairs.map((pair) => (
        <div key={pair.address} className="bg-darker rounded-lg p-4 border border-gray-800">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              <div className="flex -space-x-2">
                <img
                  src={pair.token0.logoURI}
                  alt={pair.token0.symbol}
                  className="w-8 h-8 rounded-full ring-2 ring-darker"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    target.nextElementSibling?.classList.remove('hidden');
                  }}
                />
                <div className="w-8 h-8 rounded-full bg-gray-700 hidden flex items-center justify-center text-xs ring-2 ring-darker">
                  {pair.token0.symbol.charAt(0)}
                </div>
                <img
                  src={pair.token1.logoURI}
                  alt={pair.token1.symbol}
                  className="w-8 h-8 rounded-full ring-2 ring-darker"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    target.nextElementSibling?.classList.remove('hidden');
                  }}
                />
                <div className="w-8 h-8 rounded-full bg-gray-700 hidden flex items-center justify-center text-xs ring-2 ring-darker">
                  {pair.token1.symbol.charAt(0)}
                </div>
              </div>
              <div className="ml-4">
                <div className="text-white font-medium">
                  {pair.token0.symbol}/{pair.token1.symbol}
                </div>
                <div className="text-sm text-gray-400">
                  Pool: {pair.address.slice(0, 6)}...{pair.address.slice(-4)}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-400">Liquidity:</div>
              <div className="text-white">
                {formatAmount(pair.reserves.reserve0.toString(), pair.token0.decimals)} {pair.token0.symbol}
              </div>
              <div className="text-white">
                {formatAmount(pair.reserves.reserve1.toString(), pair.token1.decimals)} {pair.token1.symbol}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}; 