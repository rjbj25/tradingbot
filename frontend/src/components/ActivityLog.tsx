import { useState, useEffect } from 'react';

interface Log {
    id: number;
    timestamp: string;
    level: string;
    message: string;
    component: string;
}

export default function ActivityLog() {
    const [logs, setLogs] = useState<Log[]>([]);

    useEffect(() => {
        fetchLogs();
        const interval = setInterval(fetchLogs, 2000); // Refresh every 2s
        return () => clearInterval(interval);
    }, []);

    const fetchLogs = async () => {
        try {
            const res = await fetch('/api/logs?limit=50');
            if (res.ok) {
                const data = await res.json();
                setLogs(data);
            }
        } catch (err) {
            console.error('Failed to fetch logs:', err);
        }
    };

    const clearLogs = async () => {
        if (!confirm('Are you sure you want to clear the log history?')) return;
        try {
            await fetch('/api/logs', { method: 'DELETE' });
            setLogs([]);
        } catch (err) {
            console.error('Failed to clear logs:', err);
        }
    };

    const getLevelColor = (level: string) => {
        switch (level) {
            case 'INFO': return 'text-blue-400';
            case 'WARNING': return 'text-yellow-400';
            case 'ERROR': return 'text-red-400';
            default: return 'text-gray-400';
        }
    };

    return (
        <div className="bg-gray-800 rounded-lg overflow-hidden h-96 flex flex-col">
            <div className="px-4 py-3 border-b border-gray-700 bg-gray-750 flex justify-between items-center">
                <h3 className="text-sm font-medium text-gray-300">System Activity Log</h3>
                <div className="flex items-center space-x-3">
                    <span className="text-xs text-gray-500">Auto-refreshing</span>
                    <button
                        onClick={clearLogs}
                        className="text-xs bg-red-900/30 hover:bg-red-900/50 text-red-400 px-2 py-1 rounded transition-colors"
                    >
                        Clear
                    </button>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-xs">
                {logs.length === 0 ? (
                    <p className="text-gray-500 text-center mt-10">No activity recorded yet.</p>
                ) : (
                    logs.map((log) => (
                        <div key={log.id} className="flex space-x-2">
                            <span className="text-gray-500 shrink-0">
                                {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                            <span className={`font-bold shrink-0 w-16 ${getLevelColor(log.level)}`}>
                                [{log.level}]
                            </span>
                            <span className="text-gray-400 shrink-0 w-24">
                                {log.component}:
                            </span>
                            <span className="text-gray-300 break-all">
                                {log.message}
                            </span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
