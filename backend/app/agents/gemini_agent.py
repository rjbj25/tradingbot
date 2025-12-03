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

    async def analyze_market(self, symbol: str, data_dict: dict, base_tf: str, strategy: str = "IA Driven"):
        """
        Analyze market data using Gemini with Multi-Timeframe context and specific Strategy.
        """
        # Prepare data string
        data_str = ""
        for tf, df in data_dict.items():
            data_str += f"\n--- Timeframe: {tf} (Last 15 candles) ---\n"
            data_str += df.tail(15).to_string() + "\n"
            
        # Strategy Definitions
        strategies = {
            "IA Driven": "Realiza un análisis técnico integral combinando múltiples indicadores, acción del precio y estructura de mercado.",
            "RSI Divergence": "Céntrate EXCLUSIVAMENTE en buscar Divergencias de RSI (Regular y Oculta) en zonas de sobrecompra/sobreventa.",
            "MACD Crossover": "Busca cruces de líneas MACD y cruces de línea cero, confirmados por volumen.",
            "Bollinger Bands Breakout": "Busca rupturas de las Bandas de Bollinger con confirmación de volumen (Squeeze & Break).",
            "EMA Golden Cross": "Analiza cruces de medias móviles (EMA 50/200 o 20/50) para determinar tendencia.",
            "Fibonacci Retracement": "Identifica niveles de retroceso de Fibonacci (0.382, 0.5, 0.618) en la tendencia principal.",
            "Ichimoku Cloud": "Utiliza la Nube de Ichimoku (Kumo) para determinar tendencia, soporte/resistencia y señales de entrada.",
            "Price Action (S/R)": "Opera puramente basado en Soportes, Resistencias, Líneas de Tendencia y Patrones de Velas.",
            "Volume Spread Analysis (VSA)": "Analiza la relación entre el spread de la vela y el volumen para detectar manipulación institucional.",
            "Elliott Wave Theory": "Identifica en qué onda de Elliott se encuentra el mercado (Impulso 1-5 o Corrección A-B-C).",
            "Wyckoff Method": "Identifica fases de Acumulación o Distribución según la metodología Wyckoff.",
            "Smart Money Concepts (SMC)": "Busca Order Blocks, Fair Value Gaps (FVG) y Liquidez (Buy/Sell Side Liquidity)."
        }
        
        selected_instruction = strategies.get(strategy, strategies["IA Driven"])
        
        prompt = f"""
        Actúa como un experto analista de trading de criptomonedas institucional. 
        Realiza un análisis técnico para {symbol} utilizando la estrategia: **{strategy}**.
        
        Instrucción de Estrategia:
        {selected_instruction}
        
        Contexto Multi-Timeframe:
        1. Identificar la TENDENCIA MACRO usando las temporalidades mayores.
        2. Buscar patrones de entrada precisos en la temporalidad base ({base_tf}).
        
        Datos de Mercado:
        {data_str}
        
        Reglas de Gestión:
        - Solo opera si la estrategia da una señal CLARA.
        - Define Stop Loss y Take Profit lógicos.
        - Calcula un nivel de confianza (0.0 - 1.0).
        
        Proporciona tu decisión EXCLUSIVAMENTE en formato JSON con estas claves:
        {{
            "action": "BUY" | "SELL" | "HOLD",
            "confidence": float,
            "entry_price": float (precio actual aproximado),
            "stop_loss": float,
            "take_profit": float,
            "reasoning": "Explicación concisa en español enfocada en {strategy}"
        }}
        """
        
        try:
            response = self.model.generate_content(prompt)
            return response.text
        except Exception as e:
            print(f"Error analyzing market: {e}")
            return None
