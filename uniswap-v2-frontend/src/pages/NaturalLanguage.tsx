import React, { useState, useEffect } from 'react';
import { useWeb3Context } from '../context/Web3Context';
import { processNaturalLanguage, setOpenAIKey } from '../services/openai';
import { createCommandExecutor } from '../services/commands';

export const NaturalLanguage: React.FC = () => {
  const { account, routerContract, provider, signer } = useWeb3Context();
  const [command, setCommand] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [isApiKeySet, setIsApiKeySet] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
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

  // Load API key from localStorage on component mount
  useEffect(() => {
    const savedKey = localStorage.getItem('openai_api_key');
    if (savedKey) {
      setApiKey(savedKey);
      setOpenAIKey(savedKey);
      setIsApiKeySet(true);
    }
  }, []);

  const handleApiKeySubmit = () => {
    if (apiKey.trim()) {
      localStorage.setItem('openai_api_key', apiKey);
      setOpenAIKey(apiKey);
      setIsApiKeySet(true);
    }
  };

  const handleApiKeyReset = () => {
    localStorage.removeItem('openai_api_key');
    setApiKey('');
    setIsApiKeySet(false);
    setShowApiKey(false);
  };

  const handleCommandSubmit = async () => {
    if (!command.trim() || !isApiKeySet) return;

    setIsProcessing(true);
    try {
      // First, process the natural language command
      const nlpResult = await processNaturalLanguage(command);
      
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
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Natural Language Interface</h1>
        
        {/* API Key Section */}
        <div className="bg-dark rounded-lg p-6 shadow-lg mb-6">
          <h2 className="text-xl font-semibold text-white mb-4">OpenAI API Key Setup</h2>
          {!isApiKeySet ? (
            <div className="space-y-4">
              <p className="text-gray-400">
                To use the natural language interface, you need to provide your OpenAI API key.
                You can get one from{' '}
                <a 
                  href="https://platform.openai.com/api-keys" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  OpenAI's platform
                </a>.
              </p>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="flex-1 bg-darker border border-gray-700 rounded-lg py-2 px-3 text-white placeholder-gray-500 focus:outline-none focus:border-primary"
                  placeholder="Enter your OpenAI API key"
                />
                <button
                  onClick={handleApiKeySubmit}
                  className="bg-primary hover:bg-opacity-90 text-white px-4 py-2 rounded-lg font-medium"
                >
                  Save Key
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-green-400">✓ API key is set and ready to use</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="text-primary hover:text-opacity-90"
                >
                  {showApiKey ? 'Hide API Key' : 'Show API Key'}
                </button>
                <button
                  onClick={handleApiKeyReset}
                  className="text-red-400 hover:text-opacity-90 ml-4"
                >
                  Reset API Key
                </button>
              </div>
              {showApiKey && (
                <input
                  type="text"
                  value={apiKey}
                  readOnly
                  className="w-full bg-darker border border-gray-700 rounded-lg py-2 px-3 text-white"
                />
              )}
            </div>
          )}
        </div>

        {/* Main content area */}
        <div className="bg-dark rounded-lg p-6 shadow-lg">
          <div className="mb-6">
            <label htmlFor="nlCommand" className="block text-sm font-medium text-gray-400 mb-2">
              Enter your command
            </label>
            <input
              type="text"
              id="nlCommand"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              className="w-full bg-darker border border-gray-700 rounded-lg py-3 px-4 text-white placeholder-gray-500 focus:outline-none focus:border-primary"
              placeholder="Example: swap 10 USDC for ETH"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleCommandSubmit();
                }
              }}
              disabled={!isApiKeySet}
            />
          </div>
          
          <button
            className={`w-full ${
              isProcessing || !isApiKeySet
                ? 'bg-gray-600 cursor-not-allowed' 
                : 'bg-primary hover:bg-opacity-90'
            } text-white py-3 px-4 rounded-lg font-medium transition-colors`}
            onClick={handleCommandSubmit}
            disabled={isProcessing || !isApiKeySet}
          >
            {isProcessing ? 'Processing...' : 'Execute Command'}
          </button>
          
          {/* Result area */}
          {result && (
            <div className="mt-6 p-4 bg-darker rounded-lg">
              <h2 className="text-lg font-medium text-white mb-2">Result</h2>
              {result.success ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-green-400">✓ Command processed successfully</p>
                    <div className="bg-black bg-opacity-50 p-3 rounded">
                      <p className="text-gray-300">Action: {result.action}</p>
                      <p className="text-gray-300 mt-2">Parameters:</p>
                      <pre className="text-gray-400 text-sm mt-1 overflow-x-auto">
                        {JSON.stringify(result.parameters, null, 2)}
                      </pre>
                    </div>
                  </div>

                  {result.executionResult && (
                    <div className="space-y-2">
                      <p className={result.executionResult.success ? "text-green-400" : "text-red-400"}>
                        {result.executionResult.success ? "✓ Command executed successfully" : "✗ Command execution failed"}
                      </p>
                      <div className="bg-black bg-opacity-50 p-3 rounded">
                        {result.executionResult.error ? (
                          <p className="text-red-400">{result.executionResult.error}</p>
                        ) : (
                          <>
                            {result.executionResult.txHash && (
                              <p className="text-gray-300">
                                Transaction Hash: <span className="text-primary">{result.executionResult.txHash}</span>
                              </p>
                            )}
                            {result.executionResult.reserves && (
                              <div className="text-gray-300">
                                <p>Pool Reserves:</p>
                                <p className="ml-2">Token 0: {result.executionResult.reserves.token0Amount}</p>
                                <p className="ml-2">Token 1: {result.executionResult.reserves.token1Amount}</p>
                              </div>
                            )}
                            {result.executionResult.count !== undefined && (
                              <p className="text-gray-300">
                                Total Swaps: {result.executionResult.count}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-red-400">{result.error}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}; 