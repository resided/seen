import React from 'react';
import { formatUSD } from '../../lib/prediction-utils';

export function HistoryTab({ pastRounds, userStats }) {
  return (
    <div className="flex-1 flex flex-col bg-[#0a0a0a] p-5">
      <div className="mb-6">
        <h2 className="text-white text-2xl font-semibold mb-2">Your History</h2>
        <p className="text-neutral-500 text-sm">Track your predictions and performance</p>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-neutral-900 p-4">
          <p className="text-neutral-600 text-[10px] tracking-wide mb-1">TOTAL PROFIT</p>
          <p className={`text-2xl font-semibold ${
            userStats.totalProfit > 0 ? 'text-emerald-400' : 'text-rose-400'
          }`}>
            {userStats.totalProfit > 0 ? '+' : ''}{formatUSD(userStats.totalProfit)}
          </p>
        </div>

        <div className="bg-neutral-900 p-4">
          <p className="text-neutral-600 text-[10px] tracking-wide mb-1">WIN RATE</p>
          <p className="text-white text-2xl font-semibold">{userStats.winRate.toFixed(0)}%</p>
        </div>

        <div className="bg-neutral-900 p-4">
          <p className="text-neutral-600 text-[10px] tracking-wide mb-1">WIN STREAK</p>
          <p className="text-white text-2xl font-semibold">{userStats.winStreak}</p>
        </div>

        <div className="bg-neutral-900 p-4">
          <p className="text-neutral-600 text-[10px] tracking-wide mb-1">ROUNDS</p>
          <p className="text-white text-2xl font-semibold">{userStats.roundsPlayed}</p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white text-sm font-medium">Recent Rounds</h3>
        <span className="text-neutral-600 text-xs">{pastRounds.length} total</span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2">
        {pastRounds.map((round, index) => (
          <div
            key={index}
            className={`p-4 border ${
              round.won
                ? 'bg-emerald-500/5 border-emerald-500/20'
                : 'bg-rose-500/5 border-rose-500/20'
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                  round.won ? 'bg-emerald-400' : 'bg-rose-400'
                }`}>
                  {round.won ? (
                    <svg className="w-4 h-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </div>
                <div>
                  <p className={`text-sm font-medium ${
                    round.won ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {round.won ? 'Won' : 'Lost'}
                  </p>
                  <p className="text-neutral-600 text-xs">Round #{pastRounds.length - index}</p>
                </div>
              </div>

              <div className="text-right">
                <p className={`text-lg font-semibold ${
                  round.won ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {round.won ? '+' : ''}{formatUSD(round.profit)}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <span className={`px-2 py-0.5 ${
                  round.side === 'YEP'
                    ? 'bg-emerald-400/20 text-emerald-400'
                    : 'bg-rose-400/20 text-rose-400'
                }`}>
                  {round.side}
                </span>
                {round.earlyBirdBonus > 0 && (
                  <span className="text-amber-400">+{round.earlyBirdBonus}% bonus</span>
                )}
              </div>
              <span className="text-neutral-600">{formatUSD(round.poolSize)} pool</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
