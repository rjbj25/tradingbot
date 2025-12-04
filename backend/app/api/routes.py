from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session
from app.core.orchestrator import TradingOrchestrator
from app.agents.binance_agent import BinanceAgent
from app.agents.gemini_agent import GeminiAgent
from app.core.database import get_db
from app.models.database import Configuration, SystemLog, Trade, GeminiDecision
from app.core.backtest_engine import BacktestEngine
import uuid

router = APIRouter()

# Global Orchestrator Instance
orchestrator = TradingOrchestrator()

class LogResponse(BaseModel):
    id: int
    timestamp: str
    level: str
    message: str
    component: str
    
    class Config:
        from_attributes = True

class StartRequest(BaseModel):
    symbol: str
    market_type: str = "future"
    timeframe: str
    investment_amount: float
    leverage: int
    binance_api_key: Optional[str] = None
    binance_secret_key: Optional[str] = None
    gemini_api_key: Optional[str] = None
    paper_trading: bool = True
    max_open_positions: int = 1
    strategy: str = "IA Driven"
    check_interval: int = 60

class ConfigRequest(BaseModel):
    binance_api_key: Optional[str] = None
    binance_secret_key: Optional[str] = None
    gemini_api_key: Optional[str] = None
    symbol: Optional[str] = None
    timeframe: Optional[str] = None
    investment_amount: Optional[float] = None
    leverage: Optional[int] = None
    paper_trading: Optional[bool] = None
    max_open_positions: Optional[int] = None
    strategy: Optional[str] = None
    check_interval: Optional[int] = None

class BacktestRequest(BaseModel):
    symbol: str = "BTC/USDT"
    timeframe: str = "1h"
    strategy: str = "IA Driven"
    model: str = "gemini-2.5-flash"
    days: int = 7
    initial_capital: float = 1000.0

@router.get("/models")
def get_models(db: Session = Depends(get_db)):
    """List available Gemini models"""
    # Try to get API key from config if not provided in env
    configs = db.query(Configuration).all()
    config_map = {c.config_key: c.config_value for c in configs}
    api_key = config_map.get('gemini_api_key')
    
    agent = GeminiAgent(api_key=api_key)
    return agent.list_available_models()

@router.post("/start")
async def start_trading(request: StartRequest, background_tasks: BackgroundTasks = None):
    if orchestrator.is_running:
        return {"status": "already_running"}
    
    print(f"DEBUG: Start Request Keys - Binance: {request.binance_api_key}, Gemini: {request.gemini_api_key}")

    # Fallback: Try to load keys from DB if not provided in request
    binance_key = request.binance_api_key
    binance_secret = request.binance_secret_key
    gemini_key = request.gemini_api_key
    
    if not (binance_key and binance_secret and gemini_key):
        db = next(get_db())
        configs = db.query(Configuration).all()
        config_map = {c.config_key: c.config_value for c in configs}
        
        if not binance_key:
            binance_key = config_map.get('binance_api_key')
        if not binance_secret:
            binance_secret = config_map.get('binance_secret_key')
        if not gemini_key:
            gemini_key = config_map.get('gemini_api_key')
            
    # Start the orchestrator
    background_tasks.add_task(
        orchestrator.start_trading_loop,
        symbol=request.symbol,
        market_type=request.market_type,
        timeframe=request.timeframe,
        investment_amount=request.investment_amount,
        leverage=request.leverage,
        binance_api_key=binance_key,
        binance_secret_key=binance_secret,
        gemini_api_key=gemini_key,
        paper_trading=request.paper_trading,
        max_open_positions=request.max_open_positions,
        strategy=request.strategy,
        check_interval=request.check_interval
    )

    return {"status": "started"}

@router.get("/config")
def get_config(db: Session = Depends(get_db)):
    """Get current configuration"""
    configs = db.query(Configuration).all()
    return {c.config_key: c.config_value for c in configs}

@router.post("/config")
def save_config(config: ConfigRequest, db: Session = Depends(get_db)):
    """Save configuration"""
    data = config.dict(exclude_unset=True)
    for key, value in data.items():
        if value is not None:
            # Update or create
            db_config = db.query(Configuration).filter(Configuration.config_key == key).first()
            if db_config:
                db_config.config_value = str(value)
            else:
                db_config = Configuration(config_key=key, config_value=str(value))
                db.add(db_config)
    db.commit()
    return {"status": "saved"}

# In-memory storage for backtest results (for simplicity)
backtest_results = {}

