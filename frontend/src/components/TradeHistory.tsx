import { useState, useEffect } from 'react';

interface Trade {
    id: number;
    symbol: string;
    action: string;
    amount?: number;
    entry_price: number;
    entry_time: string;
    exit_price?: number;
    exit_time?: string;
    profit_loss?: number;
    status: string;
    confidence?: number;
    stop_loss?: number;
    take_profit?: number;
    is_simulation?: boolean;
}

interface Stats {
    total_trades: number;
    open_trades: number;
    closed_trades: number;
    total_profit_loss: number;
}

export default function TradeHistory() {
    const [trades, setTrades] = useState<Trade[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);

    useEffect(() => {
        fetchHistory();
        const interval = setInterval(fetchHistory, 5000); // Refresh every 5s
        return () => clearInterval(interval);
    }, []);

    const fetchHistory = async () => {
        try {
            const [tradesRes, statsRes] = await Promise.all([
                fetch('/api/history/trades?limit=20'),
                fetch('/api/history/stats')
            ]);

            if (tradesRes.ok) {
                const tradesData = await tradesRes.json();
                setTrades(tradesData);
            }

            if (statsRes.ok) {
                const statsData = await statsRes.json();
                setStats(statsData);
            }
        } catch (err) {
            console.error('Failed to fetch history:', err);
        }
    };

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-800 rounded-lg p-4">
                        <p className="text-xs text-gray-500 uppercase">Total Trades</p>
                        <p className="text-2xl font-bold text-white mt-1">{stats.total_trades}</p>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-4">
                        <p className="text-xs text-gray-500 uppercase">Open</p>
                        <p className="text-2xl font-bold text-yellow-400 mt-1">{stats.open_trades}</p>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-4">
                        <p className="text-xs text-gray-500 uppercase">Closed</p>
                        <p className="text-2xl font-bold text-blue-400 mt-1">{stats.closed_trades}</p>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-4">
                        <p className="text-xs text-gray-500 uppercase">Total P/L</p>
                        <p className={`text-2xl font-bold mt-1 ${stats.total_profit_loss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            ${stats.total_profit_loss.toFixed(2)}
                        </p>
                    </div>
                </div>
            )}

            {/* Trade Table */}
            <div className="bg-gray-800 rounded-lg overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-700">
                    <h3 className="text-lg font-medium text-white">Recent Trades</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-700">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Symbol</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Action</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-400 uppercase">Type</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-400 uppercase">Conf.</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase">Amount</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase">Entry</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase">SL</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase">TP</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase">Exit</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase">P/L</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-400 uppercase">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {trades.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="px-6 py-4 text-center text-gray-500">
                                        No trades yet
                                    </td>
                                </tr>
                            ) : (
                                trades.map((trade) => (
                                    <tr key={trade.id} className="hover:bg-gray-750">
                                        <td className="px-6 py-4 text-sm text-white font-mono">{trade.symbol}</td>
                                        <td className="px-6 py-4">
                                            <span className={`text-xs font-semibold px-2 py-1 rounded ${trade.action === 'BUY' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                                {trade.action}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${trade.is_simulation ? 'border-blue-500 text-blue-400' : 'border-purple-500 text-purple-400'}`}>
                                                {trade.is_simulation ? 'PAPER' : 'REAL'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {trade.confidence ? (
                                                <span className={`text-xs font-bold ${trade.confidence > 0.8 ? 'text-green-400' : trade.confidence > 0.5 ? 'text-yellow-400' : 'text-red-400'}`}>
                                                    {(trade.confidence * 100).toFixed(0)}%
                                                </span>
                                            ) : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-right text-white">
                                            {trade.amount ? `$${trade.amount.toFixed(2)}` : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-right text-white">${trade.entry_price.toFixed(2)}</td>
                                        <td className="px-6 py-4 text-sm text-right text-red-300">
                                            {trade.stop_loss ? `$${trade.stop_loss.toFixed(2)}` : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-right text-green-300">
                                            {trade.take_profit ? `$${trade.take_profit.toFixed(2)}` : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-right text-white">
                                            {trade.exit_price ? `$${trade.exit_price.toFixed(2)}` : '-'}
                                        </td>
                                        <td className={`px-6 py-4 text-sm text-right font-medium ${trade.profit_loss ? (trade.profit_loss >= 0 ? 'text-green-400' : 'text-red-400') : 'text-gray-500'}`}>
                                            {trade.profit_loss ? `$${trade.profit_loss.toFixed(2)}` : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`text-xs px-2 py-1 rounded ${trade.status === 'OPEN' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-600 text-gray-300'}`}>
                                                {trade.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
