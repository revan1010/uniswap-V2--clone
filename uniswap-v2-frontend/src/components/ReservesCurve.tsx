import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot, Label } from 'recharts';
import { ethers } from 'ethers';
import { Token } from '../utils/tokens';

interface ReservesCurveProps {
  token0: Token | null;
  token1: Token | null;
  reserve0: ethers.BigNumber;
  reserve1: ethers.BigNumber;
  inputAmount?: string;
  outputAmount?: string;
}

export const ReservesCurve: React.FC<ReservesCurveProps> = ({
  token0,
  token1,
  reserve0,
  reserve1,
  inputAmount,
  outputAmount
}) => {
  // Generate data points for the curve
  const data = useMemo(() => {
    if (!token0 || !token1 || !reserve0 || !reserve1) return [];

    // Convert reserves to numbers for easier calculation
    const reserve0Num = parseFloat(ethers.utils.formatUnits(reserve0, token0.decimals));
    const reserve1Num = parseFloat(ethers.utils.formatUnits(reserve1, token1.decimals));
    
    const k = reserve0Num * reserve1Num;
    const points = [];
    const numPoints = 200;

    // Calculate range for x-axis (token0)
    const minX = reserve0Num * 0.1;
    const maxX = reserve0Num * 3;

    // Generate points with non-linear distribution
    for (let i = 0; i < numPoints; i++) {
      const t = i / (numPoints - 1);
      const x = minX + (maxX - minX) * (t * t);
      const y = k / x;

      if (x > 0 && y > 0 && !isNaN(y) && isFinite(y)) {
        points.push({
          x,
          y,
          tooltipX: x,
          tooltipY: y
        });
      }
    }

    return points;
  }, [token0, token1, reserve0, reserve1]);

  // Calculate current swap point
  const currentPoint = useMemo(() => {
    if (!inputAmount || !outputAmount || !token0 || !token1) return null;
    
    return {
      x: parseFloat(inputAmount),
      y: parseFloat(outputAmount)
    };
  }, [inputAmount, outputAmount, token0, token1]);

  if (!token0 || !token1 || data.length === 0) {
    return null;
  }

  // Calculate domain padding (10% padding)
  const xValues = data.map(p => p.x);
  const yValues = data.map(p => p.y);
  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);

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
            tickFormatter={(value) => parseFloat(value).toFixed(2)}
            type="number"
            domain={[minX * 0.9, maxX * 1.1]}
          />
          <YAxis 
            stroke="#888" 
            label={{ value: token1.symbol, angle: -90, position: 'left', fill: '#888', offset: 40 }} 
            tickFormatter={(value) => parseFloat(value).toFixed(2)}
            type="number"
            domain={[minY * 0.9, maxY * 1.1]}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#222', border: 'none' }}
            labelStyle={{ color: '#888' }}
            formatter={(value: any) => [`${parseFloat(value).toFixed(6)} ${token1.symbol}`]}
            labelFormatter={(value) => `${parseFloat(value).toFixed(6)} ${token0.symbol}`}
          />
          <Line 
            type="monotone" 
            dataKey="y" 
            stroke="#ff007a" 
            dot={false} 
            strokeWidth={2}
          />
          {currentPoint && (
            <ReferenceDot
              x={currentPoint.x}
              y={currentPoint.y}
              r={4}
              fill="#ff007a"
              stroke="white"
            >
              <Label
                value={`${currentPoint.x.toFixed(6)} ${token0.symbol}\n${currentPoint.y.toFixed(6)} ${token1.symbol}`}
                position="right"
                fill="#888"
              />
            </ReferenceDot>
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}; 