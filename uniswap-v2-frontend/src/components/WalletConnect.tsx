import React from 'react';
import { useWeb3Context } from '../context/Web3Context';
import { RPC_URL } from '../constants/addresses';

// Tenderly mainnet fork configuration
const TENDERLY_CHAIN_ID = 1; // Mainnet chain ID
const NETWORK_NAME = 'Tenderly Mainnet Fork';

export const WalletConnect: React.FC = () => {
  const { account, isConnected, connectWallet, disconnectWallet, isCorrectNetwork } = useWeb3Context();

  const handleConnect = async () => {
    await connectWallet();
  };

  const handleDisconnect = () => {
    disconnectWallet();
  };

  const handleSwitchNetwork = async () => {
    if (window?.ethereum) {
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${TENDERLY_CHAIN_ID.toString(16)}` }],
        });
      } catch (error: any) {
        // This error code indicates that the chain has not been added to MetaMask
        if (error.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: `0x${TENDERLY_CHAIN_ID.toString(16)}`,
                chainName: NETWORK_NAME,
                nativeCurrency: {
                  name: 'ETH',
                  symbol: 'ETH',
                  decimals: 18,
                },
                rpcUrls: [RPC_URL],
                blockExplorerUrls: ['https://etherscan.io/'],
              },
            ],
          });
        }
      }
    }
  };

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="flex items-center space-x-2">
      {isConnected ? (
        <>
          {!isCorrectNetwork && (
            <button
              onClick={handleSwitchNetwork}
              className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
            >
              Switch to Mainnet
            </button>
          )}
          <div className="px-4 py-2 bg-light rounded-lg text-white">
            {account ? truncateAddress(account) : ''}
          </div>
          <button
            onClick={handleDisconnect}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
          >
            Disconnect
          </button>
        </>
      ) : (
        <button
          onClick={handleConnect}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-opacity-90 transition-colors"
        >
          Connect Wallet
        </button>
      )}
    </div>
  );
}; 