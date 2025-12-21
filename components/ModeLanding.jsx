// Landing page for selecting between Discovery and Game modes
import React from 'react';
import { ChevronRightIcon } from '@heroicons/react/24/outline';

const ModeLanding = ({ onSelectMode }) => {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-4">
            SEEN.
          </h1>
          <p className="text-xs md:text-sm tracking-[0.3em] text-gray-500">
            DISCOVER THE BEST MINIAPPS ON FARCASTER
          </p>
        </div>

        {/* Mode Selection */}
        <div className="space-y-4">
          {/* Discovery Mode */}
          <button
            onClick={() => onSelectMode('discovery')}
            className="w-full border-2 border-white p-8 hover:bg-white hover:text-black transition-all group"
          >
            <div className="flex items-center justify-between">
              <div className="text-left">
                <h2 className="text-2xl md:text-4xl font-black tracking-tight mb-2">
                  SEEN
                </h2>
                <p className="text-xs md:text-sm tracking-[0.2em] text-gray-400 group-hover:text-gray-800">
                  DISCOVER + VOTE ON MINIAPPS
                </p>
              </div>
              <ChevronRightIcon className="w-8 h-8 md:w-12 md:h-12" />
            </div>
          </button>

          {/* Game Mode */}
          <button
            onClick={() => onSelectMode('game')}
            className="w-full border-2 border-white p-8 hover:bg-white hover:text-black transition-all group relative overflow-hidden"
          >
            {/* "LIVE" indicator */}
            <div className="absolute top-4 right-4 border border-white px-2 py-1 text-[8px] tracking-[0.3em] group-hover:border-black group-hover:text-black">
              LIVE BATTLE
            </div>

            <div className="flex items-center justify-between">
              <div className="text-left">
                <h2 className="text-2xl md:text-4xl font-black tracking-tight mb-2">
                  SEEN (THE GAME)
                </h2>
                <p className="text-xs md:text-sm tracking-[0.2em] text-gray-400 group-hover:text-gray-800 mb-2">
                  FEATURE WARS • BET • WIN
                </p>
                <p className="text-[10px] tracking-[0.2em] text-gray-600 group-hover:text-gray-700">
                  THIS IS IN EARLY BETA AND MAY BREAK
                </p>
              </div>
              <ChevronRightIcon className="w-8 h-8 md:w-12 md:h-12" />
            </div>
          </button>
        </div>

        {/* Footer */}
        <div className="text-center mt-12">
          <p className="text-[10px] tracking-[0.3em] text-gray-700">
            POWERED BY $SEEN
          </p>
        </div>
      </div>
    </div>
  );
};

export default ModeLanding;
