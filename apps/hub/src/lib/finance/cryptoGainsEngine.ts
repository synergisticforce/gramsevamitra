/** Crypto capital gains calculator — FIFO offline logic. */

export type CryptoTradeType = 'buy' | 'sell';

export interface CryptoTrade {
  id: string;
  asset: string;
  type: CryptoTradeType;
  quantity: number;
  priceInr: number;
  date: string;
}

export interface CryptoLot {
  quantity: number;
  priceInr: number;
}

export interface CryptoGainResult {
  asset: string;
  totalGain: number;
  totalProceeds: number;
  totalCost: number;
  tradesProcessed: number;
}

export function createCryptoTradeId(): string {
  return `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function computeCryptoGains(trades: CryptoTrade[]): CryptoGainResult[] {
  const byAsset = new Map<string, CryptoTrade[]>();
  for (const trade of trades) {
    const list = byAsset.get(trade.asset.toUpperCase()) ?? [];
    list.push(trade);
    byAsset.set(trade.asset.toUpperCase(), list);
  }

  const results: CryptoGainResult[] = [];

  for (const [asset, assetTrades] of byAsset) {
    const sorted = [...assetTrades].sort((a, b) => a.date.localeCompare(b.date));
    const lots: CryptoLot[] = [];
    let totalGain = 0;
    let totalProceeds = 0;
    let totalCost = 0;
    let tradesProcessed = 0;

    for (const trade of sorted) {
      if (trade.quantity <= 0 || trade.priceInr <= 0) continue;
      tradesProcessed += 1;

      if (trade.type === 'buy') {
        lots.push({ quantity: trade.quantity, priceInr: trade.priceInr });
        continue;
      }

      let remaining = trade.quantity;
      const proceeds = trade.quantity * trade.priceInr;
      totalProceeds += proceeds;
      let costBasis = 0;

      while (remaining > 0 && lots.length > 0) {
        const lot = lots[0];
        const used = Math.min(remaining, lot.quantity);
        costBasis += used * lot.priceInr;
        lot.quantity -= used;
        remaining -= used;
        if (lot.quantity <= 0.00000001) lots.shift();
      }

      totalCost += costBasis;
      totalGain += proceeds - costBasis;
    }

    results.push({ asset, totalGain, totalProceeds, totalCost, tradesProcessed });
  }

  return results.sort((a, b) => a.asset.localeCompare(b.asset));
}

export function portfolioDistribution(trades: CryptoTrade[]): { asset: string; value: number }[] {
  const holdings = new Map<string, number>();
  for (const trade of trades) {
    const key = trade.asset.toUpperCase();
    const current = holdings.get(key) ?? 0;
    if (trade.type === 'buy') {
      holdings.set(key, current + trade.quantity * trade.priceInr);
    } else {
      holdings.set(key, Math.max(0, current - trade.quantity * trade.priceInr));
    }
  }
  return [...holdings.entries()]
    .filter(([, value]) => value > 0)
    .map(([asset, value]) => ({ asset, value }))
    .sort((a, b) => b.value - a.value);
}