async def run_backtest_task(backtest_id: str, request: BacktestRequest, binance_key: str, gemini_key: str):
    try:
        backtest_results[backtest_id] = {"status": "running", "progress": 0, "logs": []}
        
        # Initialize Agents
        binance = BinanceAgent(api_key=binance_key) # Read-only for backtest usually
        await binance.load_markets()
        gemini = GeminiAgent(api_key=gemini_key, model_name=request.model)
        
        engine = BacktestEngine(binance, gemini)
        
        async def on_progress(msg):
            if backtest_id in backtest_results:
                if "logs" not in backtest_results[backtest_id]:
                    backtest_results[backtest_id]["logs"] = []
                backtest_results[backtest_id]["logs"].append(msg)
                # Keep only last 50 logs
                if len(backtest_results[backtest_id]["logs"]) > 50:
                    backtest_results[backtest_id]["logs"].pop(0)

        # Run Backtest
        results = await engine.run(
            symbol=request.symbol,
            timeframe=request.timeframe,
            strategy=request.strategy,
            initial_capital=request.initial_capital,
            days=request.days,
            on_progress=on_progress
        )
        
        if isinstance(results, dict) and "error" in results:
            backtest_results[backtest_id]["status"] = "failed"
            backtest_results[backtest_id]["error"] = results["error"]
        else:
            backtest_results[backtest_id]["status"] = "completed"
            backtest_results[backtest_id]["results"] = results
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        backtest_results[backtest_id]["status"] = "failed"
        backtest_results[backtest_id]["error"] = str(e)

@router.post("/backtest")
async def start_backtest(request: BacktestRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    # Get API keys
    configs = db.query(Configuration).all()
    config_map = {c.config_key: c.config_value for c in configs}
    binance_key = config_map.get('binance_api_key')
    gemini_key = config_map.get('gemini_api_key')
    
    if not binance_key or not gemini_key:
        raise HTTPException(status_code=400, detail="API Keys not found in configuration")

    backtest_id = str(uuid.uuid4())
    background_tasks.add_task(run_backtest_task, backtest_id, request, binance_key, gemini_key)
    
    return {"backtest_id": backtest_id, "status": "started"}

@router.get("/backtest/{backtest_id}")
def get_backtest_status(backtest_id: str):
    result = backtest_results.get(backtest_id)
    if not result:
        raise HTTPException(status_code=404, detail="Backtest not found")
    return result

@router.get("/logs", response_model=List[LogResponse])
def get_logs(limit: int = 50, db: Session = Depends(get_db)):
    """Get system logs"""
    logs = db.query(SystemLog).order_by(SystemLog.timestamp.desc()).limit(limit).all()
    # Convert datetime to string for response
    return [
        LogResponse(
            id=l.id,
            timestamp=l.timestamp.isoformat(),
            level=l.level,
            message=l.message,
            component=l.component
        ) for l in logs
    ]

@router.delete("/logs")
def clear_logs(db: Session = Depends(get_db)):
    """Clear all system logs"""
    db.query(SystemLog).delete()
    db.commit()
    return {"status": "cleared"}

@router.post("/stop")
async def stop_trading():
    if not orchestrator.is_running:
        return {"status": "not_running"}
    orchestrator.stop()
    return {"status": "stopped"}

@router.post("/reset")
async def reset_data(db: Session = Depends(get_db)):
    """
    Reset all trading data (Trades, Decisions, Logs) but keep Configuration (API Keys).
    """
    try:
        # Delete all records from operational tables
        db.query(Trade).delete()
        db.query(GeminiDecision).delete()
        db.query(SystemLog).delete()
        db.commit()
        return {"status": "success", "message": "Trading data reset successfully"}
    except Exception as e:
        db.rollback()
        return {"status": "error", "message": str(e)}

@router.get("/status")
async def get_status():
    return {"running": orchestrator.is_running}

@router.get("/market/candles")
async def get_candles(symbol: str, timeframe: str = "1h", limit: int = 100):
    agent = orchestrator.binance
    should_close = False
    
    if not agent:
        # Create temporary agent for public data if bot is not running
        agent = BinanceAgent()
        await agent.load_markets()
        should_close = True
    
    try:
        df = await agent.fetch_ohlcv(symbol, timeframe, limit)
        if df is not None:
            # Convert timestamp to int (ms) for frontend if needed, or keep as string
            # Recharts usually likes unix timestamp numbers or ISO strings
            # df['timestamp'] is datetime, let's convert to ms timestamp
            result = df.to_dict(orient='records')
            for row in result:
                if hasattr(row['timestamp'], 'timestamp'):
                    row['timestamp'] = int(row['timestamp'].timestamp() * 1000)
            return result
        return []
    finally:
        if should_close:
            await agent.close()
