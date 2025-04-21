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
  reason?: string; 
}

const defaultTestCases: TestCase[] = [
  // Regular test cases
  {
    id: '1',
    command: 'swap 1 LINK for WETH',
    expectedResult: {
      success: true,
      action: 'swapTokens',
      parameters: {
        amount: '1',
        tokenIn: 'LINK',
        tokenOut: 'WETH',
        exactType: 'input'
      }
    },
    actualResult: '',
    isHardCase: false
  },
  {
    id: '2',
    command: 'add liquidity of 2 WETH in WETH-LINK pool',
    expectedResult: {
      success: true,
      action: 'addLiquidity',
      parameters: {
        token0: 'WETH',
        token1: 'LINK',
        amount0: '2'
        // amount1 is optional
      }
    },
    actualResult: '',
    isHardCase: false
  },
  {
    id: '3',
    command: 'remove 2 LP tokens from WETH-LINK pool',
    expectedResult: {
      success: true,
      action: 'removeLiquidity',
      parameters: {
        token0: 'WETH',
        token1: 'LINK',
        lpTokenAmount: '2'
      }
    },
    actualResult: '',
    isHardCase: false
  },
  {
    id: '4',
    command: 'what are the reserves for WETH-LINK pool',
    expectedResult: {
      success: true,
      action: 'getPoolReserves',
      parameters: {
        token0: 'WETH',
        token1: 'LINK'
      }
    },
    actualResult: '',
    isHardCase: false
  },
  {
    id: '5',
    command: 'Get me 10 UNI with WETH',
    expectedResult: {
      success: true,
      action: 'swapTokens',
      parameters: {
        amount: '10',
        tokenIn: 'WETH',
        tokenOut: 'UNI',
        exactType: 'output'
      }
    },
    actualResult: '',
    isHardCase: false
  },
  {
    id: '6',
    command: 'Convert my 0.5 WETH to LINK',
    expectedResult: {
      success: true,
      action: 'swapTokens',
      parameters: {
        amount: '0.5',
        tokenIn: 'WETH',
        tokenOut: 'LINK',
        exactType: 'input'
      }
    },
    actualResult: '',
    isHardCase: false
  },
  {
    id: '7',
    command: 'how many swaps have been so far today for UNI-WETH pool',
    expectedResult: {
      success: true,
      action: 'getSwapCount',
      parameters: {
        token0: 'UNI',
        token1: 'WETH',
        timeframe: 'today'
      }
    },
    actualResult: '',
    isHardCase: false
  },
  {
    id: '8',
    command: 'Deposit 500 UNI and 3.336611 WETH in uni-weth pool',
    expectedResult: {
      success: true,
      action: 'addLiquidity',
      parameters: {
        token0: 'UNI',
        token1: 'WETH',
        amount0: '500',
        amount1: '3.336611'
      }
    },
    actualResult: '',
    isHardCase: false
  },
  {
    id: '9',
    command: 'Buy 0.02 WETH with LINK',
    expectedResult: {
      success: true,
      action: 'swapTokens',
      parameters: {
        amount: '0.02',
        tokenIn: 'LINK',
        tokenOut: 'WETH',
        exactType: 'output'
      }
    },
    actualResult: '',
    isHardCase: false
  },
  {
    id: '10',
    command: 'Redeem 2 LP tokens from the LINK/WETH pool',
    expectedResult: {
      success: true,
      action: 'removeLiquidity',
      parameters: {
        token0: 'LINK',
        token1: 'WETH',
        lpTokenAmount: '2'
      }
    },
    actualResult: '',
    isHardCase: false
  },
  
  // Hard test cases
  // {
  //   id: '11',
  //   command: 'I want to provide some ETH and get some LINK tokens in return',
  //   expectedResult: {
  //     success: true,
  //     action: 'swapTokens',
  //     parameters: {
  //       tokenIn: 'ETH',
  //       tokenOut: 'LINK'
  //     }
  //   },
  //   actualResult: '',
  //   isHardCase: true
  // },
  // {
  //   id: '12',
  //   command: 'help me become a liquidity provider for the ETH and LINK pair',
  //   expectedResult: {
  //     success: true,
  //     action: 'addLiquidity',
  //     parameters: {
  //       token0: 'ETH',
  //       token1: 'LINK'
  //     }
  //   },
  //   actualResult: '',
  //   isHardCase: true
  // },
  // {
  //   id: '13',
  //   command: 'what are the current reserves in the USDC-DAI pool',
  //   expectedResult: {
  //     success: true,
  //     action: 'getPoolReserves',
  //     parameters: {
  //       token0: 'USDC',
  //       token1: 'DAI'
  //     }
  //   },
  //   actualResult: '',
  //   isHardCase: true
  // },
  // {
  //   id: '14',
  //   command: 'how many swaps happened in ETH-USDC pool this week',
  //   expectedResult: {
  //     success: true,
  //     action: 'getSwapCount',
  //     parameters: {
  //       token0: 'ETH',
  //       token1: 'USDC',
  //       timeframe: 'this week'
  //     }
  //   },
  //   actualResult: '',
  //   isHardCase: true
  // },
  // {
  //   id: '15',
  //   command: 'I want to remove all my liquidity from ETH-LINK pool',
  //   expectedResult: {
  //     success: true,
  //     action: 'removeLiquidity',
  //     parameters: {
  //       token0: 'ETH',
  //       token1: 'LINK'
  //     }
  //   },
  //   actualResult: '',
  //   isHardCase: true
  // },
  // {
  //   id: '16',
  //   command: 'add some ETH to the ETH-USDC pool',
  //   expectedResult: {
  //     success: true,
  //     action: 'addLiquidity',
  //     parameters: {
  //       token0: 'ETH',
  //       token1: 'USDC'
  //     }
  //   },
  //   actualResult: '',
  //   isHardCase: true
  // },
  // {
  //   id: '17',
  //   command: 'show me all swaps in ETH-LINK pool this month',
  //   expectedResult: {
  //     success: true,
  //     action: 'getSwapCount',
  //     parameters: {
  //       token0: 'ETH',
  //       token1: 'LINK',
  //       timeframe: 'this month'
  //     }
  //   },
  //   actualResult: '',
  //   isHardCase: true
  // },
  // {
  //   id: '18',
  //   command: 'what are all the reserves in ETH-LINK pool',
  //   expectedResult: {
  //     success: true,
  //     action: 'getPoolReserves',
  //     parameters: {
  //       token0: 'ETH',
  //       token1: 'LINK'
  //     }
  //   },
  //   actualResult: '',
  //   isHardCase: true
  // },
  // {
  //   id: '19',
  //   command: 'swap my ETH to USDC',
  //   expectedResult: {
  //     success: true,
  //     action: 'swapTokens',
  //     parameters: {
  //       tokenIn: 'ETH',
  //       tokenOut: 'USDC'
  //     }
  //   },
  //   actualResult: '',
  //   isHardCase: true
  // },
  // {
  //   id: '20',
  //   command: 'show me total swaps in WBTC-ETH pool all time',
  //   expectedResult: {
  //     success: true,
  //     action: 'getSwapCount',
  //     parameters: {
  //       token0: 'WBTC',
  //       token1: 'ETH',
  //       timeframe: 'all time'
  //     }
  //   },
  //   actualResult: '',
  //   isHardCase: true
  // }


  {
    id: '11',
    command: 'Swap the smallest amount of LINK that gives exactly 0.01 WETH at today’s rate',
    expectedResult: {
      success: false,
      action: 'unknown'
    },
    actualResult: '',
    isHardCase: true,
    reason: 'Requires dynamic quote estimation, price oracle logic, and exact output calculation — none of which your schema handles'
  },
  {
    id: '12',
    command: 'Give me a better rate: swapping LINK to WETH or UNI to WETH?',
    expectedResult: {
      success: false,
      action: 'unknown'
    },
    actualResult: '',
    isHardCase: true,
    reason: 'Comparative logic across pools not supported in function definitions'
  },
  {
    id: '13',
    command: 'What is my impermanent loss for the last 24h on the LINK-WETH pool?',
    expectedResult: {
      success: false,
      action: 'unknown'
    },
    actualResult: '',
    isHardCase: true,
    reason: 'Requires historical liquidity tracking, not supported by getPoolReserves or swap count'
  },
  {
    id: '14',
    command: 'Add liquidity using my full UNI balance',
    expectedResult: {
      success: false,
      action: 'unknown'
    },
    actualResult: '',
    isHardCase: true,
    reason: 'Requires wallet balance integration and user context which function calling can’t resolve'
  },
  {
    id: '15',
    command: 'Which of my liquidity positions has earned me the most fees so far?',
    expectedResult: {
      success: false,
      action: 'unknown'
    },
    actualResult: '',
    isHardCase: true,
    reason: 'Requires fee tracking per LP position, which is not exposed in your current function schema or Uniswap V2 contracts'
  },
  {
    id: '16',
    command: 'Remove LP tokens from whichever pool I have the most LP in',
    expectedResult: {
      success: false,
      action: 'unknown'
    },
    actualResult: '',
    isHardCase: true,
    reason: 'Requires portfolio-level LP analysis and conditional logic'
  },
  {
    id: '17',
    command: 'Buy WETH using all available tokens in my wallet',
    expectedResult: {
      success: false,
      action: 'unknown'
    },
    actualResult: '',
    isHardCase: true,
    reason: 'No way to inspect wallet balances or do multi-token swaps dynamically'
  },
  {
    id: '18',
    command: 'List all pools where volume increased more than 10% today',
    expectedResult: {
      success: false,
      action: 'unknown'
    },
    actualResult: '',
    isHardCase: true,
    reason: 'Involves cross-pool volume analytics + historical comparison'
  },
  {
    id: '19',
    command: 'Predict slippage for a 1000 LINK → WETH swap',
    expectedResult: {
      success: false,
      action: 'unknown'
    },
    actualResult: '',
    isHardCase: true,
    reason: 'Slippage prediction not part of your function set and requires AMM math logic'
  },
  {
    id: '20',
    command: 'Automatically rebalance my liquidity equally between UNI/WETH and LINK/WETH',
    expectedResult: {
      success: false,
      action: 'unknown'
    },
    actualResult: '',
    isHardCase: true,
    reason: 'Multi-contract logic + state tracking + token balance inference not supported'
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

      <div className="space-y-12">
        {/* Working Test Cases Section */}
        <div>
          <h2 className="text-xl font-semibold text-white mb-4">Working Test Cases ({testCases.filter(tc => !tc.isHardCase).length})</h2>
          <div className="grid gap-6">
            {testCases
              .filter(tc => !tc.isHardCase)
              .map((testCase, index) => (
                <div key={testCase.id} className="border border-gray-600 p-6 rounded-lg bg-gray-800/90 hover:bg-gray-800">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white font-semibold">
                        {index + 1}
                      </span>
                      <h3 className="font-semibold text-gray-200">Command: {testCase.command}</h3>
                    </div>
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
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="font-medium text-gray-300 mb-2">Expected Result:</p>
                      <pre className="bg-gray-900 p-3 rounded-lg text-gray-200 border border-gray-700 overflow-x-auto">
                        {JSON.stringify(testCase.expectedResult, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <p className="font-medium text-gray-300 mb-2">Actual Result:</p>
                      <pre className="bg-gray-900 p-3 rounded-lg text-gray-200 border border-gray-700 overflow-x-auto">
                        {testCase.actualResult || 'Not run yet'}
                      </pre>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Hard Test Cases Section */}
        <div className="mt-16">
          <div className="border-t-4 border-red-800 pt-8">
            <h2 className="text-2xl font-bold text-red-400 mb-6 flex items-center gap-3">
              <span className="text-3xl">🔥</span>
              Hard Test Cases ({testCases.filter(tc => tc.isHardCase).length})
            </h2>
            <div className="grid gap-8">
              {testCases
                .filter(tc => tc.isHardCase)
                .map((testCase, index) => (
                  <div key={testCase.id} className="border-2 border-red-800 p-6 rounded-lg bg-red-950/20 hover:bg-red-950/30 transition-colors">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-red-600 text-white font-semibold">
                          {index + 1}
                        </span>
                        <h3 className="font-semibold text-red-200">Command: {testCase.command}</h3>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleRunTest(testCase)}
                          className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={isProcessing}
                        >
                          Run
                        </button>
                        <button
                          onClick={() => handleResetTest(testCase.id)}
                          className="bg-red-800 text-white px-3 py-1 rounded hover:bg-red-900"
                        >
                          Reset
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <p className="font-medium text-red-300 mb-2">Expected Result:</p>
                        <pre className="bg-red-950/40 p-3 rounded-lg text-red-100 border border-red-800 overflow-x-auto">
                          {JSON.stringify(testCase.expectedResult, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <p className="font-medium text-red-300 mb-2">Actual Result:</p>
                        <pre className="bg-red-950/40 p-3 rounded-lg text-red-100 border border-red-800 overflow-x-auto">
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
    </div>
  );
}; 