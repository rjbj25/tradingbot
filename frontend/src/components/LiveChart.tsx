import React, { useEffect, useState } from 'react';
import {
    ComposedChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine
} from 'recharts';

interface Candle {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

interface LiveChartProps {
    symbol: string;
    timeframe: string;
}

export default function LiveChart({ symbol, timeframe }: LiveChartProps) {
    const [data, setData] = useState<Candle[]>([]);
    const [activeTrade, setActiveTrade] = useState<any>(null);

    useEffect(() => {
        fetchData();
        fetchActiveTrade();
        const interval = setInterval(() => {
            fetchData();
            fetchActiveTrade();
        }, 5000);
        return () => clearInterval(interval);
    }, [symbol, timeframe]);

    const fetchData = async () => {
        try {
            const res = await fetch(`/api/market/candles?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}&limit=50`);
            if (res.ok) {
                const jsonData = await res.json();
                setData(jsonData);
            }
        } catch (err) {
            console.error("Failed to fetch candles", err);
        }
    };

    const fetchActiveTrade = async () => {
        try {
            const res = await fetch('/api/history/trades?limit=1'); // Check most recent
            if (res.ok) {
                const trades = await res.json();
                const latest = trades[0];
                if (latest && latest.status === 'OPEN' && latest.symbol === symbol) {
                    setActiveTrade(latest);
                } else {
                    setActiveTrade(null);
                }
            }
        } catch (err) {
            console.error(err);
        }
    }

    if (data.length === 0) {
        return <div className="h-64 flex items-center justify-center text-gray-500">Loading Chart...</div>;
    }

    // Calculate domain for Y-axis to auto-scale nicely
    const minPrice = Math.min(...data.map(d => d.low));
    const maxPrice = Math.max(...data.map(d => d.high));
    const padding = (maxPrice - minPrice) * 0.1;

    return (
        <div className="h-96 w-full bg-gray-800 p-4 rounded-xl shadow-lg">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-gray-300 font-medium">Live Market: {symbol}</h3>
                {activeTrade && (
                    <span className="text-xs px-2 py-1 bg-green-900 text-green-300 rounded">
                        Active Position: {activeTrade.action} @ {activeTrade.entry_price}
                    </span>
                )}
            </div>
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis
                        dataKey="timestamp"
                        tickFormatter={(unixTime) => new Date(unixTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        stroke="#9CA3AF"
                        fontSize={12}
                    />
                    <YAxis
                        domain={[minPrice - padding, maxPrice + padding]}
                        stroke="#9CA3AF"
                        fontSize={12}
                        tickFormatter={(val) => val.toFixed(2)}
                    />
                    <Tooltip
                        contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                        labelFormatter={(label) => new Date(label).toLocaleString()}
                    />
                    <Line
                        type="monotone"
                        dataKey="close"
                        stroke="#3B82F6"
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                    />

                    {/* Active Trade Overlays */}
                    {activeTrade && (
                        <>
                            <ReferenceLine y={activeTrade.entry_price} stroke="#10B981" strokeDasharray="3 3" label={{ value: 'ENTRY', fill: '#10B981', fontSize: 10 }} />
                            {activeTrade.stop_loss && (
                                <ReferenceLine y={activeTrade.stop_loss} stroke="#EF4444" strokeDasharray="3 3" label={{ value: 'SL', fill: '#EF4444', fontSize: 10 }} />
                            )}
                            {activeTrade.take_profit && (
                                <ReferenceLine y={activeTrade.take_profit} stroke="#3B82F6" strokeDasharray="3 3" label={{ value: 'TP', fill: '#3B82F6', fontSize: 10 }} />
                            )}
                        </>
                    )}
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
}
