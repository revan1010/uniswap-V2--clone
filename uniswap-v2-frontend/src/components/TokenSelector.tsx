import React, { useState, useEffect } from 'react';
import { TEST_TOKENS, WETH_ADDRESS } from '../constants/addresses';
import { Token } from '../utils/tokens';

interface TokenSelectorProps {
  selectedToken: Token | null;
  onSelectToken: (token: Token) => void;
  otherSelectedToken?: Token | null;
  label?: string;
}

const TokenSelector: React.FC<TokenSelectorProps> = ({ 
  selectedToken, 
  onSelectToken, 
  otherSelectedToken,
  label = "Select Token"
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredTokens, setFilteredTokens] = useState<Token[]>(TEST_TOKENS);

  // Filter out the other selected token to prevent duplicate selection
  useEffect(() => {
    if (searchQuery) {
      const filtered = TEST_TOKENS.filter(token => 
        (token.address !== otherSelectedToken?.address) && 
        (token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || 
         token.name.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      setFilteredTokens(filtered);
    } else {
      setFilteredTokens(TEST_TOKENS.filter(token => token.address !== otherSelectedToken?.address));
    }
  }, [searchQuery, otherSelectedToken]);

  const handleTokenSelect = (token: Token) => {
    onSelectToken(token);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-300 mb-1">
        {label}
      </label>
      <button
        type="button"
        className="w-full flex items-center justify-between bg-dark text-white px-4 py-2 rounded-lg border border-gray-700 hover:border-gray-500 focus:outline-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        {selectedToken ? (
          <div className="flex items-center">
            <img
              src={selectedToken.logoURI}
              alt={selectedToken.symbol}
              className="w-6 h-6 rounded-full mr-2"
              onError={(e) => {
                // If image fails to load, show fallback with first letter
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                target.nextElementSibling?.classList.remove('hidden');
              }}
            />
            <div className="w-6 h-6 rounded-full bg-gray-700 hidden flex items-center justify-center text-xs mr-2">
              {selectedToken.symbol.charAt(0)}
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
        <div className="absolute z-10 w-full mt-1 bg-darker border border-gray-700 rounded-lg shadow-lg">
          <div className="p-2">
            <input
              type="text"
              placeholder="Search token name or symbol"
              className="w-full bg-dark text-white p-2 rounded-lg border border-gray-700 focus:outline-none focus:border-primary"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filteredTokens.map((token) => (
              <button
                key={token.address}
                className="w-full text-left px-4 py-2 hover:bg-dark flex items-center focus:outline-none"
                onClick={() => handleTokenSelect(token)}
              >
                <img
                  src={token.logoURI}
                  alt={token.symbol}
                  className="w-8 h-8 rounded-full mr-3"
                  onError={(e) => {
                    // If image fails to load, show fallback with first letter
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    target.nextElementSibling?.classList.remove('hidden');
                  }}
                />
                <div className="w-8 h-8 rounded-full bg-gray-700 hidden flex items-center justify-center text-sm mr-3">
                  {token.symbol.charAt(0)}
                </div>
                <div>
                  <div className="font-medium text-white">{token.symbol}</div>
                  <div className="text-xs text-gray-400">{token.name}</div>
                </div>
              </button>
            ))}
            {filteredTokens.length === 0 && (
              <div className="px-4 py-3 text-gray-400 text-center">
                No tokens found for "{searchQuery}"
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TokenSelector; 