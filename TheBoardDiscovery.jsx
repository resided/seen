import React, { useState, useEffect, useRef } from 'react';
import { useAccount, useConnect, useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, parseUnits, erc20Abi, encodeFunctionData, toHex, stringToHex } from 'viem';
import { sdk } from '@farcaster/miniapp-sdk';
import SubmitForm from './components/SubmitForm';

// ============================================
// SEEN. - MINI APP DISCOVERY
// Helping Farcaster builders get seen
// ============================================

// Icon components for categories
const StarIcon = () => (
  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
  </svg>
);

const ChartIcon = () => (
  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
    <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
  </svg>
);

const UsersIcon = () => (
  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
    <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
  </svg>
);

const GamepadIcon = () => (
  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
    <path d="M6.5 6.5a.5.5 0 11-1 0 .5.5 0 011 0zm3 0a.5.5 0 11-1 0 .5.5 0 011 0zm3 0a.5.5 0 11-1 0 .5.5 0 011 0zm-9 3a.5.5 0 11-1 0 .5.5 0 011 0zm3 0a.5.5 0 11-1 0 .5.5 0 011 0zm3 0a.5.5 0 11-1 0 .5.5 0 011 0zm-9 3a.5.5 0 11-1 0 .5.5 0 011 0zm3 0a.5.5 0 11-1 0 .5.5 0 011 0zm3 0a.5.5 0 11-1 0 .5.5 0 011 0z" />
    <path fillRule="evenodd" d="M3.5 2A1.5 1.5 0 002 3.5v13A1.5 1.5 0 003.5 18h13a1.5 1.5 0 001.5-1.5v-13A1.5 1.5 0 0016.5 2h-13zM3 3.5a.5.5 0 01.5-.5h13a.5.5 0 01.5.5v13a.5.5 0 01-.5.5h-13a.5.5 0 01-.5-.5v-13z" />
  </svg>
);

const WrenchIcon = () => (
  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
  </svg>
);

const ImageIcon = () => (
  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
  </svg>
);

