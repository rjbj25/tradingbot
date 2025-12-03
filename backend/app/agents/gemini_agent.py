import google.generativeai as genai
from app.core.config import settings
import pandas as pd

class GeminiAgent:
    def __init__(self, api_key: str = None):
        key = api_key or settings.GEMINI_API_KEY
        if not key:
            print("Warning: GEMINI_API_KEY not found.")
        else:
            genai.configure(api_key=key)
            
        # Using available model from list_models.py
        self.model = genai.GenerativeModel('gemini-2.5-flash')

    async def analyze_market(self, symbol: str, ohlcv_df: pd.DataFrame):
        """
        Analyze market data using Gemini.
        """
        # Prepare data for prompt
        latest_data = ohlcv_df.tail(20).to_string()
        
        prompt = f"""
        Actúa como un experto analista de trading de criptomonedas. Analiza los siguientes datos OHLCV para {symbol}.
        
        Datos (Últimas 20 velas):
        {latest_data}
        
        Proporciona una decisión de trading en formato JSON con las siguientes claves:
        - action: "BUY", "SELL", o "HOLD"
        - confidence: 0.0 a 1.0
        - entry_price: float (opcional)
        - stop_loss: float (opcional)
        - take_profit: float (opcional)
        - reasoning: string (explicación detallada en español)
        
        Salida solo JSON.
        """
        
        try:
            response = self.model.generate_content(prompt)
            return response.text
        except Exception as e:
            print(f"Error analyzing market: {e}")
            return None
