import React, { useEffect, useState } from 'react';
import {
    ComposedChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
    ReferenceDot,
    Brush
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
    const [activeTrades, setActiveTrades] = useState<any[]>([]);
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        fetchData();
        fetchActiveTrades();
        const interval = setInterval(() => {
            fetchData();
            fetchActiveTrades();
        }, 5000);
        return () => clearInterval(interval);
    }, [symbol, timeframe]);

    const fetchData = async () => {
        try {
            const res = await fetch(`/api/market/candles?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}&limit=200`);
            if (res.ok) {
                const jsonData = await res.json();
                setData(jsonData);
            }
        } catch (err) {
            console.error("Failed to fetch candles", err);
        }
    };

    const fetchActiveTrades = async () => {
        try {
            const res = await fetch('/api/history/trades?limit=50');
            if (res.ok) {
                const trades = await res.json();
                // Filter for all OPEN trades for this symbol
                const openTrades = trades.filter((t: any) => t.status === 'OPEN' && t.symbol === symbol);
                setActiveTrades(openTrades);
            }
        } catch (err) {
            console.error(err);
        }
    }

    if (data.length === 0) {
        return <div className="h-64 flex items-center justify-center text-gray-500">Loading Chart...</div>;
    }

    // Calculate domain for Y-axis
    const minPrice = Math.min(...data.map(d => d.low));
    const maxPrice = Math.max(...data.map(d => d.high));
    const padding = (maxPrice - minPrice) * 0.1;

    const containerClass = isExpanded
        ? "fixed inset-0 z-50 bg-gray-900 p-8 flex flex-col"
        : "h-96 w-full bg-gray-800 p-4 rounded-xl shadow-lg relative";

    return (
        <div className={containerClass}>
            <div className="flex justify-between items-start mb-4 shrink-0 gap-4">
                <div className="flex flex-col gap-2 min-w-0 flex-1">
                    <h3 className="text-gray-300 font-medium text-lg">Live Market: {symbol}</h3>
                    <div className="flex gap-2 flex-wrap max-h-20 overflow-y-auto custom-scrollbar">
                        {activeTrades.map((trade, idx) => (
                            <span key={trade.id} className="text-xs px-2 py-1 bg-green-900 text-green-300 rounded border border-green-700 whitespace-nowrap">
                                #{trade.id} {trade.action} @ {trade.entry_price}
                            </span>
                        ))}
                    </div>
                </div>

                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="p-2 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors shrink-0 mt-1"
                    title={isExpanded ? "Minimize" : "Maximize"}
                >
                    {isExpanded ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3" /><path d="M21 8h-3a2 2 0 0 1-2-2V3" /><path d="M3 16h3a2 2 0 0 1 2 2v3" /><path d="M16 21v-3a2 2 0 0 1 2-2h3" /></svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6" /><path d="M9 21H3v-6" /><path d="M21 3l-7 7" /><path d="M3 21l7-7" /></svg>
                    )}
                </button>
            </div>

            <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis
                            dataKey="timestamp"
                            tickFormatter={(unixTime) => new Date(unixTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            stroke="#9CA3AF"
                            fontSize={12}
                            minTickGap={30}
                        />
                        <YAxis
                            domain={[minPrice - padding, maxPrice + padding]}
                            stroke="#9CA3AF"
                            fontSize={12}
                            tickFormatter={(val) => val.toFixed(2)}
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px', color: '#F3F4F6' }}
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

                        <Brush
                            dataKey="timestamp"
                            height={30}
                            stroke="#3B82F6"
                            fill="#1F2937"
                            tickFormatter={() => ''}
                            alwaysShowText={false}
                            y={undefined} // Let Recharts position it automatically at the bottom
                        />

                        {/* Active Trade Overlays */}
                        {activeTrades.map((trade, idx) => {
                            // Parse entry_time to timestamp if it's a string
                            const entryTime = new Date(trade.entry_time).getTime();

                            return (
                                <React.Fragment key={trade.id}>
                                    {/* Horizontal Entry Line */}
                                    <ReferenceLine
                                        y={trade.entry_price}
                                        stroke="#10B981"
                                        strokeDasharray="3 3"
                                        label={{ value: `ENTRY #${trade.id}`, fill: '#10B981', fontSize: 10, position: 'insideLeft' }}
                                    />

                                    {/* Specific Entry Point Marker */}
                                    <ReferenceDot
                                        x={entryTime}
                                        y={trade.entry_price}
                                        r={6}
                                        fill="#10B981"
                                        stroke="#fff"
                                        strokeWidth={2}
                                        label={{ value: 'BUY', position: 'top', fill: '#10B981', fontSize: 10 }}
                                        ifOverflow="extendDomain"
                                    />

                                    {trade.stop_loss && (
                                        <ReferenceLine
                                            y={trade.stop_loss}
                                            stroke="#EF4444"
                                            strokeDasharray="3 3"
                                            label={{ value: `SL #${trade.id}`, fill: '#EF4444', fontSize: 10, position: 'insideLeft' }}
                                        />
                                    )}
                                    {trade.take_profit && (
                                        <ReferenceLine
                                            y={trade.take_profit}
                                            stroke="#3B82F6"
                                            strokeDasharray="3 3"
                                            label={{ value: `TP #${trade.id}`, fill: '#3B82F6', fontSize: 10, position: 'insideLeft' }}
                                        />
                                    )}
                                </React.Fragment>
                            )
                        })}
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
