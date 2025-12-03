from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.database import Trade, GeminiDecision
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
from fastapi import APIRouter

router = APIRouter()

class TradeResponse(BaseModel):
    id: int
    symbol: str
    action: str
    amount: Optional[float] = None
    entry_price: float
    entry_time: datetime
    exit_price: Optional[float] = None
    exit_time: Optional[datetime] = None
    profit_loss: Optional[float] = None
    status: str
    confidence: Optional[float] = None
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    is_simulation: bool = False
    
    class Config:
        from_attributes = True

class DecisionResponse(BaseModel):
    id: int
    timestamp: datetime
    symbol: str
    action: str
    confidence: float
    entry_price: Optional[float] = None
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    reasoning: str
    executed: bool
    
    class Config:
        from_attributes = True

@router.get("/trades", response_model=List[TradeResponse])
def get_trades(limit: int = 50, db: Session = Depends(get_db)):
    """Get recent trades"""
    trades = db.query(Trade).order_by(Trade.entry_time.desc()).limit(limit).all()
    
    # Manually map fields from relationship
    result = []
    for t in trades:
        trade_dict = t.__dict__
        if t.gemini_decision:
            trade_dict['confidence'] = t.gemini_decision.confidence
            trade_dict['stop_loss'] = t.gemini_decision.stop_loss
            trade_dict['take_profit'] = t.gemini_decision.take_profit
        result.append(trade_dict)
        
    return result

@router.get("/decisions", response_model=List[DecisionResponse])
def get_decisions(limit: int = 50, db: Session = Depends(get_db)):
    """Get recent Gemini decisions"""
    decisions = db.query(GeminiDecision).order_by(GeminiDecision.timestamp.desc()).limit(limit).all()
    return decisions

@router.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    """Get trading statistics"""
    total_trades = db.query(Trade).count()
    open_trades = db.query(Trade).filter(Trade.status == 'OPEN').count()
    closed_trades = db.query(Trade).filter(Trade.status == 'CLOSED').count()
    
    # Calculate P/L for closed trades
    closed_trades_list = db.query(Trade).filter(Trade.status == 'CLOSED', Trade.profit_loss.isnot(None)).all()
    total_pl = sum(t.profit_loss for t in closed_trades_list) if closed_trades_list else 0
    
    return {
        "total_trades": total_trades,
        "open_trades": open_trades,
        "closed_trades": closed_trades,
        "total_profit_loss": total_pl
    }
