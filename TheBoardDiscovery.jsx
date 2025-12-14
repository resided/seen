import React, { useState, useEffect, useRef } from 'react';
import { useAccount, useConnect, useSendTransaction } from 'wagmi';
import { parseEther } from 'viem';
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
const FeaturedApp = ({ app, onTip, isInFarcaster = false, isConnected = false }) => {
  const [countdown, setCountdown] = useState({ h: 8, m: 42, s: 17 });
  const [creatorProfileUrl, setCreatorProfileUrl] = useState(null);
  const [builderData, setBuilderData] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [liveStats, setLiveStats] = useState({ views: 0, clicks: 0, tips: 0 });
  const [tipAmount, setTipAmount] = useState('0.001'); // Default tip amount in ETH
  const [tipping, setTipping] = useState(false);
  const [tipMessage, setTipMessage] = useState('');
  const [showTipModal, setShowTipModal] = useState(false);
  const [customTipAmount, setCustomTipAmount] = useState('0.001'); // Stored as ETH internally
  const [customTipAmountUsd, setCustomTipAmountUsd] = useState(''); // Display value in USD
  const [ethPrice, setEthPrice] = useState(null);
  const [ethPriceLoading, setEthPriceLoading] = useState(true);
  
  const { sendTransaction } = useSendTransaction();

  // Fetch live ETH price
  useEffect(() => {
    const fetchEthPrice = async () => {
      try {
        // Using CoinGecko API (free, no API key needed)
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
        const data = await response.json();
        if (data.ethereum?.usd) {
          setEthPrice(data.ethereum.usd);
        }
      } catch (error) {
        console.error('Error fetching ETH price:', error);
        // Fallback to a default price if API fails
        setEthPrice(2800); // Approximate fallback
      } finally {
        setEthPriceLoading(false);
      }
    };

    fetchEthPrice();
    // Refresh price every 30 seconds
    const interval = setInterval(fetchEthPrice, 30000);
    return () => clearInterval(interval);
  }, []);

  // Sync USD amount when ETH price loads or modal opens
  useEffect(() => {
    if (showTipModal && ethPrice && !customTipAmountUsd && customTipAmount) {
      const usdValue = (parseFloat(customTipAmount) * ethPrice).toFixed(2);
      setCustomTipAmountUsd(usdValue);
    }
  }, [showTipModal, ethPrice, customTipAmount, customTipAmountUsd]);
  
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

  // Track view when component mounts
  useEffect(() => {
    if (app?.id) {
      // Track view
      fetch('/api/track-click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: app.id, type: 'view' }),
      }).catch(() => {}); // Fail silently

      // Fetch today's stats
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
    }
  }, [app?.id]);

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
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div>
            <div className="text-3xl font-black">{formatNumber(liveStats.views || app.stats?.views || 0)}</div>
            <div className="text-[9px] tracking-[0.3em] text-gray-500 mt-1">VIEWS</div>
          </div>
          <div>
            <div className="text-3xl font-black">{formatNumber(liveStats.clicks || app.stats?.clicks || 0)}</div>
            <div className="text-[9px] tracking-[0.3em] text-gray-500 mt-1">CLICKS</div>
          </div>
          <div>
            <div className="text-3xl font-black">{liveStats.tips || app.stats?.tips || 0}Ξ</div>
            <div className="text-[9px] tracking-[0.3em] text-gray-500 mt-1">TIPPED TODAY</div>
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
              if (!isInFarcaster || !isConnected) {
                setTipMessage('CONNECT WALLET TO TIP');
                setTimeout(() => setTipMessage(''), 3000);
                return;
              }

              // Ensure builder has a verified primary Farcaster wallet
              if (!builderData?.walletAddress || !builderData?.verified) {
                setTipMessage('PRIMARY VERIFIED FARCASTER WALLET NOT FOUND');
                setTimeout(() => setTipMessage(''), 3000);
                return;
              }

              // Show tip modal and initialize USD amount
              setShowTipModal(true);
              if (ethPrice) {
                const initialUsd = (parseFloat(customTipAmount) * ethPrice).toFixed(2);
                setCustomTipAmountUsd(initialUsd);
              }
            }}
            disabled={!isInFarcaster || !isConnected || !builderData?.walletAddress || !builderData?.verified}
            className={`bg-black py-4 font-bold text-sm tracking-[0.2em] transition-all ${
              isInFarcaster && isConnected && builderData?.walletAddress && builderData?.verified
                ? 'hover:bg-white hover:text-black' 
                : 'opacity-50 cursor-not-allowed'
            }`}
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
                  setCustomTipAmount('0.001');
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
                  min="0.01"
                  value={customTipAmountUsd}
                  onChange={(e) => {
                    const usdValue = e.target.value;
                    setCustomTipAmountUsd(usdValue);
                    
                    // Convert USD to ETH for storage (this is what gets sent)
                    if (usdValue === '') {
                      setCustomTipAmount('0.001'); // Reset to minimum
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
                  Minimum: ${ethPrice ? (0.001 * ethPrice).toFixed(2) : '2.80'} (~0.001 ETH)
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
                    {builderData.verified && (
                      <div className="text-[9px] tracking-[0.2em] text-green-400">
                        ✓ VERIFIED FARCASTER WALLET
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-[10px] text-red-400">
                    NO VERIFIED WALLET FOUND
                  </div>
                )}
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => {
                    setShowTipModal(false);
                    setCustomTipAmount('0.001');
                    setTipMessage('');
                  }}
                  className="flex-1 py-3 border border-white font-bold text-sm tracking-[0.2em] hover:bg-white hover:text-black transition-all"
                >
                  CANCEL
                </button>
                <button
                  onClick={async () => {
                    const amount = parseFloat(customTipAmount);
                    const minEth = 0.001;
                    const minUsd = ethPrice ? (minEth * ethPrice).toFixed(2) : '2.80';
                    
                    if (!amount || amount < minEth) {
                      setTipMessage(`MINIMUM TIP IS $${minUsd} (~0.001 ETH)`);
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
                    setTipMessage('');

                    try {
                      // Send transaction
                      await sendTransaction({
                        to: recipientAddress,
                        value: parseEther(customTipAmount),
                      });

                      // Track tip in stats
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
                      } catch (error) {
                        console.error('Error tracking tip:', error);
                      }

                      const usdAmount = ethPrice ? (parseFloat(customTipAmount) * ethPrice).toFixed(2) : null;
                      setTipMessage(`TIP SENT! ${parseFloat(customTipAmount).toFixed(6)} ETH${usdAmount ? ` ($${usdAmount})` : ''}`);
                      setTimeout(() => {
                        setShowTipModal(false);
                        setCustomTipAmount('0.001');
                        setCustomTipAmountUsd('');
                        setTipMessage('');
                      }, 3000);
                    } catch (error) {
                      console.error('Error sending tip:', error);
                      setTipMessage('TIP FAILED. PLEASE TRY AGAIN.');
                    } finally {
                      setTipping(false);
                    }
                  }}
                  disabled={tipping || !customTipAmount || parseFloat(customTipAmount) < 0.001}
                  className="flex-1 py-3 bg-white text-black font-black text-sm tracking-[0.2em] hover:bg-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {tipping ? 'SENDING...' : ethPrice ? `SEND $${(parseFloat(customTipAmount) * ethPrice).toFixed(2)}` : `SEND ${parseFloat(customTipAmount).toFixed(6)} ETH`}
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
// CATEGORY RANKINGS
// ============================================
const CategoryRankings = ({ category }) => {
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRankings = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/projects/rankings?category=${category}&limit=10`);
        const data = await response.json();
        if (data.rankings) {
          setRankings(data.rankings);
        }
      } catch (error) {
        console.error('Error fetching rankings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRankings();
    // Refresh rankings every 30 seconds
    const interval = setInterval(fetchRankings, 30000);
    return () => clearInterval(interval);
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
        <div className="text-6xl mb-4">📊</div>
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
        {rankings.map((project, index) => {
          const previousRank = project.previousRank;
          const rankChange = previousRank ? previousRank - project.rank : null;
          
          return (
            <div
              key={project.id}
              className="border border-white p-4 hover:bg-white/5 transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 min-w-[80px]">
                  <div className="text-2xl font-black w-8 text-center">
                    #{project.rank}
                  </div>
                  {rankChange !== null && (
                    <div className={`text-xs ${
                      rankChange > 0 ? 'text-green-400' : 
                      rankChange < 0 ? 'text-red-400' : 
                      'text-gray-500'
                    }`}>
                      {rankChange > 0 ? '↑' : rankChange < 0 ? '↓' : '—'}
                      {rankChange !== 0 && Math.abs(rankChange)}
                    </div>
                  )}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-lg font-black">{project.name}</h3>
                    <span className="text-[9px] tracking-[0.2em] px-2 py-0.5 bg-white text-black font-bold">
                      {project.category?.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500 mb-2">{project.tagline}</p>
                  <div className="flex items-center gap-4 text-[9px] tracking-[0.2em] text-gray-600">
                    <span>👁 {formatNumber(project.todayViews || project.stats?.views || 0)}</span>
                    <span>👆 {formatNumber(project.todayClicks || project.stats?.clicks || 0)}</span>
                    <span>💰 {project.stats?.tips || 0}Ξ</span>
                  </div>
                </div>
                
                {project.links?.miniapp && (
                  <button
                    onClick={() => window.open(project.links.miniapp, '_blank', 'noopener,noreferrer')}
                    className="px-4 py-2 border border-white text-[10px] tracking-[0.2em] hover:bg-white hover:text-black transition-all"
                  >
                    OPEN
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================
// DAILY CLAIM
// ============================================
const DailyClaim = ({ isInFarcaster = false, userFid = null, isConnected = false }) => {
  const [claimed, setClaimed] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [message, setMessage] = useState('');
  const [nextClaimTime, setNextClaimTime] = useState(null);

  useEffect(() => {
    // Check if user has claimed today
    if (userFid) {
      fetch('/api/claim/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fid: userFid }),
      })
        .then(res => res.json())
        .then(data => {
          if (data.claimed) {
            setClaimed(true);
            if (data.nextClaimTime) {
              setNextClaimTime(new Date(data.nextClaimTime));
            }
          }
        })
        .catch(() => {});
    }
  }, [userFid]);

  const handleClaim = async () => {
    if (!isInFarcaster || !isConnected || !userFid) {
      setMessage('CONNECT WALLET TO CLAIM');
      return;
    }

    if (claimed) {
      setMessage('ALREADY CLAIMED TODAY');
      return;
    }

    setClaiming(true);
    setMessage('');

    try {
      const response = await fetch('/api/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fid: userFid }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setClaimed(true);
        setMessage('CLAIMED! TOKENS SENT TO YOUR WALLET');
        if (data.nextClaimTime) {
          setNextClaimTime(new Date(data.nextClaimTime));
        }
      } else {
        setMessage(data.error || 'CLAIM FAILED');
      }
    } catch (error) {
      setMessage('ERROR CLAIMING TOKENS');
    } finally {
      setClaiming(false);
    }
  };

  const getTimeUntilNextClaim = () => {
    if (!nextClaimTime) return null;
    const now = new Date();
    const diff = nextClaimTime - now;
    if (diff <= 0) return null;
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="border border-white">
      <div className="border-b border-white p-3">
        <span className="text-[10px] tracking-[0.3em]">DAILY CLAIM</span>
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
        
        {claimed ? (
          <>
            <div className="text-4xl mb-2">✓</div>
            <div className="text-sm font-bold mb-2">CLAIMED TODAY</div>
            {nextClaimTime && getTimeUntilNextClaim() && (
              <div className="text-[10px] tracking-[0.2em] text-gray-500">
                NEXT CLAIM IN {getTimeUntilNextClaim()}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-center">
              <div className="w-16 h-16 border-2 border-white flex items-center justify-center relative">
                <div className="absolute inset-0 border-2 border-white" style={{ transform: 'rotate(45deg)' }}></div>
                <div className="text-2xl font-black relative z-10">$</div>
              </div>
            </div>
            <div className="text-sm font-bold mb-2">CLAIM YOUR DAILY TOKENS</div>
            <div className="text-[10px] tracking-[0.2em] text-gray-500 mb-4">
              CONNECT WALLET TO CLAIM
            </div>
            <button
              onClick={handleClaim}
              disabled={!isInFarcaster || !isConnected || claiming}
              className={`w-full py-3 font-black text-sm tracking-[0.2em] transition-all ${
                isInFarcaster && isConnected && !claiming
                  ? 'bg-white text-black hover:bg-gray-200'
                  : 'bg-gray-600 text-gray-400 cursor-not-allowed'
              }`}
            >
              {claiming ? 'CLAIMING...' : 'CLAIM NOW'}
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
  const [categoryRankings, setCategoryRankings] = useState([]);
  const [rankingsLoading, setRankingsLoading] = useState(false);
  
  // Wagmi wallet connection
  const { isConnected, address } = useAccount()
  const { connect, connectors } = useConnect()
  
  // Detect if we're in Farcaster context and check miniapp installation
  useEffect(() => {
    const checkFarcasterContext = async () => {
      try {
        // Check if SDK is available and has context
        const context = await sdk.context;
        if (context?.user || context) {
          setIsInFarcaster(true);
          // Check if miniapp is installed
          // The miniapp is considered "installed" if we can access the context
          // In Farcaster, if you're viewing the miniapp, it's installed
          setIsMiniappInstalled(true);
        } else {
          // Also check user agent for Farcaster desktop
          const userAgent = navigator.userAgent.toLowerCase();
          if (userAgent.includes('farcaster') || userAgent.includes('warpcast')) {
            setIsInFarcaster(true);
            setIsMiniappInstalled(true);
          } else {
            setIsInFarcaster(false);
            setIsMiniappInstalled(false);
          }
        }
      } catch (error) {
        // If SDK throws error, we're likely not in Farcaster
        const userAgent = navigator.userAgent.toLowerCase();
        if (userAgent.includes('farcaster') || userAgent.includes('warpcast')) {
          setIsInFarcaster(true);
          setIsMiniappInstalled(true);
        } else {
          setIsInFarcaster(false);
          setIsMiniappInstalled(false);
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
                <FeaturedApp 
                  app={featuredApp} 
                  onTip={handleTip} 
                  isInFarcaster={isInFarcaster}
                  isConnected={isConnected}
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
              <DailyClaim 
                isInFarcaster={isInFarcaster} 
                userFid={userInfo?.fid || null}
                isConnected={isConnected}
              />
            </div>
          </div>
        ) : (
          <CategoryRankings category={category} />
        )}
      </main>

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
