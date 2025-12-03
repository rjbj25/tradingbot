from app.core.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TABLE trades ADD COLUMN amount FLOAT"))
        print("Column 'amount' added successfully.")
    except Exception as e:
        print(f"Error (column might exist): {e}")
