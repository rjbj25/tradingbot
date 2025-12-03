import { useState, useEffect } from 'react';
import ActivityLog from './ActivityLog';
import LiveChart from './LiveChart';

export default function Dashboard() {
    const [status, setStatus] = useState('stopped');
    const [symbol, setSymbol] = useState('BTC/USDT');
    const [marketType, setMarketType] = useState('future');
    const [timeframe, setTimeframe] = useState('1h');
    const [investmentAmount, setInvestmentAmount] = useState('100');
    const [leverage, setLeverage] = useState('1');
    const [maxOpenPositions, setMaxOpenPositions] = useState('1');

    const [paperTrading, setPaperTrading] = useState(true); // Default to true for safety

    // Credentials State
    const [binanceApiKey, setBinanceApiKey] = useState('');
    const [binanceSecretKey, setBinanceSecretKey] = useState('');
    const [geminiApiKey, setGeminiApiKey] = useState('');

    const [lastDecision, setLastDecision] = useState<any>(null);
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        loadConfig();
        checkStatus();
        const interval = setInterval(() => {
            fetchDecision();
            checkStatus();
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    const checkStatus = async () => {
        try {
            const res = await fetch('/api/status');
            if (res.ok) {
                const data = await res.json();
                setStatus(data.running ? 'running' : 'stopped');
            }
        } catch (err) {
            console.error('Failed to check status:', err);
        }
    };

    const fetchDecision = async () => {
        try {
            const res = await fetch('/api/history/decisions?limit=1');
            if (res.ok) {
                const data = await res.json();
                if (data && data.length > 0) {
                    setLastDecision(data[0]);
                }
            }
        } catch (err) {
            console.error('Failed to fetch decision:', err);
        }
    };

    const loadConfig = async () => {
        try {
            const res = await fetch('/api/config');
            if (res.ok) {
                const config = await res.json();
                if (config.symbol) setSymbol(config.symbol);
                if (config.market_type) setMarketType(config.market_type);
                if (config.timeframe) setTimeframe(config.timeframe);
                if (config.investment_amount) setInvestmentAmount(config.investment_amount);
                if (config.leverage) setLeverage(config.leverage);
                if (config.max_open_positions) setMaxOpenPositions(config.max_open_positions);
                if (config.binance_api_key) setBinanceApiKey(config.binance_api_key);
                if (config.binance_secret_key) setBinanceSecretKey(config.binance_secret_key);
                if (config.gemini_api_key) setGeminiApiKey(config.gemini_api_key);
                // Note: paper_trading might not be in config yet, but good to have
            }
        } catch (err) {
            console.error('Failed to load config:', err);
        }
    };

    const saveConfig = async () => {
        try {
            await fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    symbol,
                    market_type: marketType,
                    timeframe,
                    investment_amount: parseFloat(investmentAmount),
                    leverage: parseInt(leverage),
                    max_open_positions: parseInt(maxOpenPositions),
                    binance_api_key: binanceApiKey,
                    binance_secret_key: binanceSecretKey,
                    gemini_api_key: geminiApiKey,
                    paper_trading: paperTrading
                })
            });
            alert('Configuration saved!');
        } catch (err) {
            console.error('Failed to save config:', err);
            alert('Failed to save configuration');
        }
    };

    const handleStart = async () => {
        try {
            const res = await fetch('/api/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    symbol,
                    market_type: marketType,
                    timeframe,
                    investment_amount: parseFloat(investmentAmount),
                    leverage: parseInt(leverage),
                    max_open_positions: parseInt(maxOpenPositions),
                    binance_api_key: binanceApiKey,
                    binance_secret_key: binanceSecretKey,
                    gemini_api_key: geminiApiKey,
                    paper_trading: paperTrading
                })
            });
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                alert(`Failed to start: ${errorData.detail || res.statusText}`);
                return;
            }
            const data = await res.json();
            if (data.status === 'started' || data.status === 'already_running') {
                setStatus('running');
                if (data.status === 'already_running') {
                    alert('Bot was already running. UI synced.');
                }
            } else {
                alert(`Unexpected status: ${data.status}`);
            }
        } catch (err) {
            console.error(err);
            alert('Error starting bot: ' + String(err));
        }
    };

    const handleStop = async () => {
        try {
            await fetch('/api/stop', { method: 'POST' });
            setStatus('stopped');
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="p-8">
            <div className="max-w-4xl mx-auto bg-gray-800 rounded-xl shadow-lg overflow-hidden">
                <div className="p-6 border-b border-gray-700 flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-white">Trading Dashboard</h2>
                    <div className={`px-3 py-1 rounded-full text-sm font-semibold ${status === 'running' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {status.toUpperCase()}
                    </div>
                </div>

                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Controls */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium text-gray-300">Configuration</h3>

                        {/* Symbol Input */}
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Symbol</label>
                            <input
                                type="text"
                                value={symbol}
                                onChange={(e) => setSymbol(e.target.value)}
                                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                                placeholder="BTC/USDT"
                            />
                        </div>

                        {/* Market Type Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Market Type</label>
                            <div className="flex space-x-2">
                                <button
                                    onClick={() => setMarketType('future')}
                                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${marketType === 'future' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
                                >
                                    Futures
                                </button>
                                <button
                                    onClick={() => setMarketType('spot')}
                                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${marketType === 'spot' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
                                >
                                    Spot
                                </button>
                            </div>
                        </div>

                        {/* Timeframe Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Timeframe</label>
                            <select
                                value={timeframe}
                                onChange={(e) => setTimeframe(e.target.value)}
                                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                            >
                                {['1m', '5m', '15m', '1h', '4h', '1d'].map((tf) => (
                                    <option key={tf} value={tf}>{tf}</option>
                                ))}
                            </select>
                        </div>

                        {/* Budget & Risk Section */}
                        <div className="pt-4 border-t border-gray-700 space-y-3">
                            <h4 className="text-sm font-medium text-gray-300">Budget & Risk</h4>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Invest (USDT)</label>
                                    <input
                                        type="number"
                                        value={investmentAmount}
                                        onChange={(e) => setInvestmentAmount(e.target.value)}
                                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Leverage (x)</label>
                                    <input
                                        type="number"
                                        value={leverage}
                                        onChange={(e) => setLeverage(e.target.value)}
                                        disabled={marketType === 'spot'}
                                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Max Positions</label>
                                    <input
                                        type="number"
                                        value={maxOpenPositions}
                                        onChange={(e) => setMaxOpenPositions(e.target.value)}
                                        min="1"
                                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Credentials Section */}
                        <div className="pt-4 border-t border-gray-700 space-y-3">
                            <h4 className="text-sm font-medium text-gray-300">API Credentials</h4>

                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Binance API Key</label>
                                <input
                                    type="password"
                                    value={binanceApiKey}
                                    onChange={(e) => setBinanceApiKey(e.target.value)}
                                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500"
                                    placeholder="Enter Binance API Key"
                                />
                            </div>

                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Binance Secret Key</label>
                                <input
                                    type="password"
                                    value={binanceSecretKey}
                                    onChange={(e) => setBinanceSecretKey(e.target.value)}
                                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500"
                                    placeholder="Enter Binance Secret Key"
                                />
                            </div>

                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Gemini API Key</label>
                                <input
                                    type="password"
                                    value={geminiApiKey}
                                    onChange={(e) => setGeminiApiKey(e.target.value)}
                                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500"
                                    placeholder="Enter Gemini API Key"
                                />
                            </div>
                        </div>

                        <button
                            onClick={saveConfig}
                            className="w-full mt-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs py-2 rounded transition-colors"
                        >
                            Save Configuration (Persist Keys)
                        </button>

                        {/* Paper Trading Toggle */}
                        <div className="pt-4 border-t border-gray-700 flex items-center justify-between">
                            <div>
                                <h4 className="text-sm font-medium text-gray-300">Paper Trading Mode</h4>
                                <p className="text-xs text-gray-500">Simulate trades without real funds</p>
                            </div>
                            <button
                                onClick={() => setPaperTrading(!paperTrading)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${paperTrading ? 'bg-blue-600' : 'bg-gray-600'}`}
                            >
                                <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${paperTrading ? 'translate-x-6' : 'translate-x-1'}`}
                                />
                            </button>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex space-x-4 pt-4">
                            <button
                                onClick={handleStart}
                                disabled={status === 'running'}
                                className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg transition-colors"
                            >
                                Start Bot
                            </button>
                            <button
                                onClick={handleStop}
                                disabled={status === 'stopped'}
                                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg transition-colors"
                            >
                                Stop Bot
                            </button>
                        </div>

                        {/* Reset Data Button */}
                        <div className="pt-4 border-t border-gray-700">
                            <button
                                onClick={async () => {
                                    if (window.confirm('Are you sure you want to delete all trading history? API Keys will be preserved.')) {
                                        try {
                                            const res = await fetch('/api/reset', { method: 'POST' });
                                            const data = await res.json();
                                            if (data.status === 'success') {
                                                alert('Data reset successfully');
                                                // Optional: Trigger a refresh if needed, though components poll
                                            } else {
                                                alert('Failed to reset data: ' + data.message);
                                            }
                                        } catch (err) {
                                            console.error(err);
                                            alert('Error resetting data');
                                        }
                                    }
                                }}
                                className="w-full bg-red-900/50 hover:bg-red-900 text-red-200 text-xs py-2 rounded transition-colors border border-red-800"
                            >
                                ⚠️ Reset All Trading Data
                            </button>
                        </div>
                    </div>

                    {/* Stats & Chart */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium text-gray-300">Live Status</h3>

                        {/* Chart */}
                        <LiveChart symbol={symbol} timeframe={timeframe} />

                        <div className="bg-gray-700/50 rounded-lg p-4 space-y-3">
                            <div>
                                <p className="text-gray-400 text-xs uppercase tracking-wider">Active Configuration</p>
                                <div className="flex items-center space-x-2 mt-1">
                                    <span className="text-white font-mono">{symbol}</span>
                                    <span className="text-gray-500">•</span>
                                    <span className="text-blue-400 text-sm">{marketType.toUpperCase()}</span>
                                    <span className="text-gray-500">•</span>
                                    <span className="text-yellow-400 text-sm">{timeframe}</span>
                                </div>
                            </div>

                            <div className="pt-2 border-t border-gray-600">
                                <div className="flex justify-between items-center">
                                    <p className="text-gray-400 text-xs uppercase tracking-wider">Última Decisión</p>
                                    {lastDecision && (
                                        <button
                                            onClick={() => setIsExpanded(!isExpanded)}
                                            className="text-xs text-blue-400 hover:text-blue-300 focus:outline-none"
                                        >
                                            {isExpanded ? 'Ver menos' : 'Ver más'}
                                        </button>
                                    )}
                                </div>
                                {lastDecision ? (
                                    <div className="mt-2 space-y-1">
                                        <div className="flex justify-between items-center">
                                            <span className={`text-lg font-bold ${lastDecision.action === 'BUY' ? 'text-green-400' : lastDecision.action === 'SELL' ? 'text-red-400' : 'text-gray-400'}`}>
                                                {lastDecision.action}
                                            </span>
                                            <span className="text-xs text-gray-500">
                                                {lastDecision.timestamp ? new Date(lastDecision.timestamp).toLocaleTimeString() : ''}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-gray-400">Confianza:</span>
                                            <span className="text-white">{(lastDecision.confidence * 100).toFixed(0)}%</span>
                                        </div>
                                        <div className={`text-xs text-gray-400 italic mt-1 ${isExpanded ? '' : 'line-clamp-2'}`} title={lastDecision.reasoning}>
                                            "{lastDecision.reasoning}"
                                        </div>
                                        {isExpanded && (
                                            <div className="mt-2 pt-2 border-t border-gray-700 grid grid-cols-2 gap-2 text-xs">
                                                <div>
                                                    <span className="text-gray-500 block">Entry</span>
                                                    <span className="text-white">{lastDecision.entry_price || '-'}</span>
                                                </div>
                                                <div>
                                                    <span className="text-gray-500 block">Stop Loss</span>
                                                    <span className="text-white">{lastDecision.stop_loss || '-'}</span>
                                                </div>
                                                <div>
                                                    <span className="text-gray-500 block">Take Profit</span>
                                                    <span className="text-white">{lastDecision.take_profit || '-'}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-xl font-mono text-white mt-1">ESPERANDO...</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Activity Log */}
                    <div className="mt-4">
                        <ActivityLog />
                    </div>
                </div>
            </div>
        </div>
    );
}
