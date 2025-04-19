import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // Note: In production, you should use a backend service
});

const FUNCTION_DEFINITIONS = [
  {
    name: 'swapTokens',
    description: 'Swap one token for another',
    parameters: {
      type: 'object',
      properties: {
        amount: {
          type: 'string',
          description: 'The amount to swap'
        },
        tokenIn: {
          type: 'string',
          description: 'The symbol of the input token'
        },
        tokenOut: {
          type: 'string',
          description: 'The symbol of the output token'
        },
        exactType: {
          type: 'string',
          description: 'Whether the amount specified is the exact input or exact output amount',
          enum: ['input', 'output']
        }
      },
      required: ['amount', 'tokenIn', 'tokenOut', 'exactType']
    }
  },
  {
    name: 'addLiquidity',
    description: 'Add liquidity to a pool',
    parameters: {
      type: 'object',
      properties: {
        token0: {
          type: 'string',
          description: 'The symbol of the first token'
        },
        token1: {
          type: 'string',
          description: 'The symbol of the second token'
        },
        amount0: {
          type: 'string',
          description: 'The amount of the first token to add'
        },
        amount1: {
          type: 'string',
          description: 'The amount of the second token to add (optional - if not provided, will calculate optimal amount)'
        }
      },
      required: ['token0', 'token1', 'amount0']
    }
  },
  {
    name: 'removeLiquidity',
    description: 'Remove liquidity from a pool',
    parameters: {
      type: 'object',
      properties: {
        token0: {
          type: 'string',
          description: 'The symbol of the first token'
        },
        token1: {
          type: 'string',
          description: 'The symbol of the second token'
        },
        lpTokenAmount: {
          type: 'string',
          description: 'The amount of LP tokens to burn'
        }
      },
      required: ['token0', 'token1', 'lpTokenAmount']
    }
  },
  {
    name: 'getPoolReserves',
    description: 'Get the current reserves of a pool',
    parameters: {
      type: 'object',
      properties: {
        token0: {
          type: 'string',
          description: 'The symbol of the first token'
        },
        token1: {
          type: 'string',
          description: 'The symbol of the second token'
        }
      },
      required: ['token0', 'token1']
    }
  },
  {
    name: 'getSwapCount',
    description: 'Get the number of swaps in a specific pool or all pools for a given timeframe',
    parameters: {
      type: 'object',
      properties: {
        token0: {
          type: 'string',
          description: 'Optional: The symbol of the first token in the pool. If not provided, will count swaps across all pools.'
        },
        token1: {
          type: 'string',
          description: 'Optional: The symbol of the second token in the pool. If not provided, will count swaps across all pools.'
        },
        timeframe: {
          type: 'string',
          description: 'The timeframe to count swaps for (today, this week, this month, all time)',
          enum: ['today', 'this week', 'this month', 'all time']
        }
      },
      required: ['timeframe']
    }
  }
];

export const processNaturalLanguage = async (command: string) => {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `You are a helpful assistant that processes natural language commands for a Uniswap V2 interface.
          
          For swap commands, you should determine if it's an exact input or exact output swap:
          - Exact Input Examples:
            "Swap 1 ETH for USDC"
            "Sell 100 USDC for ETH"
            "Trade 50 LINK to UNI"
            Here, the input amount is exact and output will be at least minimum amount.
          
          - Exact Output Examples:
            "Get me exactly 1000 USDC using ETH"
            "I want to receive 2 ETH by selling USDC"
            "Buy exactly 100 UNI with LINK"
            Here, the output amount is exact and input will be at most maximum amount.
          
          Common token symbols: ETH, WETH, USDC, USDT, DAI, LINK, UNI, WBTC
          
          Always set exactType to:
          - 'input' when user specifies input amount
          - 'output' when user specifies output amount`
        },
        {
          role: 'user',
          content: command
        }
      ],
      functions: FUNCTION_DEFINITIONS,
      function_call: 'auto'
    });

    const functionCall = completion.choices[0].message?.function_call;

    if (!functionCall) {
      return {
        success: false,
        error: 'Failed to process command'
      };
    }

    const args = JSON.parse(functionCall.arguments);

    return {
      success: true,
      action: functionCall.name,
      parameters: args
    };

  } catch (error: any) {
    console.error('OpenAI API error:', error);
    return {
      success: false,
      error: error.message || 'Failed to process command'
    };
  }
}; 