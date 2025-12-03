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

    async def analyze_market(self, symbol: str, data_dict: dict, base_tf: str):
        """
        Analyze market data using Gemini with Multi-Timeframe context.
        """
        # Prepare data string
        data_str = ""
        for tf, df in data_dict.items():
            data_str += f"\n--- Timeframe: {tf} (Last 15 candles) ---\n"
            data_str += df.tail(15).to_string() + "\n"
        
        prompt = f"""
        Actúa como un experto analista de trading de criptomonedas institucional. 
        Realiza un análisis técnico profundo para {symbol} utilizando una estrategia Multi-Timeframe.
        
        Tus objetivos:
        1. Identificar la TENDENCIA MACRO usando las temporalidades mayores.
        2. Buscar patrones de entrada precisos en la temporalidad base ({base_tf}).
        3. Validar la fuerza de la tendencia y el volumen.
        
        Datos de Mercado:
        {data_str}
        
        Reglas de Gestión:
        - Solo opera si hay confluencia entre temporalidades.
        - Define Stop Loss y Take Profit lógicos basados en soporte/resistencia.
        - Calcula un nivel de confianza (0.0 - 1.0) basado en la claridad del setup.
        
        Proporciona tu decisión EXCLUSIVAMENTE en formato JSON con estas claves:
        {{
            "action": "BUY" | "SELL" | "HOLD",
            "confidence": float,
            "entry_price": float (precio actual aproximado),
            "stop_loss": float,
            "take_profit": float,
            "reasoning": "Explicación concisa en español mencionando la confluencia de temporalidades"
        }}
        """
        
        try:
            response = self.model.generate_content(prompt)
            return response.text
        except Exception as e:
            print(f"Error analyzing market: {e}")
            return None
