import { useState, useEffect } from 'react';
import ActivityLog from './ActivityLog';
import LiveChart from './LiveChart';
import Input from './Input';
import {
    DollarSign,
    Play,
    StopCircle,
    Settings,
    BarChart2,
    Activity,
    CheckCircle,
    Trash2,
    Save,
    Wallet,
    Percent,
    PieChart
} from 'lucide-react';

function StatCard({ title, value, subValue, icon, trend }: { title: string, value: string | number, subValue?: string, icon: React.ReactNode, trend?: 'up' | 'down' }) {
    return (
        <div className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700 hover:border-gray-600 transition-colors">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-gray-400 text-sm font-medium">{title}</p>
                    <div className="flex items-baseline gap-2 mt-1">
                        <h3 className="text-2xl font-bold text-white">{value}</h3>
                        {subValue && <span className="text-sm text-gray-400">{subValue}</span>}
                    </div>
                </div>
                <div className="p-3 bg-gray-900 rounded-lg">
                    {icon}
                </div>
            </div>
            {trend && (
                <div className={`mt-4 flex items-center text-sm ${trend === 'up' ? 'text-green-400' : 'text-red-400'}`}>
                    <span>{trend === 'up' ? '↗' : '↘'} {trend === 'up' ? 'Profit' : 'Loss'}</span>
                </div>
            )}
        </div>
    );
}

