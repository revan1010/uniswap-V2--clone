import React, { useState, useEffect } from 'react';
import { processNaturalLanguage } from '../services/openai';

interface TestCase {
  id: string;
  command: string;
  expectedResult: {
    success: boolean;
    action: string;
    parameters?: any;  // Allow any additional properties based on the action type
  };
  isHardCase: boolean;
  actualResult?: string;
}

const defaultTestCases: TestCase[] = [
  // Regular test cases
  {
    id: '1',
    command: 'swap 1 ETH for LINK',
    expectedResult: {
      success: true,
      action: 'swapTokens',
      parameters: {
        amountIn: '1',
        tokenIn: 'ETH',
        tokenOut: 'LINK'
      }
    },
    actualResult: '',
    isHardCase: false
  },
  {
    id: '2',
    command: 'add liquidity 2 ETH and 100 LINK to pool',
    expectedResult: {
      success: true,
      action: 'addLiquidity',
      parameters: {
        token0: 'ETH',
        token1: 'LINK',
        amount0: '2',
        amount1: '100'
      }
    },
    actualResult: '',
    isHardCase: false
  },
  {
    id: '3',
    command: 'remove 5 LP tokens from ETH-LINK pool',
    expectedResult: {
      success: true,
      action: 'removeLiquidity',
      parameters: {
        token0: 'ETH',
        token1: 'LINK',
        lpTokenAmount: '5'
      }
    },
    actualResult: '',
    isHardCase: false
  },
  {
    id: '4',
    command: 'what are the reserves for ETH-LINK pool',
    expectedResult: {
      success: true,
      action: 'getPoolReserves',
      parameters: {
        token0: 'ETH',
        token1: 'LINK'
      }
    },
    actualResult: '',
    isHardCase: false
  },
  {
    id: '5',
    command: 'swap 500 USDC for DAI',
    expectedResult: {
      success: true,
      action: 'swapTokens',
      parameters: {
        amountIn: '500',
        tokenIn: 'USDC',
        tokenOut: 'DAI'
      }
    },
    actualResult: '',
    isHardCase: false
  },
  {
    id: '6',
    command: 'add liquidity 1000 USDC and 1000 DAI to pool',
    expectedResult: {
      success: true,
      action: 'addLiquidity',
      parameters: {
        token0: 'USDC',
        token1: 'DAI',
        amount0: '1000',
        amount1: '1000'
      }
    },
    actualResult: '',
    isHardCase: false
  },
  {
    id: '7',
    command: 'what are the reserves for ETH-USDC pool',
    expectedResult: {
      success: true,
      action: 'getPoolReserves',
      parameters: {
        token0: 'ETH',
        token1: 'USDC'
      }
    },
    actualResult: '',
    isHardCase: false
  },
  {
    id: '8',
    command: 'swap 10 WBTC for ETH',
    expectedResult: {
      success: true,
      action: 'swapTokens',
      parameters: {
        amountIn: '10',
        tokenIn: 'WBTC',
        tokenOut: 'ETH'
      }
    },
    actualResult: '',
    isHardCase: false
  },
  {
    id: '9',
    command: 'how many swaps happened in USDC-DAI pool today',
    expectedResult: {
      success: true,
      action: 'getSwapCount',
      parameters: {
        token0: 'USDC',
        token1: 'DAI',
        timeframe: 'today'
      }
    },
    actualResult: '',
    isHardCase: false
  },
  {
    id: '10',
    command: 'what are the reserves for ETH-LINK pool',
    expectedResult: {
      success: true,
      action: 'getPoolReserves',
      parameters: {
        token0: 'ETH',
        token1: 'LINK'
      }
    },
    actualResult: '',
    isHardCase: false
  },
  
  // Hard test cases
  {
    id: '11',
    command: 'I want to provide some ETH and get some LINK tokens in return',
    expectedResult: {
      success: true,
      action: 'swapTokens',
      parameters: {
        tokenIn: 'ETH',
        tokenOut: 'LINK'
      }
    },
    actualResult: '',
    isHardCase: true
  },
  {
    id: '12',
    command: 'help me become a liquidity provider for the ETH and LINK pair',
    expectedResult: {
      success: true,
      action: 'addLiquidity',
      parameters: {
        token0: 'ETH',
        token1: 'LINK'
      }
    },
    actualResult: '',
    isHardCase: true
  },
  {
    id: '13',
    command: 'what are the current reserves in the USDC-DAI pool',
    expectedResult: {
      success: true,
      action: 'getPoolReserves',
      parameters: {
        token0: 'USDC',
        token1: 'DAI'
      }
    },
    actualResult: '',
    isHardCase: true
  },
  {
    id: '14',
    command: 'how many swaps happened in ETH-USDC pool this week',
    expectedResult: {
      success: true,
      action: 'getSwapCount',
      parameters: {
        token0: 'ETH',
        token1: 'USDC',
        timeframe: 'this week'
      }
    },
    actualResult: '',
    isHardCase: true
  },
  {
    id: '15',
    command: 'I want to remove all my liquidity from ETH-LINK pool',
    expectedResult: {
      success: true,
      action: 'removeLiquidity',
      parameters: {
        token0: 'ETH',
        token1: 'LINK'
      }
    },
    actualResult: '',
    isHardCase: true
  },
  {
    id: '16',
    command: 'add some ETH to the ETH-USDC pool',
    expectedResult: {
      success: true,
      action: 'addLiquidity',
      parameters: {
        token0: 'ETH',
        token1: 'USDC'
      }
    },
    actualResult: '',
    isHardCase: true
  },
  {
    id: '17',
    command: 'show me all swaps in ETH-LINK pool this month',
    expectedResult: {
      success: true,
      action: 'getSwapCount',
      parameters: {
        token0: 'ETH',
        token1: 'LINK',
        timeframe: 'this month'
      }
    },
    actualResult: '',
    isHardCase: true
  },
  {
    id: '18',
    command: 'what are all the reserves in ETH-LINK pool',
    expectedResult: {
      success: true,
      action: 'getPoolReserves',
      parameters: {
        token0: 'ETH',
        token1: 'LINK'
      }
    },
    actualResult: '',
    isHardCase: true
  },
  {
    id: '19',
    command: 'swap my ETH to USDC',
    expectedResult: {
      success: true,
      action: 'swapTokens',
      parameters: {
        tokenIn: 'ETH',
        tokenOut: 'USDC'
      }
    },
    actualResult: '',
    isHardCase: true
  },
  {
    id: '20',
    command: 'show me total swaps in WBTC-ETH pool all time',
    expectedResult: {
      success: true,
      action: 'getSwapCount',
      parameters: {
        token0: 'WBTC',
        token1: 'ETH',
        timeframe: 'all time'
      }
    },
    actualResult: '',
    isHardCase: true
  }
];

