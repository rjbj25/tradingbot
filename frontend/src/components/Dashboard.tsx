import { useState, useEffect } from 'react';
import ActivityLog from './ActivityLog';
import LiveChart from './LiveChart';
import TradeHistory from './TradeHistory';
import Input from './Input';
import {
    DollarSign,
    Play,
    StopCircle,
    Settings,
    BarChart2,
    Activity,
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

    const [stats, setStats] = useState<any>({});
    const [lastDecision, setLastDecision] = useState<any>(null);
    const [isExpanded, setIsExpanded] = useState(false);
    const [activeTab, setActiveTab] = useState<'live' | 'backtest'>('live');

    // Backtest State
    const [backtestStatus, setBacktestStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle');
    const [backtestResults, setBacktestResults] = useState<any>(null);
    const [backtestLogs, setBacktestLogs] = useState<string[]>([]);
    // const [backtestId, setBacktestId] = useState<string | null>(null);

    // Multi-Timeframe Backtest State
    const [multiBacktestResults, setMultiBacktestResults] = useState<Record<string, any>>({});
    const [multiBacktestStatus, setMultiBacktestStatus] = useState<Record<string, string>>({});
    const [multiBacktestLogs, setMultiBacktestLogs] = useState<Record<string, string[]>>({});
    const [globalMultiLogs, setGlobalMultiLogs] = useState<string[]>([]);
    const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({});
    const [isMultiRunning, setIsMultiRunning] = useState(false);

    const [availableModels, setAvailableModels] = useState<string[]>([]);
    const [model, setModel] = useState("gemini-2.5-flash");

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
    const [checkInterval, setCheckInterval] = useState(60);

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

    const intervals = [
        { label: '1 min', value: 60 },
        { label: '5 min', value: 300 },
        { label: '10 min', value: 600 },
        { label: '20 min', value: 1200 },
        { label: '60 min', value: 3600 },
        { label: '120 min', value: 7200 },
        { label: '260 min', value: 15600 },
    ];

    useEffect(() => {
        checkStatus();
        fetchDecision();
        fetchStats();
        loadConfig();
        fetchModels();
        const interval = setInterval(() => {
            checkStatus();
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
                if (data.check_interval) setCheckInterval(Number(data.check_interval));
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
                    strategy,
                    check_interval: checkInterval
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
                    strategy,
                    check_interval: checkInterval
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

    const fetchModels = async () => {
        try {
            const res = await fetch('/api/models');
            if (res.ok) {
                const data = await res.json();
                setAvailableModels(data);
            }
        } catch (err) {
            console.error("Failed to fetch models", err);
        }
    };

    const toggleLogs = (tf: string) => {
        setExpandedLogs((prev: Record<string, boolean>) => ({ ...prev, [tf]: !prev[tf] }));
    };

    const runBacktest = async () => {
        setBacktestStatus('running');
        setBacktestResults(null);
        setBacktestLogs([]);
        try {
            const res = await fetch('/api/backtest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    symbol,
                    timeframe,
                    strategy,
                    model,
                    days: 7,
                    initial_capital: investment * 10
                })
            });
            if (res.ok) {
                const data = await res.json();
                // setBacktestId(data.backtest_id);
                pollBacktest(data.backtest_id);
            } else {
                setBacktestStatus('failed');
                alert("Failed to start backtest");
            }
        } catch (err) {
            console.error(err);
            setBacktestStatus('failed');
        }
    };

    const pollBacktest = async (id: string) => {
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`/api/backtest/${id}`);
                if (res.ok) {
                    const data = await res.json();

                    if (data.logs && Array.isArray(data.logs)) {
                        setBacktestLogs(data.logs);
                    }

                    if (data.status === 'completed') {
                        setBacktestResults(data.results);
                        setBacktestStatus('completed');
                        clearInterval(interval);
                    } else if (data.status === 'failed') {
                        setBacktestStatus('failed');
                        clearInterval(interval);
                        alert(`Backtest failed: ${data.error}`);
                    }
                }
            } catch (err) {
                console.error(err);
                clearInterval(interval);
            }
        }, 1000);
    };

    const runMultiBacktest = async () => {
        setIsMultiRunning(true);
        setMultiBacktestResults({});
        setMultiBacktestStatus({});
        setMultiBacktestLogs({});
        setGlobalMultiLogs([]);
        setExpandedLogs({});

        const timeframes = ['1m', '5m', '15m', '1h', '4h', '1d'];

        for (const tf of timeframes) {
            setMultiBacktestStatus((prev: Record<string, string>) => ({ ...prev, [tf]: 'running' }));
            setExpandedLogs((prev: Record<string, boolean>) => ({ ...prev, [tf]: true }));

            try {
                const res = await fetch('/api/backtest', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        symbol,
                        timeframe: tf,
                        strategy,
                        model,
                        days: 7,
                        initial_capital: investment * 10
                    })
                });

                if (res.ok) {
                    const data = await res.json();
                    pollMultiBacktest(data.backtest_id, tf);
                } else {
                    setMultiBacktestStatus((prev: Record<string, string>) => ({ ...prev, [tf]: 'error' }));
                }
            } catch (err) {
                console.error(err);
                setMultiBacktestStatus((prev: Record<string, string>) => ({ ...prev, [tf]: 'error' }));
            }
        }
        setIsMultiRunning(false);
    };

    const pollMultiBacktest = async (id: string, tf: string) => {
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`/api/backtest/${id}`);
                if (res.ok) {
                    const data = await res.json();

                    if (data.logs && Array.isArray(data.logs)) {
                        setMultiBacktestLogs((prev: Record<string, string[]>) => ({ ...prev, [tf]: data.logs }));
                        // Update global logs with timeframe prefix, filtering only new logs if possible, 
                        // but for simplicity we might just show the latest logs from all. 
                        // Actually, appending everything might be too much. 
                        // Let's just show the logs of the *active* timeframe in the global panel?
                        // Or better: Append new logs to global array.
                        // Since we are polling, 'data.logs' contains ALL logs for that backtest ID.
                        // We can't easily distinguish "new" logs without tracking length.
                        // So let's just set the global logs to be the logs of the *current* timeframe being polled?
                        // But multiple are polling.
                        // Let's try to just show the logs of the most recently updated timeframe.
                        setGlobalMultiLogs(data.logs.map((l: string) => `[${tf}] ${l}`));
                    }

                    if (data.status === 'completed') {
                        setMultiBacktestResults((prev: Record<string, any>) => ({ ...prev, [tf]: data.results }));
                        setMultiBacktestStatus((prev: Record<string, string>) => ({ ...prev, [tf]: 'completed' }));
                        clearInterval(interval);
                    } else if (data.status === 'failed') {
                        console.error("Backtest failed:", data.error);
                        setMultiBacktestStatus((prev: Record<string, string>) => ({ ...prev, [tf]: 'failed' }));
                        clearInterval(interval);
                    }
                }
            } catch (err) {
                console.error(err);
                clearInterval(interval);
            }
        }, 1000);
    };

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100 font-sans p-6">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Header */}
                <header className="flex justify-between items-center bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700">
                    <div className="flex items-center gap-8">
                        <div>
                            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                                AI Trading Agent
                            </h1>
                            <p className="text-gray-400 mt-1">Institutional Grade • Gemini Powered • Multi-Strategy</p>
                        </div>
                        <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-700">
                            <button
                                onClick={() => setActiveTab('live')}
                                className={`px-4 py-2 rounded-md transition-all ${activeTab === 'live' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}
                            >
                                Live Trading
                            </button>
                            <button
                                onClick={() => setActiveTab('backtest')}
                                className={`px-4 py-2 rounded-md transition-all ${activeTab === 'backtest' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}
                            >
                                Backtesting
                            </button>
                        </div>
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

                {activeTab === 'live' ? (
                    <>
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

                                        {/* Check Interval */}
                                        <div className="space-y-3 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                                            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Scan Interval</h3>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-400 mb-1">Check Every</label>
                                                <select
                                                    value={checkInterval}
                                                    onChange={(e) => setCheckInterval(Number(e.target.value))}
                                                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                                >
                                                    {intervals.map(i => (
                                                        <option key={i.value} value={i.value}>{i.label}</option>
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

                            {/* Recent Trades (Moved here) */}
                            <div className="lg:col-span-3">
                                <TradeHistory />
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="space-y-6">
                        {/* Backtest Controls */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-400">Model</label>
                            <select
                                value={model}
                                onChange={(e) => setModel(e.target.value)}
                                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                            >
                                {availableModels.map(m => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex flex-col justify-end gap-3">
                            <button
                                onClick={runBacktest}
                                disabled={backtestStatus === 'running'}
                                className={`w-full py-3 rounded-lg font-bold text-white transition-all ${backtestStatus === 'running' ? 'bg-gray-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-blue-500/20'}`}
                            >
                                {backtestStatus === 'running' ? 'Running Simulation...' : 'Run Single Simulation'}
                            </button>
                            <button
                                onClick={runMultiBacktest}
                                disabled={isMultiRunning}
                                className={`w-full py-3 rounded-lg font-bold text-white transition-all ${isMultiRunning ? 'bg-gray-600 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700 shadow-lg hover:shadow-purple-500/20'}`}
                            >
                                {isMultiRunning ? 'Running All Timeframes...' : 'Run All Timeframes'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Single Backtest Results */}
                {
                    backtestStatus !== 'idle' && (
                        <div className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700">
                            <h3 className="text-lg font-semibold mb-4 text-gray-200">Single Simulation Results ({timeframe})</h3>

                            {/* Simulation Logs Panel */}
                            <div className="mb-6 bg-black/30 rounded-lg border border-gray-700 overflow-hidden">
                                <div className="bg-gray-900/50 px-4 py-2 border-b border-gray-700 flex justify-between items-center">
                                    <span className="text-sm font-medium text-gray-300">Simulation Logs</span>
                                    <span className="text-xs text-gray-500">{backtestLogs.length} events</span>
                                </div>
                                <div className="h-48 overflow-y-auto p-4 font-mono text-xs space-y-1">
                                    {backtestLogs.length === 0 ? (
                                        <div className="text-gray-500 italic text-center py-4">Waiting for simulation logs...</div>
                                    ) : (
                                        backtestLogs.map((log, i) => (
                                            <div key={i} className="text-gray-300 border-b border-gray-800/50 pb-1 last:border-0">
                                                <span className="text-blue-400 mr-2">[{new Date().toLocaleTimeString()}]</span>
                                                {log}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {backtestResults && (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="bg-gray-700/30 p-4 rounded-lg">
                                        <p className="text-gray-400 text-sm">Total Return</p>
                                        <p className={`text-xl font-bold ${backtestResults.total_return >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {backtestResults.total_return?.toFixed(2)}%
                                        </p>
                                    </div>
                                    <div className="bg-gray-700/30 p-4 rounded-lg">
                                        <p className="text-gray-400 text-sm">Win Rate</p>
                                        <p className="text-xl font-bold text-blue-400">{backtestResults.win_rate?.toFixed(1)}%</p>
                                    </div>
                                    <div className="bg-gray-700/30 p-4 rounded-lg">
                                        <p className="text-gray-400 text-sm">Max Drawdown</p>
                                        <p className="text-xl font-bold text-red-400">{backtestResults.max_drawdown?.toFixed(2)}%</p>
                                    </div>
                                    <div className="bg-gray-700/30 p-4 rounded-lg">
                                        <p className="text-gray-400 text-sm">Total Trades</p>
                                        <p className="text-xl font-bold text-white">{backtestResults.total_trades}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                }

                {/* Multi-Timeframe Global Logs Panel */}
                {
                    Object.keys(multiBacktestStatus).length > 0 && (
                        <div className="mb-6 bg-black/30 rounded-lg border border-gray-700 overflow-hidden">
                            <div className="bg-gray-900/50 px-4 py-2 border-b border-gray-700 flex justify-between items-center">
                                <span className="text-sm font-medium text-gray-300">Multi-Timeframe Simulation Logs (Live)</span>
                                <span className="text-xs text-gray-500">Latest Updates</span>
                            </div>
                            <div className="h-48 overflow-y-auto p-4 font-mono text-xs space-y-1">
                                {globalMultiLogs.length === 0 ? (
                                    <div className="text-gray-500 italic text-center py-4">Waiting for simulation logs...</div>
                                ) : (
                                    globalMultiLogs.map((log, i) => (
                                        <div key={i} className="text-gray-300 border-b border-gray-800/50 pb-1 last:border-0">
                                            <span className="text-purple-400 mr-2">[{new Date().toLocaleTimeString()}]</span>
                                            {log}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )
                }

                {/* Multi-Timeframe Results Cards */}
                {
                    Object.keys(multiBacktestStatus).length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {['1m', '5m', '15m', '1h', '4h', '1d'].map(tf => (
                                <div key={tf} className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                                    <div className="flex justify-between items-center mb-3">
                                        <h4 className="font-bold text-white">{tf} Timeframe</h4>
                                        <span className={`text-xs px-2 py-1 rounded-full ${multiBacktestStatus[tf] === 'completed' ? 'bg-green-900 text-green-300' :
                                            multiBacktestStatus[tf] === 'running' ? 'bg-blue-900 text-blue-300 animate-pulse' :
                                                multiBacktestStatus[tf] === 'failed' ? 'bg-red-900 text-red-300' :
                                                    'bg-gray-700 text-gray-400'
                                            }`}>
                                            {multiBacktestStatus[tf] || 'Pending'}
                                        </span>
                                    </div>

                                    {/* Toggle Logs Button */}
                                    <button
                                        onClick={() => toggleLogs(tf)}
                                        className="w-full mb-3 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 py-1 rounded transition-colors flex justify-center items-center gap-2"
                                    >
                                        {expandedLogs[tf] ? 'Hide Logs' : 'Show Logs'}
                                        {multiBacktestLogs[tf] && <span className="bg-gray-900 px-1.5 rounded-full text-[10px]">{multiBacktestLogs[tf].length}</span>}
                                    </button>

                                    {/* Collapsible Logs */}
                                    {expandedLogs[tf] && (
                                        <div className="mb-3 h-32 overflow-y-auto bg-black/30 rounded p-2 text-[10px] font-mono border border-gray-700/50">
                                            {multiBacktestLogs[tf]?.length > 0 ? (
                                                multiBacktestLogs[tf].map((log, i) => (
                                                    <div key={i} className="text-gray-400 border-b border-gray-800/30 pb-0.5 mb-0.5 last:border-0">
                                                        {log}
                                                    </div>
                                                ))
                                            ) : (
                                                <span className="text-gray-600 italic">No logs yet...</span>
                                            )}
                                        </div>
                                    )}

                                    {multiBacktestResults[tf] ? (
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-gray-400">Return</span>
                                                <span className={multiBacktestResults[tf].total_return >= 0 ? 'text-green-400' : 'text-red-400'}>
                                                    {multiBacktestResults[tf].total_return?.toFixed(2)}%
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-400">Win Rate</span>
                                                <span className="text-blue-400">{multiBacktestResults[tf].win_rate?.toFixed(1)}%</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-400">Trades</span>
                                                <span className="text-white">{multiBacktestResults[tf].total_trades}</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="h-20 flex items-center justify-center text-gray-600 text-sm italic">
                                            {multiBacktestStatus[tf] === 'running' ? 'Simulating...' : 'Waiting...'}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )
                }
            </div>
        </div>
    );
}
