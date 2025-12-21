import React from 'react';
import { formatUSD, formatUSDPrecise } from '../../lib/prediction-utils';

export function BetConfirmation({
  selectedSide,
  betAmount,
  earlyBirdBonus,
  baseOdds,
  boostedOdds,
  potentialWin,
  potentialWinWithoutBonus,
  onBack,
  onConfirm,
}) {
  const profit = potentialWin - betAmount;
  const bonusValue = potentialWin - potentialWinWithoutBonus;

  return (
    <div className="flex-1 flex flex-col bg-[#0a0a0a] p-5">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-neutral-500 hover:text-white transition-all mb-6"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        <span className="text-sm">Back</span>
      </button>

      <h2 className="text-white text-2xl font-semibold mb-2">Confirm your bet</h2>
      <p className="text-neutral-500 text-sm mb-8">Review the details before placing</p>

      <div className="bg-neutral-900 p-5 mb-6">
        <div className="flex items-center justify-between mb-5">
          <span className="text-neutral-600 text-xs">You're betting</span>
          <div className={`px-3 py-1 ${
            selectedSide === 'YEP' ? 'bg-emerald-400 text-black' : 'bg-rose-400 text-black'
          }`}>
            <span className="text-sm font-semibold">{selectedSide}</span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-neutral-500 text-sm">Bet amount</span>
            <span className="text-white text-lg font-semibold">{formatUSD(betAmount)}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-neutral-500 text-sm">Base odds</span>
            <span className="text-neutral-400 text-sm">{baseOdds.toFixed(2)}x</span>
          </div>

          {earlyBirdBonus > 0 && (
            <>
              <div className="flex justify-between items-center">
                <span className="text-amber-400 text-sm">Early bird bonus</span>
                <span className="text-amber-400 text-sm">+{earlyBirdBonus}%</span>
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-neutral-800">
                <span className="text-neutral-500 text-sm">Boosted odds</span>
                <span className="text-white text-lg font-semibold">{boostedOdds.toFixed(2)}x</span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="bg-neutral-900 p-5 mb-8">
        <div className="flex justify-between items-baseline mb-2">
          <span className="text-neutral-600 text-xs">If you win</span>
          <span className="text-white text-2xl font-semibold">{formatUSD(potentialWin)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-neutral-600 text-xs">Profit</span>
          <span className="text-emerald-400 text-sm">+{formatUSD(profit)}</span>
        </div>
        {earlyBirdBonus > 0 && bonusValue > 0 && (
          <div className="flex justify-between items-center mt-1">
            <span className="text-neutral-700 text-[10px]">Bonus value</span>
            <span className="text-amber-400 text-xs">+{formatUSDPrecise(bonusValue)}</span>
          </div>
        )}
      </div>

      <button
        onClick={onConfirm}
        className="w-full py-4 bg-white text-black font-medium hover:bg-neutral-100 transition-all"
      >
        Confirm bet
      </button>
    </div>
  );
}
