from app.core.database import engine, Base
from app.models.database import Trade
from sqlalchemy import text

def recreate_tables():
    print("Dropping trades table...")
    with engine.connect() as connection:
        connection.execute(text("DROP TABLE IF EXISTS trades"))
        connection.commit()
    print("Trades table dropped. It will be recreated on next startup.")

if __name__ == "__main__":
    recreate_tables()
