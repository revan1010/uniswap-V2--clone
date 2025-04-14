import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { WalletConnect } from './WalletConnect';

export const Header: React.FC = () => {
  const location = useLocation();
  
  return (
    <header className="flex justify-between items-center py-4 px-6 bg-dark">
      <div className="flex items-center">
        <Link to="/" className="text-2xl font-bold text-primary mr-8">Uniswap V2</Link>
        <nav className="hidden md:flex space-x-6">
          <Link 
            to="/swap" 
            className={`transition-colors ${
              location.pathname === '/swap' 
                ? 'text-primary' 
                : 'text-white hover:text-primary'
            }`}
          >
            Swap
          </Link>
          <Link 
            to="/pool" 
            className={`transition-colors ${
              location.pathname === '/pool' 
                ? 'text-primary' 
                : 'text-white hover:text-primary'
            }`}
          >
            Pool
          </Link>
        </nav>
      </div>
      <WalletConnect />
    </header>
  );
}; 