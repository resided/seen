import React, { useState } from 'react';
import { formatUSD } from '../../lib/prediction-utils';

export function LeaderboardTab({ leaderboard, userProfit }) {
  const [timeframe, setTimeframe] = useState('week');

  const timeframes = [
    { id: 'week', label: 'Week' },
    { id: 'month', label: 'Month' },
    { id: 'all', label: 'All Time' },
  ];

  return (
    <div className="flex-1 flex flex-col bg-[#0a0a0a] p-5">
      <div className="mb-6">
        <h2 className="text-white text-2xl font-semibold mb-2">Leaderboard</h2>
        <p className="text-neutral-500 text-sm">Top predictors on MOOD.</p>
      </div>

      <div className="flex gap-2 mb-6">
        {timeframes.map((tf) => (
          <button
            key={tf.id}
            onClick={() => setTimeframe(tf.id)}
            className={`flex-1 py-2 text-xs font-medium transition-all ${
              timeframe === tf.id
                ? 'bg-white text-black'
                : 'bg-neutral-900 text-neutral-500 hover:text-white'
            }`}
          >
            {tf.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto space-y-2">
        {leaderboard.map((entry) => {
          const isCurrentUser = entry.username === 'you';
          return (
            <div
              key={entry.rank}
              className={`p-4 transition-all ${
                isCurrentUser
                  ? 'bg-purple-500/10 border border-purple-500/30'
                  : 'bg-neutral-900'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-8 h-8 flex items-center justify-center text-sm font-bold ${
                  entry.rank === 1
                    ? 'text-amber-400'
                    : entry.rank === 2
                      ? 'text-neutral-400'
                      : entry.rank === 3
                        ? 'text-orange-600'
                        : 'text-neutral-600'
                }`}>
                  {entry.rank <= 3 ? (
                    <TrophyIcon rank={entry.rank} />
                  ) : (
                    <span>#{entry.rank}</span>
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-white text-sm font-medium">{entry.username}</p>
                    {isCurrentUser && (
                      <span className="text-purple-400 text-[10px] font-medium px-1.5 py-0.5 bg-purple-500/20 rounded">
                        YOU
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-neutral-500 text-xs">
                    <span>{entry.winRate.toFixed(1)}% WR</span>
                    <span>•</span>
                    <span>{entry.rounds} rounds</span>
                  </div>
                </div>

                <div className="text-right">
                  <p className={`text-lg font-semibold ${
                    entry.totalProfit > 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {entry.totalProfit > 0 ? '+' : ''}{formatUSD(entry.totalProfit)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TrophyIcon({ rank }) {
  const colors = {
    1: 'text-amber-400',
    2: 'text-neutral-400',
    3: 'text-orange-600',
  };

  return (
    <svg className={`w-6 h-6 ${colors[rank]}`} fill="currentColor" viewBox="0 0 20 20">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}
