import React, { useState, useEffect, useRef } from 'react';

// ============================================
// THE BOARD - MINI APP DISCOVERY
// Helping Farcaster builders get seen
// ============================================

const CATEGORIES = [
  { id: 'main', label: 'MAIN' },
  { id: 'defi', label: 'DEFI' },
  { id: 'social', label: 'SOCIAL' },
  { id: 'games', label: 'GAMES' },
  { id: 'tools', label: 'TOOLS' },
  { id: 'nft', label: 'NFT' },
];

// Today's featured Mini App
const FEATURED_APP = {
  id: 1,
  name: 'ZORA',
  tagline: 'MINT AND COLLECT ONCHAIN MEDIA',
  description: 'The easiest way to create, collect, and earn onchain. Mint NFTs, create splits, and build your collector base directly from Farcaster.',
  builder: 'JACOB.ETH',
  builderFid: 12345,
  category: 'nft',
  launchDate: 'DEC 13, 2025',
  stats: {
    installs: 23847,
    dau: 4201,
    tips: 12.4,
  },
  links: {
    miniapp: 'https://warpcast.com/~/mini-app/zora',
    website: 'https://zora.co',
    github: 'https://github.com/ourzora',
  }
};

// Sample chat messages
const INITIAL_MESSAGES = [
  { id: 1, user: 'DWR.ETH', fid: 3, msg: 'THIS IS EXACTLY WHAT WE NEEDED', time: '2M', verified: true },
  { id: 2, user: 'VITALIK.ETH', fid: 5650, msg: 'CLEAN UX. MINTED 3 ALREADY', time: '5M', verified: true },
  { id: 3, user: 'JESSE.BASE', fid: 99, msg: 'HOW DO I LIST MY APP HERE?', time: '8M' },
  { id: 4, user: 'BUILDER.ETH', fid: 421, msg: 'FINALLY A PLACE FOR DISCOVERY', time: '12M' },
  { id: 5, user: 'ANON', fid: 8821, msg: 'NEED MORE GAMES CATEGORY', time: '15M' },
];

