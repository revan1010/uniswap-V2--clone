import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useWeb3Context } from '../context/Web3Context';

const UNI_LOGO_URL = 'https://assets.coingecko.com/coins/images/12504/small/uniswap-uni.png';

export const Header = () => {
  const { account, disconnectWallet, connectWallet } = useWeb3Context();
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path || (path !== '/' && location.pathname.startsWith(path));
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getNavLinkClass = (path: string) => {
    if (path === '/nl') {
      return isActive(path)
        ? 'px-5 py-3 rounded-xl font-medium text-lg relative bg-gradient-to-r from-pink-500 via-purple-500 to-pink-500 text-white animate-gradient-x shadow-lg shadow-pink-500/20 hover:shadow-pink-500/40 transition-all duration-300 border border-white/10'
        : 'px-5 py-3 rounded-xl font-medium text-lg relative bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-pink-500/10 text-pink-500 hover:bg-gradient-to-r hover:from-pink-500/20 hover:via-purple-500/20 hover:to-pink-500/20 transition-all duration-300';
    }
    
    return `px-5 py-3 rounded-xl transition-all duration-200 font-medium text-lg ${
      isActive(path)
        ? 'bg-pink-500/10 text-pink-500'
        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
    }`;
  };

  return (
    <>
      {/* Spacer div to prevent content from going under fixed header */}
      <div className="h-[100px]" />
      
      {/* Fixed Header Container with Margin */}
      <div className="fixed top-0 left-0 right-0 z-50 px-6 pt-4">
        {/* Header with Island Effect */}
        <header className="mx-auto max-w-7xl rounded-2xl border border-gray-800/50 backdrop-blur-xl bg-gray-900/40 shadow-[0_0_20px_10px_rgba(0,0,0,0.1)] hover:shadow-[0_0_25px_12px_rgba(0,0,0,0.12)] transition-shadow duration-300">
          <div className="px-8 py-4">
            <nav className="flex items-center justify-between">
              {/* Logo and Nav Links */}
              <div className="flex items-center gap-14">
                <Link to="/" className="flex items-center gap-4 group">
                  <img 
                    src={UNI_LOGO_URL}
                    alt="UNI Token" 
                    className="w-14 h-14 rounded-full shadow-lg shadow-pink-500/20 group-hover:shadow-pink-500/40 group-hover:rotate-12 transition-all duration-300"
                  />
                  <span className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-purple-500">
                    Uniswap V2
                  </span>
                </Link>
                
                <div className="flex items-center gap-3">
                  {[
                    { path: '/swap', label: 'Swap' },
                    { path: '/pool', label: 'Pool' },
                    { path: '/nl', label: 'AI Chat' },
                    { path: '/nl/test', label: 'Test Cases' }
                  ].map(({ path, label }) => (
                    <Link
                      key={path}
                      to={path}
                      className={getNavLinkClass(path)}
                    >
                      {label}
                      {path === '/nl' && !isActive(path) && (
                        <span className="absolute -top-1 -right-1 flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-pink-500"></span>
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>

              {/* Wallet Section */}
              <div className="flex items-center gap-4">
                {account ? (
                  <div className="flex items-center gap-4">
                    <div className="px-5 py-3 rounded-xl bg-gray-800/50 border border-gray-700/50 text-gray-300 font-medium text-lg">
                      {formatAddress(account)}
                    </div>
                    <button
                      onClick={disconnectWallet}
                      className="px-5 py-3 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors font-medium text-lg"
                    >
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={connectWallet}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 text-white hover:opacity-90 transition-opacity font-medium text-lg"
                  >
                    Connect Wallet
                  </button>
                )}
              </div>
            </nav>
          </div>
        </header>
      </div>
    </>
  );
}; 