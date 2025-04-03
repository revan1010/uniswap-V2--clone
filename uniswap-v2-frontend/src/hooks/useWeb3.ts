import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { RPC_URL } from '../constants/addresses';
import { ERC20_ABI, FACTORY_ABI, PAIR_ABI, ROUTER_ABI } from '../constants/abis';
import { FACTORY_ADDRESS, ROUTER_ADDRESS } from '../constants/addresses';

// Tenderly mainnet fork configuration
const TENDERLY_CHAIN_ID = 1; // Mainnet chain ID
const NETWORK_NAME = 'Tenderly Mainnet Fork';

export interface Web3Context {
  provider: ethers.providers.Web3Provider | null;
  signer: ethers.Signer | null;
  account: string | null;
  chainId: number | null;
  isConnected: boolean;
  isCorrectNetwork: boolean;
  factoryContract: ethers.Contract | null;
  routerContract: ethers.Contract | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  switchNetwork: () => Promise<void>;
  getERC20Contract: (address: string) => ethers.Contract | null;
  getPairContract: (address: string) => ethers.Contract | null;
}

export function useWeb3(): Web3Context {
  const [provider, setProvider] = useState<ethers.providers.Web3Provider | null>(null);
  const [tenderlyProvider, setTenderlyProvider] = useState<ethers.providers.JsonRpcProvider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [factoryContract, setFactoryContract] = useState<ethers.Contract | null>(null);
  const [routerContract, setRouterContract] = useState<ethers.Contract | null>(null);

  // For Tenderly, we consider Mainnet (1) as the correct network
  const isCorrectNetwork = chainId === TENDERLY_CHAIN_ID;

  // Initialize Tenderly provider
  useEffect(() => {
    try {
      const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
      setTenderlyProvider(provider);
    } catch (error) {
      console.error("Failed to initialize Tenderly provider:", error);
    }
  }, []);

  const setupContracts = useCallback((walletSigner: ethers.Signer) => {
    try {
      if (!tenderlyProvider) {
        console.error("Tenderly provider not initialized");
        return;
      }
      
      // Create contracts with Tenderly provider for reading
      const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, tenderlyProvider);
      // But use the signer for writing operations
      const factoryWithSigner = factory.connect(walletSigner);
      setFactoryContract(factoryWithSigner);
  
      const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, tenderlyProvider);
      const routerWithSigner = router.connect(walletSigner);
      setRouterContract(routerWithSigner);
    } catch (error) {
      console.error('Error setting up contracts:', error);
      setFactoryContract(null);
      setRouterContract(null);
    }
  }, [tenderlyProvider]);

  const switchNetwork = useCallback(async () => {
    if (!window.ethereum) return;
    
    try {
      // Try to switch to Mainnet for Tenderly
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${TENDERLY_CHAIN_ID.toString(16)}` }]
      });
    } catch (error: any) {
      // If the error code is 4902, the chain hasn't been added to MetaMask
      if (error.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: `0x${TENDERLY_CHAIN_ID.toString(16)}`,
                chainName: NETWORK_NAME,
                nativeCurrency: {
                  name: 'ETH',
                  symbol: 'ETH',
                  decimals: 18
                },
                rpcUrls: [RPC_URL],
                blockExplorerUrls: ['https://etherscan.io/']
              }
            ]
          });
        } catch (addError) {
          console.error('Error adding Tenderly network to MetaMask:', addError);
        }
      } else {
        console.error('Error switching to Tenderly network:', error);
      }
    }
  }, []);

  const connectWallet = useCallback(async () => {
    try {
      if (!window?.ethereum) {
        alert('Please install MetaMask to use this application');
        return;
      }
      
      // First check if we need to switch networks
      const { ethereum } = window;
      const chainIdHex = await ethereum.request({ method: 'eth_chainId' });
      const currentChainId = parseInt(chainIdHex, 16);
      
      if (currentChainId !== TENDERLY_CHAIN_ID) {
        alert(`Please switch to Ethereum Mainnet to use this application with Tenderly fork.`);
        await switchNetwork();
        // Return early to let the user switch networks first
        return;
      }
      
      // Proceed with connection
      await ethereum.request({ method: 'eth_requestAccounts' });
      
      // Use the metamask provider for signing transactions
      const web3Provider = new ethers.providers.Web3Provider(ethereum);
      const web3Signer = web3Provider.getSigner();
      const address = await web3Signer.getAddress();
      
      setProvider(web3Provider);
      setSigner(web3Signer);
      setAccount(address);
      setChainId(TENDERLY_CHAIN_ID); // Set explicitly to avoid chain ID issues
      setIsConnected(true);
      
      // Setup contracts with the signer
      setupContracts(web3Signer);
      
    } catch (error) {
      console.error('Error connecting wallet:', error);
      alert(`Failed to connect wallet: ${error instanceof Error ? error.message : 'Unknown error'}`);
      disconnectWallet();
    }
  }, [setupContracts, switchNetwork]);

  const disconnectWallet = useCallback(() => {
    setProvider(null);
    setSigner(null);
    setAccount(null);
    setChainId(null);
    setIsConnected(false);
    setFactoryContract(null);
    setRouterContract(null);
  }, []);

  const getERC20Contract = useCallback((address: string) => {
    if (!signer || address === 'ETH') return null;
    
    try {
      if (!tenderlyProvider) {
        console.error("Tenderly provider not initialized");
        return null;
      }
      
      // Create contract with Tenderly provider
      const contract = new ethers.Contract(address, ERC20_ABI, tenderlyProvider);
      return contract.connect(signer);
    } catch (error) {
      console.error('Error creating ERC20 contract:', error);
      return null;
    }
  }, [signer, tenderlyProvider]);

  const getPairContract = useCallback((address: string) => {
    if (!signer) return null;
    
    try {
      if (!tenderlyProvider) {
        console.error("Tenderly provider not initialized");
        return null;
      }
      
      // Create contract with Tenderly provider
      const contract = new ethers.Contract(address, PAIR_ABI, tenderlyProvider);
      return contract.connect(signer);
    } catch (error) {
      console.error('Error creating Pair contract:', error);
      return null;
    }
  }, [signer, tenderlyProvider]);

  useEffect(() => {
    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnectWallet();
      } else if (isConnected) {
        setAccount(accounts[0]);
      }
    };

    const handleChainChanged = (chainIdHex: string) => {
      const newChainId = parseInt(chainIdHex, 16);
      setChainId(newChainId);
      
      // If the chain changed to anything other than Mainnet, alert the user
      if (newChainId !== TENDERLY_CHAIN_ID) {
        alert(`Please switch to Ethereum Mainnet to use this application with Tenderly fork.`);
        disconnectWallet();
      } else if (signer) {
        // If switched to Mainnet, setup contracts
        setupContracts(signer);
      }
    };

    if (window?.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
    }

    return () => {
      if (window?.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, [isConnected, disconnectWallet, signer, setupContracts]);

  return {
    provider,
    signer,
    account,
    chainId,
    isConnected,
    isCorrectNetwork,
    factoryContract,
    routerContract,
    connectWallet,
    disconnectWallet,
    switchNetwork,
    getERC20Contract,
    getPairContract
  };
} 