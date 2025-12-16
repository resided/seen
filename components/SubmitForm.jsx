import React, { useState, useEffect } from 'react';
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther } from 'viem';

const SubmitForm = ({ onClose, onSubmit, userFid, userUsername = null, userDisplayName = null, isMiniappInstalled = false, neynarUserScore = null }) => {
  const MIN_NEYNAR_SCORE = 0.62; // Minimum Neynar user score required to submit
  
  // Auto-fill builder name (prefer displayName, fallback to username)
  const autoFillBuilder = userDisplayName || (userUsername ? `@${userUsername}` : '');
  
  const [formData, setFormData] = useState({
    name: '',
    tagline: '',
    description: '',
    builder: autoFillBuilder,
    builderFid: userFid ? String(userFid) : '',
    tokenName: '',
    category: 'defi', // Default to defi for free queue (no main/featured category)
    miniapp: '',
    website: '',
    github: '',
    twitter: '',
    submissionType: 'queue', // 'queue' (free) or 'featured' (paid)
    plannedGoLiveDate: '', // Date when they plan to go live
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [paymentTxHash, setPaymentTxHash] = useState(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  
  const { isConnected, address } = useAccount();
  const { sendTransaction, data: txData } = useSendTransaction();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: paymentTxHash || txData,
  });
  
  // Featured submission pricing (configurable)
  const BASE_FEATURED_PRICE_USD = 111; // Base USD price
  const [ethPrice, setEthPrice] = useState(null);
  const [ethPriceLoading, setEthPriceLoading] = useState(true);
  // Treasury address should be fetched from API or environment
  const [treasuryAddress, setTreasuryAddress] = useState(null);
  
  // Holder benefits for discount (30M+ = 20% off)
  const [holderBenefits, setHolderBenefits] = useState(null);
  const isHolder = holderBenefits?.isHolder || false;
  
  // Calculate discounted price for 30M+ holders (20% off)
  const discountPercent = isHolder ? 20 : 0;
  const FEATURED_PRICE_USD = BASE_FEATURED_PRICE_USD * (1 - discountPercent / 100);
  
  // Calculate ETH amount from USD price
  const FEATURED_PRICE_ETH = ethPrice ? (FEATURED_PRICE_USD / ethPrice) : null;
  const FEATURED_PRICE_DISPLAY = isHolder 
    ? `$${FEATURED_PRICE_USD.toFixed(0)} (20% holder discount!)` 
    : `$${BASE_FEATURED_PRICE_USD}`;
  
  // Fetch ETH price
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
    // Refresh price every 30 seconds
    const interval = setInterval(fetchEthPrice, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch holder benefits for discount
  useEffect(() => {
    if (address) {
      fetch(`/api/holder-benefits?address=${address}`)
        .then(res => res.json())
        .then(data => {
          setHolderBenefits(data);
        })
        .catch(() => {
          setHolderBenefits(null);
        });
    } else {
      setHolderBenefits(null);
    }
  }, [address]);

  // Fetch treasury address from API
  useEffect(() => {
    if (formData.submissionType === 'featured') {
      fetch('/api/payment/treasury-address')
        .then(res => res.json())
        .then(data => {
          if (data.treasuryAddress) {
            setTreasuryAddress(data.treasuryAddress);
          }
        })
        .catch(() => {
          // Fallback - will show error if payment attempted
        });
    }
  }, [formData.submissionType]);

  // Auto-submit after payment confirmation
  useEffect(() => {
    const txHash = paymentTxHash || txData;
    if (formData.submissionType === 'featured' && txHash && isConfirmed && !submitting && !processingPayment) {
      // Payment confirmed, now submit the form
      const submitAfterPayment = async () => {
        setSubmitting(true);
        setMessage('PAYMENT CONFIRMED! SUBMITTING PROJECT...');
        
        try {
          const paymentAmount = FEATURED_PRICE_ETH;
          const response = await fetch('/api/submit', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              ...formData,
              submissionType: formData.submissionType,
              paymentAmount: paymentAmount,
              paymentTxHash: txHash,
              paymentTimestamp: new Date().toISOString(),
              submitterWalletAddress: address,
              links: {
                miniapp: formData.miniapp,
                website: formData.website,
                github: formData.github,
                twitter: formData.twitter || null,
              },
              submitterFid: userFid || null,
              plannedGoLiveDate: formData.plannedGoLiveDate || null,
            }),
          });

          const data = await response.json();

          if (response.ok) {
            setMessage(`SUBMITTED! PAYMENT RECEIVED. YOUR FEATURED SUBMISSION IS PENDING ADMIN APPROVAL. TX: ${txHash.slice(0, 10)}...`);
            setTimeout(() => {
              onSubmit?.();
              onClose();
            }, 4000);
          } else {
            setMessage(data.error || 'SUBMISSION FAILED');
          }
        } catch (error) {
          setMessage('ERROR SUBMITTING PROJECT');
        } finally {
          setSubmitting(false);
          setProcessingPayment(false);
        }
      };
      
      submitAfterPayment();
    }
  }, [isConfirmed, paymentTxHash, txData, formData.submissionType, submitting, processingPayment, address, userFid]);

  const handleChange = (e) => {
    const newFormData = {
      ...formData,
      [e.target.name]: e.target.value
    };
    
    // If switching submission types, reset category appropriately
    if (e.target.name === 'submissionType') {
      if (e.target.value === 'queue') {
        // Switching to queue - reset to defi (no featured/main category allowed)
        newFormData.category = 'defi';
      } else if (e.target.value === 'featured') {
        // Switching to featured - always set to featured category
        newFormData.category = 'featured';
      }
    }
    
    setFormData(newFormData);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');

    // Check if miniapp is installed (required)
    if (!isMiniappInstalled) {
      setMessage('ERROR: YOU MUST ADD THIS MINI APP TO YOUR FARCASTER ACCOUNT BEFORE SUBMITTING');
      setSubmitting(false);
      return;
    }

    // Require miniapp URL
    if (!formData.miniapp || !formData.miniapp.trim()) {
      setMessage('ERROR: MINI APP URL IS REQUIRED');
      setSubmitting(false);
      return;
    }

    // Calculate payment amount dynamically based on ETH price
    let paymentAmount = 0;
    if (formData.submissionType === 'featured') {
      if (!ethPrice || !FEATURED_PRICE_ETH) {
        setMessage('ERROR: ETH PRICE NOT LOADED. PLEASE WAIT AND TRY AGAIN.');
        setSubmitting(false);
        return;
      }
      paymentAmount = FEATURED_PRICE_ETH;
    }

    // If featured submission, collect payment first
    if (formData.submissionType === 'featured' && paymentAmount > 0) {
      if (!isConnected || !address) {
        setMessage('ERROR: CONNECT WALLET TO PAY FOR FEATURED SUBMISSION');
        setSubmitting(false);
        return;
      }

      if (!treasuryAddress) {
        setMessage('ERROR: TREASURY ADDRESS NOT CONFIGURED. PLEASE CONTACT ADMIN.');
        setSubmitting(false);
        return;
      }

      try {
        setProcessingPayment(true);
        setMessage('PROCESSING PAYMENT...');

        // Send payment transaction
        const hash = await sendTransaction({
          to: treasuryAddress,
          value: parseEther(paymentAmount.toFixed(6)),
        });

        // The hash will be available in txData from useSendTransaction
        // But we also set it in state for the useEffect
        if (hash) {
          setPaymentTxHash(hash);
        }
        setMessage('PAYMENT SENT! WAITING FOR CONFIRMATION...');
        
        // Wait for transaction confirmation
        // The useWaitForTransactionReceipt hook will handle this
        // We'll check isConfirmed in the next part
      } catch (error) {
        console.error('Payment error:', error);
        setMessage('PAYMENT FAILED. PLEASE TRY AGAIN.');
        setSubmitting(false);
        setProcessingPayment(false);
        return;
      }
    }

    // If payment was sent but not confirmed yet, wait
    if (formData.submissionType === 'featured' && paymentTxHash && !isConfirmed) {
      if (isConfirming) {
        setMessage('WAITING FOR PAYMENT CONFIRMATION...');
        setSubmitting(false);
        return; // Don't submit yet, wait for confirmation
      }
      // If transaction failed or was rejected
      setMessage('PAYMENT NOT CONFIRMED. PLEASE TRY AGAIN.');
      setSubmitting(false);
      setProcessingPayment(false);
      return;
    }

    // For queue submissions, submit immediately
    // For featured submissions, wait for payment confirmation (handled in useEffect)
    if (formData.submissionType === 'queue') {
      try {
        const response = await fetch('/api/submit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...formData,
            submissionType: formData.submissionType,
            paymentAmount: 0,
            paymentTxHash: null,
            paymentTimestamp: null,
            submitterWalletAddress: null,
            plannedGoLiveDate: formData.plannedGoLiveDate || null,
            links: {
              miniapp: formData.miniapp,
              website: formData.website,
              github: formData.github,
              twitter: formData.twitter || null,
            },
            submitterFid: userFid || null,
          }),
        });

        const data = await response.json();

        if (response.ok) {
          setMessage('SUBMITTED! YOUR PROJECT IS PENDING ADMIN APPROVAL AND WILL BE ADDED TO THE QUEUE IF APPROVED.');
          setTimeout(() => {
            onSubmit?.();
            onClose();
          }, 4000);
        } else {
          setMessage(data.error || 'SUBMISSION FAILED');
        }
      } catch (error) {
        setMessage('ERROR SUBMITTING PROJECT');
      } finally {
        setSubmitting(false);
        setProcessingPayment(false);
      }
    }
    // For featured submissions, payment confirmation will trigger submission via useEffect
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-black border-2 border-white max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="border-b border-white p-4 flex items-center justify-between">
          <h2 className="text-xl font-black tracking-tight">SUBMIT YOUR PROJECT</h2>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-400 text-2xl"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {neynarUserScore !== null && neynarUserScore < MIN_NEYNAR_SCORE && (
            <div className="p-4 border border-red-500 bg-red-900/20 text-red-400">
              <div className="text-sm font-bold mb-1">NEYNAR SCORE TOO LOW</div>
              <div className="text-xs">
                Your Neynar user score ({neynarUserScore.toFixed(2)}) is below the required threshold of {MIN_NEYNAR_SCORE}.
                Only users with a score of {MIN_NEYNAR_SCORE} or higher can submit projects.
              </div>
            </div>
          )}

          {message && (
            <div className={`p-4 border border-white ${message.includes('SUBMITTED') ? 'bg-white text-black' : 'bg-red-900 text-white'}`}>
              {message}
            </div>
          )}

          <div>
            <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
              PROJECT NAME *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black"
              placeholder="YOUR PROJECT NAME"
            />
          </div>

          <div>
            <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
              TOKEN NAME (OPTIONAL)
            </label>
            <input
              type="text"
              name="tokenName"
              value={formData.tokenName}
              onChange={handleChange}
              className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black"
              placeholder="$TOKEN"
            />
          </div>

          <div>
            <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
              TAGLINE *
            </label>
            <input
              type="text"
              name="tagline"
              value={formData.tagline}
              onChange={handleChange}
              required
              className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black"
              placeholder="SHORT TAGLINE"
            />
          </div>

          <div>
            <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
              DESCRIPTION *
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              required
              rows="4"
              className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black"
              placeholder="MAKE IT APPEALING AND EASILY READABLE. DESCRIBE YOUR PROJECT CLEARLY."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
                BUILDER NAME *
              </label>
              <input
                type="text"
                name="builder"
                value={formData.builder}
                onChange={handleChange}
                required
                className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black"
                placeholder="YOUR.ETH"
              />
            </div>
            <div>
              <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
                FID (OPTIONAL)
              </label>
              <input
                type="number"
                name="builderFid"
                value={formData.builderFid}
                onChange={handleChange}
                className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black"
                placeholder="12345"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
              SUBMISSION TYPE *
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 border border-white cursor-pointer hover:bg-white/10">
                <input
                  type="radio"
                  name="submissionType"
                  value="queue"
                  checked={formData.submissionType === 'queue'}
                  onChange={handleChange}
                  className="accent-white"
                />
                <div className="flex-1">
                  <div className="text-sm font-bold">FREE QUEUE</div>
                  <div className="text-[10px] text-gray-500">Added to queue, no payment required</div>
                </div>
              </label>
              <label className="flex items-center gap-3 p-3 border border-white cursor-pointer hover:bg-white/10">
                <input
                  type="radio"
                  name="submissionType"
                  value="featured"
                  checked={formData.submissionType === 'featured'}
                  onChange={handleChange}
                  className="accent-white"
                />
                <div className="flex-1">
                  <div className="text-sm font-bold">FEATURED SLOT</div>
                  <div className="text-[10px] text-gray-500">
                    {FEATURED_PRICE_DISPLAY} 
                    {ethPriceLoading ? ' (Loading...)' : FEATURED_PRICE_ETH ? ` (~${FEATURED_PRICE_ETH.toFixed(6)} ETH)` : ' (Price unavailable)'} - Payment required
                  </div>
                  {isHolder && (
                    <div className="text-[9px] text-green-400 mt-1 font-bold">
                      30M+ HOLDER: 20% OFF (was ${BASE_FEATURED_PRICE_USD})
                    </div>
                  )}
                  <div className="text-[9px] text-yellow-400 mt-1 font-bold">
                    ⚠ MUST CHOOSE FEATURED DROPDOWN MENU
                  </div>
                  {formData.submissionType === 'featured' && !isConnected && (
                    <div className="text-[9px] text-yellow-400 mt-1">⚠ CONNECT WALLET TO PAY</div>
                  )}
                </div>
              </label>
            </div>
            
            {/* Holder discount info */}
            <div className="mt-3 p-3 border border-white/30 bg-white/5">
              <div className="text-[10px] tracking-[0.2em] text-gray-400 mb-1">$SEEN HOLDER DISCOUNT</div>
              <div className="text-[9px] text-gray-500">
                Hold 30M+ $SEEN for 20% off featured pricing
              </div>
              {isHolder && (
                <div className="mt-1 text-[9px] text-green-400">
                  You qualify ({holderBenefits?.balance?.toLocaleString()} $SEEN)
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
              CATEGORY *
            </label>
            <select
              name="category"
              value={formData.category}
              onChange={handleChange}
              required
              className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black"
            >
              <option value="featured" disabled={formData.submissionType === 'queue'}>
                FEATURED
              </option>
              <option value="defi" disabled={formData.submissionType === 'featured'}>
                DEFI
              </option>
              <option value="social" disabled={formData.submissionType === 'featured'}>
                SOCIAL
              </option>
              <option value="games" disabled={formData.submissionType === 'featured'}>
                GAMES
              </option>
              <option value="tools" disabled={formData.submissionType === 'featured'}>
                TOOLS
              </option>
              <option value="nft" disabled={formData.submissionType === 'featured'}>
                NFT
              </option>
              <option value="tokens" disabled={formData.submissionType === 'featured'}>
                TOKENS
              </option>
            </select>
            {formData.submissionType === 'featured' && formData.category !== 'featured' && (
              <div className="text-[9px] text-red-400 mt-1">
                ⚠ MUST CHOOSE FEATURED FROM DROPDOWN MENU
              </div>
            )}
          </div>

          {formData.submissionType === 'featured' && (
            <div>
              <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
                PLANNED GO LIVE DATE (OPTIONAL)
              </label>
              <input
                type="date"
                name="plannedGoLiveDate"
                value={formData.plannedGoLiveDate}
                onChange={handleChange}
                min={new Date().toISOString().split('T')[0]}
                className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black"
              />
              <p className="text-[10px] text-gray-600 mt-1">
                When do you plan to launch? We'll try to accommodate, but slot may be booked. We'll reach out if we need a different date.
              </p>
            </div>
          )}

          {formData.submissionType === 'featured' && (
            <div className="p-4 border border-yellow-500/50 bg-yellow-500/10">
              <div className="text-xs font-bold text-yellow-400 mb-2">⚠ SLOT AVAILABILITY DISCLAIMER</div>
              <div className="text-[10px] text-yellow-300">
                Featured slots may be booked. We'll review your submission and reach out if we need to schedule a different date. Payment is required upfront and will be refunded if we cannot accommodate your requested date.
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
              MINI APP URL *
            </label>
            <input
              type="url"
              name="miniapp"
              value={formData.miniapp}
              onChange={handleChange}
              required
              className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black"
              placeholder="https://warpcast.com/~/mini-app/your-app"
            />
            <p className="text-[10px] text-gray-600 mt-1">Required to submit your project</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
                WEBSITE (OPTIONAL)
              </label>
              <input
                type="url"
                name="website"
                value={formData.website}
                onChange={handleChange}
                className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black"
                placeholder="https://yourproject.com"
              />
            </div>
            <div>
              <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
                GITHUB (OPTIONAL)
              </label>
              <input
                type="url"
                name="github"
                value={formData.github}
                onChange={handleChange}
                className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black"
                placeholder="https://github.com/yourproject"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
              TWITTER / X (OPTIONAL)
            </label>
            <input
              type="text"
              name="twitter"
              value={formData.twitter}
              onChange={handleChange}
              className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black"
              placeholder="@ireside (include @)"
            />
            <p className="text-[10px] text-gray-600 mt-1">Enter username with @ symbol (e.g., @ireside). A "Follow on X" button will appear on your featured project.</p>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="py-3 border border-white font-bold text-sm tracking-[0.2em] hover:bg-white hover:text-black transition-all"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={submitting || processingPayment || isConfirming || (neynarUserScore !== null && neynarUserScore < MIN_NEYNAR_SCORE) || (formData.submissionType === 'featured' && !isConnected) || (formData.submissionType === 'featured' && paymentTxHash && !isConfirmed) || (formData.submissionType === 'featured' && formData.category !== 'featured')}
              className="py-3 bg-white text-black font-black text-sm tracking-[0.2em] hover:bg-gray-200 transition-all disabled:opacity-50"
            >
              {isConfirming ? 'WAITING FOR CONFIRMATION...' : processingPayment ? 'PROCESSING PAYMENT...' : submitting ? 'SUBMITTING...' : (neynarUserScore !== null && neynarUserScore < MIN_NEYNAR_SCORE) ? 'SCORE TOO LOW' : (formData.submissionType === 'featured' && !isConnected) ? 'CONNECT WALLET' : (formData.submissionType === 'featured' && formData.category !== 'featured') ? 'MUST CHOOSE FEATURED' : formData.submissionType === 'featured' ? `SUBMIT & PAY ${FEATURED_PRICE_DISPLAY}` : 'SUBMIT'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SubmitForm;

