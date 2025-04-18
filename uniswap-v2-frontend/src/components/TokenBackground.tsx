import React from 'react';
import { TEST_TOKENS } from '../constants/addresses';

const TokenBackground: React.FC = () => {
  // Select a subset of tokens for the background
  const backgroundTokens = TEST_TOKENS.slice(0, 8);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {backgroundTokens.map((token, index) => (
        <div
          key={token.address}
          className="absolute opacity-25"
          style={{
            animation: `float-${index} ${20 + index * 5}s infinite ease-in-out`,
            top: `${Math.random() * 80}%`,
            left: `${Math.random() * 80}%`,
          }}
        >
          <img
            src={token.logoURI}
            alt=""
            className="w-24 h-24 rounded-full blur-[2px]"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
        </div>
      ))}
      <style>
        {backgroundTokens.map((_, index) => `
          @keyframes float-${index} {
            0%, 100% {
              transform: translate(0, 0) rotate(0deg);
            }
            25% {
              transform: translate(${70 + Math.random() * 70}px, ${-70 - Math.random() * 70}px) rotate(${90 + Math.random() * 90}deg);
            }
            50% {
              transform: translate(${-70 - Math.random() * 70}px, ${70 + Math.random() * 70}px) rotate(${180 + Math.random() * 90}deg);
            }
            75% {
              transform: translate(${70 + Math.random() * 70}px, ${70 + Math.random() * 70}px) rotate(${270 + Math.random() * 90}deg);
            }
          }
        `).join('\n')}
      </style>
    </div>
  );
};

export default TokenBackground; 