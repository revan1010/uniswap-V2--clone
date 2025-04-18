import React, { useState } from 'react';
import { useWeb3Context } from '../context/Web3Context';
import { processNaturalLanguage } from '../services/openai';
import { createCommandExecutor } from '../services/commands';

export const NaturalLanguage: React.FC = () => {
  const { account, routerContract, provider, signer } = useWeb3Context();
  const [command, setCommand] = useState('');
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

  const handleCommandSubmit = async () => {
    if (!command.trim()) return;

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
            />
          </div>
          
          <button
            onClick={handleCommandSubmit}
            disabled={isProcessing || !command.trim()}
            className={`w-full ${
              isProcessing || !command.trim()
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-primary hover:bg-opacity-90'
            } text-white py-3 px-4 rounded-lg font-medium transition-colors`}
          >
            {isProcessing ? 'Processing...' : 'Execute Command'}
          </button>

          {/* Result display */}
          {result && (
            <div className="mt-6 space-y-4">
              <h3 className="text-lg font-medium text-white">Result</h3>
              {result.success ? (
                <div className="space-y-2">
                  <p className="text-green-400">✓ Command processed successfully</p>
                  <div className="bg-darker rounded-lg p-4">
                    <p className="text-gray-400">Action: {result.action}</p>
                    <p className="text-gray-400">Parameters:</p>
                    <pre className="text-gray-400 mt-2 whitespace-pre-wrap">
                      {JSON.stringify(result.parameters, null, 2)}
                    </pre>
                  </div>
                  {result.executionResult && (
                    <div className="bg-darker rounded-lg p-4 mt-4">
                      <p className="text-gray-400">Execution Result:</p>
                      <pre className="text-gray-400 mt-2 whitespace-pre-wrap">
                        {JSON.stringify(result.executionResult, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-red-900 bg-opacity-50 border border-red-700 rounded-lg p-4">
                  <p className="text-red-400">Error: {result.error}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}; 