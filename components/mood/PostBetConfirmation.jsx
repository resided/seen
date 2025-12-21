import React, { useState } from 'react';
import { formatUSD, formatTime } from '../../lib/prediction-utils';

export function PostBetConfirmation({ userBet, round, timeLeft, yepPercent, nopePercent }) {
  const [shareStatus, setShareStatus] = useState('');

  const handleShare = async () => {
    setShareStatus('Sharing...');
    // TODO: Implement actual Farcaster share
    setTimeout(() => {
      setShareStatus('Shared!');
      setTimeout(() => setShareStatus(''), 2000);
    }, 1000);
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0a0a0a] p-5">
      <div className="flex-1">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-400/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-white text-2xl font-semibold mb-2">Bet placed!</h2>
          <p className="text-neutral-500 text-sm">Your prediction is locked in</p>
        </div>

        <div className="bg-neutral-900 p-5 mb-4">
          <div className="flex items-center justify-between mb-5">
            <span className="text-neutral-600 text-xs">You bet</span>
            <div className={`px-3 py-1 ${
              userBet.side === 'YEP' ? 'bg-emerald-400 text-black' : 'bg-rose-400 text-black'
            }`}>
              <span className="text-sm font-semibold">{userBet.side}</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-neutral-500 text-sm">Amount</span>
              <span className="text-white text-lg font-semibold">{formatUSD(userBet.amount)}</span>
            </div>

            {userBet.earlyBirdBonus > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-amber-400 text-sm">Early bird bonus</span>
                <span className="text-amber-400 text-sm">+{userBet.earlyBirdBonus}%</span>
              </div>
            )}

            <div className="flex justify-between items-center pt-3 border-t border-neutral-800">
              <span className="text-neutral-600 text-xs">Time remaining</span>
              <span className="text-white text-sm font-mono">{formatTime(timeLeft)}</span>
            </div>
          </div>
        </div>

        <div className="bg-neutral-900 p-5 mb-6">
          <h3 className="text-white text-sm font-medium mb-4">Current pool</h3>
          <div className="h-1.5 flex overflow-hidden bg-neutral-800 rounded-full mb-3">
            <div
              className="bg-emerald-400 transition-all duration-500"
              style={{ width: `${yepPercent}%` }}
            />
            <div
              className="bg-rose-400 transition-all duration-500"
              style={{ width: `${nopePercent}%` }}
            />
          </div>
          <div className="flex justify-between">
            <div>
              <p className="text-neutral-600 text-[10px]">YEP</p>
              <p className="text-emerald-400 text-sm font-semibold">{yepPercent.toFixed(0)}%</p>
            </div>
            <div className="text-center">
              <p className="text-neutral-600 text-[10px]">TOTAL POOL</p>
              <p className="text-white text-sm font-semibold">{formatUSD(round.totalPool)}</p>
            </div>
            <div className="text-right">
              <p className="text-neutral-600 text-[10px]">NOPE</p>
              <p className="text-rose-400 text-sm font-semibold">{nopePercent.toFixed(0)}%</p>
            </div>
          </div>
        </div>

        <div className="bg-neutral-900/50 border border-neutral-800 p-4 mb-4">
          <div className="flex items-start gap-3">
            <svg className="w-4 h-4 text-neutral-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-neutral-400 text-xs leading-relaxed">
                Results will be announced when the round ends. Check back to see if you won!
              </p>
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={handleShare}
        disabled={shareStatus === 'Sharing...'}
        className="w-full py-4 bg-purple-600 text-white font-medium hover:bg-purple-500 transition-all disabled:opacity-50 mb-3"
      >
        {shareStatus || 'Share your prediction'}
      </button>

      <button
        onClick={() => window.location.reload()}
        className="w-full py-4 bg-neutral-900 text-white font-medium hover:bg-neutral-800 transition-all"
      >
        Back to pool
      </button>
    </div>
  );
}
