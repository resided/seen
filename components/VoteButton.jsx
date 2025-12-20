// Community Voting Button Component
// Allows users to vote for queue projects by burning 100K $SEEN tokens

import React, { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';

const VOTE_COST = '100000'; // 100K $SEEN per vote
const SEEN_TOKEN_ADDRESS = '0x82a56d595ccdfa3a1dc6eef28d5f0a870f162b07';
const TREASURY_ADDRESS = '0x32b907f125c4b929d5d9565fa24bc6bf9af39fbb';
const ERC20_ABI = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }]
  }
];

const VoteButton = ({ project, userFid, onVoteSuccess }) => {
  const { address, isConnected } = useAccount();
  const [showModal, setShowModal] = useState(false);
  const [voting, setVoting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const { writeContract, data: txHash } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Handle transaction confirmation
  React.useEffect(() => {
    console.log('[VOTE] useEffect triggered:', { isConfirmed, txHash, voting });
    if (isConfirmed && txHash && voting) {
      console.log('[VOTE] Calling submitVote with hash:', txHash);
      submitVote(txHash);
    }
  }, [isConfirmed, txHash, voting]);

  const handleVoteClick = () => {
    if (!isConnected) {
      setError('Please connect your wallet to vote');
      return;
    }

    if (!userFid) {
      setError('Farcaster account required to vote');
      return;
    }

    setShowModal(true);
    setError('');
    setMessage('');
  };

  const executeVote = async () => {
    try {
      setVoting(true);
      setMessage('Approve transaction in wallet...');
      setError('');

      const amount = parseUnits(VOTE_COST, 18);

      await writeContract({
        address: SEEN_TOKEN_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [TREASURY_ADDRESS, amount],
      });

      setMessage('Waiting for transaction confirmation...');
    } catch (err) {
      console.error('Vote transaction failed:', err);
      setError(err.message || 'Transaction failed');
      setVoting(false);
    }
  };

  const submitVote = async (transactionHash) => {
    try {
      console.log('[VOTE] submitVote called with hash:', transactionHash);
      setMessage('Recording vote...');

      const response = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          fid: userFid,
          walletAddress: address,
          txHash: transactionHash,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('[VOTE] API Error:', data);
        throw new Error(data.error || 'Failed to record vote');
      }

      console.log('[VOTE] Vote recorded successfully:', data);
      setMessage(`Vote recorded! ${VOTE_COST} $SEEN sent to treasury`);
      setVoting(false);

      // Close modal after 2 seconds
      setTimeout(() => {
        setShowModal(false);
        if (onVoteSuccess) {
          onVoteSuccess(data.project);
        }
      }, 2000);

    } catch (err) {
      console.error('Vote submission failed:', err);
      setError(err.message || 'Failed to record vote');
      setVoting(false);
    }
  };

  const closeModal = () => {
    if (!voting) {
      setShowModal(false);
      setMessage('');
      setError('');
    }
  };

  return (
    <>
      <button
        onClick={handleVoteClick}
        className="w-full px-6 py-3 md:px-3 md:py-2 bg-white text-black font-black text-sm md:text-[9px] tracking-[0.2em] hover:bg-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={!isConnected || !userFid}
      >
        VOTE
      </button>

      {/* Vote Confirmation Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4" onClick={closeModal}>
          <div className="bg-black border-2 border-white max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-black tracking-tight">VOTE FOR FEATURED</h3>
                <p className="text-[9px] tracking-[0.2em] text-gray-500 mt-1">
                  SEND 100K $SEEN TO TREASURY
                </p>
              </div>
              {!voting && (
                <button
                  onClick={closeModal}
                  className="text-white hover:text-gray-400 text-2xl"
                >
                  ×
                </button>
              )}
            </div>

            <div className="mb-6">
              <div className="border border-white p-4 mb-4">
                <div className="text-sm font-bold mb-2">{project.name}</div>
                <div className="text-xs text-gray-400">{project.tagline}</div>
                {project.votes !== undefined && (
                  <div className="text-xs text-gray-500 mt-2">
                    Current votes: {project.votes.toLocaleString()}
                  </div>
                )}
              </div>

              <div className="border border-yellow-500/50 bg-yellow-500/10 p-4 mb-4">
                <div className="text-sm font-bold text-yellow-400 mb-2">⚠️ IMPORTANT</div>
                <ul className="text-xs text-yellow-300 space-y-1 list-disc list-inside">
                  <li>100,000 $SEEN will be sent to treasury</li>
                  <li>This action cannot be undone</li>
                  <li>Vote helps this project get featured</li>
                </ul>
              </div>

              {message && (
                <div className="p-3 border border-green-500 bg-green-500/20 text-green-400 text-xs mb-4">
                  {message}
                </div>
              )}

              {error && (
                <div className="p-3 border border-red-500 bg-red-500/20 text-red-400 text-xs mb-4">
                  {error}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={closeModal}
                disabled={voting}
                className="flex-1 py-3 border border-white text-white font-black text-sm tracking-[0.2em] hover:bg-white/10 transition-all disabled:opacity-50"
              >
                CANCEL
              </button>
              <button
                onClick={executeVote}
                disabled={voting || isConfirming}
                className="flex-1 py-3 bg-white text-black font-black text-sm tracking-[0.2em] hover:bg-gray-200 transition-all disabled:opacity-50"
              >
                {voting || isConfirming ? 'PROCESSING...' : 'SEND & VOTE'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default VoteButton;
