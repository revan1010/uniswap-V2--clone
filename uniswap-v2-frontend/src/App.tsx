import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Web3Provider } from './context/Web3Context'
import { Header } from './components/Header'
import { Swap } from './components/Swap'
import { Pool } from './components/Pool'
import { NaturalLanguage } from './pages/NaturalLanguage'
import { TestEvaluation } from './pages/TestEvaluation'
import TokenBackground from './components/TokenBackground'
import './App.css'

function App() {
  return (
    <Web3Provider>
      <Router>
        <div className="relative min-h-screen overflow-hidden">
          {/* Animated background */}
          <TokenBackground />
          
          {/* Content */}
          <div className="relative z-10">
            <Header />
            <main className="container mx-auto py-6 px-4 min-h-[calc(100vh-180px)]">
              <Routes>
                <Route path="/" element={<Swap />} />
                <Route path="/pool" element={<Pool />} />
                <Route path="/nl" element={<NaturalLanguage />} />
                <Route path="/nl/test" element={<TestEvaluation/>} />
                <Route path="/swap" element={<Swap />} />
              </Routes>
            </main>
            
            {/* Footer with glass effect */}
            <footer className="glass-effect mt-auto py-4 px-4 text-center text-gray-400">
              <p className="text-sm">Uniswap V2 Frontend • Deployed on Fork Ethereum Mainnet</p>
            </footer>
          </div>
        </div>
      </Router>
    </Web3Provider>
  )
}

export default App
