import React, { useState, useEffect, useCallback } from 'react';
import { TEST_TOKENS, WETH_ADDRESS } from '../constants/addresses';
import { Token } from '../utils/tokens';

interface TokenSelectorProps {
  selectedToken: Token | null;
  onSelectToken: (token: Token | null) => void;
  otherSelectedToken: Token | null;
  className?: string;
  label?: string;
}

const TokenSelector: React.FC<TokenSelectorProps> = ({
  selectedToken,
  onSelectToken,
  otherSelectedToken,
  className = '',
  label
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredTokens, setFilteredTokens] = useState<Token[]>(TEST_TOKENS);

  // Memoize the filter function to improve performance
  const filterTokens = useCallback((query: string) => {
    const searchTerms = query.toLowerCase().trim().split(/\s+/);
    return TEST_TOKENS.filter(token => {
      // Skip the other selected token
      if (token.address === otherSelectedToken?.address) {
        return false;
      }

      // Check if all search terms match either symbol, name, or address
      return searchTerms.every(term =>
        token.symbol.toLowerCase().includes(term) ||
        token.name.toLowerCase().includes(term) ||
        token.address.toLowerCase().includes(term)
      );
    });
  }, [otherSelectedToken]);

  // Update filtered tokens when search query changes
  useEffect(() => {
    const filtered = searchQuery ? filterTokens(searchQuery) : TEST_TOKENS.filter(
      token => token.address !== otherSelectedToken?.address
    );
    setFilteredTokens(filtered);
  }, [searchQuery, filterTokens]);

  const handleTokenSelect = (token: Token) => {
    onSelectToken(token);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div className="relative">
      {label && (
        <label className="block text-sm font-medium text-gray-300 mb-1">
          {label}
        </label>
      )}
      <button
        type="button"
        className={`w-full flex items-center justify-between bg-dark text-white px-4 py-2 rounded-lg border border-gray-700 hover:border-gray-500 focus:outline-none ${className}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        {selectedToken ? (
          <div className="flex items-center">
            <div className="relative">
              <img
                src={selectedToken.logoURI}
                alt={selectedToken.symbol}
                className="w-6 h-6 rounded-full mr-2"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  target.nextElementSibling?.classList.remove('hidden');
                }}
              />
              <div className="w-6 h-6 rounded-full bg-gray-700 hidden flex items-center justify-center text-xs mr-2 absolute inset-0">
                {selectedToken.symbol.charAt(0)}
              </div>
            </div>
            <span>{selectedToken.symbol}</span>
          </div>
        ) : (
          <span className="text-gray-400">Select a token</span>
        )}
        <svg
          className="w-4 h-4 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M19 9l-7 7-7-7"
          ></path>
        </svg>
      </button>

      {isOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="fixed inset-0 bg-black/70" onClick={() => setIsOpen(false)} />
          <div className="relative bg-darker w-full max-w-sm mx-4 rounded-xl border border-gray-800 shadow-xl">
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
              <h3 className="text-sm font-medium text-white">Select a token</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-2">
              <input
                type="text"
                placeholder="Search name, symbol, or paste address"
                className="w-full bg-dark text-white px-3 py-1.5 text-sm rounded-xl border border-gray-700 focus:outline-none focus:border-primary"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
              <div className="max-h-[240px] overflow-y-auto mt-1">
                {filteredTokens.map((token) => (
                  <button
                    key={token.address}
                    className="w-full text-left px-2 py-1.5 hover:bg-dark flex items-center focus:outline-none transition-colors duration-200 rounded-lg"
                    onClick={() => handleTokenSelect(token)}
                  >
                    <div className="relative">
                      <img
                        src={token.logoURI}
                        alt={token.symbol}
                        className="w-6 h-6 rounded-full mr-2"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          target.nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                      <div className="w-6 h-6 rounded-full bg-gray-700 hidden flex items-center justify-center text-xs mr-2 absolute inset-0">
                        {token.symbol.charAt(0)}
                      </div>
                    </div>
                    <div className="flex flex-col">
                      <div className="font-medium text-sm text-white leading-none">{token.symbol}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{token.name}</div>
                    </div>
                  </button>
                ))}
                {filteredTokens.length === 0 && (
                  <div className="px-2 py-1.5 text-gray-400 text-center text-xs">
                    No tokens found for "{searchQuery}"
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TokenSelector;