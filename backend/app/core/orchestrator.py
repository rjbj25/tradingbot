import asyncio
import json
from app.agents.binance_agent import BinanceAgent
from app.agents.gemini_agent import GeminiAgent
from app.core.database import SessionLocal
from app.models.database import GeminiDecision, Trade, SystemLog, Configuration
from datetime import datetime

class TradingOrchestrator:
    def __init__(self):
        self.binance = None # Initialized on start
        self.gemini = None
        self.is_running = False
        self.symbol = None
        self.market_type = None
        self.timeframe = None
        self.investment_amount = None
        self.leverage = None

    def log(self, level: str, message: str, details: dict = None):
        """Save log to database and print"""
        print(f"[{level}] {message}")
        try:
            db = SessionLocal()
            log_entry = SystemLog(
                level=level,
                component="Orchestrator",
                message=message,
                details=json.dumps(details) if details else None
            )
            db.add(log_entry)
            db.commit()
            db.close()
        except Exception as e:
            print(f"Failed to save log: {e}")

    async def start_trading_loop(self, symbol: str, market_type: str, timeframe: str, 
                               investment_amount: float, leverage: int,
                               binance_api_key: str = None, binance_secret_key: str = None, 
                               gemini_api_key: str = None):
        self.is_running = True
        self.symbol = symbol
        self.market_type = market_type
        self.timeframe = timeframe
        self.investment_amount = investment_amount
        self.leverage = leverage
        
        self.log("INFO", f"Starting trading loop for {symbol} ({market_type}, {timeframe})", {
            "investment": investment_amount,
            "leverage": leverage
        })
        
        # Debug: Check keys (masked)
        b_key_masked = f"{binance_api_key[:4]}..." if binance_api_key else "None"
        g_key_masked = f"{gemini_api_key[:4]}..." if gemini_api_key else "None"
        self.log("INFO", f"Keys received - Binance: {b_key_masked}, Gemini: {g_key_masked}")

        # Initialize Agents with provided keys
        try:
            self.binance = BinanceAgent(api_key=binance_api_key, secret_key=binance_secret_key, market_type=market_type)
            self.gemini = GeminiAgent(api_key=gemini_api_key)
            self.log("INFO", "Agents initialized successfully")
        except Exception as e:
            self.log("ERROR", f"Failed to initialize agents: {str(e)}")
            self.is_running = False
            return
        
        while self.is_running:
            try:
                # 1. Fetch Data
                self.log("INFO", "Fetching market data...")
                ohlcv = await self.binance.fetch_ohlcv(symbol, timeframe=timeframe)
                if ohlcv is None:
                    self.log("WARNING", "Failed to fetch data. Retrying in 10s...")
                    await asyncio.sleep(10)
                    continue

                # 2. Analyze with Gemini
                self.log("INFO", "Analyzing market with Gemini...")
                analysis_json = await self.gemini.analyze_market(symbol, ohlcv)
                
                if analysis_json:
                    # Clean json string if needed (Gemini might add markdown)
                    cleaned_json = analysis_json.replace('```json', '').replace('```', '').strip()
                    try:
                        decision = json.loads(cleaned_json)
                        self.log("INFO", f"Gemini Decision: {decision.get('action')} ({decision.get('confidence')})", decision)
                        
                        # Save Gemini decision to database
                        db = SessionLocal()
                        try:
                            gemini_decision = GeminiDecision(
                                symbol=symbol,
                                action=decision.get('action'),
                                confidence=decision.get('confidence'),
                                entry_price=decision.get('entry_price'),
                                stop_loss=decision.get('stop_loss'),
                                take_profit=decision.get('take_profit'),
                                reasoning=decision.get('reasoning'),
                                market_data=ohlcv.tail(20).to_json(),
                                executed=False
                            )
                            db.add(gemini_decision)
                            db.commit()
                            db.refresh(gemini_decision)
                            
                            # 3. Execute (Placeholder for now)
                            if decision.get('action') in ['BUY', 'SELL']:
                                # Balance Check for BUY orders
                                if decision.get('action') == 'BUY':
                                    self.log("INFO", "Checking account balance...")
                                    balance = await self.binance.get_balance()
                                    if balance:
                                        # Assuming USDT for now, logic can be expanded for other quote currencies
                                        quote_currency = 'USDT' 
                                        free_balance = balance.get(quote_currency, {}).get('free', 0.0)
                                        self.log("INFO", f"Free Balance: {free_balance} {quote_currency}")
                                        
                                        if free_balance < investment_amount:
                                            self.log("WARNING", f"Insufficient funds. Required: {investment_amount}, Available: {free_balance}")
                                            gemini_decision.executed = False
                                            gemini_decision.reasoning += " [SKIPPED: Insufficient Funds]"
                                            db.commit()
                                            continue
                                    else:
                                        self.log("WARNING", "Failed to fetch balance. Skipping trade.")
                                        continue

                                self.log("INFO", f"Executing {decision['action']} order...", {
                                    "amount": investment_amount,
                                    "leverage": leverage
                                })
                                # await self.binance.create_order(...)
                                
                                # Create trade record
                                trade = Trade(
                                    symbol=symbol,
                                    market_type=market_type,
                                    timeframe=timeframe,
                                    action=decision['action'],
                                    amount=investment_amount,
                                    entry_price=decision.get('entry_price') or ohlcv.iloc[-1]['close'],
                                    entry_time=datetime.utcnow(),
                                    status='OPEN',
                                    gemini_decision_id=gemini_decision.id
                                )
                                db.add(trade)
                                gemini_decision.executed = True
                                db.commit()
                                self.log("INFO", f"Trade #{trade.id} created")
                        finally:
                            db.close()
                    except json.JSONDecodeError as e:
                        self.log("ERROR", f"Failed to parse Gemini response: {e}")
                else:
                    self.log("WARNING", "Gemini analysis failed (returned None). Check API Key or logs.")
                
            except Exception as e:
                self.log("ERROR", f"Error in trading loop: {e}")
            
            await asyncio.sleep(60)  # Fixed interval bug

    def stop(self):
        self.is_running = False
        self.log("INFO", "Stopping trading loop...")
