# AI Trading Agent 🤖📈

An institutional-grade AI trading bot powered by Google's Gemini Pro, designed for automated cryptocurrency trading on Binance Futures. It features a modern React dashboard, multi-strategy support, and real-time market analysis.

## 🚀 Key Features

### 🧠 AI Core
- **Gemini Pro Integration**: Uses advanced LLM analysis for market decisions.
- **Multi-Strategy Engine**: Select from 12+ trading strategies including:
  - Smart Money Concepts (SMC)
  - RSI Divergence
  - MACD Crossover
  - Elliott Wave Theory
  - Wyckoff Method
  - And more...
- **Multi-Timeframe Analysis**: Analyzes macro trends and micro structures simultaneously.

### 💻 Modern Dashboard
- **Real-time Charting**: Interactive candlestick chart with zoom/pan.
- **Live Stats**: Track Total P/L, Win Rate, Total Invested, and Pending Allocation.
- **Activity Log**: Real-time feed of bot actions and AI reasoning.
- **Configuration Panel**: Adjust risk, leverage, and strategies on the fly.

### 🛡️ Risk Management
- **Paper Trading Mode**: Test strategies safely without real funds.
- **Position Management**: Automated Stop Loss and Take Profit execution.
- **Max Open Positions**: Configurable limit for simultaneous trades (Pyramiding).
- **Allocation Tracking**: Visualizes target vs. current investment.

## 🛠️ Tech Stack
- **Backend**: Python (FastAPI, SQLAlchemy, Pandas, CCXT)
- **Frontend**: React (Vite, Tailwind CSS, Recharts, Lucide)
- **Database**: SQLite (Local)
- **Infrastructure**: Docker & Docker Compose

## ⚡️ Quick Start

### Prerequisites
- Docker & Docker Compose
- Binance Futures API Key
- Google Gemini API Key

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd <repository-directory>
   ```

2. **Configure Environment**
   Create a `.env` file in the root directory (or configure via Dashboard):
   ```env
   BINANCE_API_KEY=your_key
   BINANCE_SECRET_KEY=your_secret
   GEMINI_API_KEY=your_gemini_key
   BACKEND_URL=http://localhost:8000
   ```

3. **Run with Docker**
   ```bash
   docker-compose up -d --build
   ```

4. **Access the Dashboard**
   Open [http://localhost:5173](http://localhost:5173) in your browser.

## 🔄 Recent Updates

- **Strategy Selector**: Dynamic dropdown to switch AI trading strategies instantly.
- **Enhanced Stats**: Added "Pending Allocation" and "Win Rate" metrics.
- **Input Component**: Modularized UI components for better maintainability.
- **Dependency Fixes**: Resolved `lucide-react` and `Input.tsx` import issues.

## ⚠️ Disclaimer
This software is for educational purposes only. Cryptocurrency trading involves significant risk. The authors are not responsible for any financial losses incurred while using this bot.