export default function Dashboard() {
    const [isRunning, setIsRunning] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [logs, setLogs] = useState<any[]>([]);
    const [stats, setStats] = useState<any>({});
    const [lastDecision, setLastDecision] = useState<any>(null);
    const [isExpanded, setIsExpanded] = useState(false);

    // Configuration State
    const [symbol, setSymbol] = useState('BTC/USDT');
    const [timeframe, setTimeframe] = useState('1h');
    const [investment, setInvestment] = useState(100);
    const [leverage, setLeverage] = useState(1);
    const [paperTrading, setPaperTrading] = useState(true);
    const [maxOpenPositions, setMaxOpenPositions] = useState(1);
    const [binanceKey, setBinanceKey] = useState('');
    const [binanceSecret, setBinanceSecret] = useState('');
    const [geminiKey, setGeminiKey] = useState('');
    const [strategy, setStrategy] = useState("IA Driven");

    const strategies = [
        "IA Driven",
        "RSI Divergence",
        "MACD Crossover",
        "Bollinger Bands Breakout",
        "EMA Golden Cross",
        "Fibonacci Retracement",
        "Ichimoku Cloud",
        "Price Action (S/R)",
        "Volume Spread Analysis (VSA)",
        "Elliott Wave Theory",
        "Wyckoff Method",
        "Smart Money Concepts (SMC)"
    ];

    useEffect(() => {
        checkStatus();
        fetchLogs();
        fetchDecision();
        fetchStats();
        loadConfig();
        const interval = setInterval(() => {
            checkStatus();
            fetchLogs();
            fetchDecision();
            fetchStats();
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    const loadConfig = async () => {
        try {
            const res = await fetch('/api/config');
            if (res.ok) {
                const data = await res.json();
                if (data.binance_api_key) setBinanceKey(data.binance_api_key);
                if (data.binance_secret_key) setBinanceSecret(data.binance_secret_key);
                if (data.gemini_api_key) setGeminiKey(data.gemini_api_key);
                if (data.symbol) setSymbol(data.symbol);
                if (data.timeframe) setTimeframe(data.timeframe);
                if (data.investment_amount) setInvestment(Number(data.investment_amount));
                if (data.leverage) setLeverage(Number(data.leverage));
                if (data.paper_trading !== undefined) setPaperTrading(data.paper_trading === 'True');
                if (data.max_open_positions) setMaxOpenPositions(Number(data.max_open_positions));
                if (data.strategy) setStrategy(data.strategy);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const saveConfig = async () => {
        try {
            await fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    binance_api_key: binanceKey,
                    binance_secret_key: binanceSecret,
                    gemini_api_key: geminiKey,
                    symbol,
                    timeframe,
                    investment_amount: investment,
                    leverage,
                    paper_trading: paperTrading,
                    max_open_positions: maxOpenPositions,
                    strategy
                })
            });
            alert("Configuration Saved!");
        } catch (err) {
            alert("Failed to save config");
        }
    };

    const handleStart = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    symbol,
                    market_type: 'future',
                    timeframe,
                    investment_amount: investment,
                    leverage,
                    binance_api_key: binanceKey,
                    binance_secret_key: binanceSecret,
                    gemini_api_key: geminiKey,
                    paper_trading: paperTrading,
                    max_open_positions: maxOpenPositions,
                    strategy
                })
            });
            const data = await res.json();
            if (res.ok) {
                if (data.status === 'already_running') {
                    alert("Bot is already running!");
                } else {
                    setIsRunning(true);
                }
            } else {
                alert(`Error: ${data.detail || 'Failed to start'}`);
            }
        } catch (err) {
            console.error(err);
            alert("Failed to start trading bot");
        } finally {
            setIsLoading(false);
        }
    };

    const handleStop = async () => {
        setIsLoading(true);
        try {
            await fetch('/api/stop', { method: 'POST' });
            setIsRunning(false);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleReset = async () => {
        if (!confirm("Are you sure you want to delete ALL trading history? This cannot be undone.")) return;
        try {
            const res = await fetch('/api/reset', { method: 'POST' });
            if (res.ok) {
                alert("Data reset successfully");
                fetchStats();
                fetchLogs();
            }
        } catch (err) {
            alert("Failed to reset data");
        }
    }

    const checkStatus = async () => {
        try {
            const res = await fetch('/api/status');
            if (res.ok) {
                const data = await res.json();
                setIsRunning(data.running);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const fetchLogs = async () => {
        try {
            const res = await fetch('/api/logs?limit=50');
            if (res.ok) setLogs(await res.json());
        } catch (err) {
            console.error(err);
        }
    };

    const fetchDecision = async () => {
        try {
            const res = await fetch('/api/history/decisions?limit=1');
            if (res.ok) {
                const data = await res.json();
                if (data.length > 0) setLastDecision(data[0]);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const fetchStats = async () => {
        try {
            const res = await fetch('/api/history/stats');
            if (res.ok) setStats(await res.json());
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100 font-sans p-6">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Header */}
                <header className="flex justify-between items-center bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700">
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                            AI Trading Agent
                        </h1>
                        <p className="text-gray-400 mt-1">Institutional Grade • Gemini Powered • Multi-Strategy</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className={`px-4 py-2 rounded-full flex items-center gap-2 ${isRunning ? 'bg-green-900/50 text-green-400 border border-green-700' : 'bg-red-900/50 text-red-400 border border-red-700'}`}>
                            <div className={`w-3 h-3 rounded-full ${isRunning ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                            <span className="font-medium">{isRunning ? 'SYSTEM ACTIVE' : 'SYSTEM STOPPED'}</span>
                        </div>
                        <button onClick={handleReset} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors" title="Reset Data">
                            <Trash2 size={20} />
                        </button>
                    </div>
                </header>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <StatCard
                        title="Total P/L"
                        value={`${stats.total_profit_loss?.toFixed(2)} USDT`}
                        icon={<DollarSign className="text-green-400" />}
                        trend={stats.total_profit_loss >= 0 ? 'up' : 'down'}
                    />
                    <StatCard
                        title="Total Invested"
                        value={`${stats.total_invested?.toFixed(2) || '0.00'} USDT`}
                        icon={<Wallet className="text-blue-400" />}
                    />
                    <StatCard
                        title="Win Rate"
                        value={`${stats.win_rate_pct?.toFixed(1) || '0.0'}%`}
                        subValue={`(${stats.trades_won || 0}/${stats.trades_total_closed || 0})`}
                        icon={<Percent className="text-purple-400" />}
                    />
                    <StatCard
                        title="Pending Alloc."
                        value={`${stats.pending_allocation?.toFixed(2) || '0.00'} USDT`}
                        subValue={`Target: ${stats.total_allocation?.toFixed(2) || '0.00'}`}
                        icon={<PieChart className="text-yellow-400" />}
                    />
                    <StatCard
                        title="Open Trades"
                        value={stats.open_trades}
                        icon={<Activity className="text-blue-400" />}
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Configuration Panel */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700">
                            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2 text-gray-200">
                                <Settings className="text-blue-400" /> Configuration
                            </h2>

                            <div className="space-y-4">
                                {/* API Keys Section */}
                                <div className="space-y-3 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                                    <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Credentials</h3>
                                    <Input
                                        label="Binance API Key"
                                        type="password"
                                        value={binanceKey}
                                        onChange={(e) => setBinanceKey(e.target.value)}
                                        placeholder="Required"
                                    />
                                    <Input
                                        label="Binance Secret"
                                        type="password"
                                        value={binanceSecret}
                                        onChange={(e) => setBinanceSecret(e.target.value)}
                                        placeholder="Required"
                                    />
                                    <Input
                                        label="Gemini API Key"
                                        type="password"
                                        value={geminiKey}
                                        onChange={(e) => setGeminiKey(e.target.value)}
                                        placeholder="Required"
                                    />
                                </div>

                                {/* Strategy Section */}
                                <div className="space-y-3 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                                    <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Strategy</h3>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-1">Select Strategy</label>
                                        <select
                                            value={strategy}
                                            onChange={(e) => setStrategy(e.target.value)}
                                            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                        >
                                            {strategies.map(s => (
                                                <option key={s} value={s}>{s}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Market Settings */}
                                <div className="space-y-3 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                                    <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Market</h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        <Input label="Symbol" value={symbol} onChange={(e) => setSymbol(e.target.value)} />
                                        <div>
                                            <label className="block text-sm font-medium text-gray-400 mb-1">Timeframe</label>
                                            <select
                                                value={timeframe}
                                                onChange={(e) => setTimeframe(e.target.value)}
                                                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                            >
                                                {['1m', '5m', '15m', '1h', '4h', '1d'].map(tf => (
                                                    <option key={tf} value={tf}>{tf}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Risk Management */}
                                <div className="space-y-3 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                                    <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Budget & Risk</h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        <Input label="Investment (USDT)" type="number" value={investment} onChange={(e) => setInvestment(Number(e.target.value))} />
                                        <Input label="Leverage (x)" type="number" value={leverage} onChange={(e) => setLeverage(Number(e.target.value))} />
                                        <Input label="Max Positions" type="number" value={maxOpenPositions} onChange={(e) => setMaxOpenPositions(Number(e.target.value))} />
                                    </div>
                                    <div className="flex items-center justify-between pt-2">
                                        <span className="text-sm text-gray-300">Paper Trading Mode</span>
                                        <button
                                            onClick={() => setPaperTrading(!paperTrading)}
                                            className={`w-12 h-6 rounded-full transition-colors relative ${paperTrading ? 'bg-blue-600' : 'bg-gray-600'}`}
                                        >
                                            <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${paperTrading ? 'left-7' : 'left-1'}`} />
                                        </button>
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button
                                        onClick={saveConfig}
                                        className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Save size={18} /> Save Config
                                    </button>
                                    <button
                                        onClick={isRunning ? handleStop : handleStart}
                                        disabled={isLoading}
                                        className={`flex-1 font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 ${isRunning
                                                ? 'bg-red-600 hover:bg-red-700 text-white'
                                                : 'bg-green-600 hover:bg-green-700 text-white'
                                            } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        {isLoading ? (
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        ) : (
                                            <>
                                                {isRunning ? <StopCircle size={18} /> : <Play size={18} />}
                                                {isRunning ? 'Stop Bot' : 'Start Bot'}
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Chart & Logs */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Live Chart */}
                        <div className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700">
                            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-gray-200">
                                <Activity className="text-blue-400" /> Live Market
                            </h2>
                            <LiveChart symbol={symbol} timeframe={timeframe} />

                            {/* Last Decision Overlay */}
                            <div className="mt-4 bg-gray-700/50 rounded-lg p-4">
                                <div className="flex justify-between items-center mb-2">
                                    <p className="text-gray-400 text-xs uppercase tracking-wider">Last AI Decision</p>
                                    {lastDecision && (
                                        <button
                                            onClick={() => setIsExpanded(!isExpanded)}
                                            className="text-xs text-blue-400 hover:text-blue-300"
                                        >
                                            {isExpanded ? 'Show Less' : 'Show More'}
                                        </button>
                                    )}
                                </div>
                                {lastDecision ? (
                                    <div>
                                        <div className="flex justify-between items-center">
                                            <span className={`text-lg font-bold ${lastDecision.action === 'BUY' ? 'text-green-400' : lastDecision.action === 'SELL' ? 'text-red-400' : 'text-gray-400'}`}>
                                                {lastDecision.action}
                                            </span>
                                            <span className="text-xs text-gray-500">
                                                {new Date(lastDecision.timestamp).toLocaleTimeString()}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-xs mt-1">
                                            <span className="text-gray-400">Confidence</span>
                                            <span className="text-white">{(lastDecision.confidence * 100).toFixed(0)}%</span>
                                        </div>
                                        <p className={`text-sm text-gray-300 mt-2 italic ${isExpanded ? '' : 'line-clamp-2'}`}>
                                            "{lastDecision.reasoning}"
                                        </p>
                                        {isExpanded && (
                                            <div className="mt-3 pt-3 border-t border-gray-600 grid grid-cols-3 gap-2 text-xs">
                                                <div>
                                                    <span className="block text-gray-500">Entry</span>
                                                    <span className="text-white">{lastDecision.entry_price || '-'}</span>
                                                </div>
                                                <div>
                                                    <span className="block text-gray-500">Stop Loss</span>
                                                    <span className="text-white">{lastDecision.stop_loss || '-'}</span>
                                                </div>
                                                <div>
                                                    <span className="block text-gray-500">Take Profit</span>
                                                    <span className="text-white">{lastDecision.take_profit || '-'}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-gray-500 italic">Waiting for market analysis...</p>
                                )}
                            </div>
                        </div>

                        {/* Activity Log */}
                        <div className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700">
                            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-gray-200">
                                <BarChart2 className="text-purple-400" /> Activity Log
                            </h2>
                            <ActivityLog />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
