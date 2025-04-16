import OpenAI from 'openai';

let openai: OpenAI;

export const setOpenAIKey = (apiKey: string) => {
  openai = new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: true // Note: In production, you should use a backend service
  });
};

// Initialize with key from env if available
if (import.meta.env.VITE_OPENAI_API_KEY) {
  setOpenAIKey(import.meta.env.VITE_OPENAI_API_KEY);
}

const FUNCTION_DEFINITIONS = [
  {
    name: 'swapTokens',
    description: 'Swap one token for another',
    parameters: {
      type: 'object',
      properties: {
        amountIn: {
          type: 'string',
          description: 'The amount of input tokens to swap'
        },
        tokenIn: {
          type: 'string',
          description: 'The symbol of the input token'
        },
        tokenOut: {
          type: 'string',
          description: 'The symbol of the output token'
        }
      },
      required: ['amountIn', 'tokenIn', 'tokenOut']
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
    description: 'Get the number of swaps in a given timeframe',
    parameters: {
      type: 'object',
      properties: {
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
          You should interpret user commands and map them to the appropriate function calls.
          For liquidity commands, if the user only specifies one amount, you should use addLiquidity with just amount0 
          and let the system calculate the optimal amount1.
          Common token symbols: ETH, WETH, USDC, USDT, DAI, LINK, UNI, WBTC`
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