import React, { useState, useEffect, useRef } from 'react';
import { useAccount, useConnect } from 'wagmi';
import { sdk } from '@farcaster/miniapp-sdk';
import SubmitForm from './components/SubmitForm';

// ============================================
// SEEN. - MINI APP DISCOVERY
// Helping Farcaster builders get seen
// ============================================

const CATEGORIES = [
  { id: 'main', label: 'FEATURED' },
  { id: 'defi', label: 'DEFI' },
  { id: 'social', label: 'SOCIAL' },
  { id: 'games', label: 'GAMES' },
  { id: 'tools', label: 'TOOLS' },
  { id: 'nft', label: 'NFT' },
];

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
    'SHORTLY ACCEPTING SUBMISSIONS',
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
const FeaturedApp = ({ app, onTip, isInFarcaster = false }) => {
  const [countdown, setCountdown] = useState({ h: 8, m: 42, s: 17 });
  const [creatorProfileUrl, setCreatorProfileUrl] = useState(null);
  const [builderData, setBuilderData] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);
  
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

  // Fetch builder profile data from Neynar
  useEffect(() => {
    const fetchBuilderProfile = async () => {
      // If we have a FID, fetch user data from Neynar
      if (app.builderFid) {
        try {
          const response = await fetch('/api/user-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fid: app.builderFid }),
          });
          
          if (response.ok) {
            const data = await response.json();
            setBuilderData(data);
            setCreatorProfileUrl(data.profileUrl);
          }
        } catch (error) {
          console.error('Error fetching builder profile:', error);
          // Fallback - will use FID format if we can't get username
          if (app.builderFid) {
            setCreatorProfileUrl(`https://farcaster.xyz/profiles/${app.builderFid}`);
          }
        }
      } else {
        // If we have a Mini App URL, try to fetch creator info
        const miniappUrl = app.links?.miniapp || app.miniappUrl;
        if (miniappUrl) {
          try {
            const response = await fetch('/api/miniapp-info', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: miniappUrl }),
            });
            
            if (response.ok) {
              const data = await response.json();
              if (data.creator?.profileUrl) {
                setCreatorProfileUrl(data.creator.profileUrl);
              }
              // If we got a FID from the manifest, fetch full profile
              if (data.creator?.fid) {
                const profileResponse = await fetch('/api/user-profile', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ fid: data.creator.fid }),
                });
                if (profileResponse.ok) {
                  const profileData = await profileResponse.json();
                  setBuilderData(profileData);
                }
              }
            }
          } catch (error) {
            console.error('Error fetching creator info:', error);
          }
        }
      }
    };

    fetchBuilderProfile();
  }, [app]);

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
          <div className="w-10 h-10 bg-white text-black flex items-center justify-center font-black text-sm relative overflow-hidden rounded-full border border-white shrink-0">
            {builderData?.pfpUrl ? (
              <>
                <img
                  src={builderData.pfpUrl}
                  alt={builderData.displayName || app.builder}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Hide image on error, show fallback initial
                    e.target.style.display = 'none';
                    if (e.target.nextSibling) {
                      e.target.nextSibling.style.display = 'flex';
                    }
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center hidden">
                  {(builderData?.displayName || app.builder)?.charAt(0).toUpperCase()}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center w-full h-full">
                {(builderData?.displayName || app.builder)?.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1">
            {creatorProfileUrl || builderData?.username || app.builderFid ? (
              <a
                href={creatorProfileUrl || (builderData?.username ? `https://farcaster.xyz/${builderData.username}` : `https://farcaster.xyz/profiles/${app.builderFid}`)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-bold hover:underline block"
              >
                {builderData?.displayName || app.builder}
              </a>
            ) : (
              <div className="text-sm font-bold">{builderData?.displayName || app.builder}</div>
            )}
            <div className="text-[10px] tracking-[0.2em] text-gray-500">
              {builderData?.username ? `@${builderData.username}` : app.builder}
              {builderData?.fid && ` • FID #${builderData.fid}`}
              {!builderData?.fid && app.builderFid && ` • FID #${app.builderFid}`}
            </div>
          </div>
          <button 
            onClick={async () => {
              if (!isInFarcaster) return;
              
              try {
                const targetFid = builderData?.fid || app.builderFid;
                const targetUsername = builderData?.username;
                
                if (!targetFid) {
                  console.error('No FID available to follow');
                  return;
                }

                // Build profile URL
                const profileUrl = creatorProfileUrl || 
                  (targetUsername ? `https://farcaster.xyz/${targetUsername}` : `https://farcaster.xyz/profiles/${targetFid}`);

                // Try to use Farcaster SDK to open profile (where user can follow)
                try {
                  if (sdk.actions?.openUrl) {
                    await sdk.actions.openUrl({ url: profileUrl });
                  } else {
                    // Fallback: open profile in new tab
                    window.open(profileUrl, '_blank', 'noopener,noreferrer');
                  }
                } catch (error) {
                  console.error('Error opening profile:', error);
                  // Fallback: open profile page
                  window.open(profileUrl, '_blank', 'noopener,noreferrer');
                }
              } catch (error) {
                console.error('Error in follow handler:', error);
              }
            }}
            disabled={!isInFarcaster}
            className={`text-[10px] tracking-[0.2em] px-3 py-1.5 border border-white transition-all ${
              isInFarcaster 
                ? 'hover:bg-white hover:text-black' 
                : 'opacity-50 cursor-not-allowed'
            }`}
          >
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
            disabled={!isInFarcaster}
            className={`bg-black py-4 font-bold text-sm tracking-[0.2em] transition-all ${
              isInFarcaster 
                ? 'hover:bg-white hover:text-black' 
                : 'opacity-50 cursor-not-allowed'
            }`}
          >
            OPEN MINI APP
          </button>
          <button 
            onClick={onTip}
            disabled={!isInFarcaster}
            className={`bg-black py-4 font-bold text-sm tracking-[0.2em] transition-all ${
              isInFarcaster 
                ? 'hover:bg-white hover:text-black' 
                : 'opacity-50 cursor-not-allowed'
            }`}
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
const LiveChat = ({ messages, onSend, isInFarcaster = false }) => {
  const handleUsernameClick = async (msg) => {
    if (!msg.fid || msg.fid === 0) return; // Can't open profile without FID
    
    const profileUrl = `https://farcaster.xyz/profiles/${msg.fid}`;
    
    try {
      if (isInFarcaster && sdk.actions?.openUrl) {
        // Open in Farcaster app context
        await sdk.actions.openUrl({ url: profileUrl });
      } else {
        // Open in new tab for web browsers
        window.open(profileUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      console.error('Error opening profile:', error);
      // Fallback: open in new tab
      window.open(profileUrl, '_blank', 'noopener,noreferrer');
    }
  };
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const chatRef = useRef(null);
  const messagesEndRef = useRef(null);
  
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);
  
  // Simple client-side validation (basic check, server does full validation)
  const validateInput = (text) => {
    // Check for URLs (basic pattern)
    const urlPattern = /(https?:\/\/|www\.|[a-zA-Z0-9-]+\.[a-zA-Z]{2,})/gi;
    if (urlPattern.test(text)) {
      return 'Links are not allowed in chat';
    }
    return null;
  };
  
  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    
    // Clear any previous errors
    setError('');
    
    // Basic client-side validation
    const validationError = validateInput(trimmed);
    if (validationError) {
      setError(validationError);
      return;
    }
    
    // Call onSend which will handle API call and show server-side errors
    try {
      await onSend(trimmed.toUpperCase());
      setInput('');
      setError('');
    } catch (err) {
      // Show error message from API (e.g., blocked content)
      setError(err.message || 'Failed to send message. Please try again.');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  
  const handleInputChange = (e) => {
    const value = e.target.value.toUpperCase();
    setInput(value);
    // Clear error when user starts typing
    if (error) {
      setError('');
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
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 text-sm py-8">
            NO MESSAGES YET. BE THE FIRST TO SAY SOMETHING!
          </div>
        ) : (
          <>
            {messages.map(msg => (
              <div key={msg.id} className="group">
                <div className="flex items-baseline gap-2">
                  {msg.fid && msg.fid > 0 ? (
                    <button
                      onClick={() => handleUsernameClick(msg)}
                      className="text-[10px] tracking-wider text-gray-500 shrink-0 hover:text-white hover:underline transition-all cursor-pointer"
                    >
                      {msg.user}
                      {msg.verified && <span className="ml-1">✓</span>}
                    </button>
                  ) : (
                    <span className="text-[10px] tracking-wider text-gray-500 shrink-0">
                      {msg.user}
                      {msg.verified && <span className="ml-1">✓</span>}
                    </span>
                  )}
                  <span className="text-[10px] text-gray-600">{msg.time}</span>
                </div>
                <p className="text-sm mt-0.5 leading-snug">{msg.msg}</p>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>
      
      {/* Input */}
      <div className="border-t border-white p-3 shrink-0">
        {error && (
          <div className="mb-2 text-[10px] text-red-400 tracking-wider">
            {error}
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={isInFarcaster ? "SAY SOMETHING..." : "READ-ONLY MODE"}
            disabled={!isInFarcaster}
            className={`flex-1 bg-transparent text-sm tracking-wider outline-none placeholder:text-gray-600 uppercase ${
              !isInFarcaster ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            maxLength={100}
          />
          <button 
            onClick={handleSend}
            disabled={!isInFarcaster}
            className={`text-[10px] tracking-[0.2em] px-4 py-2 font-bold transition-all ${
              isInFarcaster 
                ? 'bg-white text-black hover:bg-gray-200' 
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
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
const SubmitSection = ({ onSubmit, isInFarcaster = false }) => (
  <div className="border border-white p-6 text-center">
    <h3 className="text-xl font-black tracking-tight mb-2">GET YOUR PROJECT FEATURED</h3>
    <p className="text-sm text-gray-500 tracking-wider mb-4">
      STRUGGLING TO GET SEEN? SUBMIT YOUR PROJECT FOR TOMORROW'S SPOTLIGHT.
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
    <button 
      onClick={onSubmit}
      disabled={!isInFarcaster}
      className={`w-full py-4 font-black text-sm tracking-[0.3em] transition-all ${
        isInFarcaster 
          ? 'bg-white text-black hover:bg-gray-200' 
          : 'bg-gray-600 text-gray-400 cursor-not-allowed'
      }`}
    >
      {isInFarcaster ? 'SUBMIT YOUR PROJECT' : 'OPEN IN FARCASTER TO SUBMIT'}
    </button>
  </div>
);

// ============================================
// UPCOMING QUEUE
// ============================================
const UpcomingQueue = ({ queue = [] }) => {
  return (
    <div className="border border-white">
      <div className="border-b border-white p-3">
        <span className="text-[10px] tracking-[0.3em]">UPCOMING</span>
      </div>
      <div className="divide-y divide-white/20">
        {queue.length > 0 ? (
          queue.map((app, index) => (
            <div key={app.id || index} className="p-3 flex items-center gap-3">
              <div className="w-6 h-6 border border-white flex items-center justify-center text-[10px] font-bold">
                {index + 1}
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold">{app.name}</div>
                <div className="text-[10px] text-gray-500">{app.builder}</div>
              </div>
              <div className="text-[9px] tracking-[0.2em] text-gray-500">{app.category?.toUpperCase()}</div>
            </div>
          ))
        ) : (
          <div className="p-6 text-center text-gray-500 text-sm">
            NO PROJECTS IN QUEUE
          </div>
        )}
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
export default function Seen() {
  const [category, setCategory] = useState('main');
  const [messages, setMessages] = useState([]);
  const [time, setTime] = useState(new Date());
  const [featuredApp, setFeaturedApp] = useState(null);
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [lastMessageTimestamp, setLastMessageTimestamp] = useState(null);
  const [chatLoading, setChatLoading] = useState(true);
  const [isInFarcaster, setIsInFarcaster] = useState(false);
  
  // Wagmi wallet connection
  const { isConnected, address } = useAccount()
  const { connect, connectors } = useConnect()
  
  // Detect if we're in Farcaster context
  useEffect(() => {
    const checkFarcasterContext = async () => {
      try {
        // Check if SDK is available and has context
        const context = await sdk.context;
        if (context?.user || context) {
          setIsInFarcaster(true);
        } else {
          // Also check user agent for Farcaster desktop
          const userAgent = navigator.userAgent.toLowerCase();
          if (userAgent.includes('farcaster') || userAgent.includes('warpcast')) {
            setIsInFarcaster(true);
          } else {
            setIsInFarcaster(false);
          }
        }
      } catch (error) {
        // If SDK throws error, we're likely not in Farcaster
        const userAgent = navigator.userAgent.toLowerCase();
        if (userAgent.includes('farcaster') || userAgent.includes('warpcast')) {
          setIsInFarcaster(true);
        } else {
          setIsInFarcaster(false);
        }
      }
    };
    
    checkFarcasterContext();
  }, []);
  
  // Fetch user info from Farcaster SDK
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        // Try to get user context from Farcaster SDK
        const context = await sdk.context;
        if (context?.user) {
          const user = context.user;
          // Fetch full profile from Neynar
          if (user.fid) {
            try {
              const response = await fetch('/api/user-profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fid: user.fid }),
              });
              if (response.ok) {
                const profileData = await response.json();
                setUserInfo({
                  fid: profileData.fid,
                  username: profileData.username,
                  displayName: profileData.displayName,
                  verified: profileData.verified,
                });
              }
            } catch (error) {
              console.error('Error fetching user profile:', error);
              // Fallback to SDK data
              setUserInfo({
                fid: user.fid,
                username: user.username,
                displayName: user.displayName || user.username,
                verified: false,
              });
            }
          }
        }
      } catch (error) {
        console.error('Error getting Farcaster user context:', error);
        // If no Farcaster context, use wallet address as fallback
        if (address) {
          setUserInfo({
            fid: 0,
            username: null,
            displayName: `${address.slice(0, 6)}...${address.slice(-4)}`,
            verified: false,
          });
        }
      }
    };
    
    fetchUserInfo();
  }, [address]);
  
  // Fetch chat messages from API
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const response = await fetch('/api/chat');
        if (response.ok) {
          const data = await response.json();
          setMessages(data.messages || []);
          // Store timestamp of most recent message for polling
          if (data.messages && data.messages.length > 0) {
            setLastMessageTimestamp(data.messages[0].timestamp || new Date().toISOString());
          }
        }
      } catch (error) {
        console.error('Error fetching chat messages:', error);
        // Fallback to initial messages if API fails
        setMessages(INITIAL_MESSAGES);
      } finally {
        setChatLoading(false);
      }
    };
    
    fetchMessages();
  }, []);
  
  // Poll for new messages every 3 seconds
  useEffect(() => {
    if (!lastMessageTimestamp) return;
    
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/chat?since=${encodeURIComponent(lastMessageTimestamp)}`);
        if (response.ok) {
          const data = await response.json();
          if (data.messages && data.messages.length > 0) {
            // Add new messages to the beginning of the array
            setMessages(prev => {
              const existingIds = new Set(prev.map(m => m.id));
              const newMessages = data.messages.filter(m => !existingIds.has(m.id));
              if (newMessages.length > 0) {
                setLastMessageTimestamp(newMessages[0].timestamp || lastMessageTimestamp);
                return [...newMessages, ...prev];
              }
              return prev;
            });
          }
        }
      } catch (error) {
        console.error('Error polling for new messages:', error);
      }
    }, 3000); // Poll every 3 seconds
    
    return () => clearInterval(pollInterval);
  }, [lastMessageTimestamp]);
  
  // Fetch projects from API
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await fetch('/api/projects');
        const data = await response.json();
        setFeaturedApp(data.featured);
        setQueue(data.queue);
      } catch (error) {
        console.error('Error fetching projects:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchProjects();
  }, []);
  
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  
  const handleSendMessage = async (msg) => {
    try {
      // Prepare user info for the message
      const messageUser = userInfo?.displayName || userInfo?.username || (address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'ANON');
      const messageFid = userInfo?.fid || 0;
      const messageVerified = userInfo?.verified || false;
      
      // Send message to API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          msg,
          user: messageUser,
          fid: messageFid,
          verified: messageVerified,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        // Add the new message to local state immediately
        setMessages(prev => [data.message, ...prev]);
        // Update last message timestamp for polling
        if (data.message.timestamp) {
          setLastMessageTimestamp(data.message.timestamp);
        }
      } else {
        // Handle API errors (like blocked content)
        const errorData = await response.json().catch(() => ({ error: 'Failed to send message' }));
        throw new Error(errorData.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Re-throw error so LiveChat component can display it
      throw error;
    }
  };

  const handleTip = () => {
    // Would trigger wallet transaction
    console.log('Tip builder');
  };

  const handleSubmitSuccess = () => {
    // Refresh projects after submission
    fetch('/api/projects')
      .then(res => res.json())
      .then(data => {
        setFeaturedApp(data.featured);
        setQueue(data.queue);
      });
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Read-only banner for web users */}
      {!isInFarcaster && (
        <div className="border-b border-yellow-500 bg-yellow-500/10 px-4 py-2">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-[10px] tracking-[0.2em] text-yellow-400">
              READ-ONLY MODE • OPEN IN FARCASTER APP OR DESKTOP FOR FULL FUNCTIONALITY
            </p>
          </div>
        </div>
      )}
      
      {/* Header */}
      <header className="border-b border-white">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black tracking-[-0.02em]">SEEN.</h1>
            <p className="text-[9px] tracking-[0.3em] text-gray-500">PROJECT DISCOVERY</p>
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
            {isConnected ? (
              <div className="text-right">
                <div className="text-[10px] tracking-[0.2em] text-gray-500">CONNECTED</div>
                <div className="text-[9px] font-mono text-gray-400 truncate max-w-[120px]">
                  {address?.slice(0, 6)}...{address?.slice(-4)}
                </div>
              </div>
            ) : (
              <button 
                onClick={() => isInFarcaster && connect({ connector: connectors[0] })}
                disabled={!isInFarcaster}
                className={`text-[10px] tracking-[0.2em] px-4 py-2 border border-white transition-all ${
                  isInFarcaster 
                    ? 'hover:bg-white hover:text-black' 
                    : 'opacity-50 cursor-not-allowed'
                }`}
              >
                CONNECT
              </button>
            )}
          </div>
        </div>
      </header>
      
      {/* Ticker */}
      <ActivityTicker />
      
      {/* Category nav */}
      <div className="border-b border-white">
        <div className="max-w-4xl mx-auto">
          <div className="flex overflow-x-auto scrollbar-hide">
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
              {loading ? (
                <div className="border border-white p-6 text-center">
                  <div className="text-sm text-gray-500">LOADING...</div>
                </div>
              ) : featuredApp ? (
                <FeaturedApp app={featuredApp} onTip={handleTip} isInFarcaster={isInFarcaster} />
              ) : (
                <div className="border border-white p-6 text-center">
                  <div className="text-sm text-gray-500">NO FEATURED PROJECT</div>
                </div>
              )}
              <SubmitSection onSubmit={() => setShowSubmitForm(true)} isInFarcaster={isInFarcaster} />
            </div>
            
            {/* Right: Chat + Queue */}
            <div className="space-y-6">
              {chatLoading ? (
                <div className="border border-white p-6 text-center">
                  <div className="text-sm text-gray-500">LOADING CHAT...</div>
                </div>
              ) : (
                <LiveChat messages={messages} onSend={handleSendMessage} isInFarcaster={isInFarcaster} />
              )}
              <UpcomingQueue queue={queue} />
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

      {/* Submit Form Modal */}
      {showSubmitForm && (
        <SubmitForm
          onClose={() => setShowSubmitForm(false)}
          onSubmit={handleSubmitSuccess}
        />
      )}
      
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
        
        /* Custom scrollbar styling */
        ::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        ::-webkit-scrollbar-track {
          background: #000;
        }
        ::-webkit-scrollbar-thumb {
          background: #666;
          border-radius: 3px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #999;
        }
        /* Firefox scrollbar */
        * {
          scrollbar-width: thin;
          scrollbar-color: #666 #000;
        }
        /* Hide scrollbar for category nav but keep functionality */
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
