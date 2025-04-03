import { useState } from 'react';
import { Web3Provider } from './context/Web3Context'
import { Header } from './components/Header'
import { Swap } from './components/Swap'
import { Pool } from './components/Pool'
import './App.css'

type Tab = 'swap' | 'pool';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('swap');

  return (
    <Web3Provider>
      <div className="min-h-screen bg-dark text-white">
        <Header />
        <main className="container mx-auto py-6 px-4">
          <h2 className="text-3xl font-bold text-center mb-6">
            Uniswap V2 Interface
          </h2>
          
          {/* Tab selection */}
          <div className="flex justify-center mb-8">
            <div className="bg-light rounded-lg p-1 inline-flex">
              <button
                className={`py-2 px-6 rounded-md font-medium transition-colors ${
                  activeTab === 'swap' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'
                }`}
                onClick={() => setActiveTab('swap')}
              >
                Swap
              </button>
              <button
                className={`py-2 px-6 rounded-md font-medium transition-colors ${
                  activeTab === 'pool' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'
                }`}
                onClick={() => setActiveTab('pool')}
              >
                Pool
              </button>
            </div>
          </div>
          
          {/* Component based on active tab */}
          <div className="flex justify-center">
            {activeTab === 'swap' ? <Swap /> : <Pool />}
          </div>
        </main>
        <footer className="container mx-auto py-6 px-4 text-center text-gray-400">
          <p>Uniswap V2 Frontend • Deployed on Fork Ethereum Mainnet</p>
        </footer>
      </div>
    </Web3Provider>
  )
}

export default App
