import React from 'react';
import { Token } from '../utils/tokens';

interface SwapRouteProps {
  path: Token[];
  amounts?: string[];
}

export const SwapRoute: React.FC<SwapRouteProps> = ({ path, amounts }) => {
  if (path.length < 2) return null;

  return (
    <div className="bg-darker rounded-lg p-3 mb-4">
      <div className="text-sm text-gray-400 mb-2">Route</div>
      <div className="flex items-center">
        {path.map((token, index) => (
          <React.Fragment key={token.address}>
            <div className="flex items-center">
              <img
                src={token.logoURI}
                alt={token.symbol}
                className="w-6 h-6 rounded-full"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  target.nextElementSibling?.classList.remove('hidden');
                }}
              />
              <div className="w-6 h-6 rounded-full bg-gray-700 hidden flex items-center justify-center text-xs">
                {token.symbol.charAt(0)}
              </div>
              <span className="ml-1 text-white">{token.symbol}</span>
              {amounts && amounts[index] && (
                <span className="ml-1 text-gray-400">
                  ({amounts[index]})
                </span>
              )}
            </div>
            {index < path.length - 1 && (
              <svg
                className="w-4 h-4 mx-2 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}; 