import React, { useState } from 'react';
import { ALL_QUESTIONS } from '../../lib/prediction-mocks';
import { formatUSD, formatTime } from '../../lib/prediction-utils';

export function QuestionBrowser({ onSelectQuestion, onClose }) {
  const [selectedCategory, setSelectedCategory] = useState('all');

  const categories = ['all', 'Price', 'DeFi', 'Social', 'Crypto'];

  const filteredQuestions = selectedCategory === 'all'
    ? ALL_QUESTIONS
    : ALL_QUESTIONS.filter(q => q.category === selectedCategory);

  const handleSelectQuestion = (question) => {
    // Convert the question to a full round object
    const round = {
      id: question.id,
      question: question.question,
      description: question.description,
      startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      endsAt: question.endsAt,
      totalPool: question.totalPool,
      yepPool: question.totalPool * 0.53,
      nopePool: question.totalPool * 0.47,
      yepBettors: Math.floor(Math.random() * 200) + 50,
      nopeBettors: Math.floor(Math.random() * 200) + 50,
      yepOdds: 1.89,
      nopeOdds: 2.13,
      dataSource: question.dataSource,
      dataUrl: question.dataUrl,
    };
    onSelectQuestion(round);
  };

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800/50">
        <h2 className="text-white text-lg font-semibold">All Markets</h2>
        <button
          onClick={onClose}
          className="text-neutral-500 hover:text-white transition-all"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="px-5 py-4 border-b border-neutral-800/50">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all ${
                selectedCategory === category
                  ? 'bg-white text-black'
                  : 'bg-neutral-900 text-neutral-500 hover:text-white'
              }`}
            >
              {category === 'all' ? 'All' : category}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-3">
        {filteredQuestions.map((question) => {
          const timeLeft = question.endsAt.getTime() - Date.now();
          const isEnding = timeLeft < 24 * 60 * 60 * 1000; // Less than 24 hours

          return (
            <button
              key={question.id}
              onClick={() => handleSelectQuestion(question)}
              className="w-full text-left p-4 bg-neutral-900 hover:bg-neutral-800 transition-all group"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-neutral-600 text-[10px] tracking-wider uppercase">
                      {question.category}
                    </span>
                    {isEnding && (
                      <span className="text-rose-400 text-[10px] font-medium px-1.5 py-0.5 bg-rose-500/20 rounded">
                        ENDING SOON
                      </span>
                    )}
                  </div>
                  <h3 className="text-white text-sm font-medium group-hover:text-neutral-100 transition-colors mb-1">
                    {question.question}
                  </h3>
                  <p className="text-neutral-600 text-xs">{question.description}</p>
                </div>
              </div>

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-neutral-800">
                <div className="flex items-center gap-3 text-xs text-neutral-500">
                  <span>{formatUSD(question.totalPool)} pool</span>
                  <span>•</span>
                  <span className="font-mono">{formatTime(timeLeft)} left</span>
                </div>
                <svg className="w-4 h-4 text-neutral-600 group-hover:text-white group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
