from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session
from app.core.orchestrator import TradingOrchestrator
from app.agents.binance_agent import BinanceAgent
from app.core.database import get_db
from app.models.database import Configuration, SystemLog, Trade, GeminiDecision

router = APIRouter()
orchestrator = TradingOrchestrator()

class StartRequest(BaseModel):
    symbol: str = "BTC/USDT"
    market_type: str = "future"
    timeframe: str = "1h"
    investment_amount: float = 100.0
    leverage: int = 1
    binance_api_key: str = None
    binance_secret_key: str = None
    gemini_api_key: str = None
    paper_trading: bool = False
    max_open_positions: int = 1

class ConfigRequest(BaseModel):
    binance_api_key: Optional[str] = None
    binance_secret_key: Optional[str] = None
    gemini_api_key: Optional[str] = None
    symbol: Optional[str] = None
    market_type: Optional[str] = None
    timeframe: Optional[str] = None
    investment_amount: Optional[float] = None
    leverage: Optional[int] = None
    paper_trading: Optional[bool] = None
    max_open_positions: Optional[int] = None

class LogResponse(BaseModel):
    id: int
    timestamp: str
    level: str
    message: str
    component: str
    
    class Config:
        from_attributes = True

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
            
    print(f"DEBUG: Final Keys - Binance: {binance_key}, Gemini: {gemini_key}")

    # Validation: Ensure keys are present before starting
    if not (binance_key and binance_secret and gemini_key):
        raise HTTPException(status_code=400, detail="Missing API Keys. Please configure them in settings or provide them in the request.")

    background_tasks.add_task(orchestrator.start_trading_loop, 
                            request.symbol, request.market_type, request.timeframe,
                            request.investment_amount, request.leverage,
                            binance_key, binance_secret, gemini_key, request.paper_trading,
                            request.max_open_positions)
    return {"status": "started", "config": request.dict(exclude={"binance_secret_key", "binance_api_key", "gemini_api_key"})}

@router.get("/config")
def get_config(db: Session = Depends(get_db)):
    """Get saved configuration"""
    configs = db.query(Configuration).all()
    config_dict = {c.config_key: c.config_value for c in configs}
    return config_dict

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
