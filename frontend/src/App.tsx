import Dashboard from './components/Dashboard'
import TradeHistory from './components/TradeHistory'

function App() {
    return (
        <div className="min-h-screen bg-gray-900 text-white">
            <Dashboard />
            <div className="max-w-6xl mx-auto px-8 py-8">
                <TradeHistory />
            </div>
        </div>
    )
}

export default App
