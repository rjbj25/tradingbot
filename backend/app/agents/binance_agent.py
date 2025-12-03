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
            },
            'timeout': 10000, # 10 seconds timeout
        })
        if settings.BINANCE_TESTNET:
            self.exchange.set_sandbox_mode(True)

    async def load_markets(self):
        """Load market data to ensure precision info is available"""
        await self.exchange.load_markets()

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
            raise e

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

    def adjust_quantity(self, symbol: str, amount: float):
        """
        Adjust quantity to meet exchange precision requirements.
        """
        return self.exchange.amount_to_precision(symbol, amount)

    async def get_open_position(self, symbol: str):
        """
        Get the current open position for a symbol from the exchange.
        Returns None if no position or error.
        """
        try:
            # For futures, fetch_positions is usually used
            positions = await self.exchange.fetch_positions([symbol])
            for pos in positions:
                if pos['symbol'] == symbol and float(pos['contracts']) > 0:
                    return pos
            return None
        except Exception as e:
            print(f"Error fetching position for {symbol}: {e}")
            return None

    async def create_order(self, symbol: str, type: str, side: str, amount: float, price: float = None):
        """
        Create an order on Binance.
        """
        try:
            # Ensure markets are loaded for precision
            if not self.exchange.markets:
                await self.load_markets()

            # Adjust amount precision
            adjusted_amount = self.adjust_quantity(symbol, amount)
            
            print(f"DEBUG: Creating order - Symbol: {symbol}, Side: {side}, Amount: {amount} -> {adjusted_amount}")

            if type == 'limit':
                order = await self.exchange.create_order(symbol, type, side, adjusted_amount, price)
            else:
                order = await self.exchange.create_order(symbol, type, side, adjusted_amount)
            return order
        except Exception as e:
            print(f"Error creating order: {e}")
            raise e

    async def close(self):
        await self.exchange.close()