// Utilities
const formatNumber = (num) => {
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

// ============================================
// ACTIVITY TICKER
// ============================================
const ActivityTicker = () => {
  const items = [
    'NOW ACCEPTING SUBMISSIONS FOR TOMORROW',
    'TIPS GO DIRECTLY TO BUILDERS',
    '23K+ INSTALLS TODAY',
    'BUILT FOR FARCASTER MINI APPS',
    'GET YOUR APP SEEN',
  ];

  return (
    <div className="border-b border-white overflow-hidden bg-white text-black">
      <div className="py-2 animate-marquee whitespace-nowrap">
        {[...items, ...items].map((item, i) => (
          <span key={i} className="text-xs font-bold tracking-widest mx-8">
            {item} <span className="opacity-30">●</span>
          </span>
        ))}
      </div>
    </div>
  );
};

// ============================================
// FEATURED APP CARD
// ============================================
const FeaturedApp = ({ app, onTip }) => {
  const [countdown, setCountdown] = useState({ h: 8, m: 42, s: 17 });
  
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        let { h, m, s } = prev;
        s--;
        if (s < 0) { s = 59; m--; }
        if (m < 0) { m = 59; h--; }
        if (h < 0) { h = 23; m = 59; s = 59; }
        return { h, m, s };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="border border-white">
      {/* Header bar */}
      <div className="border-b border-white p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-[10px] tracking-[0.3em] text-gray-500">TODAY'S FEATURED</div>
          <div className="text-[10px] tracking-[0.2em] px-2 py-0.5 bg-white text-black font-bold">
            {app.category.toUpperCase()}
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-sm">
            {String(countdown.h).padStart(2, '0')}:{String(countdown.m).padStart(2, '0')}:{String(countdown.s).padStart(2, '0')}
          </div>
          <div className="text-[9px] tracking-[0.3em] text-gray-500">UNTIL NEXT</div>
        </div>
      </div>

      {/* Main content */}
      <div className="p-6">
        {/* App name */}
        <h1 className="text-5xl font-black tracking-[-0.03em] mb-2">{app.name}</h1>
        <p className="text-sm tracking-widest text-gray-500 mb-6">{app.tagline}</p>
        
        {/* Description */}
        <p className="text-sm leading-relaxed text-gray-400 mb-6 max-w-md">
          {app.description}
        </p>

        {/* Builder */}
        <div className="flex items-center gap-3 mb-6 pb-6 border-b border-white/20">
          <div className="w-10 h-10 bg-white text-black flex items-center justify-center font-black text-sm">
            {app.builder.charAt(0)}
          </div>
          <div>
            <div className="text-sm font-bold">{app.builder}</div>
            <div className="text-[10px] tracking-[0.2em] text-gray-500">FID #{app.builderFid}</div>
          </div>
          <button className="ml-auto text-[10px] tracking-[0.2em] px-3 py-1.5 border border-white hover:bg-white hover:text-black transition-all">
            FOLLOW
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div>
            <div className="text-3xl font-black">{formatNumber(app.stats.installs)}</div>
            <div className="text-[9px] tracking-[0.3em] text-gray-500 mt-1">INSTALLS</div>
          </div>
          <div>
            <div className="text-3xl font-black">{formatNumber(app.stats.dau)}</div>
            <div className="text-[9px] tracking-[0.3em] text-gray-500 mt-1">DAILY ACTIVE</div>
          </div>
          <div>
            <div className="text-3xl font-black">{app.stats.tips}Ξ</div>
            <div className="text-[9px] tracking-[0.3em] text-gray-500 mt-1">TIPPED TODAY</div>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-[1px] bg-white">
          <button 
            className="bg-black py-4 font-bold text-sm tracking-[0.2em] hover:bg-white hover:text-black transition-all"
          >
            OPEN MINI APP
          </button>
          <button 
            onClick={onTip}
            className="bg-black py-4 font-bold text-sm tracking-[0.2em] hover:bg-white hover:text-black transition-all"
          >
            TIP BUILDER
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// LIVE CHAT
// ============================================
const LiveChat = ({ messages, onSend }) => {
  const [input, setInput] = useState('');
  const chatRef = useRef(null);
  
  const handleSend = () => {
    if (input.trim()) {
      onSend(input.trim().toUpperCase());
      setInput('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border border-white flex flex-col h-[400px]">
      {/* Header */}
      <div className="border-b border-white p-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-white animate-pulse" />
          <span className="text-[10px] tracking-[0.3em]">LIVE CHAT</span>
        </div>
        <span className="text-[10px] tracking-[0.2em] text-gray-500">{messages.length} MESSAGES</span>
      </div>
      
      {/* Messages */}
      <div ref={chatRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map(msg => (
          <div key={msg.id} className="group">
            <div className="flex items-baseline gap-2">
              <span className="text-[10px] tracking-wider text-gray-500 shrink-0">
                {msg.user}
                {msg.verified && <span className="ml-1">✓</span>}
              </span>
              <span className="text-[10px] text-gray-600">{msg.time}</span>
            </div>
            <p className="text-sm mt-0.5 leading-snug">{msg.msg}</p>
          </div>
        ))}
      </div>
      
      {/* Input */}
      <div className="border-t border-white p-3 shrink-0">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            onKeyDown={handleKeyDown}
            placeholder="SAY SOMETHING..."
            className="flex-1 bg-transparent text-sm tracking-wider outline-none placeholder:text-gray-600 uppercase"
            maxLength={100}
          />
          <button 
            onClick={handleSend}
            className="text-[10px] tracking-[0.2em] px-4 py-2 bg-white text-black font-bold hover:bg-gray-200 transition-all"
          >
            SEND
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// SUBMIT CTA
// ============================================
const SubmitSection = () => (
  <div className="border border-white p-6 text-center">
    <h3 className="text-xl font-black tracking-tight mb-2">GET YOUR MINI APP FEATURED</h3>
    <p className="text-sm text-gray-500 tracking-wider mb-4">
      STRUGGLING TO GET SEEN? SUBMIT YOUR APP FOR TOMORROW'S SPOTLIGHT.
    </p>
    <div className="grid grid-cols-3 gap-4 mb-6 text-left">
      <div>
        <div className="text-2xl font-black">24H</div>
        <div className="text-[9px] tracking-[0.2em] text-gray-500">FEATURED SLOT</div>
      </div>
      <div>
        <div className="text-2xl font-black">10K+</div>
        <div className="text-[9px] tracking-[0.2em] text-gray-500">AVG IMPRESSIONS</div>
      </div>
      <div>
        <div className="text-2xl font-black">FREE</div>
        <div className="text-[9px] tracking-[0.2em] text-gray-500">TO SUBMIT</div>
      </div>
    </div>
    <button className="w-full py-4 bg-white text-black font-black text-sm tracking-[0.3em] hover:bg-gray-200 transition-all">
      SUBMIT YOUR APP
    </button>
  </div>
);

// ============================================
// UPCOMING QUEUE
// ============================================
const UpcomingQueue = () => {
  const queue = [
    { name: 'PODS', builder: 'PODS.ETH', category: 'SOCIAL', position: 1 },
    { name: 'BRACKET', builder: 'BRACKET.ETH', category: 'GAMES', position: 2 },
    { name: 'PAYFLOW', builder: 'PAYFLOW.ETH', category: 'DEFI', position: 3 },
  ];

  return (
    <div className="border border-white">
      <div className="border-b border-white p-3">
        <span className="text-[10px] tracking-[0.3em]">UPCOMING</span>
      </div>
      <div className="divide-y divide-white/20">
        {queue.map(app => (
          <div key={app.position} className="p-3 flex items-center gap-3">
            <div className="w-6 h-6 border border-white flex items-center justify-center text-[10px] font-bold">
              {app.position}
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold">{app.name}</div>
              <div className="text-[10px] text-gray-500">{app.builder}</div>
            </div>
            <div className="text-[9px] tracking-[0.2em] text-gray-500">{app.category}</div>
          </div>
        ))}
      </div>
      <div className="border-t border-white p-3">
        <button className="w-full text-[10px] tracking-[0.2em] text-gray-500 hover:text-white transition-all">
          VIEW FULL QUEUE →
        </button>
      </div>
    </div>
  );
};

// ============================================
// MAIN APP
// ============================================
export default function TheBoard() {
  const [category, setCategory] = useState('main');
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [time, setTime] = useState(new Date());
  
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  
  const handleSendMessage = (msg) => {
    const newMsg = {
      id: Date.now(),
      user: 'YOU',
      fid: 0,
      msg,
      time: 'NOW',
    };
    setMessages(prev => [newMsg, ...prev]);
  };

  const handleTip = () => {
    // Would trigger wallet transaction
    console.log('Tip builder');
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-white">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black tracking-[-0.02em]">THE BOARD</h1>
            <p className="text-[9px] tracking-[0.3em] text-gray-500">MINI APP DISCOVERY</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right hidden sm:block">
              <div className="font-mono text-sm tracking-tight">
                {time.toLocaleTimeString('en-US', { hour12: false })}
              </div>
              <div className="text-[9px] tracking-[0.3em] text-gray-500">
                {time.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()}
              </div>
            </div>
            <button className="text-[10px] tracking-[0.2em] px-4 py-2 border border-white hover:bg-white hover:text-black transition-all">
              CONNECT
            </button>
          </div>
        </div>
      </header>
      
      {/* Ticker */}
      <ActivityTicker />
      
      {/* Category nav */}
      <div className="border-b border-white">
        <div className="max-w-4xl mx-auto">
          <div className="flex overflow-x-auto">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={`px-6 py-3 text-xs font-bold tracking-[0.2em] transition-all border-r border-white last:border-r-0 whitespace-nowrap ${
                  category === cat.id 
                    ? 'bg-white text-black' 
                    : 'bg-black text-white hover:bg-white/10'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {category === 'main' ? (
          <div className="grid lg:grid-cols-[1fr,340px] gap-6">
            {/* Left: Featured + Submit */}
            <div className="space-y-6">
              <FeaturedApp app={FEATURED_APP} onTip={handleTip} />
              <SubmitSection />
            </div>
            
            {/* Right: Chat + Queue */}
            <div className="space-y-6">
              <LiveChat messages={messages} onSend={handleSendMessage} />
              <UpcomingQueue />
            </div>
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🚧</div>
            <h2 className="text-2xl font-black mb-2">{category.toUpperCase()} COMING SOON</h2>
            <p className="text-sm text-gray-500 tracking-wider">
              CATEGORY LISTINGS LAUNCHING NEXT WEEK
            </p>
          </div>
        )}
      </main>
      
      {/* Styles */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        
        * {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          -webkit-font-smoothing: antialiased;
        }
        
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 25s linear infinite;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .animate-pulse {
          animation: pulse 1.5s ease-in-out infinite;
        }
        
        ::selection {
          background: #fff;
          color: #000;
        }
        
        ::-webkit-scrollbar {
          width: 4px;
        }
        ::-webkit-scrollbar-track {
          background: #000;
        }
        ::-webkit-scrollbar-thumb {
          background: #333;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #fff;
        }
      `}</style>
    </div>
  );
}