const CATEGORIES = [
  { id: 'main', label: 'FEATURED', icon: StarIcon },
  { id: 'defi', label: 'DEFI', icon: ChartIcon },
  { id: 'social', label: 'SOCIAL', icon: UsersIcon },
  { id: 'games', label: 'GAMES', icon: GamepadIcon },
  { id: 'tools', label: 'TOOLS', icon: WrenchIcon },
  { id: 'nft', label: 'NFT', icon: ImageIcon },
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

// Format tips in ETH to USD (rounded up to nearest dollar)
const formatTipsUsd = (ethAmount, ethPrice) => {
  if (!ethAmount || ethAmount === 0) return '$0';
  if (!ethPrice) return `${ethAmount}Ξ`; // Fallback to ETH if price unavailable
  const usdAmount = parseFloat(ethAmount) * ethPrice;
  return `$${Math.ceil(usdAmount)}`;
};

// ============================================
// ACTIVITY TICKER
// ============================================
const ActivityTicker = () => {
  const items = [
    'ACCEPTING SUBMISSIONS',
    'TIPS GO DIRECTLY TO THE MINIAPP CREATOR',
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
const FeaturedApp = ({ app, onTip, isInFarcaster = false, isConnected = false, onMiniappClick, ethPrice = null, ethPriceLoading = false }) => {
  const [countdown, setCountdown] = useState({ h: 0, m: 0, s: 0 });
  const [creatorProfileUrl, setCreatorProfileUrl] = useState(null);
  const [builderData, setBuilderData] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [liveStats, setLiveStats] = useState({ views: 0, clicks: 0, tips: 0 });
  const [tipAmount, setTipAmount] = useState('0.001'); // Default tip amount in ETH
  const [tipping, setTipping] = useState(false);
  const [tipMessage, setTipMessage] = useState('');
  const [showTipModal, setShowTipModal] = useState(false);
  const [customTipAmount, setCustomTipAmount] = useState(''); // Stored as ETH internally
  const [customTipAmountUsd, setCustomTipAmountUsd] = useState(''); // Display value in USD
  
  // Minimum tip: $0.20 USD (20 cents)
  const MIN_TIP_USD = 0.20;
  
  const { sendTransaction, data: tipTxData } = useSendTransaction();
  const { isLoading: isTipConfirming, isSuccess: isTipConfirmed } = useWaitForTransactionReceipt({
    hash: tipTxData,
  });

  // Sync USD amount when ETH price loads or modal opens
  useEffect(() => {
    // When modal opens, set default to minimum tip ($0.20)
    if (showTipModal && ethPrice && !customTipAmountUsd && !customTipAmount) {
      setCustomTipAmountUsd(MIN_TIP_USD.toFixed(2));
      const minEth = MIN_TIP_USD / ethPrice;
      setCustomTipAmount(minEth.toString());
    } else if (showTipModal && ethPrice && !customTipAmountUsd && customTipAmount) {
      const usdValue = (parseFloat(customTipAmount) * ethPrice).toFixed(2);
      setCustomTipAmountUsd(usdValue);
    }
  }, [showTipModal, ethPrice, customTipAmount, customTipAmountUsd]);

  // Fetch builder data when modal opens if not already loaded
  useEffect(() => {
    if (showTipModal && !builderData && app.builderFid) {
      fetch('/api/user-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fid: app.builderFid }),
      })
        .then(res => res.json())
        .then(data => {
          setBuilderData(data);
        })
        .catch(error => {
          console.error('Error fetching builder profile in modal:', error);
        });
    }
  }, [showTipModal, builderData, app.builderFid]);
  
  // Calculate countdown from featuredAt timestamp (24 hours from featuredAt)
  useEffect(() => {
    const calculateCountdown = () => {
      if (!app?.featuredAt) {
        setCountdown({ h: 0, m: 0, s: 0 });
        return;
      }
      
      const featuredAt = new Date(app.featuredAt);
      const expiresAt = new Date(featuredAt.getTime() + 24 * 60 * 60 * 1000); // 24 hours from featuredAt
      const now = new Date();
      const diff = expiresAt - now;
      
      if (diff <= 0) {
        setCountdown({ h: 0, m: 0, s: 0 });
        return;
      }
      
      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      setCountdown({ h, m, s });
    };

    // Calculate immediately
    calculateCountdown();
    
    // Update every second
    const timer = setInterval(calculateCountdown, 1000);
    return () => clearInterval(timer);
  }, [app?.featuredAt]);

  // Track view when component mounts and poll for real-time stats
  useEffect(() => {
    if (app?.id) {
      // Track view
      fetch('/api/track-click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: app.id, type: 'view' }),
      }).catch(() => {}); // Fail silently

      // Fetch today's stats
      const fetchStats = () => {
        fetch(`/api/projects/stats?projectId=${app.id}`)
          .then(res => res.json())
          .then(data => {
            if (data.stats) {
              setLiveStats({
                views: data.stats.views || app.stats?.views || 0,
                clicks: data.stats.clicks || app.stats?.clicks || 0,
                tips: app.stats?.tips || 0,
              });
            }
          })
          .catch(() => {});
      };
      
      // Fetch immediately
      fetchStats();
      
      // Poll every 5 seconds for real-time updates (only when tab is visible)
      let interval;
      const handleVisibilityChange = () => {
        if (document.hidden) {
          if (interval) clearInterval(interval);
        } else {
          fetchStats(); // Fetch immediately when tab becomes visible
          interval = setInterval(fetchStats, 5000);
        }
      };
      
      interval = setInterval(fetchStats, 5000);
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      return () => {
        clearInterval(interval);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [app?.id]);

  // Fetch builder profile data from Neynar
  useEffect(() => {
    const fetchBuilderProfile = async () => {
      // Reset builder data when app changes
      setBuilderData(null);
      
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
            // Debug: log wallet info
            if (!data.walletAddress || !data.verified) {
              console.log('Builder wallet info:', {
                fid: data.fid,
                username: data.username,
                hasWallet: !!data.walletAddress,
                verified: data.verified,
                walletAddress: data.walletAddress
              });
            }
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

  // Track tip only after transaction is confirmed
  useEffect(() => {
    if (isTipConfirmed && tipTxData && !tipping) {
      // Transaction confirmed, now track the tip
      const trackTip = async () => {
        try {
          await fetch('/api/track-tip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId: app.id,
              amount: customTipAmount,
              recipientFid: builderData?.fid || app.builderFid,
            }),
          });
          
          // Update local stats
          setLiveStats(prev => ({
            ...prev,
            tips: (parseFloat(prev.tips) || 0) + parseFloat(customTipAmount),
          }));

          const usdAmount = ethPrice ? (parseFloat(customTipAmount) * ethPrice).toFixed(2) : null;
          setTipMessage(`TIP SENT! ${parseFloat(customTipAmount).toFixed(6)} ETH${usdAmount ? ` ($${usdAmount})` : ''}`);
          setTimeout(() => {
            setShowTipModal(false);
            setCustomTipAmount('');
            setCustomTipAmountUsd('');
            setTipMessage('');
          }, 3000);
        } catch (error) {
          console.error('Error tracking tip:', error);
          setTipMessage('TIP SENT BUT TRACKING FAILED');
        } finally {
          setTipping(false);
        }
      };
      
      trackTip();
    } else if (tipTxData && !isTipConfirmed && !isTipConfirming) {
      // Transaction was rejected or failed
      setTipMessage('TRANSACTION CANCELLED OR FAILED');
      setTipping(false);
    }
  }, [isTipConfirmed, tipTxData, isTipConfirming, app.id, customTipAmount, builderData?.fid, app.builderFid, ethPrice, tipping]);

  return (
    <div className="border border-white">
      {/* Header bar */}
      <div className="border-b border-white p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-[10px] tracking-[0.3em] text-gray-500">TODAY'S FEATURED</div>
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
                {/* Main name: displayName (.eth) > builder name (if .eth) > builder name > username */}
                {builderData?.displayName || 
                 (app.builder && app.builder.toUpperCase().endsWith('.ETH') ? app.builder.toUpperCase() : app.builder) ||
                 (builderData?.username ? `@${builderData.username}` : 'Unknown')}
              </a>
            ) : (
              <div className="text-sm font-bold">
                {builderData?.displayName || 
                 (app.builder && app.builder.toUpperCase().endsWith('.ETH') ? app.builder.toUpperCase() : app.builder) ||
                 (builderData?.username ? `@${builderData.username}` : 'Unknown')}
              </div>
            )}
            <div className="text-[10px] tracking-[0.2em] text-gray-500">
              {/* Secondary: Always show Farcaster username if available, otherwise builder name */}
              {builderData?.username ? `@${builderData.username}` : 
               (app.builder && app.builder.toUpperCase().endsWith('.ETH') ? app.builder.toUpperCase() : app.builder) || 'Unknown'}
              {builderData?.followerCount !== undefined && builderData.followerCount > 0 && (
                ` • ${formatNumber(builderData.followerCount)} followers`
              )}
              {(!builderData?.followerCount || builderData.followerCount === 0) && builderData?.fid && (
                ` • FID #${builderData.fid}`
              )}
              {(!builderData?.followerCount || builderData.followerCount === 0) && !builderData?.fid && app.builderFid && (
                ` • FID #${app.builderFid}`
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2">
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
            {/* Follow on X button - get X username from app data or builder data */}
            {(app.links?.twitter || app.twitter || builderData?.twitter) && (
              <button
                onClick={() => {
                  const xUsername = app.links?.twitter || app.twitter || builderData?.twitter;
                  if (!xUsername) return;
                  
                  // Handle different formats: URL, @username, or plain username
                  let xUrl;
                  if (xUsername.startsWith('http://') || xUsername.startsWith('https://')) {
                    xUrl = xUsername;
                  } else if (xUsername.startsWith('@')) {
                    xUrl = `https://x.com/${xUsername.slice(1)}`;
                  } else {
                    xUrl = `https://x.com/${xUsername.replace('@', '')}`;
                  }
                  
                  window.open(xUrl, '_blank', 'noopener,noreferrer');
                }}
                className="text-[10px] tracking-[0.2em] px-3 py-1.5 border border-white hover:bg-white hover:text-black transition-all"
              >
                FOLLOW ON X
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          <div className="min-w-0">
            <div className="text-3xl font-black truncate">{formatNumber(liveStats.views || app.stats?.views || 0)}</div>
            <div className="text-[9px] tracking-[0.3em] text-gray-500 mt-1">VIEWS</div>
          </div>
          <div className="min-w-0">
            <div className="text-3xl font-black truncate">{formatNumber(liveStats.clicks || app.stats?.clicks || 0)}</div>
            <div className="text-[9px] tracking-[0.3em] text-gray-500 mt-1">CLICKS</div>
          </div>
          <div className="min-w-0">
            <div className="text-3xl font-black truncate">{formatTipsUsd(liveStats.tips || app.stats?.tips || 0, ethPrice)}</div>
            <div className="text-[8px] tracking-[0.2em] text-gray-500 mt-1 leading-tight">TIPPED • GOES TO CREATOR</div>
          </div>
        </div>

        {/* Tip message */}
        {tipMessage && (
          <div className={`mb-4 p-3 border text-center text-[10px] tracking-[0.2em] ${
            tipMessage.includes('SENT') 
              ? 'border-green-500 text-green-400 bg-green-500/10' 
              : 'border-red-500 text-red-400 bg-red-500/10'
          }`}>
            {tipMessage}
          </div>
        )}

        {/* Actions */}
        <div className="grid grid-cols-2 gap-[1px] bg-white">
          <button 
            onClick={async () => {
              if (!isInFarcaster || !app.links?.miniapp) return;
              
              // Track click
              try {
                await fetch('/api/track-click', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ projectId: app.id, type: 'click' }),
                });
                // Update local stats
                setLiveStats(prev => ({ ...prev, clicks: (prev.clicks || 0) + 1 }));
              } catch (error) {
                console.error('Error tracking click:', error);
              }
              
              // Notify parent that miniapp was clicked
              if (onMiniappClick) {
                onMiniappClick();
              }
              
              // Open mini app
              const miniappUrl = app.links.miniapp;
              if (sdk.actions?.openUrl) {
                try {
                  await sdk.actions.openUrl({ url: miniappUrl });
                } catch (error) {
                  window.open(miniappUrl, '_blank', 'noopener,noreferrer');
                }
              } else {
                window.open(miniappUrl, '_blank', 'noopener,noreferrer');
              }
            }}
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
            onClick={() => {
              if (!isInFarcaster) {
                setTipMessage('OPEN IN FARCASTER TO TIP');
                setTimeout(() => setTipMessage(''), 3000);
                return;
              }

              if (!isConnected) {
                setTipMessage('CONNECT WALLET TO TIP');
                setTimeout(() => setTipMessage(''), 3000);
                return;
              }

              // Always show modal - validation happens inside modal
              // If builder data is still loading, try to fetch it when modal opens
              setShowTipModal(true);
              if (ethPrice) {
                const initialUsd = (parseFloat(customTipAmount) * ethPrice).toFixed(2);
                setCustomTipAmountUsd(initialUsd);
              }
            }}
            title={
              !isInFarcaster ? 'Open in Farcaster to tip' :
              !isConnected ? 'Connect wallet to tip' :
              !builderData ? 'Loading builder info...' :
              !builderData?.walletAddress || !builderData?.verified ? 'Builder needs verified Farcaster wallet' :
              'Tip the builder'
            }
            className="bg-black py-4 font-bold text-sm tracking-[0.2em] transition-all hover:bg-white hover:text-black"
          >
            TIP BUILDER
          </button>
        </div>
      </div>

      {/* Tip Modal */}
      {showTipModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-black border-2 border-white max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-black tracking-tight">TIP BUILDER</h3>
                <p className="text-[9px] tracking-[0.2em] text-gray-500 mt-1">
                  SENT ONLY TO PRIMARY FARCASTER WALLET
                </p>
              </div>
              <button
                onClick={() => {
                  setShowTipModal(false);
                  setCustomTipAmount('');
                  setCustomTipAmountUsd('');
                  setTipMessage('');
                }}
                className="text-white hover:text-gray-400 text-2xl"
              >
                ×
              </button>
            </div>

            {tipMessage && (
              <div className={`mb-4 p-3 border text-center text-[10px] tracking-[0.2em] ${
                tipMessage.includes('SENT') 
                  ? 'border-green-500 text-green-400 bg-green-500/10' 
                  : 'border-red-500 text-red-400 bg-red-500/10'
              }`}>
                {tipMessage}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
                  AMOUNT (USD)
                </label>
                <p className="text-[9px] tracking-[0.2em] text-gray-600 mb-2">
                  AMOUNT SHOWN IN USD • CONVERTS TO ETH AT CURRENT PRICE
                </p>
                {ethPriceLoading ? (
                  <div className="text-[10px] text-gray-500 mb-2">Loading ETH price...</div>
                ) : ethPrice ? (
                  <div className="text-[10px] text-gray-500 mb-2">
                    1 ETH = ${ethPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                ) : null}
                <input
                  type="number"
                  step="0.01"
                  min={MIN_TIP_USD}
                  value={customTipAmountUsd}
                  onChange={(e) => {
                    const usdValue = e.target.value;
                    setCustomTipAmountUsd(usdValue);
                    
                    // Convert USD to ETH for storage (this is what gets sent)
                    if (usdValue === '') {
                      setCustomTipAmount('');
                    } else {
                      const usdNum = parseFloat(usdValue);
                      if (!isNaN(usdNum) && usdNum >= 0) {
                        const currentPrice = ethPrice || 2800;
                        const ethValue = usdNum / currentPrice;
                        setCustomTipAmount(ethValue.toString());
                      }
                    }
                  }}
                  className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black"
                  placeholder="0.00"
                />
                {customTipAmount && customTipAmountUsd && ethPrice && (
                  <p className="text-[10px] text-gray-600 mt-1">
                    ≈ {parseFloat(customTipAmount).toFixed(6)} ETH
                  </p>
                )}
                <p className="text-[10px] text-gray-600 mt-1">
                  Minimum: ${MIN_TIP_USD.toFixed(2)} USD {ethPrice ? `(~${(MIN_TIP_USD / ethPrice).toFixed(6)} ETH)` : ''}
                </p>
              </div>

              <div className="flex gap-2">
                {ethPrice ? (
                  [
                    { usd: 5, label: '$5' },
                    { usd: 10, label: '$10' },
                    { usd: 25, label: '$25' },
                    { usd: 50, label: '$50' },
                  ].map((option) => {
                    const ethValue = (option.usd / ethPrice).toFixed(6);
                    return (
                      <button
                        key={option.usd}
                        onClick={() => {
                          setCustomTipAmountUsd(option.usd.toString());
                          setCustomTipAmount(ethValue);
                        }}
                        className="flex-1 px-3 py-2 border border-white text-[10px] tracking-[0.2em] hover:bg-white hover:text-black transition-all"
                      >
                        {option.label}
                      </button>
                    );
                  })
                ) : (
                  // Fallback if price not loaded - show USD amounts based on fallback price
                  [
                    { usd: 5, label: '$5' },
                    { usd: 10, label: '$10' },
                    { usd: 25, label: '$25' },
                    { usd: 50, label: '$50' },
                  ].map((option) => {
                    const ethValue = (option.usd / 2800).toFixed(6);
                    return (
                      <button
                        key={option.usd}
                        onClick={() => {
                          setCustomTipAmountUsd(option.usd.toString());
                          setCustomTipAmount(ethValue);
                        }}
                        className="flex-1 px-3 py-2 border border-white text-[10px] tracking-[0.2em] hover:bg-white hover:text-black transition-all"
                      >
                        {option.label}
                      </button>
                    );
                  })
                )}
              </div>

              <div className="pt-4 border-t border-white">
                <div className="text-[10px] tracking-[0.2em] text-gray-500 mb-2">
                  RECIPIENT (PRIMARY FARCASTER WALLET)
                </div>
                <div className="text-sm font-bold mb-1">
                  {builderData?.displayName || app.builder}
                </div>
                {builderData?.walletAddress ? (
                  <>
                    <div className="text-[10px] font-mono text-gray-500 break-all mb-1">
                      {builderData.walletAddress}
                    </div>
                    {builderData.verified ? (
                      <div className="text-[9px] tracking-[0.2em] text-green-400">
                        ✓ VERIFIED FARCASTER WALLET
                      </div>
                    ) : (
                      <div className="text-[9px] tracking-[0.2em] text-yellow-400">
                        ⚠ WALLET NOT VERIFIED
                      </div>
                    )}
                  </>
                ) : builderData ? (
                  <div className="text-[10px] text-red-400">
                    ⚠ PRIMARY FARCASTER WALLET NOT FOUND
                    {app.builderFid && (
                      <div className="text-[9px] text-gray-500 mt-1">
                        FID: {app.builderFid}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-[10px] text-gray-500">
                    Loading wallet info...
                  </div>
                )}
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => {
                    setShowTipModal(false);
                    setCustomTipAmount('');
                    setCustomTipAmountUsd('');
                    setTipMessage('');
                  }}
                  className="flex-1 py-3 border border-white font-bold text-sm tracking-[0.2em] hover:bg-white hover:text-black transition-all"
                >
                  CANCEL
                </button>
                <button
                  onClick={async () => {
                    const usdAmount = parseFloat(customTipAmountUsd);
                    const amount = parseFloat(customTipAmount);
                    
                    // Validate minimum tip: $0.20 USD
                    if (!usdAmount || usdAmount < MIN_TIP_USD) {
                      setTipMessage(`MINIMUM TIP IS $${MIN_TIP_USD.toFixed(2)} USD`);
                      setTimeout(() => setTipMessage(''), 3000);
                      return;
                    }
                    
                    if (!amount || amount <= 0) {
                      setTipMessage(`INVALID TIP AMOUNT`);
                      setTimeout(() => setTipMessage(''), 3000);
                      return;
                    }

                    const recipientAddress = builderData?.walletAddress;
                    
                    // Ensure we only send to verified primary Farcaster wallet
                    if (!recipientAddress) {
                      setTipMessage('PRIMARY FARCASTER WALLET NOT FOUND');
                      setTimeout(() => setTipMessage(''), 3000);
                      return;
                    }

                    // Double-check it's a verified wallet
                    if (!builderData?.verified) {
                      setTipMessage('WALLET NOT VERIFIED. TIPS ONLY SENT TO VERIFIED FARCASTER WALLETS.');
                      setTimeout(() => setTipMessage(''), 3000);
                      return;
                    }

                    setTipping(true);
                    setTipMessage('WAITING FOR TRANSACTION...');

                    try {
                      // Send transaction with "tip" in data field
                      const hash = await sendTransaction({
                        to: recipientAddress,
                        value: parseEther(customTipAmount),
                        data: stringToHex('tip'), // Add "tip" as transaction data
                      });

                      // Wait for transaction confirmation before tracking
                      setTipMessage('WAITING FOR CONFIRMATION...');
                    } catch (error) {
                      console.error('Error sending tip:', error);
                      setTipMessage('TRANSACTION FAILED. PLEASE TRY AGAIN.');
                      setTipping(false);
                    }
                  }}
                  disabled={tipping || isTipConfirming || !customTipAmountUsd || parseFloat(customTipAmountUsd) < MIN_TIP_USD || !customTipAmount || parseFloat(customTipAmount) <= 0}
                  className="flex-1 py-3 bg-white text-black font-black text-sm tracking-[0.2em] hover:bg-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isTipConfirming ? 'CONFIRMING...' : tipping ? 'SENDING...' : ethPrice ? `SEND $${(parseFloat(customTipAmount) * ethPrice).toFixed(2)}` : `SEND ${parseFloat(customTipAmount).toFixed(6)} ETH`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// LIVE CHAT
// ============================================
const LiveChat = ({ messages, onSend, isInFarcaster = false }) => {
  const handleUsernameClick = async (msg) => {
    if (!msg.fid || msg.fid === 0) return; // Can't open profile without FID
    
    // Use username for URL if available, otherwise fallback to FID
    const profileUrl = msg.username 
      ? `https://farcaster.xyz/${msg.username}`
      : `https://farcaster.xyz/profiles/${msg.fid}`;
    
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
const SubmitSection = ({ onSubmit, isInFarcaster = false, isMiniappInstalled = false }) => (
  <div className="border border-white p-6 text-center">
    <h3 className="text-xl font-black tracking-tight mb-2">GET A PAID FEATURE</h3>
    <p className="text-sm text-gray-500 tracking-wider mb-4">
      STRUGGLING TO GET SEEN? SUBMIT YOUR PROJECT FOR TOMORROW'S SPOTLIGHT.
    </p>
    <div className="grid grid-cols-3 gap-4 mb-6 text-left">
      <div>
        <div className="text-2xl font-black">MAX</div>
        <div className="text-[9px] tracking-[0.2em] text-gray-500">EXPOSURE</div>
      </div>
      <div>
        <div className="text-2xl font-black">24HR</div>
        <div className="text-[9px] tracking-[0.2em] text-gray-500">FEATURED SLOT</div>
      </div>
      <div>
        <div className="text-2xl font-black">TOP</div>
        <div className="text-[9px] tracking-[0.2em] text-gray-500">VISIBILITY</div>
      </div>
    </div>
    {!isMiniappInstalled && isInFarcaster && (
      <div className="mb-4 p-4 border border-yellow-500 bg-yellow-500/10">
        <p className="text-sm text-yellow-400 mb-2">
          ⚠️ ADD THIS MINI APP TO SUBMIT PROJECTS
        </p>
        <p className="text-xs text-yellow-500">
          You must add this miniapp to your Farcaster account before submitting.
        </p>
      </div>
    )}
    <button 
      onClick={onSubmit}
      disabled={!isInFarcaster || !isMiniappInstalled}
      className={`w-full py-4 font-black text-sm tracking-[0.3em] transition-all ${
        isInFarcaster && isMiniappInstalled
          ? 'bg-white text-black hover:bg-gray-200' 
          : 'bg-gray-600 text-gray-400 cursor-not-allowed'
      }`}
    >
      {!isInFarcaster 
        ? 'OPEN IN FARCASTER TO SUBMIT'
        : !isMiniappInstalled
        ? 'ADD MINI APP TO SUBMIT'
        : 'SUBMIT YOUR PROJECT'}
    </button>
  </div>
);

// ============================================
// PROJECT CARD (for category rankings)
// ============================================
const ProjectCard = ({ project, rankChange, ethPrice, isInFarcaster = false, isConnected = false }) => {
  const [showDescription, setShowDescription] = useState(false);
  const [showTipModal, setShowTipModal] = useState(false);
  const [customTipAmount, setCustomTipAmount] = useState('');
  const [customTipAmountUsd, setCustomTipAmountUsd] = useState('');
  const [tipping, setTipping] = useState(false);
  const [tipMessage, setTipMessage] = useState('');
  const [builderData, setBuilderData] = useState(null);
  const { sendTransaction, data: tipTxData } = useSendTransaction();
  const { isLoading: isTipConfirming, isSuccess: isTipConfirmed } = useWaitForTransactionReceipt({
    hash: tipTxData,
  });
  const MIN_TIP_USD = 0.20;

  // Fetch builder profile for tipping
  useEffect(() => {
    if (showTipModal && project.builderFid) {
      fetch(`/api/user-profile?fid=${project.builderFid}`)
        .then(res => res.json())
        .then(data => {
          if (data.user) {
            setBuilderData(data.user);
          }
        })
        .catch(() => {});
    }
  }, [showTipModal, project.builderFid]);

  // Sync USD amount when ETH price loads or modal opens
  useEffect(() => {
    if (showTipModal && ethPrice && !customTipAmountUsd && !customTipAmount) {
      setCustomTipAmountUsd(MIN_TIP_USD.toFixed(2));
      const minEth = MIN_TIP_USD / ethPrice;
      setCustomTipAmount(minEth.toString());
    } else if (showTipModal && ethPrice && !customTipAmountUsd && customTipAmount) {
      const usdValue = (parseFloat(customTipAmount) * ethPrice).toFixed(2);
      setCustomTipAmountUsd(usdValue);
    }
  }, [showTipModal, ethPrice, customTipAmount, customTipAmountUsd]);

  // Track view when project card is displayed
  useEffect(() => {
    if (project?.id) {
      // Track view when component mounts
      fetch('/api/track-click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, type: 'view' }),
      }).catch(() => {}); // Fail silently
    }
  }, [project?.id]);

  // Track tip only after transaction is confirmed (ProjectCard)
  useEffect(() => {
    if (isTipConfirmed && tipTxData && !tipping) {
      // Transaction confirmed, now track the tip
      const trackTip = async () => {
        try {
          await fetch('/api/track-tip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId: project.id,
              amount: customTipAmount,
              recipientFid: builderData?.fid || project.builderFid,
            }),
          });

          const usdAmount = ethPrice ? (parseFloat(customTipAmount) * ethPrice).toFixed(2) : null;
          setTipMessage(`TIP SENT! ${parseFloat(customTipAmount).toFixed(6)} ETH${usdAmount ? ` ($${usdAmount})` : ''}`);
          setTimeout(() => {
            setShowTipModal(false);
            setCustomTipAmount('');
            setCustomTipAmountUsd('');
            setTipMessage('');
          }, 3000);
        } catch (error) {
          console.error('Error tracking tip:', error);
          setTipMessage('TIP SENT BUT TRACKING FAILED');
        } finally {
          setTipping(false);
        }
      };
      
      trackTip();
    } else if (tipTxData && !isTipConfirmed && !isTipConfirming) {
      // Transaction was rejected or failed
      setTipMessage('TRANSACTION CANCELLED OR FAILED');
      setTipping(false);
    }
  }, [isTipConfirmed, tipTxData, isTipConfirming, project.id, customTipAmount, builderData?.fid, project.builderFid, ethPrice, tipping]);

  const handleOpenClick = async () => {
    if (!project.links?.miniapp) return;
    
    // Track click
    try {
      await fetch('/api/track-click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, type: 'click' }),
      });
    } catch (error) {
      console.error('Error tracking click:', error);
    }
    
    // Open mini app
    const miniappUrl = project.links.miniapp;
    if (isInFarcaster) {
      try {
        if (sdk.actions?.openUrl) {
          await sdk.actions.openUrl({ url: miniappUrl });
        } else {
          window.open(miniappUrl, '_blank', 'noopener,noreferrer');
        }
      } catch (error) {
        window.open(miniappUrl, '_blank', 'noopener,noreferrer');
      }
    } else {
      window.open(miniappUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <>
      <div className="border border-white p-4 md:p-6 hover:bg-white/5 transition-all">
        <div className="flex flex-col md:flex-row items-start gap-4">
          <div className="flex items-center gap-2 min-w-[80px] shrink-0">
            <div className="text-2xl md:text-3xl font-black w-10 md:w-12 text-center">
              #{project.rank}
            </div>
            {rankChange !== null && (
              <div className={`text-xs md:text-sm ${
                rankChange > 0 ? 'text-green-400' : 
                rankChange < 0 ? 'text-red-400' : 
                'text-gray-500'
              }`}>
                {rankChange > 0 ? '↑' : rankChange < 0 ? '↓' : '—'}
                {rankChange !== 0 && Math.abs(rankChange)}
              </div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h3 className="text-xl md:text-2xl font-black break-words">{project.name}</h3>
              <span className="text-[9px] tracking-[0.2em] px-2 py-0.5 bg-white text-black font-bold shrink-0">
                {project.category?.toUpperCase()}
              </span>
            </div>
            <p className="text-sm text-gray-500 mb-2">{project.tagline}</p>
            
            {/* Description - show more by default, can collapse */}
            {project.description && (
              <div className="mb-3">
                {showDescription ? (
                  <div>
                    <p className="text-sm text-gray-400 leading-relaxed mb-1 whitespace-pre-wrap break-words">{project.description}</p>
                    {project.builder && (
                      <div className="text-[10px] text-gray-500 mb-2">
                        BUILDER: <span className="text-white font-semibold">{project.builder}</span>
                        {project.builderFid ? (
                          <span className="ml-1 text-gray-500">(FID {project.builderFid})</span>
                        ) : null}
                      </div>
                    )}
                    <button
                      onClick={() => setShowDescription(false)}
                      className="text-[10px] text-gray-500 hover:text-white underline"
                    >
                      SHOW LESS
                    </button>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-gray-400 leading-relaxed mb-1 line-clamp-3 whitespace-pre-wrap break-words">{project.description}</p>
                    {project.description.length > 150 && (
                      <button
                        onClick={() => setShowDescription(true)}
                        className="text-[10px] text-gray-500 hover:text-white underline"
                      >
                        SHOW MORE
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
            
            <div className="flex items-center gap-4 md:gap-6 text-xs md:text-sm tracking-[0.2em] text-gray-600 flex-wrap">
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4 md:w-5 md:h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                  <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                </svg>
                {formatNumber(project.todayViews || project.stats?.views || 0)}
              </span>
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4 md:w-5 md:h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                </svg>
                {formatNumber(project.todayClicks || project.stats?.clicks || 0)}
              </span>
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4 md:w-5 md:h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.343 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.343-1.253V5z" clipRule="evenodd" />
                </svg>
                {formatTipsUsd(project.stats?.tips || 0, ethPrice)}
              </span>
            </div>
          </div>
          
          <div className="flex gap-2 shrink-0 w-full md:w-auto mt-2 md:mt-0">
            {project.links?.miniapp && (
              <button
                onClick={handleOpenClick}
                className="flex-1 md:flex-none px-6 py-3 md:px-4 md:py-2 border border-white text-sm md:text-[10px] tracking-[0.2em] hover:bg-white hover:text-black transition-all whitespace-nowrap font-bold"
              >
                OPEN
              </button>
            )}
            <button
              onClick={async () => {
                if (!isInFarcaster) {
                  setTipMessage('OPEN IN FARCASTER TO SHARE');
                  setTimeout(() => setTipMessage(''), 3000);
                  return;
                }
                
                const miniappUrl = 'https://farcaster.xyz/miniapps/EvK2rV9tUv3h/seen';
                const castText = `I just discovered ${project.name} using Seen\n\n${miniappUrl}`;
                
                try {
                  if (typeof window !== 'undefined' && sdk?.actions?.composeCast) {
                    await sdk.actions.composeCast({
                      text: castText,
                      embeds: [miniappUrl]
                    });
                  } else {
                    // Fallback to warpcast URL if SDK not available
                    const encodedText = encodeURIComponent(castText);
                    const farcastUrl = `https://warpcast.com/~/compose?text=${encodedText}`;
                    window.open(farcastUrl, '_blank', 'noopener,noreferrer');
                  }
                } catch (error) {
                  console.error('Error opening compose:', error);
                  // Fallback to warpcast URL
                  const encodedText = encodeURIComponent(castText);
                  const farcastUrl = `https://warpcast.com/~/compose?text=${encodedText}`;
                  window.open(farcastUrl, '_blank', 'noopener,noreferrer');
                }
              }}
              className="flex-1 md:flex-none px-6 py-3 md:px-3 md:py-2 border border-white text-sm md:text-[9px] tracking-[0.2em] hover:bg-white hover:text-black transition-all font-bold"
              title="Share this project on Farcaster"
            >
              SHARE
            </button>
            <button
              onClick={() => {
                if (!isInFarcaster) {
                  setTipMessage('OPEN IN FARCASTER TO TIP');
                  setTimeout(() => setTipMessage(''), 3000);
                  return;
                }
                if (!isConnected) {
                  setTipMessage('CONNECT WALLET TO TIP');
                  setTimeout(() => setTipMessage(''), 3000);
                  return;
                }
                // Check builder wallet when modal opens
                setShowTipModal(true);
              }}
              className="flex-1 md:flex-none px-6 py-3 md:px-3 md:py-2 border border-white text-sm md:text-[9px] tracking-[0.2em] hover:bg-white hover:text-black transition-all font-bold"
              title={
                !isInFarcaster ? 'Open in Farcaster to tip' :
                !isConnected ? 'Connect wallet to tip' :
                'Tip builder'
              }
            >
              TIP
            </button>
          </div>
        </div>
      </div>

      {/* Tip Modal */}
      {showTipModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-black border-2 border-white max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-black tracking-tight">TIP BUILDER</h3>
                <p className="text-[9px] tracking-[0.2em] text-gray-500 mt-1">
                  SENT ONLY TO PRIMARY FARCASTER WALLET
                </p>
              </div>
              <button
                onClick={() => {
                  setShowTipModal(false);
                  setCustomTipAmount('');
                  setCustomTipAmountUsd('');
                  setTipMessage('');
                }}
                className="text-white hover:text-gray-400 text-2xl"
              >
                ×
              </button>
            </div>

            {tipMessage && (
              <div className={`mb-4 p-3 border text-center text-[10px] tracking-[0.2em] ${
                tipMessage.includes('SENT') 
                  ? 'border-green-500 text-green-400 bg-green-500/10' 
                  : 'border-red-500 text-red-400 bg-red-500/10'
              }`}>
                {tipMessage}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] tracking-[0.2em] text-gray-500 mb-2">
                  AMOUNT (USD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min={MIN_TIP_USD}
                  value={customTipAmountUsd}
                  onChange={(e) => {
                    const usdValue = e.target.value;
                    setCustomTipAmountUsd(usdValue);
                    if (usdValue === '') {
                      setCustomTipAmount('');
                    } else {
                      const usdNum = parseFloat(usdValue);
                      if (!isNaN(usdNum) && usdNum >= 0 && ethPrice) {
                        const ethValue = usdNum / ethPrice;
                        setCustomTipAmount(ethValue.toString());
                      }
                    }
                  }}
                  className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black"
                  placeholder="0.00"
                />
                {customTipAmount && customTipAmountUsd && ethPrice && (
                  <p className="text-[10px] text-gray-600 mt-1">
                    ≈ {parseFloat(customTipAmount).toFixed(6)} ETH
                  </p>
                )}
                <p className="text-[10px] text-gray-600 mt-1">
                  Minimum: ${MIN_TIP_USD.toFixed(2)} USD
                </p>
              </div>

              <div className="flex gap-2">
                {ethPrice ? (
                  [
                    { usd: 5, label: '$5' },
                    { usd: 10, label: '$10' },
                    { usd: 25, label: '$25' },
                    { usd: 50, label: '$50' },
                  ].map((option) => {
                    const ethValue = (option.usd / ethPrice).toFixed(6);
                    return (
                      <button
                        key={option.usd}
                        onClick={() => {
                          setCustomTipAmountUsd(option.usd.toString());
                          setCustomTipAmount(ethValue);
                        }}
                        className="flex-1 px-3 py-2 border border-white text-[10px] tracking-[0.2em] hover:bg-white hover:text-black transition-all"
                      >
                        {option.label}
                      </button>
                    );
                  })
                ) : (
                  [
                    { usd: 5, label: '$5' },
                    { usd: 10, label: '$10' },
                    { usd: 25, label: '$25' },
                    { usd: 50, label: '$50' },
                  ].map((option) => {
                    const ethValue = (option.usd / 2800).toFixed(6);
                    return (
                      <button
                        key={option.usd}
                        onClick={() => {
                          setCustomTipAmountUsd(option.usd.toString());
                          setCustomTipAmount(ethValue);
                        }}
                        className="flex-1 px-3 py-2 border border-white text-[10px] tracking-[0.2em] hover:bg-white hover:text-black transition-all"
                      >
                        {option.label}
                      </button>
                    );
                  })
                )}
              </div>

              {tipMessage && (
                <div className={`p-3 border text-center text-[10px] tracking-[0.2em] ${
                  tipMessage.includes('SENT') 
                    ? 'border-green-500 text-green-400 bg-green-500/10' 
                    : 'border-red-500 text-red-400 bg-red-500/10'
                }`}>
                  {tipMessage}
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => {
                    setShowTipModal(false);
                    setCustomTipAmount('');
                    setCustomTipAmountUsd('');
                    setTipMessage('');
                  }}
                  className="px-6 py-2 border border-white font-bold hover:bg-white hover:text-black transition-all"
                >
                  CANCEL
                </button>
                <button
                  onClick={async () => {
                    if (!isInFarcaster || !isConnected) {
                      setTipMessage('CONNECT WALLET TO TIP');
                      setTimeout(() => setTipMessage(''), 3000);
                      return;
                    }
                    
                    if (!builderData?.walletAddress || !builderData?.verified) {
                      setTipMessage('BUILDER NEEDS VERIFIED FARCASTER WALLET');
                      setTimeout(() => setTipMessage(''), 3000);
                      return;
                    }

                    if (!customTipAmount || parseFloat(customTipAmount) <= 0) {
                      setTipMessage('INVALID TIP AMOUNT');
                      setTimeout(() => setTipMessage(''), 3000);
                      return;
                    }

                    setTipping(true);
                    setTipMessage('WAITING FOR TRANSACTION...');

                    try {
                      const { parseEther, stringToHex } = await import('viem');
                      await sendTransaction({
                        to: builderData.walletAddress,
                        value: parseEther(customTipAmount),
                        data: stringToHex('tip'), // Add "tip" as transaction data
                      });

                      // Wait for transaction confirmation before tracking
                      setTipMessage('WAITING FOR CONFIRMATION...');
                    } catch (error) {
                      console.error('Error sending tip:', error);
                      setTipMessage('TRANSACTION FAILED. PLEASE TRY AGAIN.');
                      setTipping(false);
                    }
                  }}
                  disabled={tipping || !customTipAmountUsd || parseFloat(customTipAmountUsd) < MIN_TIP_USD || !customTipAmount || parseFloat(customTipAmount) <= 0}
                  className="flex-1 py-3 bg-white text-black font-black text-sm tracking-[0.2em] hover:bg-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {tipping ? 'SENDING...' : ethPrice ? `SEND $${(parseFloat(customTipAmount) * ethPrice).toFixed(2)}` : `SEND ${customTipAmount ? parseFloat(customTipAmount).toFixed(6) : '0'} ETH`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// ============================================
// CATEGORY RANKINGS
// ============================================
const CategoryRankings = ({ category, ethPrice, isInFarcaster = false, isConnected = false }) => {
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!category) {
      setRankings([]);
      setLoading(false);
      return;
    }
    
    let isMounted = true; // Track if component is still mounted
    
    const fetchRankings = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/projects/rankings?category=${encodeURIComponent(category)}&limit=10`);
        if (!response.ok) {
          throw new Error(`Failed to fetch rankings: ${response.status}`);
        }
        const data = await response.json();
        if (isMounted) {
          if (data && data.rankings && Array.isArray(data.rankings)) {
            setRankings(data.rankings);
          } else {
            setRankings([]);
          }
        }
      } catch (error) {
        console.error('Error fetching rankings:', error);
        if (isMounted) {
          setRankings([]); // Set empty array on error to prevent crashes
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchRankings();
    // Refresh rankings every 30 seconds (only when tab is visible)
    let interval;
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (interval) clearInterval(interval);
      } else {
        if (isMounted) fetchRankings(); // Fetch immediately when tab becomes visible
        interval = setInterval(() => {
          if (isMounted) {
            fetchRankings();
          }
        }, 30000);
      }
    };
    
    interval = setInterval(() => {
      if (isMounted) {
        fetchRankings();
      }
    }, 30000);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      isMounted = false;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [category]);

  if (loading) {
    return (
      <div className="border border-white p-6 text-center">
        <div className="text-sm text-gray-500">LOADING RANKINGS...</div>
      </div>
    );
  }

  if (rankings.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="mb-4 flex justify-center">
          <svg className="w-16 h-16 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
          </svg>
        </div>
        <h2 className="text-2xl font-black mb-2">{category.toUpperCase()} RANKINGS</h2>
        <p className="text-sm text-gray-500 tracking-wider">
          NO PROJECTS IN THIS CATEGORY YET
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="border-b border-white pb-4 mb-6">
        <h2 className="text-2xl font-black tracking-tight mb-2">{category.toUpperCase()} TOP 10</h2>
        <p className="text-[10px] tracking-[0.3em] text-gray-500">
          RANKED BY ENGAGEMENT • UPDATES EVERY 30 SECONDS
        </p>
      </div>
      
      <div className="space-y-2">
        {rankings && Array.isArray(rankings) && rankings.length > 0 ? rankings.map((project, index) => {
          if (!project || !project.id) return null; // Guard against invalid projects
          
          const previousRank = project.previousRank;
          const rankChange = previousRank ? previousRank - project.rank : null;
          
          return (
            <ProjectCard 
              key={project.id || `project-${index}`}
              project={project}
              rankChange={rankChange}
              ethPrice={ethPrice}
              isInFarcaster={isInFarcaster}
              isConnected={isConnected}
            />
          );
        }).filter(Boolean) : (
          <div className="border border-white p-6 text-center">
            <div className="text-sm text-gray-500">NO PROJECTS FOUND</div>
          </div>
        )}
      </div>
      
      {/* Scroll Indicator */}
      <div className="mt-8 text-center">
        <div className="text-2xl font-black tracking-tight mb-2 flex items-center justify-center gap-2">
          <span>SCROLL</span>
          <svg className="w-6 h-6 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      </div>
    </div>
  );
};

// ============================================
// FAQ COMPONENT
// ============================================
const FAQ = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border border-white">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-3 border-b border-white flex items-center justify-between hover:bg-white/5 transition-all"
      >
        <span className="text-[10px] tracking-[0.3em] font-bold">FAQ</span>
        <span className="text-lg">{isOpen ? '−' : '+'}</span>
      </button>
      {isOpen && (
        <div className="p-6 space-y-4 text-sm">
          <div>
            <h3 className="text-lg font-black mb-2 tracking-tight">ABOUT SEEN.</h3>
            <p className="text-gray-400 leading-relaxed">
              SEEN. is a discovery platform for Farcaster Mini Apps. We help builders get their projects seen by the Farcaster community. 
              Featured projects are highlighted for 24 hours, and users can discover, interact with, and tip builders directly.
            </p>
          </div>
          
          <div>
            <h3 className="text-lg font-black mb-2 tracking-tight">HOW IT WORKS</h3>
            <ul className="text-gray-400 space-y-2 list-disc list-inside leading-relaxed">
              <li>Browse featured Mini Apps and category rankings</li>
              <li>Click "OPEN" to interact with Mini Apps</li>
              <li>Tip builders directly (tips go to their verified Farcaster wallet)</li>
              <li>Claim $SEEN tokens for checking out featured apps</li>
              <li>Submit your own project for free or pay for a featured slot</li>
            </ul>
          </div>

          <div className="p-4 border border-red-500/50 bg-red-500/10">
            <h3 className="text-base font-black mb-2 text-red-400 tracking-tight">⚠ IMPORTANT DISCLAIMER</h3>
            <p className="text-xs text-red-300 leading-relaxed mb-2">
              <strong>USE AT YOUR OWN RISK:</strong> SEEN. is a discovery platform only. We do not endorse, verify, or guarantee any Mini Apps listed on this platform.
            </p>
            <p className="text-xs text-red-300 leading-relaxed mb-2">
              <strong>DO YOUR OWN RESEARCH:</strong> Before interacting with any Mini App, you should:
            </p>
            <ul className="text-xs text-red-300 space-y-1 list-disc list-inside ml-2 mb-2">
              <li>Research the project and its creators independently</li>
              <li>Verify smart contract addresses and security audits</li>
              <li>Understand the risks associated with blockchain interactions</li>
              <li>Never share private keys or seed phrases</li>
              <li>Be cautious with transactions and token approvals</li>
            </ul>
            <p className="text-xs text-red-300 leading-relaxed">
              <strong>NO LIABILITY:</strong> SEEN. and its operators are not responsible for any losses, damages, or issues arising from your use of any Mini Apps discovered through this platform. 
              You are solely responsible for your interactions with third-party Mini Apps. Always exercise due diligence and use caution when engaging with blockchain applications.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// DAILY CLAIM
// ============================================
const DailyClaim = ({ isInFarcaster = false, userFid = null, isConnected = false, featuredApp = null, hasClickedMiniapp = false, neynarUserScore = null }) => {
  const MIN_NEYNAR_SCORE = 0.62; // Minimum Neynar user score required to claim
  const [claimed, setClaimed] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [message, setMessage] = useState('');
  const [expirationTime, setExpirationTime] = useState(null);
  const [expired, setExpired] = useState(false);
  const [treasuryAddress, setTreasuryAddress] = useState(null);
  const { address } = useAccount();
  const { sendTransaction, data: claimTxData } = useSendTransaction();
  const { isLoading: isClaimTxConfirming, isSuccess: isClaimTxConfirmed } = useWaitForTransactionReceipt({
    hash: claimTxData,
  });

  // Fetch treasury address
  useEffect(() => {
    fetch('/api/payment/treasury-address')
      .then(res => res.json())
      .then(data => {
        if (data.treasuryAddress) {
          setTreasuryAddress(data.treasuryAddress);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    // Check claim status (tied to featured project)
    if (userFid) {
      const checkStatus = () => {
        fetch('/api/claim/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fid: userFid }),
        })
          .then(res => res.json())
          .then(data => {
            if (data.claimed) {
              setClaimed(true);
            }
            if (data.expired) {
              setExpired(true);
              setClaimed(false); // Reset if expired
            }
            if (data.expirationTime) {
              setExpirationTime(new Date(data.expirationTime));
            }
          })
          .catch(() => {});
      };
      
      checkStatus();
      // Check every 30 seconds to catch expiration (only when tab is visible)
      let interval;
      const handleVisibilityChange = () => {
        if (document.hidden) {
          if (interval) clearInterval(interval);
        } else {
          checkStatus(); // Check immediately when tab becomes visible
          interval = setInterval(checkStatus, 30000);
        }
      };
      
      interval = setInterval(checkStatus, 30000);
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      return () => {
        clearInterval(interval);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [userFid]);

  // When claim transaction is confirmed, send txHash to API
  useEffect(() => {
    if (isClaimTxConfirmed && claimTxData && userFid && address) {
      // Transaction confirmed, now send to API to process claim
      fetch('/api/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          fid: userFid,
          walletAddress: address,
          txHash: claimTxData
        }),
      })
        .then(res => res.json().then(data => ({ ok: res.ok, data })))
        .then(({ ok, data }) => {
          if (ok && data.success) {
            setClaimed(true);
            if (data.txHash) {
              setMessage(`CLAIMED! YOUR TX: ${data.txHash.slice(0, 10)}... TOKENS SENT.`);
            } else {
              setMessage(data.message || 'CLAIMED! TOKENS SENT TO YOUR WALLET');
            }
            if (data.expirationTime) {
              setExpirationTime(new Date(data.expirationTime));
            }
          } else {
            if (data.expired) {
              setExpired(true);
              setMessage('CLAIM WINDOW EXPIRED. WAIT FOR NEXT FEATURED PROJECT.');
            } else {
              setMessage(data.error || 'CLAIM FAILED');
            }
          }
          setClaiming(false);
        })
        .catch(error => {
          console.error('Error processing claim:', error);
          setMessage('ERROR PROCESSING CLAIM');
          setClaiming(false);
        });
    }
  }, [isClaimTxConfirmed, claimTxData, userFid, address]);

  const handleClaim = async () => {
    if (!isInFarcaster) {
      setMessage('OPEN IN FARCASTER TO CLAIM');
      return;
    }

    if (!hasClickedMiniapp) {
      setMessage('CLICK "OPEN MINI APP" FIRST TO CLAIM');
      return;
    }

    if (!isConnected || !userFid || !address) {
      setMessage('CONNECT WALLET TO CLAIM');
      return;
    }

    // Validate address format
    if (!address || !address.startsWith('0x') || address.length !== 42) {
      setMessage('INVALID WALLET ADDRESS. PLEASE RECONNECT WALLET.');
      return;
    }

    if (!treasuryAddress) {
      setMessage('LOADING TREASURY ADDRESS...');
      return;
    }

    if (claimed) {
      setMessage('ALREADY CLAIMED FOR THIS FEATURED PROJECT');
      return;
    }

    if (expired) {
      setMessage('CLAIM WINDOW EXPIRED. WAIT FOR NEXT FEATURED PROJECT.');
      return;
    }

    setClaiming(true);
    setMessage('PREPARING TRANSACTION...');

    try {
      // User signs a transaction to claim (0 ETH transfer with "claim" data)
      // This creates a user transaction for Farcaster rankings
      sendTransaction({
        to: treasuryAddress,
        value: parseEther('0'),
        data: stringToHex('claim'),
      });
      setMessage('WAITING FOR TRANSACTION CONFIRMATION...');
    } catch (error) {
      console.error('Error initiating claim transaction:', error);
      setMessage('ERROR INITIATING CLAIM. PLEASE TRY AGAIN.');
      setClaiming(false);
    }
  };

  const getTimeUntilExpiration = () => {
    if (!expirationTime) return null;
    const now = new Date();
    const diff = expirationTime - now;
    if (diff <= 0) {
      setExpired(true);
      return 'EXPIRED';
    }
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    return `${hours}h ${minutes}m ${seconds}s`;
  };

  // Update expiration status every second
  useEffect(() => {
    if (!expirationTime) return;
    
    const interval = setInterval(() => {
      const now = new Date();
      if (now > expirationTime) {
        setExpired(true);
        setClaimed(false); // Reset claim status when expired
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [expirationTime]);

  return (
    <div className="border border-white">
      <div className="border-b border-white p-3">
        <span className="text-[10px] tracking-[0.3em]">FEATURED CLAIM</span>
      </div>
      <div className="p-6 text-center space-y-4">
        {message && (
          <div className={`text-[10px] tracking-[0.2em] ${
            message.includes('CLAIMED') ? 'text-green-400' : 
            message.includes('ERROR') || message.includes('FAILED') ? 'text-red-400' : 
            'text-yellow-400'
          }`}>
            {message}
          </div>
        )}
        
        {/* Check Neynar score - show message if too low */}
        {neynarUserScore !== null && neynarUserScore < MIN_NEYNAR_SCORE ? (
          <>
            <div className="mb-4 flex items-center justify-center">
              <div className="w-16 h-16 border-2 border-white flex items-center justify-center relative">
                <div className="absolute inset-0 border-2 border-white" style={{ transform: 'rotate(45deg)' }}></div>
                <div className="text-2xl font-black relative z-10">✗</div>
              </div>
            </div>
            <div className="text-sm font-bold mb-2 text-red-400">NEYNAR SCORE TOO LOW</div>
            <div className="text-[10px] tracking-[0.2em] text-gray-500 mb-4">
              Your Neynar user score ({neynarUserScore.toFixed(2)}) is below the required threshold of {MIN_NEYNAR_SCORE}.
            </div>
            <div className="text-[10px] tracking-[0.2em] text-gray-400">
              Only users with a score of {MIN_NEYNAR_SCORE} or higher can claim tokens.
            </div>
          </>
        ) : expired ? (
          <>
            <div className="text-4xl mb-2 text-red-400">✗</div>
            <div className="text-sm font-bold mb-2 text-red-400">CLAIM EXPIRED</div>
            <div className="text-[10px] tracking-[0.2em] text-gray-500">
              WAIT FOR NEXT FEATURED PROJECT
            </div>
          </>
        ) : claimed ? (
          <>
            <div className="text-4xl mb-2">✓</div>
            <div className="text-sm font-bold mb-2">CLAIMED</div>
            {expirationTime && getTimeUntilExpiration() && getTimeUntilExpiration() !== 'EXPIRED' && (
              <div className="text-[10px] tracking-[0.2em] text-gray-500 mb-4">
                EXPIRES IN {getTimeUntilExpiration()}
              </div>
            )}
            <button
              onClick={async () => {
                const miniappUrl = 'https://farcaster.xyz/miniapps/EvK2rV9tUv3h/seen';
                const castText = `I just claimed $SEEN for checking out today's featured miniapp\n\n${miniappUrl}`;
                
                // Use Farcaster SDK composeCast for proper embedding
                try {
                  if (typeof window !== 'undefined' && sdk?.actions?.composeCast) {
                    await sdk.actions.composeCast({
                      text: castText,
                      embeds: [miniappUrl]
                    });
                  } else {
                    // Fallback to warpcast URL if SDK not available
                    const encodedText = encodeURIComponent(castText);
                    const farcastUrl = `https://warpcast.com/~/compose?text=${encodedText}`;
                    window.open(farcastUrl, '_blank', 'noopener,noreferrer');
                  }
                } catch (error) {
                  console.error('Error opening compose:', error);
                  // Fallback to warpcast URL
                  const encodedText = encodeURIComponent(castText);
                  const farcastUrl = `https://warpcast.com/~/compose?text=${encodedText}`;
                  window.open(farcastUrl, '_blank', 'noopener,noreferrer');
                }
              }}
              className="w-full py-3 border border-white font-bold text-sm tracking-[0.2em] hover:bg-white hover:text-black transition-all mt-4"
            >
              SHARE ON FARCASTER
            </button>
          </>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-center">
              <div className="w-16 h-16 border-2 border-white flex items-center justify-center relative">
                <div className="absolute inset-0 border-2 border-white" style={{ transform: 'rotate(45deg)' }}></div>
                <div className="text-2xl font-black relative z-10">$</div>
              </div>
            </div>
            <div className="text-sm font-bold mb-2">CLAIM YOUR TOKENS</div>
            {expirationTime && getTimeUntilExpiration() && getTimeUntilExpiration() !== 'EXPIRED' && (
              <div className="text-xs text-gray-500 mb-2">
                EXPIRES IN {getTimeUntilExpiration()}
              </div>
            )}
            <div className="text-[10px] tracking-[0.2em] text-gray-500 mb-4">
              {!isInFarcaster 
                ? 'OPEN IN FARCASTER TO CLAIM' 
                : !hasClickedMiniapp 
                ? 'CLICK "OPEN MINI APP" FIRST TO CLAIM'
                : !isConnected 
                ? 'CONNECT WALLET TO CLAIM' 
                : 'CLAIM EXPIRES WHEN FEATURED PROJECT CHANGES'}
            </div>
            <button
              onClick={handleClaim}
              disabled={!isInFarcaster || !hasClickedMiniapp || !isConnected || claiming || isClaimTxConfirming || expired || claimed || !treasuryAddress}
              className={`w-full py-3 font-black text-sm tracking-[0.2em] transition-all ${
                isInFarcaster && hasClickedMiniapp && isConnected && !claiming && !isClaimTxConfirming && !expired && !claimed && treasuryAddress
                  ? 'bg-white text-black hover:bg-gray-200'
                  : 'bg-gray-600 text-gray-400 cursor-not-allowed'
              }`}
            >
              {claiming || isClaimTxConfirming 
                ? (isClaimTxConfirming ? 'WAITING FOR CONFIRMATION...' : 'PREPARING TRANSACTION...')
                : expired 
                ? 'EXPIRED' 
                : claimed 
                ? 'CLAIMED' 
                : !hasClickedMiniapp 
                ? 'OPEN MINI APP FIRST' 
                : !treasuryAddress
                ? 'LOADING...'
                : 'CLAIM NOW'}
            </button>
          </>
        )}
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
  const [isMiniappInstalled, setIsMiniappInstalled] = useState(false);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [categoryRankings, setCategoryRankings] = useState([]);
  const [rankingsLoading, setRankingsLoading] = useState(false);
  const [hasClickedMiniapp, setHasClickedMiniapp] = useState(false);
  const [ethPrice, setEthPrice] = useState(null);
  const [ethPriceLoading, setEthPriceLoading] = useState(true);
  
  // Fetch ETH price in main component so it's available everywhere
  useEffect(() => {
    const fetchEthPrice = async () => {
      try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
        if (response.ok) {
          const data = await response.json();
          if (data.ethereum?.usd) {
            setEthPrice(data.ethereum.usd);
          }
        }
      } catch (error) {
        console.error('Error fetching ETH price:', error);
        setEthPrice(2800); // Approximate fallback
      } finally {
        setEthPriceLoading(false);
      }
    };
    
    fetchEthPrice();
    // Refresh price every 30 seconds (only when tab is visible)
    let interval;
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (interval) clearInterval(interval);
      } else {
        fetchEthPrice(); // Fetch immediately when tab becomes visible
        interval = setInterval(fetchEthPrice, 30000);
      }
    };
    
    interval = setInterval(fetchEthPrice, 30000);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
  
  // Wagmi wallet connection
  const { isConnected, address } = useAccount()
  const { connect, connectors } = useConnect()
  
  // Check if user has clicked miniapp (persist in localStorage with featured project validation)
  useEffect(() => {
    if (!featuredApp?.id) return;
    
    try {
      const storedData = localStorage.getItem('hasClickedMiniapp');
      if (storedData) {
        const parsed = JSON.parse(storedData);
        // Validate: must be for current featured project and within 24 hours
        const featuredAtTime = featuredApp.featuredAt ? new Date(featuredApp.featuredAt).getTime() : Date.now();
        const isValidProject = parsed.projectId === featuredApp.id;
        const isValidWindow = parsed.featuredAt === featuredAtTime || 
          (Date.now() - parsed.clickedAt < 24 * 60 * 60 * 1000); // Within 24 hours of click
        
        if (isValidProject && isValidWindow) {
          setHasClickedMiniapp(true);
        } else {
          // Clear stale data
          localStorage.removeItem('hasClickedMiniapp');
        }
      }
    } catch (e) {
      // Handle legacy sessionStorage or corrupted data
      const legacyClicked = sessionStorage.getItem('hasClickedMiniapp') === 'true';
      if (legacyClicked) {
        setHasClickedMiniapp(true);
      }
    }
  }, [featuredApp?.id, featuredApp?.featuredAt]);
  
  // Detect if we're in Farcaster context and check miniapp installation
  // Check every time the app opens
  useEffect(() => {
    const checkFarcasterContext = async () => {
      try {
        // Check if SDK is available and has context
        const context = await sdk.context;
        if (context?.user || context) {
          setIsInFarcaster(true);
          // The miniapp is considered "installed" if we can access the context
          // In Farcaster, if you're viewing the miniapp, it's installed
          setIsMiniappInstalled(true);
          setShowInstallPrompt(false); // Hide prompt if installed
        } else {
          // Also check user agent for Farcaster desktop
          const userAgent = navigator.userAgent.toLowerCase();
          if (userAgent.includes('farcaster') || userAgent.includes('warpcast')) {
            setIsInFarcaster(true);
            // If we're in Farcaster but can't access context, miniapp might not be installed
            // Try to check more explicitly
            try {
              // Try to call ready() - if it works, miniapp is likely installed
              await sdk.actions.ready();
              setIsMiniappInstalled(true);
              setShowInstallPrompt(false);
            } catch (readyError) {
              // If ready() fails, miniapp might not be installed
              setIsMiniappInstalled(false);
              setShowInstallPrompt(true); // Show prompt to add miniapp
            }
          } else {
            setIsInFarcaster(false);
            setIsMiniappInstalled(false);
            setShowInstallPrompt(false); // Don't show prompt outside Farcaster
          }
        }
      } catch (error) {
        // If SDK throws error, check user agent
        const userAgent = navigator.userAgent.toLowerCase();
        if (userAgent.includes('farcaster') || userAgent.includes('warpcast')) {
          setIsInFarcaster(true);
          // Try to check if miniapp is installed by attempting SDK actions
          try {
            await sdk.actions.ready();
            setIsMiniappInstalled(true);
            setShowInstallPrompt(false);
          } catch (readyError) {
            setIsMiniappInstalled(false);
            setShowInstallPrompt(true); // Show prompt to add miniapp
          }
        } else {
          setIsInFarcaster(false);
          setIsMiniappInstalled(false);
          setShowInstallPrompt(false);
        }
      }
    };
    
    checkFarcasterContext();
  }, []); // Run on every mount (app open)
  
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
                  neynarUserScore: profileData.neynarUserScore || null,
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
          // Store timestamp of most recent message (last in array) for polling
          if (data.messages && data.messages.length > 0) {
            const lastMessage = data.messages[data.messages.length - 1];
            setLastMessageTimestamp(lastMessage.timestamp || new Date().toISOString());
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
  
  // Poll for new messages every 3 seconds (only when tab is visible)
  useEffect(() => {
    if (!lastMessageTimestamp) return;
    
    const pollMessages = async () => {
      try {
        const response = await fetch(`/api/chat?since=${encodeURIComponent(lastMessageTimestamp)}`);
        if (response.ok) {
          const data = await response.json();
          if (data.messages && data.messages.length > 0) {
            // Add new messages to the end of the array (newest at bottom)
            setMessages(prev => {
              const existingIds = new Set(prev.map(m => m.id));
              const newMessages = data.messages.filter(m => !existingIds.has(m.id));
              if (newMessages.length > 0) {
                // Update timestamp to the newest message (last in array)
                const newestMessage = newMessages[newMessages.length - 1];
                setLastMessageTimestamp(newestMessage.timestamp || lastMessageTimestamp);
                return [...prev, ...newMessages];
              }
              return prev;
            });
          }
        }
      } catch (error) {
        console.error('Error polling for new messages:', error);
      }
    };
    
    let pollInterval;
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (pollInterval) clearInterval(pollInterval);
      } else {
        pollMessages(); // Poll immediately when tab becomes visible
        pollInterval = setInterval(pollMessages, 3000);
      }
    };
    
    pollInterval = setInterval(pollMessages, 3000);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearInterval(pollInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
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
      const messageUsername = userInfo?.username || null; // Store username separately for profile URLs
      const messageFid = userInfo?.fid || 0;
      const messageVerified = userInfo?.verified || false;
      
      // Send message to API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          msg,
          user: messageUser,
          username: messageUsername,
          fid: messageFid,
          verified: messageVerified,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        // Add the new message to the end of the array (newest at bottom)
        setMessages(prev => [...prev, data.message]);
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
          <div className="flex overflow-x-auto scrollbar-thin">
            {CATEGORIES.map(cat => {
              const IconComponent = cat.icon;
              return (
                <button
                  key={cat.id}
                  onClick={(e) => {
                    e.preventDefault();
                    try {
                      setCategory(cat.id);
                    } catch (error) {
                      console.error('Error switching category:', error);
                    }
                  }}
                  className={`px-6 py-3 text-xs font-bold tracking-[0.2em] transition-all border-r border-white last:border-r-0 whitespace-nowrap flex items-center gap-2 ${
                    category === cat.id 
                      ? 'bg-white text-black' 
                      : 'bg-black text-white hover:bg-white/10'
                  }`}
                >
                  <IconComponent />
                  {cat.label}
                </button>
              );
            })}
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
                <FeaturedApp 
                  app={featuredApp} 
                  onTip={handleTip} 
                  isInFarcaster={isInFarcaster}
                  isConnected={isConnected}
                  ethPrice={ethPrice}
                  ethPriceLoading={ethPriceLoading}
                  onMiniappClick={() => {
                    setHasClickedMiniapp(true);
                    // Store with project info for validation
                    const clickData = {
                      projectId: featuredApp?.id,
                      featuredAt: featuredApp?.featuredAt ? new Date(featuredApp.featuredAt).getTime() : Date.now(),
                      clickedAt: Date.now()
                    };
                    localStorage.setItem('hasClickedMiniapp', JSON.stringify(clickData));
                    // Also set sessionStorage for backward compatibility
                    sessionStorage.setItem('hasClickedMiniapp', 'true');
                  }}
                />
              ) : (
                <div className="border border-white p-6 text-center">
                  <div className="text-sm text-gray-500">NO FEATURED PROJECT</div>
                </div>
              )}
              <SubmitSection 
                onSubmit={() => setShowSubmitForm(true)} 
                isInFarcaster={isInFarcaster}
                isMiniappInstalled={isMiniappInstalled}
              />
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
              {/* Follow Reside Box */}
              <div className="border border-white p-4 text-center">
                <div className="text-sm font-black tracking-[0.2em] mb-2">FOLLOW RESIDE</div>
                <a
                  href="https://farcaster.xyz/ireside.eth"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={async (e) => {
                    if (isInFarcaster && sdk.actions?.openUrl) {
                      e.preventDefault();
                      try {
                        await sdk.actions.openUrl({ url: 'https://farcaster.xyz/ireside.eth' });
                      } catch (error) {
                        window.open('https://farcaster.xyz/ireside.eth', '_blank', 'noopener,noreferrer');
                      }
                    }
                  }}
                  className="text-[10px] tracking-[0.2em] text-gray-400 hover:text-white underline transition-colors"
                >
                  ireside.eth
                </a>
              </div>
              
              {/* Always show claim section - users can claim if they have wallet connected */}
              <DailyClaim 
                isInFarcaster={isInFarcaster} 
                userFid={userInfo?.fid || null}
                isConnected={isConnected}
                featuredApp={featuredApp}
                hasClickedMiniapp={hasClickedMiniapp}
                neynarUserScore={userInfo?.neynarUserScore || null}
              />
              
              {/* FAQ Section */}
              <FAQ />
            </div>
          </div>
        ) : (
          <CategoryRankings category={category} ethPrice={ethPrice} isInFarcaster={isInFarcaster} isConnected={isConnected} />
        )}
      </main>

      {/* Install Miniapp Prompt Modal */}
      {showInstallPrompt && isInFarcaster && !isMiniappInstalled && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div className="bg-black border-2 border-white max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-black tracking-tight">ADD THIS MINI APP</h3>
                <p className="text-[9px] tracking-[0.2em] text-gray-500 mt-1">
                  TO ACCESS ALL FEATURES
                </p>
              </div>
              <button
                onClick={() => setShowInstallPrompt(false)}
                className="text-white hover:text-gray-400 text-2xl"
              >
                ×
              </button>
            </div>
            
            <div className="mb-6">
              <p className="text-sm text-gray-300 mb-4">
                You need to add this miniapp to your Farcaster account to submit projects, claim tokens, and access all features.
              </p>
              <div className="border border-yellow-500/50 bg-yellow-500/10 p-4 mb-4">
                <p className="text-xs text-yellow-400 mb-2 font-bold">
                  HOW TO ADD:
                </p>
                <ol className="text-xs text-yellow-300 space-y-1 list-decimal list-inside">
                  <li>Look for the "Add" or "Install" button in your Farcaster app</li>
                  <li>Or tap the miniapp icon in the top right corner</li>
                  <li>Confirm to add it to your account</li>
                </ol>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowInstallPrompt(false)}
                className="flex-1 py-3 border border-white text-white font-bold text-sm tracking-[0.2em] hover:bg-white hover:text-black transition-all"
              >
                GOT IT
              </button>
              <button
                onClick={async () => {
                  // Try to open the miniapp URL to help with installation
                  const miniappUrl = 'https://farcaster.xyz/miniapps/EvK2rV9tUv3h/seen';
                  try {
                    if (sdk.actions?.openUrl) {
                      await sdk.actions.openUrl({ url: miniappUrl });
                    } else {
                      window.open(miniappUrl, '_blank', 'noopener,noreferrer');
                    }
                  } catch (error) {
                    window.open(miniappUrl, '_blank', 'noopener,noreferrer');
                  }
                  setShowInstallPrompt(false);
                }}
                className="flex-1 py-3 bg-white text-black font-black text-sm tracking-[0.2em] hover:bg-gray-200 transition-all"
              >
                OPEN MINI APP
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submit Form Modal */}
      {showSubmitForm && (
        <SubmitForm
          onClose={() => setShowSubmitForm(false)}
          onSubmit={handleSubmitSuccess}
          userFid={userInfo?.fid || null}
          isMiniappInstalled={isMiniappInstalled}
          neynarUserScore={userInfo?.neynarUserScore || null}
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
          animation: marquee 8s linear infinite;
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
        /* Thin scrollbar for category nav - visible for Windows users */
        .scrollbar-thin {
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 255, 255, 0.3) transparent;
        }
        .scrollbar-thin::-webkit-scrollbar {
          height: 6px;
        }
        .scrollbar-thin::-webkit-scrollbar-track {
          background: transparent;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.3);
          border-radius: 3px;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.5);
        }
      `}</style>
    </div>
  );
}
