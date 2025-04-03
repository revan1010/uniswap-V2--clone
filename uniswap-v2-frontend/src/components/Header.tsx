import React from 'react';
import { WalletConnect } from './WalletConnect';

export const Header: React.FC = () => {
  return (
    <header className="flex justify-between items-center py-4 px-6 bg-dark">
      <div className="flex items-center">
        <h1 className="text-2xl font-bold text-primary mr-8">Uniswap V2</h1>
        <nav className="hidden md:flex space-x-6">
          <a href="#swap" className="text-white hover:text-primary transition-colors">Swap</a>
          <a href="#pool" className="text-white hover:text-primary transition-colors">Pool</a>
          <a href="#charts" className="text-white hover:text-primary transition-colors">Charts</a>
        </nav>
      </div>
      <WalletConnect />
    </header>
  );
}; 