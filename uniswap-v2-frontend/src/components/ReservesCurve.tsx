import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ethers } from 'ethers';
import { Token } from '../utils/tokens';

interface ReservesCurveProps {
  token0: Token | null;
  token1: Token | null;
  reserve0: ethers.BigNumber;
  reserve1: ethers.BigNumber;
}

export const ReservesCurve: React.FC<ReservesCurveProps> = ({
  token0,
  token1,
  reserve0,
  reserve1,
}) => {
  // Generate data points for the curve
  const data = useMemo(() => {
    if (!token0 || !token1 || !reserve0 || !reserve1) return [];

    const k = reserve0.mul(reserve1);
    const points = [];
    const numPoints = 100;
    const maxX = reserve0.mul(2);

    for (let i = 0; i < numPoints; i++) {
      const x = maxX.mul(i).div(numPoints);
      if (x.isZero()) continue;
      
      const y = k.div(x);
      points.push({
        x: parseFloat(ethers.utils.formatUnits(x, token0.decimals)),
        y: parseFloat(ethers.utils.formatUnits(y, token1.decimals)),
      });
    }

    return points;
  }, [token0, token1, reserve0, reserve1]);

  if (!token0 || !token1 || data.length === 0) {
    return null;
  }

  return (
    <div className="w-full h-80 bg-dark rounded-lg p-4">
      <h3 className="text-white text-lg mb-4">Reserves Curve</h3>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 20, right: 30, bottom: 40, left: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#444" />
          <XAxis 
            dataKey="x" 
            stroke="#888" 
            label={{ value: token0.symbol, position: 'bottom', fill: '#888', offset: 20 }} 
            tickFormatter={(value) => value.toFixed(2)}
          />
          <YAxis 
            stroke="#888" 
            label={{ value: token1.symbol, angle: -90, position: 'left', fill: '#888', offset: 40 }} 
            tickFormatter={(value) => value.toFixed(2)}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#222', border: 'none' }}
            labelStyle={{ color: '#888' }}
            formatter={(value: number) => [`${value.toFixed(6)} ${token1.symbol}`, token1.symbol]}
            labelFormatter={(value) => `${value.toFixed(6)} ${token0.symbol}`}
          />
          <Line 
            type="monotone" 
            dataKey="y" 
            stroke="#ff007a" 
            dot={false} 
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}; 