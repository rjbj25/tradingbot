import ccxt.async_support as ccxt
import pandas as pd
from app.core.config import settings

class BinanceAgent:
    def __init__(self, api_key: str = None, secret_key: str = None, market_type: str = 'future'):
        self.exchange = ccxt.binance({
            'apiKey': api_key or settings.BINANCE_API_KEY,
            'secret': secret_key or settings.BINANCE_SECRET_KEY,
            'options': {
                'defaultType': market_type,
            }
        })
        if settings.BINANCE_TESTNET:
            self.exchange.set_sandbox_mode(True)

    async def fetch_ohlcv(self, symbol: str, timeframe: str = '1h', limit: int = 100):
        """
        Fetch OHLCV data for a symbol.
        """
        try:
            ohlcv = await self.exchange.fetch_ohlcv(symbol, timeframe, limit=limit)
            df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
            df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
            return df
        except Exception as e:
            print(f"Error fetching OHLCV: {e}")
            return None

    async def get_balance(self):
        """
        Fetch account balance.
        """
        try:
            balance = await self.exchange.fetch_balance()
            return balance
        except Exception as e:
            print(f"Error fetching balance: {e}")
            return None

    async def close(self):
        await self.exchange.close()
