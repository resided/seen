// Feedback submission component
// Requires transaction signature to prevent spam
// Submissions stored in Redis and viewable in admin panel

import { useState, useEffect } from 'react';
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, stringToHex, keccak256 } from 'viem';

export default function FeedbackBox({ userFid, isInFarcaster = false }) {
  const { address, isConnected } = useAccount();
  const { sendTransaction, data: txHash, error: txError } = useSendTransaction();
  const { isSuccess: isTxConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

  const [isExpanded, setIsExpanded] = useState(false);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
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

  const handleSubmit = async () => {
    if (!userFid || !isInFarcaster || !isConnected || !address || !treasuryAddress) {
      setStatusMessage('ERROR: Connect wallet to submit feedback');
      return;
    }

    if (!message.trim()) {
      setStatusMessage('ERROR: Message cannot be empty');
      return;
    }

    if (message.length > 500) {
      setStatusMessage('ERROR: Message too long (max 500 characters)');
      return;
    }

    setSubmitting(true);
    setStatusMessage('SIGN TRANSACTION...');

    try {
      // Send 0 ETH transaction with readable feedback signature
      // This is just for metrics - nothing gets transferred!
      const readableData = `SEEN Feedback Submission - No transfer - Metrics only - Message: ${message.trim().substring(0, 50)}...`;
      sendTransaction({
        to: treasuryAddress,
        value: parseEther('0'),
        data: stringToHex(readableData),
      });
    } catch (error) {
      setStatusMessage('ERROR: ' + error.message);
      setSubmitting(false);
    }
  };

  // Handle transaction confirmation
  useEffect(() => {
    const processSubmission = async () => {
      if (!isTxConfirmed || !txHash || !submitting) return;

      setStatusMessage('SUBMITTING FEEDBACK...');

      try {
        const res = await fetch('/api/submit-feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fid: userFid,
            walletAddress: address,
            message: message.trim(),
            txHash: txHash, // Proof of transaction
          }),
        });

        const data = await res.json();

        if (data.success) {
          setStatusMessage('SUCCESS! Feedback submitted');
          setMessage('');
          setTimeout(() => {
            setIsExpanded(false);
            setStatusMessage('');
          }, 2000);
        } else {
          setStatusMessage(data.error || 'SUBMISSION FAILED');
        }
      } catch (error) {
        setStatusMessage('ERROR: ' + error.message);
      } finally {
        setSubmitting(false);
      }
    };

    processSubmission();
  }, [isTxConfirmed, txHash, userFid, address, message, submitting]);

  // Handle transaction error
  useEffect(() => {
    if (txError && submitting) {
      setStatusMessage(txError.message?.includes('rejected') ? 'TRANSACTION CANCELLED' : 'TRANSACTION FAILED');
      setSubmitting(false);
    }
  }, [txError, submitting]);

  return (
    <div className="w-full max-w-2xl mx-auto mb-6">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-3 border-2 border-white bg-black hover:bg-white/5 transition-all"
      >
        <div className="flex items-center justify-center gap-2">
          <span className="text-sm font-black tracking-wider">
            {isExpanded ? '▼' : '▶'} SEND FEEDBACK
          </span>
        </div>
      </button>

      {isExpanded && (
        <div className="border-2 border-t-0 border-white p-4 bg-black">
          {/* Instructions */}
          <div className="text-xs text-gray-400 mb-3 text-center">
            Share your thoughts, report bugs, or suggest features
          </div>

          {/* Text area */}
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your feedback here..."
            disabled={submitting || !isInFarcaster}
            maxLength={500}
            rows={4}
            className="w-full p-3 bg-black border border-white text-white font-mono text-sm resize-none focus:outline-none focus:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
          />

          {/* Character count */}
          <div className="text-xs text-gray-500 text-right mt-1 mb-3">
            {message.length}/500
          </div>

          {/* Status message */}
          {statusMessage && (
            <div className={`text-center p-2 mb-3 border ${
              statusMessage.includes('SUCCESS') ? 'border-green-500 text-green-400' :
              statusMessage.includes('ERROR') || statusMessage.includes('FAILED') ? 'border-red-500 text-red-400' :
              'border-white text-white'
            }`}>
              {statusMessage}
            </div>
          )}

          {/* Submit button */}
          <button
            onClick={handleSubmit}
            disabled={submitting || !isInFarcaster || !isConnected || !message.trim()}
            className="w-full p-3 border-2 border-white bg-black hover:bg-white hover:text-black transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-black disabled:hover:text-white font-black tracking-wider"
          >
            {submitting ? 'SUBMITTING...' :
             !isInFarcaster ? 'OPEN IN FARCASTER' :
             !isConnected ? 'CONNECT WALLET' :
             'SUBMIT FEEDBACK'}
          </button>

          {/* Privacy note */}
          <div className="text-[10px] text-gray-600 text-center mt-2">
            Requires transaction signature to prevent spam
          </div>
        </div>
      )}
    </div>
  );
}
