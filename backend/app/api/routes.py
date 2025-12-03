from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel, Field
from app.core.orchestrator import TradingOrchestrator
from app.core.database import get_db
from app.models.database import Configuration, SystemLog
from sqlalchemy.orm import Session
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from typing import List, Optional

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

class ConfigRequest(BaseModel):
    binance_api_key: Optional[str] = None
    binance_secret_key: Optional[str] = None
    gemini_api_key: Optional[str] = None
    symbol: Optional[str] = None
    market_type: Optional[str] = None
    timeframe: Optional[str] = None
    investment_amount: Optional[float] = None
    leverage: Optional[int] = None

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

    background_tasks.add_task(orchestrator.start_trading_loop, 
                            request.symbol, request.market_type, request.timeframe,
                            request.investment_amount, request.leverage,
                            binance_key, binance_secret, gemini_key)
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
    orchestrator.stop()
    return {"status": "stopped"}

@router.get("/status")
async def get_status():
    return {"running": orchestrator.is_running}
