from app.core.database import SessionLocal, engine
from app.models.database import Trade, GeminiDecision, SystemLog
from sqlalchemy import text

def reset_db():
    print("Starting database reset...")
    db = SessionLocal()
    try:
        # Delete data from tables
        num_trades = db.query(Trade).delete()
        num_decisions = db.query(GeminiDecision).delete()
        num_logs = db.query(SystemLog).delete()
        
        db.commit()
        
        print(f"Deleted {num_trades} trades.")
        print(f"Deleted {num_decisions} decisions.")
        print(f"Deleted {num_logs} logs.")
        print("Configuration (API Keys) preserved.")
        
    except Exception as e:
        print(f"Error resetting database: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    reset_db()
