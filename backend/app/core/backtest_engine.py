import pandas as pd
import asyncio
from datetime import datetime
from app.agents.gemini_agent import GeminiAgent
from app.agents.binance_agent import BinanceAgent

class BacktestEngine:
    def __init__(self, binance_agent: BinanceAgent, gemini_agent: GeminiAgent):
        self.binance = binance_agent
        self.gemini = gemini_agent
        self.results = {
            "total_trades": 0,
            "wins": 0,
            "losses": 0,
            "total_pnl": 0.0,
            "equity_curve": [],
            "trades": []
        }

    async def run(self, symbol: str, timeframe: str, strategy: str, initial_capital: float = 1000.0, days: int = 7, on_progress=None):
        """
        Run backtest for a specific symbol and timeframe.
        WARNING: This uses REAL Gemini API calls which consumes quota.
        """
        async def log(msg):
            if on_progress:
                await on_progress(msg)
            print(msg)

        # 1. Fetch Historical Data
        await log(f"Fetching historical data for {symbol} ({timeframe})...")
        try:
            # Fetch more data than needed to have context
            # limit = days * 24 * 60 // int(self._timeframe_to_minutes(timeframe)) + 100
            # Simplified limit for now to ensure we get enough data
            limit = 500 
            df = await self.binance.fetch_ohlcv(symbol, timeframe=timeframe, limit=limit)
            await log(f"Successfully fetched {len(df)} candles.")
        except Exception as e:
            await log(f"Error fetching data: {str(e)}")
            return {"error": str(e)}
        
        if df is None or df.empty:
            return {"error": "No data found"}

        capital = initial_capital
        position = None # {'entry_price': float, 'amount': float, 'type': 'BUY'/'SELL'}
        
        self.results["equity_curve"].append({"time": str(df.iloc[0]['timestamp']), "equity": capital})

        # 2. Simulate Loop
        # We need at least 20 candles for analysis
        total_candles = len(df)
        await log(f"Starting simulation on {total_candles} candles...")
        
        for i in range(20, total_candles):
            if i % 10 == 0:
                await log(f"Processing candle {i}/{total_candles} ({df.iloc[i]['timestamp']})...")
                
            current_candle = df.iloc[i]
            current_time = str(current_candle['timestamp'])
            current_price = current_candle['close']
            
            # Slice data up to current time (simulating past)
            historical_slice = df.iloc[:i+1]
            
            # Construct data_dict for Agent
            data_dict = {timeframe: historical_slice}
            
            # Check Exit
            if position:
                pnl = 0
                closed = False
                reason = ""
                
                # Simple SL/TP check (Mocked for now, agent provides them)
                if position['type'] == 'BUY':
                    if current_price <= position['entry_price'] * 0.98: # 2% SL
                        pnl = (current_price - position['entry_price']) * position['amount']
                        closed = True
                        reason = "Stop Loss"
                    elif current_price >= position['entry_price'] * 1.04: # 4% TP
                        pnl = (current_price - position['entry_price']) * position['amount']
                        closed = True
                        reason = "Take Profit"
                
                if closed:
                    capital += pnl
                    self.results["total_pnl"] += pnl
                    self.results["total_trades"] += 1
                    if pnl > 0: self.results["wins"] += 1
                    else: self.results["losses"] += 1
                    
                    self.results["trades"].append({
                        "entry_time": position['time'],
                        "exit_time": current_time,
                        "type": position['type'],
                        "entry_price": position['entry_price'],
                        "exit_price": current_price,
                        "pnl": pnl,
                        "reason": reason
                    })
                    await log(f"Closed {position['type']} at {current_price:.2f} (PnL: {pnl:.2f}) - {reason}")
                    position = None
                    self.results["equity_curve"].append({"time": current_time, "equity": capital})
                    continue # Wait for next candle to re-enter

            # Check Entry (Only if no position)
            if not position:
                # Call Agent (Real API Call)
                # To save quota, we might want to skip some candles or use a cheaper model
                # For MVP, let's run it every 5 candles to save quota
                if i % 5 != 0:
                    continue

                try:
                    await log("Requesting AI analysis...")
                    analysis_json = await self.gemini.analyze_market(symbol, data_dict, timeframe, strategy)
                    if analysis_json:
                        import json
                        cleaned = analysis_json.replace('```json', '').replace('```', '').strip()
                        decision = json.loads(cleaned)
                        
                        action = decision.get('action')
                        confidence = decision.get('confidence', 0)
                        
                        await log(f"AI Decision: {action} (Confidence: {confidence})")
                        
                        if action in ['BUY', 'SELL'] and confidence > 0.7:
                            amount = capital * 0.1 # Invest 10%
                            position = {
                                'type': action,
                                'entry_price': current_price,
                                'amount': amount / current_price,
                                'time': current_time
                            }
                            await log(f"OPEN {action} at {current_price:.2f} (Conf: {confidence})")
                except Exception as e:
                    await log(f"Agent error: {e}")

        await log("Backtest completed.")
        return self.results
