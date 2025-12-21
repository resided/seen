// ================================
// MOOD. - Utility Functions
// ================================

export const MAX_EARLY_BIRD_BONUS = 25;

export function calculateEarlyBirdBonus(startedAt, endsAt) {
  const now = Date.now();
  const totalDuration = endsAt.getTime() - startedAt.getTime();
  const elapsed = now - startedAt.getTime();
  const remainingPercent = Math.max(0, 1 - (elapsed / totalDuration));
  return Math.round(remainingPercent * MAX_EARLY_BIRD_BONUS);
}

export function formatTime(ms) {
  if (ms <= 0) return "00:00:00";
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const secs = Math.floor((ms % (1000 * 60)) / 1000);
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function formatUSD(amount) {
  // Format large numbers: 1000 -> $1K, 1000000 -> $1M, 1000000000 -> $1B
  if (amount >= 1000000000) {
    return `$${(amount / 1000000000).toFixed(1)}B`;
  } else if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  } else if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatUSDPrecise(amount) {
  // For precise amounts under 1M, use full format
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(2)}M`;
  } else if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(2)}K`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

export function calculatePoolPercentages(yepPool, nopePool, totalPool) {
  return {
    yepPercent: (yepPool / totalPool) * 100,
    nopePercent: (nopePool / totalPool) * 100,
  };
}

export function calculateBoostedOdds(baseOdds, earlyBirdBonus) {
  return baseOdds * (1 + earlyBirdBonus / 100);
}
