import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Web3Provider } from './context/Web3Context'
import { Header } from './components/Header'
import { Swap } from './components/Swap'
import { Pool } from './components/Pool'
import { NaturalLanguage } from './pages/NaturalLanguage'
import './App.css'

function App() {
  return (
    <Web3Provider>
      <Router>
        <div className="min-h-screen bg-dark text-white">
          <Header />
          <main className="container mx-auto py-6 px-4">
            <h2 className="text-3xl font-bold text-center mb-6">
              Uniswap V2 Interface
            </h2>
            
            <Routes>
              <Route path="/swap" element={<Swap />} />
              <Route path="/pool" element={<Pool />} />
              <Route path="/nl" element={<NaturalLanguage />} />
              <Route path="/" element={<Navigate to="/swap" replace />} />
            </Routes>
          </main>
          <footer className="container mx-auto py-6 px-4 text-center text-gray-400">
            <p>Uniswap V2 Frontend • Deployed on Fork Ethereum Mainnet</p>
          </footer>
        </div>
      </Router>
    </Web3Provider>
  )
}

export default App
