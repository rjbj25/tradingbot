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

    async def manage_open_positions(self, symbol: str, current_price: float, paper_trading: bool):
        """
        Check ALL open positions for the symbol and handle SL/TP.
        Returns the number of positions that remain OPEN.
        """
        db = SessionLocal()
        try:
            # Find ALL open trades for this symbol
            trades = db.query(Trade).filter(
                Trade.symbol == symbol, 
                Trade.status == 'OPEN'
            ).all()
            
            open_count = 0
            
            if not trades:
                return 0
            
            # --- SYNCHRONIZATION (Real Trading Only) ---
            # Note: Syncing multiple positions is complex because Binance returns a net position for Futures.
            # If we are in Hedge Mode, we might have long and short.
            # If in One-Way Mode (default), we only have one net position.
            # For simplicity in this iteration: 
            # We will sync based on TOTAL size. If Binance size == 0, close ALL DB positions.
            # This is a simplification. Ideally we track order IDs.
            
            if not paper_trading:
                try:
                    real_position = await self.binance.get_open_position(symbol)
                    real_amt = float(real_position['info']['positionAmt']) if real_position else 0
                    
                    if real_amt == 0 and trades:
                        self.log("WARNING", f"Binance position is CLOSED/LIQUIDATED. Closing {len(trades)} local trades.")
                        for trade in trades:
                            trade.status = 'CLOSED'
                            trade.exit_price = current_price 
                            trade.exit_time = datetime.utcnow()
                            trade.profit_loss = 0 
                        db.commit()
                        return 0
                except Exception as e:
                    self.log("ERROR", f"Failed to sync position with Binance: {e}")

            # Iterate over each open trade to check SL/TP
            for trade in trades:
                # If we just closed it in sync step (though we returned 0 above, so this is safe)
                if trade.status != 'OPEN':
                    continue

                self.log("INFO", f"Monitoring Trade #{trade.id} ({trade.action}) | Entry: {trade.entry_price} | Current: {current_price}")
                
                if not trade.gemini_decision:
                    open_count += 1
                    continue

                stop_loss = trade.gemini_decision.stop_loss
                take_profit = trade.gemini_decision.take_profit
                
                close_action = None
                reason = None
                
                # Check SL/TP
                if trade.action == 'BUY': # LONG
                    if stop_loss and current_price <= stop_loss:
                        close_action = 'SELL'
                        reason = f"Stop Loss hit ({current_price} <= {stop_loss})"
                    elif take_profit and current_price >= take_profit:
                        close_action = 'SELL'
                        reason = f"Take Profit hit ({current_price} >= {take_profit})"
                elif trade.action == 'SELL': # SHORT
                    if stop_loss and current_price >= stop_loss:
                        close_action = 'BUY'
                        reason = f"Stop Loss hit ({current_price} >= {stop_loss})"
                    elif take_profit and current_price <= take_profit:
                        close_action = 'BUY'
                        reason = f"Take Profit hit ({current_price} <= {take_profit})"
                
                if close_action:
                    self.log("INFO", f"Closing Trade #{trade.id}: {reason}")
                    
                    # Execute Close
                    if not paper_trading:
                        try:
                            # Real Execution
                            quantity = trade.amount / trade.entry_price
                            await self.binance.create_order(symbol, 'market', close_action.lower(), quantity)
                            self.log("INFO", f"Real Close Order Executed: {close_action} {quantity}")
                        except Exception as e:
                            self.log("ERROR", f"Failed to close trade on Binance: {e}")
                            # If real close fails, keep open in DB
                            open_count += 1
                            continue 
                    
                    # Update DB
                    trade.status = 'CLOSED'
                    trade.exit_price = current_price
                    trade.exit_time = datetime.utcnow()
                    
                    # P/L Calculation
                    if trade.action == 'BUY':
                        trade.profit_loss = (current_price - trade.entry_price) * (trade.amount / trade.entry_price)
                        trade.profit_loss_pct = (current_price - trade.entry_price) / trade.entry_price
                    else: # SHORT
                        trade.profit_loss = (trade.entry_price - current_price) * (trade.amount / trade.entry_price)
                        trade.profit_loss_pct = (trade.entry_price - current_price) / trade.entry_price
                    
                    db.commit()
                    self.log("INFO", f"Trade #{trade.id} Closed. P/L: {trade.profit_loss:.2f} USDT")
                else:
                    open_count += 1
            
            return open_count

        except Exception as e:
            self.log("ERROR", f"Error managing open positions: {e}")
            return 1 # Assume at least one is open on error to prevent spamming new trades
        finally:
            db.close()

    async def start_trading_loop(self, symbol: str, market_type: str, timeframe: str, 
                               investment_amount: float, leverage: int,
                               binance_api_key: str = None, binance_secret_key: str = None, 
                               gemini_api_key: str = None, paper_trading: bool = False,
                               max_open_positions: int = 1, strategy: str = "IA Driven",
                               check_interval: int = 60, model: str = "gemini-2.5-flash"):
        self.is_running = True
        self.symbol = symbol
        self.market_type = market_type
        self.timeframe = timeframe
        self.investment_amount = investment_amount
        self.leverage = leverage
        self.max_open_positions = max_open_positions
        self.check_interval = check_interval
        
        mode_str = "PAPER TRADING" if paper_trading else "REAL TRADING"
        self.log("INFO", f"Starting {mode_str} loop for {symbol} ({market_type}, {timeframe})", {
            "investment": investment_amount,
            "leverage": leverage,
            "paper_trading": paper_trading,
            "max_open_positions": max_open_positions,
            "strategy": strategy,
            "check_interval": check_interval,
            "model": model
        })
        
        # Debug: Check keys (masked)
        b_key_masked = f"{binance_api_key[:4]}..." if binance_api_key else "None"
        g_key_masked = f"{gemini_api_key[:4]}..." if gemini_api_key else "None"
        self.log("INFO", f"Keys received - Binance: {b_key_masked}, Gemini: {g_key_masked}")

        # Initialize Agents with provided keys
        try:
            self.binance = BinanceAgent(api_key=binance_api_key, secret_key=binance_secret_key, market_type=market_type)
            await self.binance.load_markets()
            self.gemini = GeminiAgent(api_key=gemini_api_key, model_name=model)
            self.log("INFO", "Agents initialized successfully")
        except Exception as e:
            self.log("ERROR", f"Failed to initialize agents: {str(e)}")
            self.is_running = False
            return
        
        try:
            while self.is_running:
                try:
                    # 1. Fetch Data (Multi-Timeframe)
                    self.log("INFO", "Fetching market data...")
                    
                    # Define timeframe hierarchy
                    tf_map = {
                        '1m': ['5m', '15m'],
                        '5m': ['15m', '1h'],
                        '15m': ['1h', '4h'],
                        '1h': ['4h', '1d'],
                        '4h': ['1d', '1w'],
                        '1d': ['1w', '1M']
                    }
                    
                    higher_tfs = tf_map.get(timeframe, [])
                    data_dict = {}
                    
                    # Fetch Base Timeframe
                    base_ohlcv = await self.binance.fetch_ohlcv(symbol, timeframe=timeframe)
                    if base_ohlcv is None:
                        self.log("WARNING", "Failed to fetch base data. Retrying in 10s...")
                        await asyncio.sleep(10)
                        continue
                    data_dict[timeframe] = base_ohlcv
                    current_price = base_ohlcv.iloc[-1]['close']
                    
                    # Fetch Higher Timeframes
                    for tf in higher_tfs:
                        try:
                            df = await self.binance.fetch_ohlcv(symbol, timeframe=tf)
                            if df is not None:
                                data_dict[tf] = df
                        except Exception as e:
                            self.log("WARNING", f"Failed to fetch {tf} data: {e}")

                    # 2. Check Open Positions & Manage SL/TP
                    open_trades_count = await self.manage_open_positions(symbol, current_price, paper_trading)
                    
                    if open_trades_count >= self.max_open_positions:
                        self.log("INFO", f"Max positions reached ({open_trades_count}/{self.max_open_positions}). Skipping new analysis.")
                        await asyncio.sleep(self.check_interval)
                        continue
                        
                    # 3. Analyze with Gemini (Only if slots available)
                    self.log("INFO", f"Analyzing market with Gemini (Open: {open_trades_count}/{self.max_open_positions}) | Strategy: {strategy}...")
                    # Pass the entire data_dict to analyze_market
                    analysis_json = await self.gemini.analyze_market(symbol, data_dict, timeframe, strategy)
                    
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
                                    market_data=data_dict[timeframe].tail(20).to_json(), # Save base TF data for reference
                                    executed=False
                                )
                                db.add(gemini_decision)
                                db.commit()
                                db.refresh(gemini_decision)
                                
                                # 4. Execute
                                if decision.get('action') in ['BUY', 'SELL']:
                                    # Balance Check
                                    if decision.get('action') == 'BUY':
                                        self.log("INFO", "Checking account balance...")
                                        balance = await self.binance.get_balance()
                                        
                                        if balance:
                                            quote_currency = 'USDT' 
                                            free_balance = balance.get(quote_currency, {}).get('free', 0.0)
                                            self.log("INFO", f"Free Balance: {free_balance} {quote_currency}")
                                            
                                            if not paper_trading and free_balance < investment_amount:
                                                self.log("WARNING", f"Insufficient funds. Required: {investment_amount}, Available: {free_balance}")
                                                gemini_decision.executed = False
                                                gemini_decision.reasoning += " [SKIPPED: Insufficient Funds]"
                                                db.commit()
                                                continue
                                            elif paper_trading:
                                                self.log("INFO", f"Paper Trading: Skipping balance check (Virtual Balance assumed)")
                                        else:
                                            if not paper_trading:
                                                self.log("WARNING", "Failed to fetch balance. Skipping trade.")
                                                continue
                                            else:
                                                self.log("WARNING", "Failed to fetch balance, but proceeding in Paper Mode.")

                                    self.log("INFO", f"Executing {decision['action']} order ({mode_str})...", {
                                        "amount": investment_amount,
                                        "leverage": leverage
                                    })
                                    
                                    # Execution Logic
                                    entry_price = decision.get('entry_price') or current_price
                                    executed_amount = investment_amount
                                    
                                    if not paper_trading:
                                        try:
                                            # Calculate quantity based on price
                                            raw_quantity = executed_amount / entry_price
                                            
                                            # Determine side based on action
                                            side = 'buy' if decision['action'] == 'BUY' else 'sell'
                                            
                                            # Execute Order (with precision adjustment inside BinanceAgent)
                                            await self.binance.create_order(symbol, 'market', side, raw_quantity)
                                            self.log("INFO", f"Real Order Executed on Binance: {side} {raw_quantity}")
                                            
                                        except Exception as e:
                                            self.log("ERROR", f"Order execution failed: {e}")
                                            # If execution failed, DO NOT create trade record
                                            continue

                                    # Create trade record
                                    trade = Trade(
                                        symbol=symbol,
                                        market_type=market_type,
                                        timeframe=timeframe,
                                        action=decision['action'],
                                        amount=investment_amount,
                                        entry_price=entry_price,
                                        entry_time=datetime.utcnow(),
                                        status='OPEN',
                                        gemini_decision_id=gemini_decision.id,
                                        is_simulation=paper_trading
                                    )
                                    db.add(trade)
                                    gemini_decision.executed = True
                                    db.commit()
                                    self.log("INFO", f"Trade #{trade.id} created ({mode_str})")
                            finally:
                                db.close()
                        except json.JSONDecodeError as e:
                            self.log("ERROR", f"Failed to parse Gemini response: {e}")
                    else:
                        self.log("WARNING", "Gemini analysis failed (returned None). Check API Key or logs.")
                    
                except Exception as e:
                    self.log("ERROR", f"Error in trading loop: {e}")
                
                await asyncio.sleep(self.check_interval)
        finally:
            self.is_running = False
            self.log("INFO", "Trading loop stopped.")

    def stop(self):
        self.is_running = False
        self.log("INFO", "Stopping trading loop...")