const compareResults = (expected: any, actual: any): boolean => {
  // Remove success field from comparison if it exists
  const { success: expectedSuccess, ...expectedRest } = expected;
  const { success: actualSuccess, ...actualRest } = actual;
  
  return JSON.stringify(expectedRest) === JSON.stringify(actualRest);
};

export const TestEvaluation: React.FC = () => {
  const [testCases, setTestCases] = useState<TestCase[]>(defaultTestCases);
  const [newCommand, setNewCommand] = useState('');
  const [newExpectedResult, setNewExpectedResult] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAddTestCase = () => {
    try {
      const expectedResult = newExpectedResult ? JSON.parse(newExpectedResult) : {};
      const newCase: TestCase = {
        id: `test-${Date.now()}`,
        command: newCommand,
        expectedResult,
        isHardCase: false,
      };
      setTestCases([newCase, ...testCases]);
      setNewCommand('');
      setNewExpectedResult('');
    } catch (error) {
      alert('Invalid JSON format for expected result');
    }
  };

  const handleResetTest = (id: string) => {
    setTestCases(prevCases =>
      prevCases.map(tc =>
        tc.id === id
          ? {
              ...tc,
              actualResult: '',
            }
          : tc
      )
    );
  };

  const handleResetAllTests = () => {
    setTestCases(defaultTestCases);
  };

  const handleRunAllTests = async () => {
    for (const testCase of testCases) {
      await handleRunTest(testCase);
    }
  };

  const handleRunTest = async (testCase: TestCase) => {
    setIsProcessing(true);
    try {
      const result = await processNaturalLanguage(testCase.command);
      setTestCases(prevCases =>
        prevCases.map(tc =>
          tc.id === testCase.id
            ? {
                ...tc,
                actualResult: JSON.stringify(result, null, 2)
              }
            : tc
        )
      );
    } catch (error) {
      setTestCases(prevCases =>
        prevCases.map(tc =>
          tc.id === testCase.id
            ? {
                ...tc,
                actualResult: error instanceof Error ? error.message : String(error)
              }
            : tc
        )
      );
    }
    setIsProcessing(false);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-white">Natural Language Test Evaluation</h1>
      
      <div className="mb-8 bg-gray-800 p-6 rounded-lg">
        <h2 className="text-xl font-semibold mb-4 text-white">Add New Test Case</h2>
        <div className="space-y-4">
          <div>
            <label className="block mb-2 text-gray-300">Command:</label>
            <input
              type="text"
              value={newCommand}
              onChange={(e) => setNewCommand(e.target.value)}
              className="w-full p-2 border rounded bg-gray-800 text-white border-gray-600 focus:border-blue-500 focus:outline-none"
              placeholder="Enter natural language command"
            />
          </div>
          <div>
            <label className="block mb-2 text-gray-300">
              Expected Result (JSON) - Optional:
            </label>
            <textarea
              value={newExpectedResult}
              onChange={(e) => setNewExpectedResult(e.target.value)}
              className="w-full p-2 border rounded bg-gray-800 text-white border-gray-600 focus:border-blue-500 focus:outline-none h-32"
              placeholder="Enter expected result in JSON format (optional)"
            />
          </div>
          <button
            onClick={handleAddTestCase}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!newCommand}
          >
            Add Test Case
          </button>
        </div>
      </div>

      <div className="mb-4 flex space-x-4">
        <button
          onClick={handleRunAllTests}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isProcessing}
        >
          Run All Tests ({testCases.length} Total)
        </button>
        <button
          onClick={handleResetAllTests}
          className="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700"
        >
          Reset All Tests
        </button>
      </div>

      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-white mb-4">Basic Test Cases ({testCases.filter(tc => !tc.isHardCase).length})</h2>
          <div className="grid gap-4">
            {testCases
              .filter(tc => !tc.isHardCase)
              .map(testCase => (
                <div key={testCase.id} className="border border-gray-600 p-4 rounded bg-gray-800">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-gray-200">Command: {testCase.command}</h3>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleRunTest(testCase)}
                        className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={isProcessing}
                      >
                        Run
                      </button>
                      <button
                        onClick={() => handleResetTest(testCase.id)}
                        className="bg-yellow-600 text-white px-3 py-1 rounded hover:bg-yellow-700"
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="font-medium text-gray-300">Expected Result:</p>
                      <pre className="bg-gray-900 p-2 rounded text-gray-200 border border-gray-700 overflow-x-auto">
                        {JSON.stringify(testCase.expectedResult, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <p className="font-medium text-gray-300">Actual Result:</p>
                      <pre className="bg-gray-900 p-2 rounded text-gray-200 border border-gray-700 overflow-x-auto">
                        {testCase.actualResult || 'Not run yet'}
                      </pre>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>

        <div className="mt-12 pt-12 border-t border-red-800">
          <h2 className="text-xl font-semibold text-red-400 mb-4">Hard Test Cases ({testCases.filter(tc => tc.isHardCase).length})</h2>
          <div className="grid gap-4">
            {testCases
              .filter(tc => tc.isHardCase)
              .map(testCase => (
                <div key={testCase.id} className="border border-red-800 p-4 rounded bg-gray-800/90 hover:bg-red-950/30">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-red-200">Command: {testCase.command}</h3>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleRunTest(testCase)}
                        className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={isProcessing}
                      >
                        Run
                      </button>
                      <button
                        onClick={() => handleResetTest(testCase.id)}
                        className="bg-yellow-600 text-white px-3 py-1 rounded hover:bg-yellow-700"
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="font-medium text-red-300">Expected Result:</p>
                      <pre className="bg-gray-900 p-2 rounded text-gray-200 border border-red-900 overflow-x-auto">
                        {JSON.stringify(testCase.expectedResult, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <p className="font-medium text-red-300">Actual Result:</p>
                      <pre className="bg-gray-900 p-2 rounded text-gray-200 border border-red-900 overflow-x-auto">
                        {testCase.actualResult || 'Not run yet'}
                      </pre>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}; 