import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useWeb3Context } from '../context/Web3Context';

export const Header = () => {
  const { account, disconnectWallet, connectWallet } = useWeb3Context();
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path || (path !== '/' && location.pathname.startsWith(path));
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <header className="border-b border-gray-800/50 backdrop-blur-xl bg-gray-900/40">
      <div className="container mx-auto px-4 py-4">
        <nav className="flex items-center justify-between">
          {/* Logo and Nav Links */}
          <div className="flex items-center gap-12">
            <Link to="/" className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-purple-500">
              Uniswap V2
            </Link>
            
            <div className="flex items-center gap-2">
              {[
                { path: '/swap', label: 'Swap' },
                { path: '/pool', label: 'Pool' },
                { path: '/nl', label: 'AI Chat' },
                { path: '/nl/test', label: 'Test Cases' }
              ].map(({ path, label }) => (
                <Link
                  key={path}
                  to={path}
                  className={`px-4 py-2 rounded-xl transition-all duration-200 font-medium ${
                    isActive(path)
                      ? 'bg-pink-500/10 text-pink-500'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                  }`}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>

          {/* Wallet Section */}
          <div className="flex items-center gap-3">
            {account ? (
              <div className="flex items-center gap-3">
                <div className="px-4 py-2 rounded-xl bg-gray-800/50 border border-gray-700/50 text-gray-300 font-medium">
                  {formatAddress(account)}
                </div>
                <button
                  onClick={disconnectWallet}
                  className="px-4 py-2 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors font-medium"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={connectWallet}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 text-white hover:opacity-90 transition-opacity font-medium"
              >
                Connect Wallet
              </button>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}; 