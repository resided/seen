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
                  SEEN.
                </h2>
                <p className="text-xs md:text-sm tracking-[0.2em] text-gray-400 group-hover:text-gray-800">
                  DISCOVER + VOTE ON MINIAPPS
                </p>
              </div>
              <ChevronRightIcon className="w-8 h-8 md:w-12 md:h-12" />
            </div>
          </button>

          {/* Game Mode - Coming Soon */}
          <div className="w-full border-2 border-gray-700 p-8 opacity-50 cursor-not-allowed relative">
            <div className="flex items-center justify-between">
              <div className="text-left">
                <h2 className="text-2xl md:text-4xl font-black tracking-tight mb-2 text-gray-400">
                  MOOD.
                </h2>
                <p className="text-xs md:text-sm tracking-[0.2em] text-gray-500 mb-2">
                  PREDICT • BET • WIN
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-[10px] tracking-[0.2em] text-yellow-500 font-bold">
                    IN BETA
                  </p>
                  <span className="text-gray-700">•</span>
                  <p className="text-[10px] tracking-[0.2em] text-gray-600">
                    COMING SOON
                  </p>
                </div>
              </div>
              <ChevronRightIcon className="w-8 h-8 md:w-12 md:h-12 text-gray-700" />
            </div>
            {/* Coming Soon Banner Overlay */}
            <div className="absolute top-2 right-2 bg-yellow-500/20 border border-yellow-500/50 px-3 py-1 rounded">
              <p className="text-[8px] tracking-[0.3em] text-yellow-400 font-bold">
                COMING SOON
              </p>
            </div>
          </div>
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
