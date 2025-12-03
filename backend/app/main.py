from fastapi import FastAPI
from app.core.config import settings
from app.api.routes import router
from app.api.history import router as history_router
from app.core.database import init_db

app = FastAPI(title="Agentic Trading System", version="0.1.0")

# Initialize database
init_db()

app.include_router(router, prefix="/api")
app.include_router(history_router, prefix="/api/history")

@app.get("/")
async def root():
    return {"message": "Agentic Trading System API is running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
