from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base

class Trade(Base):
    __tablename__ = "trades"
    
    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String, nullable=False, index=True)
    market_type = Column(String)
    timeframe = Column(String)
    action = Column(String)  # 'BUY' or 'SELL'
    amount = Column(Float)   # Investment amount in USDT
    entry_price = Column(Float)
    entry_time = Column(DateTime, default=datetime.utcnow)
    exit_price = Column(Float, nullable=True)
    exit_time = Column(DateTime, nullable=True)
    profit_loss = Column(Float, nullable=True)
    profit_loss_pct = Column(Float, nullable=True)
    status = Column(String, default='OPEN')  # 'OPEN', 'CLOSED'
    gemini_decision_id = Column(Integer, ForeignKey('gemini_decisions.id'), nullable=True)
    
    # Relationship
    gemini_decision = relationship("GeminiDecision", back_populates="trade")

class GeminiDecision(Base):
    __tablename__ = "gemini_decisions"
    
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    symbol = Column(String, nullable=False)
    action = Column(String)  # 'BUY', 'SELL', 'HOLD'
    confidence = Column(Float)
    entry_price = Column(Float, nullable=True)
    stop_loss = Column(Float, nullable=True)
    take_profit = Column(Float, nullable=True)
    reasoning = Column(Text)
    market_data = Column(Text)  # JSON string with OHLCV
    executed = Column(Boolean, default=False)
    
    # Relationship
    trade = relationship("Trade", back_populates="gemini_decision", uselist=False)

class Configuration(Base):
    __tablename__ = "configurations"
    
    id = Column(Integer, primary_key=True, index=True)
    config_key = Column(String, unique=True, nullable=False, index=True)
    config_value = Column(Text)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class SystemLog(Base):
    __tablename__ = "system_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    level = Column(String)  # 'INFO', 'WARNING', 'ERROR'
    component = Column(String)  # 'Orchestrator', 'BinanceAgent', 'GeminiAgent'
    message = Column(Text)
    details = Column(Text, nullable=True)  # JSON string for extra data
