import React, { useState } from 'react';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { PoolTab } from './mood/PoolTab';
import { LeaderboardTab } from './mood/LeaderboardTab';
import { HistoryTab } from './mood/HistoryTab';
import { BottomNavigation } from './mood/BottomNavigation';
import { QuestionBrowser } from './mood/QuestionBrowser';
import {
  MOCK_CURRENT_ROUND,
  MOCK_USER_STATS,
  MOCK_LEADERBOARD,
  MOCK_PAST_ROUNDS,
} from '../lib/prediction-mocks';

const MoodGame = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState('pool');
  const [currentRound, setCurrentRound] = useState(MOCK_CURRENT_ROUND);
  const [showBrowser, setShowBrowser] = useState(false);

  if (showBrowser) {
    return (
      <div className="min-h-screen flex flex-col overflow-hidden bg-[#0a0a0a]">
        <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-800/50">
          <button
            onClick={() => setShowBrowser(false)}
            className="flex items-center gap-2 text-neutral-500 hover:text-white transition-all"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            <span className="text-sm">Back</span>
          </button>
        </div>
        <QuestionBrowser
          onSelectQuestion={(round) => {
            setCurrentRound(round);
            setShowBrowser(false);
          }}
          onClose={() => setShowBrowser(false)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col overflow-hidden bg-[#0a0a0a]">
      {/* Header */}
      <div className="border-b border-neutral-800/50">
        <div className="max-w-4xl mx-auto px-5 py-4">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-sm tracking-[0.2em] text-neutral-500 hover:text-white transition-all"
            >
              <ArrowLeftIcon className="w-4 h-4" />
              BACK
            </button>
            {activeTab === 'pool' && (
              <button
                onClick={() => setShowBrowser(true)}
                className="flex items-center gap-2 text-neutral-500 hover:text-white transition-all group"
              >
                <span className="text-[10px] font-medium tracking-[0.15em] uppercase">Markets</span>
                <svg className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M1 13L13 1M13 1H5M13 1V9" />
                </svg>
              </button>
            )}
          </div>

          <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white">
            MOOD.
          </h1>
          <p className="text-[10px] tracking-[0.3em] text-gray-500 mt-2">
            PREDICT • BET • WIN
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto max-w-4xl mx-auto w-full">
        {activeTab === 'pool' && (
          <PoolTab key={currentRound.id} round={currentRound} userStats={MOCK_USER_STATS} />
        )}
        {activeTab === 'leaders' && (
          <LeaderboardTab
            leaderboard={MOCK_LEADERBOARD}
            userProfit={MOCK_USER_STATS.totalProfit}
          />
        )}
        {activeTab === 'history' && (
          <HistoryTab pastRounds={MOCK_PAST_ROUNDS} userStats={MOCK_USER_STATS} />
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="max-w-4xl mx-auto w-full">
        <BottomNavigation activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    </div>
  );
};

export default MoodGame;
