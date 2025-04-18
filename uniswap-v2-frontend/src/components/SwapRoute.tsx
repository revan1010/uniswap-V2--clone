import React from 'react';
import { Token } from '../utils/tokens';

interface SwapRouteProps {
  path: Token[];
  amounts?: string[];
}

export const SwapRoute: React.FC<SwapRouteProps> = ({ path, amounts }) => {
  if (path.length < 2) return null;

  return (
    <div className="space-y-2">
      <div className="text-sm text-gray-400">Route</div>
      <div className="flex items-center flex-wrap gap-2">
        {path.map((token, index) => (
          <React.Fragment key={token.address}>
            <div className="flex items-center bg-gray-800/50 rounded-lg px-3 py-1.5">
              <div className="relative">
                <img
                  src={token.logoURI}
                  alt={token.symbol}
                  className="w-5 h-5 rounded-full"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    target.nextElementSibling?.classList.remove('hidden');
                  }}
                />
                <div className="w-5 h-5 rounded-full bg-gray-700 hidden flex items-center justify-center text-xs absolute inset-0">
                  {token.symbol.charAt(0)}
                </div>
              </div>
              <span className="ml-2 text-sm font-medium text-white">{token.symbol}</span>
              {amounts && amounts[index] && (
                <span className="ml-2 text-xs text-gray-400" title={`${amounts[index]} ${token.symbol}`}>
                  ({amounts[index].length > 8 ? amounts[index].slice(0, 8) + '...' : amounts[index]})
                </span>
              )}
            </div>
            {index < path.length - 1 && (
              <div className="flex items-center text-gray-500">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
      {path.length > 2 && (
        <div className="text-xs text-gray-400 mt-1">
          Through {path.length - 2} pool{path.length - 2 > 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}; 