// Add type declarations for Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: {
    item(index: number): {
      item(index: number): {
        transcript: string;
      };
    };
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
    };
  };
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}

declare global {
  interface Window {
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
    SpeechRecognition?: SpeechRecognitionConstructor;
  }
}

import React, { useState, useEffect, useRef } from 'react';
import { useWeb3Context } from '../context/Web3Context';
import { processNaturalLanguage } from '../services/openai';
import { createCommandExecutor } from '../services/commands';
import { FaMicrophone, FaStop } from 'react-icons/fa';
import { BsLightningChargeFill } from 'react-icons/bs';
import { AiOutlineLoading3Quarters } from 'react-icons/ai';
import '../styles/animations.css';

export const NaturalLanguage: React.FC = () => {
  const { account, routerContract, provider, signer } = useWeb3Context();
  const [command, setCommand] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
  const [result, setResult] = useState<{
    success: boolean;
    action?: string;
    parameters?: Record<string, any>;
    error?: string;
    executionResult?: {
      success: boolean;
      error?: string;
      txHash?: string;
      reserves?: {
        token0Amount: string;
        token1Amount: string;
      };
      count?: number;
    };
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognitionAPI = (window.webkitSpeechRecognition || window.SpeechRecognition) as SpeechRecognitionConstructor;
      const recognitionInstance = new SpeechRecognitionAPI();
      recognitionInstance.continuous = false;
      recognitionInstance.interimResults = false;
      recognitionInstance.lang = 'en-US';

      recognitionInstance.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0][0].transcript;
        setCommand(transcript);
        handleCommandSubmit(transcript);
      };

      recognitionInstance.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognitionInstance.onend = () => {
        setIsListening(false);
      };

      setRecognition(recognitionInstance);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle command submission
    console.log('Command submitted:', command);
    setCommand('');
  };

  const toggleListening = () => {
    if (!recognition) return;

    if (isListening) {
      recognition.stop();
    } else {
      recognition.start();
      setIsListening(true);
    }
  };

  const handleCommandSubmit = async (transcriptCommand?: string) => {
    const commandToProcess = transcriptCommand || command;
    if (!commandToProcess.trim()) return;

    setIsProcessing(true);
    try {
      // First, process the natural language command
      const nlpResult = await processNaturalLanguage(commandToProcess);
      
      // If NLP processing failed, return early
      if (!nlpResult.success) {
        setResult(nlpResult);
        return;
      }

      // Create command executor
      const executor = createCommandExecutor(account, routerContract, provider, signer);

      // Execute the command based on the action
      let executionResult;
      switch (nlpResult.action) {
        case 'swapTokens':
          executionResult = await executor.swapTokens(nlpResult.parameters);
          break;
        case 'addLiquidity':
          executionResult = await executor.addLiquidity(nlpResult.parameters);
          break;
        case 'removeLiquidity':
          executionResult = await executor.removeLiquidity(nlpResult.parameters);
          break;
        case 'getPoolReserves':
          executionResult = await executor.getPoolReserves(nlpResult.parameters);
          break;
        case 'getSwapCount':
          executionResult = await executor.getSwapCount(nlpResult.parameters);
          break;
        default:
          executionResult = {
            success: false,
            error: 'Unknown command'
          };
      }

      setResult({
        ...nlpResult,
        executionResult
      });
    } catch (error) {
      setResult({
        success: false,
        error: 'Failed to process command. Please try again.'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 mb-2">
          AI Command Center
        </h1>
        <p className="text-gray-400 text-lg">
          Trade smarter with AI-powered natural language commands
        </p>
      </div>

      <div className="bg-gray-900/40 backdrop-blur-xl border border-gray-800/50 rounded-2xl p-6 shadow-xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <div className="flex items-center gap-2 text-pink-500 mb-3">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="text-sm font-medium">Enter your command or use voice input</span>
            </div>
            
            <div className={`relative rounded-xl transition-all duration-300 ${
              isListening ? 'animate-border-pulse' : ''
            }`}>
              <div className={`absolute inset-0 rounded-xl ${
                isListening ? 'bg-gradient-to-r from-pink-500/20 via-purple-500/20 to-pink-500/20 animate-gradient' : ''
              }`} />
              
              <div className="relative flex items-center">
                <input
                  ref={inputRef}
                  type="text"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder="Example: swap 10 USDC for ETH"
                  className={`w-full bg-gray-800/50 text-white ${
                    isListening ? 'pl-24' : 'pl-4'
                  } py-3 rounded-xl border ${
                    isListening 
                      ? 'border-pink-500/50' 
                      : 'border-gray-700'
                  } focus:outline-none focus:border-pink-500 pr-12 placeholder-gray-500 transition-all duration-300`}
                />
                
                {/* Recording Status Indicator */}
                {isListening && (
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
                    <div className="flex items-center gap-1.5 bg-pink-500/10 px-2 py-0.5 rounded-full border border-pink-500/20">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-500 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-pink-500" />
                      </span>
                      <span className="text-pink-500 text-xs font-semibold tracking-wide uppercase">Live</span>
                    </div>
                  </div>
                )}

                {/* Voice Input Button */}
                <button
                  type="button"
                  onClick={toggleListening}
                  className={`absolute right-3 p-2 rounded-lg transition-all duration-300 ${
                    isListening 
                      ? 'bg-pink-500 text-white hover:bg-pink-600' 
                      : 'text-gray-400 hover:text-pink-500 hover:bg-gray-700/50'
                  }`}
                >
                  {isListening ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Recording Status Banner */}
            {isListening && (
              <div className="absolute -bottom-14 left-0 right-0 bg-gradient-to-r from-pink-500/5 via-purple-500/5 to-pink-500/5 backdrop-blur-sm border border-pink-500/20 rounded-lg py-2.5 px-4 flex items-center justify-between animate-fadeIn">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <svg className="w-5 h-5 text-pink-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                    <span className="absolute -top-1 -right-1 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-500 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-pink-500" />
                    </span>
                  </div>
                  <span className="text-gray-300 text-sm">Listening for voice command...</span>
                </div>
                <button
                  onClick={toggleListening}
                  className="text-xs bg-pink-500 hover:bg-pink-600 text-white px-3 py-1.5 rounded-lg transition-colors font-medium"
                >
                  Stop
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => handleCommandSubmit()}
            disabled={isProcessing || !command.trim()}
            className={`w-full ${
              isProcessing || !command.trim()
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-gradient-to-r from-pink-500 to-purple-500 hover:opacity-90'
            } text-white py-3 px-4 rounded-xl font-medium transition-all focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 focus:ring-offset-gray-900 mt-8`}
          >
            {isProcessing ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Processing...
              </span>
            ) : (
              'Execute Command'
            )}
          </button>
        </form>

        {!result && (
          <div className="mt-6 space-y-2">
            <div className="text-sm font-medium text-gray-400">Example commands:</div>
            <div className="space-y-2 text-sm text-gray-500">
              <div className="bg-gray-800/30 p-2 rounded-lg">"swap 10 LINK for WETH"</div>
              <div className="bg-gray-800/30 p-2 rounded-lg">" add liquidity of 4 WETH in WETH-LINK pool"</div>
              <div className="bg-gray-800/30 p-2 rounded-lg">" how many swaps have been so far today for UNI-WETH pool"</div>
            </div>
          </div>
        )}
      </div>

      {/* Result Flow Chart */}
      {result && (
        <div className="mt-8 space-y-6 animate-fadeIn">
          <div className="bg-gray-900/40 backdrop-blur-xl border border-gray-800/50 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-6">
              <div className={`w-3 h-3 rounded-full ${result.success ? 'bg-green-400' : 'bg-red-400'} animate-pulse`}></div>
              <h3 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                Transaction Flow
              </h3>
            </div>

            <div className="relative">
              {/* Step 1: Command Processing */}
              <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6 mb-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold shadow-lg">1</div>
                  <h4 className="text-xl font-semibold text-blue-400">Command Processing</h4>
                </div>
                <div className="pl-11">
                  <p className={`text-lg ${result.success ? 'text-green-400' : 'text-red-400'}`}>
                    {result.success ? '✓ Command processed successfully' : `✗ ${result.error}`}
                  </p>
                </div>
              </div>

              {/* Connecting Line */}
              {result.success && (
                <div className="absolute left-10 top-[5.5rem] w-0.5 h-12 bg-gradient-to-b from-blue-500 to-purple-500"></div>
              )}

              {/* Step 2: Action Details */}
              {result.success && (
                <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6 mb-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg">2</div>
                    <h4 className="text-xl font-semibold text-purple-400">Action Details</h4>
                  </div>
                  <div className="pl-11">
                    <div className="mb-3">
                      <span className="text-gray-400">Action Type:</span>
                      <span className="ml-2 text-lg font-medium text-pink-500">{result.action}</span>
                    </div>
                    <div className="space-y-2">
                      <span className="text-gray-400">Parameters:</span>
                      <pre className="mt-2 bg-gray-900/50 p-4 rounded-lg overflow-x-auto font-mono text-sm text-emerald-300">
                        {JSON.stringify(result.parameters, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              )}

              {/* Connecting Line */}
              {result.success && result.executionResult && (
                <div className="absolute left-10 top-[16rem] w-0.5 h-12 bg-gradient-to-b from-purple-500 to-pink-500"></div>
              )}

              {/* Step 3: Execution Result */}
              {result.success && result.executionResult && (
                <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-pink-500 to-pink-600 flex items-center justify-center text-white font-bold shadow-lg">3</div>
                    <h4 className="text-xl font-semibold text-pink-400">Execution Result</h4>
                  </div>
                  <div className="pl-11">
                    <div className={`text-lg mb-3 ${result.executionResult.success ? 'text-green-400' : 'text-red-400'}`}>
                      {result.executionResult.success ? '✓ Transaction successful' : `✗ ${result.executionResult.error}`}
                    </div>
                    {result.executionResult.success && (
                      <div className="bg-gray-900/50 p-4 rounded-lg overflow-x-auto">
                        <pre className="font-mono text-sm text-cyan-300">
                          {JSON.stringify(
                            {
                              ...result.executionResult,
                              success: undefined,
                              error: undefined
                            },
                            null,
                            2
                          )}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 