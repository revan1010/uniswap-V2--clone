import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import { useWeb3, Web3Context as Web3ContextType } from '../hooks/useWeb3';

const Web3Context = createContext<Web3ContextType | null>(null);

export const useWeb3Context = () => {
  const context = useContext(Web3Context);
  if (!context) {
    throw new Error('useWeb3Context must be used within a Web3Provider');
  }
  return context;
};

export const Web3Provider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const web3 = useWeb3();
  
  // Use useMemo to ensure consistent returned object 
  const contextValue = useMemo(() => web3, [
    web3.provider,
    web3.signer,
    web3.account,
    web3.chainId,
    web3.isConnected,
    web3.isCorrectNetwork,
    web3.factoryContract,
    web3.routerContract
  ]);

  return (
    <Web3Context.Provider value={contextValue}>
      {children}
    </Web3Context.Provider>
  );
}; 