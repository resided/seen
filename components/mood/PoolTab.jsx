import React, { useState, useEffect } from 'react';
import {
  calculateEarlyBirdBonus,
  calculatePoolPercentages,
  calculateBoostedOdds,
  formatTime,
  formatUSD,
} from '../../lib/prediction-utils';
import { QUICK_BET_AMOUNTS } from '../../lib/prediction-mocks';
import { EarlyBirdBanner } from './EarlyBirdBanner';
import { PostBetConfirmation } from './PostBetConfirmation';
import { BetConfirmation } from './BetConfirmation';

export function PoolTab({ round, userStats }) {
  const [selectedSide, setSelectedSide] = useState(null);
  const [betAmount, setBetAmount] = useState('');
  const [timeLeft, setTimeLeft] = useState(null);
  const [earlyBirdBonus, setEarlyBirdBonus] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [hasBet, setHasBet] = useState(false);
  const [userBet, setUserBet] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setTimeLeft(round.endsAt.getTime() - Date.now());
    setEarlyBirdBonus(calculateEarlyBirdBonus(round.startedAt, round.endsAt));

    const timer = setInterval(() => {
      setTimeLeft(round.endsAt.getTime() - Date.now());
      setEarlyBirdBonus(calculateEarlyBirdBonus(round.startedAt, round.endsAt));
    }, 1000);

    return () => clearInterval(timer);
  }, [round.startedAt, round.endsAt]);

  const { yepPercent, nopePercent } = calculatePoolPercentages(
    round.yepPool,
    round.nopePool,
    round.totalPool
  );

  const baseOdds = selectedSide === 'YEP' ? round.yepOdds : round.nopeOdds;
  const currentBonus = earlyBirdBonus ?? 0;
  const boostedOdds = calculateBoostedOdds(baseOdds, currentBonus);
  const potentialWin = selectedSide && betAmount ? parseFloat(betAmount) * boostedOdds : 0;
  const potentialWinWithoutBonus = selectedSide && betAmount ? parseFloat(betAmount) * baseOdds : 0;

  if (hasBet && userBet) {
    return (
      <PostBetConfirmation
        userBet={userBet}
        round={round}
        timeLeft={timeLeft ?? 0}
        yepPercent={yepPercent}
        nopePercent={nopePercent}
      />
    );
  }

  if (showConfirm && selectedSide && betAmount) {
    return (
      <BetConfirmation
        selectedSide={selectedSide}
        betAmount={parseFloat(betAmount)}
        earlyBirdBonus={currentBonus}
        baseOdds={baseOdds}
        boostedOdds={boostedOdds}
        potentialWin={potentialWin}
        potentialWinWithoutBonus={potentialWinWithoutBonus}
        onBack={() => setShowConfirm(false)}
        onConfirm={() => {
          setUserBet({ side: selectedSide, amount: parseFloat(betAmount), earlyBirdBonus: currentBonus });
          setHasBet(true);
        }}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[#0a0a0a] min-h-full">
      {mounted && currentBonus > 0 && <EarlyBirdBanner bonus={currentBonus} />}

      <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800/50">
        <div>
          <p className="text-neutral-600 text-[10px] tracking-wide">balance</p>
          <p className="text-white text-lg font-semibold">{formatUSD(userStats.balance)}</p>
        </div>
        <div className="text-right">
          <p className="text-neutral-600 text-[10px] tracking-wide">streak</p>
          <p className="text-white text-lg font-semibold">{userStats.winStreak}w</p>
        </div>
      </div>

      <div className="px-5 pt-6 pb-4">
        <div className="flex items-start justify-between mb-3">
          <p className="text-neutral-600 text-[10px] tracking-wider uppercase">Round {round.id}</p>
          <p className="text-neutral-400 text-sm font-mono tracking-tight">
            {mounted ? formatTime(timeLeft ?? 0) : '--:--:--'}
          </p>
        </div>
        <h2 className="text-white text-2xl font-semibold leading-tight tracking-tight">
          {round.question}
        </h2>
        <p className="text-neutral-500 text-xs mt-2">{round.description}</p>
        {round.dataSource && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-neutral-700 text-[10px]">via</span>
            <span className="text-neutral-500 text-[10px]">{round.dataSource}</span>
          </div>
        )}
      </div>

      <div className="px-5 mb-6">
        <div className="h-1 flex overflow-hidden bg-neutral-900">
          <div
            className="bg-emerald-400 transition-all duration-500"
            style={{ width: `${yepPercent}%` }}
          />
          <div
            className="bg-rose-400 transition-all duration-500"
            style={{ width: `${nopePercent}%` }}
          />
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-neutral-500 text-[10px]">{yepPercent.toFixed(0)}% yep</span>
          <span className="text-neutral-600 text-[10px]">{formatUSD(round.totalPool)} pool</span>
          <span className="text-neutral-500 text-[10px]">{nopePercent.toFixed(0)}% nope</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 px-5 mb-6">
        <button
          onClick={() => setSelectedSide('YEP')}
          className={`relative p-5 text-left transition-all ${
            selectedSide === 'YEP'
              ? 'bg-emerald-400 text-black'
              : 'bg-neutral-900 text-white hover:bg-neutral-800'
          }`}
        >
          <p className="text-2xl font-semibold tracking-tight mb-2">Yep</p>
          <div className="flex items-baseline gap-1">
            <span className={`text-xl font-semibold ${selectedSide === 'YEP' ? 'text-black' : 'text-emerald-400'}`}>
              {round.yepOdds.toFixed(2)}x
            </span>
          </div>
          <p className={`text-[10px] mt-2 ${selectedSide === 'YEP' ? 'text-black/60' : 'text-neutral-600'}`}>
            {round.yepBettors} players
          </p>
        </button>

        <button
          onClick={() => setSelectedSide('NOPE')}
          className={`relative p-5 text-left transition-all ${
            selectedSide === 'NOPE'
              ? 'bg-rose-400 text-black'
              : 'bg-neutral-900 text-white hover:bg-neutral-800'
          }`}
        >
          <p className="text-2xl font-semibold tracking-tight mb-2">Nope</p>
          <div className="flex items-baseline gap-1">
            <span className={`text-xl font-semibold ${selectedSide === 'NOPE' ? 'text-black' : 'text-rose-400'}`}>
              {round.nopeOdds.toFixed(2)}x
            </span>
          </div>
          <p className={`text-[10px] mt-2 ${selectedSide === 'NOPE' ? 'text-black/60' : 'text-neutral-600'}`}>
            {round.nopeBettors} players
          </p>
        </button>
      </div>

      {selectedSide && (
        <div className="px-5 mb-4">
          <div className="bg-neutral-900 p-5">
            <p className="text-neutral-600 text-[10px] tracking-wide mb-3">amount</p>
            <div className="relative">
              <span className="absolute left-0 top-1/2 -translate-y-1/2 text-neutral-600 text-2xl font-semibold">$</span>
              <input
                type="number"
                placeholder="0"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                className="w-full bg-transparent text-white text-3xl font-semibold pl-7 outline-none placeholder:text-neutral-800"
              />
            </div>
            <div className="flex gap-2 mt-4">
              {QUICK_BET_AMOUNTS.map((amount) => (
                <button
                  key={amount}
                  onClick={() => setBetAmount(amount.toString())}
                  className={`flex-1 py-2 text-xs font-medium transition-all ${
                    betAmount === amount.toString()
                      ? 'bg-white text-black'
                      : 'bg-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  ${amount}
                </button>
              ))}
            </div>

            {betAmount && parseFloat(betAmount) > 0 && (
              <div className="mt-5 pt-4 border-t border-neutral-800">
                <div className="flex justify-between items-baseline">
                  <span className="text-neutral-600 text-[10px]">potential win</span>
                  <span className="text-white text-xl font-semibold">{formatUSD(potentialWin)}</span>
                </div>
                {currentBonus > 0 && (
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-neutral-700 text-[10px] line-through">{baseOdds.toFixed(2)}x</span>
                    <span className="text-amber-400 text-[10px]">
                      +{currentBonus}% bonus
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="px-5 mt-auto mb-6">
        <button
          disabled={!selectedSide || !betAmount || parseFloat(betAmount) <= 0}
          onClick={() => setShowConfirm(true)}
          className={`w-full py-4 font-medium text-sm tracking-wide transition-all ${
            selectedSide && betAmount && parseFloat(betAmount) > 0
              ? 'bg-white text-black hover:bg-neutral-100'
              : 'bg-neutral-900 text-neutral-600 cursor-not-allowed'
          }`}
        >
          {!selectedSide
            ? 'Pick a side'
            : !betAmount || parseFloat(betAmount) <= 0
              ? 'Enter amount'
              : `Bet ${formatUSD(parseFloat(betAmount))} on ${selectedSide.toLowerCase()}`
          }
        </button>
      </div>
    </div>
  );
}
