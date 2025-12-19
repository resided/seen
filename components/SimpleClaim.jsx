// SIMPLE CLAIM COMPONENT
// One claim per FID per featured project
// Users sign their own transactions (counts for miniapp rankings)

import { useState, useEffect } from 'react';
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, stringToHex } from 'viem';

export default function SimpleClaim({ userFid, isInFarcaster = false, hasClickedMiniapp = false }) {
  const { address, isConnected } = useAccount();
  const { sendTransaction, data: txHash, error: txError } = useSendTransaction();
  const { isSuccess: isTxConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

  const [canClaim, setCanClaim] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [message, setMessage] = useState('');
  const [tokenAmount, setTokenAmount] = useState('40000');
  const [featuredName, setFeaturedName] = useState('');
  const [treasuryAddress, setTreasuryAddress] = useState(null);

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

  // Check claim status
  const checkStatus = async () => {
    if (!userFid) return;

    try {
      const res = await fetch(`/api/claim/simple-claim?fid=${userFid}&wallet=${address || ''}`);
      const data = await res.json();

      setCanClaim(data.canClaim);
      setClaimed(data.claimed);
      setTokenAmount(data.tokenAmount || '40000');
      setFeaturedName(data.featuredProjectName || '');
      setLoading(false);

      // Clear message if user can now claim
      if (data.canClaim) {
        setMessage('');
      }
    } catch (error) {
      console.error('Status check failed:', error);
      setLoading(false);
    }
  };

  // Check status on mount and every 5 seconds
  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, [userFid, address]);

  // Handle claim
  const handleClaim = async () => {
    if (!userFid || !address || !treasuryAddress || claiming || claimed) return;

    setClaiming(true);
    setMessage('SIGN TRANSACTION...');

    try {
      // Send 0 ETH transaction to treasury with "claim" data
      // This counts for miniapp rankings!
      sendTransaction({
        to: treasuryAddress,
        value: parseEther('0'),
        data: stringToHex('claim'),
      });
    } catch (error) {
      setMessage('ERROR: ' + error.message);
      setClaiming(false);
    }
  };

  // Handle transaction confirmation
  useEffect(() => {
    const processClaim = async () => {
      if (!isTxConfirmed || !txHash || !claiming) return;

      setMessage('SENDING TOKENS...');

      try {
        // Call backend to send actual tokens from treasury
        const res = await fetch('/api/claim/simple-claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fid: userFid,
            walletAddress: address,
            txHash: txHash, // Proof of user transaction
          }),
        });

        const data = await res.json();

        if (data.success) {
          setClaimed(true);
          setCanClaim(false);
          setMessage(`SUCCESS! ${tokenAmount} SEEN claimed!`);
        } else {
          setMessage(data.error || 'TOKEN TRANSFER FAILED');
          await checkStatus();
        }
      } catch (error) {
        setMessage('ERROR: ' + error.message);
        await checkStatus();
      } finally {
        setClaiming(false);
      }
    };

    processClaim();
  }, [isTxConfirmed, txHash, userFid, address, tokenAmount, claiming]);

  // Handle transaction error
  useEffect(() => {
    if (txError && claiming) {
      setMessage(txError.message?.includes('rejected') ? 'TRANSACTION CANCELLED' : 'TRANSACTION FAILED');
      setClaiming(false);
    }
  }, [txError, claiming]);

  // Determine button state
  const getButtonText = () => {
    if (loading) return 'LOADING...';
    if (claiming) return 'SENDING...';
    if (claimed) return 'ALREADY CLAIMED';
    if (!isInFarcaster) return 'OPEN IN FARCASTER';
    if (!isConnected) return 'CONNECT WALLET';
    if (!hasClickedMiniapp) return 'CLICK MINI APP FIRST';
    if (canClaim) return `CLAIM ${tokenAmount} SEEN`;
    return 'CANNOT CLAIM';
  };

  const isDisabled = loading || claiming || claimed || !isInFarcaster || !isConnected || !hasClickedMiniapp || !canClaim;

  return (
    <div className="border-2 border-white p-4 bg-black">
      {/* Header */}
      <div className="text-center mb-4">
        <div className="text-[10px] tracking-[0.3em] text-gray-400 mb-1">SIMPLE CLAIM</div>
        <div className="text-xl font-black">CLAIM YOUR TOKENS</div>
        {featuredName && (
          <div className="text-xs text-gray-400 mt-1">For: {featuredName}</div>
        )}
      </div>

      {/* Status Message */}
      {message && (
        <div className={`text-center p-2 mb-4 border ${
          message.includes('SUCCESS') ? 'border-green-500 text-green-400' : 
          message.includes('ERROR') || message.includes('FAILED') ? 'border-red-500 text-red-400' : 
          'border-white text-white'
        }`}>
          {message}
        </div>
      )}

      {/* Claim Info */}
      <div className="text-center mb-4 p-3 bg-black border-2 border-gray-600 animate-pulse-subtle">
        <div className="text-[10px] tracking-[0.2em] text-gray-500">YOU GET</div>
        <div className="text-2xl font-black text-white">{tokenAmount} $SEEN</div>
        <div className="text-xs text-gray-500 mt-1">One claim per person per featured project</div>
      </div>

      <style jsx>{`
        @keyframes pulse-subtle {
          0%, 100% {
            border-color: rgb(75, 85, 99);
            transform: scale(1);
          }
          50% {
            border-color: rgb(156, 163, 175);
            transform: scale(1.02);
          }
        }
        .animate-pulse-subtle {
          animation: pulse-subtle 3s ease-in-out infinite;
        }
      `}</style>

      {/* Claim Button */}
      <button
        onClick={handleClaim}
        disabled={isDisabled}
        className={`w-full py-4 font-black text-sm tracking-[0.2em] transition-all button-press ${
          isDisabled
            ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
            : 'bg-white text-black hover:bg-gray-200'
        } ${claiming ? 'animate-pulse' : ''}`}
      >
        {getButtonText()}
      </button>

      {/* Status */}
      <div className="mt-4 text-center text-xs text-gray-500">
        {claimed ? '✓ You have claimed for this featured project' : 
         canClaim ? '○ Ready to claim' : 
         loading ? '...' : '✗ Cannot claim'}
      </div>
    </div>
  );
}

