// Feature Wars Game Component
import React, { useState, useEffect } from 'react';
import { ArrowLeftIcon, TrophyIcon } from '@heroicons/react/24/outline';
import { useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { erc20Abi, parseUnits, encodeFunctionData } from 'viem';

// $SEEN token on Base
const SEEN_TOKEN_ADDRESS = '0xA29Cf6c8cD61FFE04108CaBd0Ab2A3310Bb44801';
// Bet amount (100K $SEEN)
const BET_AMOUNT = '100000';

const FeatureWarsGame = ({ onBack, userFid, isConnected }) => {
  const [currentBattle, setCurrentBattle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [myBets, setMyBets] = useState([]);
  const [showBetModal, setShowBetModal] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [betStatus, setBetStatus] = useState('');
  const [treasuryAddress, setTreasuryAddress] = useState(null);

  // Wagmi hooks for sending transactions
  const { sendTransaction, data: txData } = useSendTransaction();
  const { isLoading: isTxPending, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({
    hash: txData,
  });

  useEffect(() => {
    fetchCurrentBattle();
    if (userFid) {
      fetchMyBets();
    }
    // Fetch treasury address
    fetch('/api/payment/treasury-address')
      .then(res => res.json())
      .then(data => {
        if (data.treasuryAddress) {
          setTreasuryAddress(data.treasuryAddress);
        }
      })
      .catch(() => {});
  }, [userFid]);

  const fetchCurrentBattle = async () => {
    try {
      const response = await fetch('/api/game/current-battle');
      const data = await response.json();
      if (response.ok) {
        setCurrentBattle(data.battle);
      }
    } catch (error) {
      console.error('Error fetching battle:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyBets = async () => {
    try {
      const response = await fetch(`/api/game/my-bets?fid=${userFid}`);
      const data = await response.json();
      if (response.ok) {
        setMyBets(data.bets || []);
      }
    } catch (error) {
      console.error('Error fetching bets:', error);
    }
  };

  // Handle bet button click
  const handleBetClick = (team) => {
    if (!isConnected || !userFid) {
      setBetStatus('Please connect wallet to place bets');
      return;
    }

    setSelectedTeam(team);
    setShowBetModal(true);
    setBetStatus('');
  };

  // Execute bet transaction
  const executeBet = async () => {
    if (!treasuryAddress) {
      setBetStatus('Loading treasury address...');
      return;
    }

    try {
      setBetStatus('Preparing transaction...');

      const amount = parseUnits(BET_AMOUNT, 18);
      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [treasuryAddress, amount],
      });

      sendTransaction({
        to: SEEN_TOKEN_ADDRESS,
        data,
      });

      setBetStatus('Confirm transaction in wallet...');
    } catch (error) {
      console.error('Error executing bet:', error);
      setBetStatus(`Error: ${error.message}`);
    }
  };

  // Handle successful transaction
  useEffect(() => {
    if (isTxSuccess && txData && selectedTeam && currentBattle) {
      const recordBet = async () => {
        try {
          setBetStatus('Recording bet...');

          const response = await fetch('/api/game/place-bet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              battleId: currentBattle.id,
              userFid,
              team: selectedTeam,
              txHash: txData,
            }),
          });

          const data = await response.json();

          if (response.ok) {
            setBetStatus('Bet placed successfully!');

            // Refresh data
            fetchCurrentBattle();
            fetchMyBets();

            // Close modal after 2 seconds
            setTimeout(() => {
              setShowBetModal(false);
              setSelectedTeam(null);
              setBetStatus('');
            }, 2000);
          } else {
            setBetStatus(`Error: ${data.error}`);
          }
        } catch (error) {
          console.error('Error recording bet:', error);
          setBetStatus(`Error: ${error.message}`);
        }
      };

      recordBet();
    }
  }, [isTxSuccess, txData, selectedTeam, currentBattle, userFid]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-sm tracking-[0.2em] text-gray-500">LOADING BATTLE...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-white">
        <div className="max-w-4xl mx-auto p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-sm tracking-[0.2em] hover:text-gray-400 transition-all"
            >
              <ArrowLeftIcon className="w-4 h-4" />
              BACK
            </button>
            <TrophyIcon className="w-6 h-6" />
          </div>

          <h1 className="text-4xl md:text-6xl font-black tracking-tight">
            FEATURE WARS
          </h1>
          <p className="text-[10px] tracking-[0.3em] text-gray-500 mt-2">
            BET ON PROJECTS • HIGHEST ENGAGEMENT WINS
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
        {!currentBattle ? (
          <NoBattleState />
        ) : (
          <>
            <CurrentBattle
              battle={currentBattle}
              userFid={userFid}
              isConnected={isConnected}
              onBet={handleBetClick}
            />
            {myBets.length > 0 && <MyBets bets={myBets} />}
            <HowToPlay />
          </>
        )}
      </div>

      {/* Bet Confirmation Modal */}
      {showBetModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-black border-2 border-white max-w-md w-full">
            <div className="border-b border-white p-4 flex items-center justify-between">
              <h3 className="text-sm tracking-[0.2em] font-black">
                CONFIRM BET
              </h3>
              <button
                onClick={() => {
                  setShowBetModal(false);
                  setSelectedTeam(null);
                  setBetStatus('');
                }}
                className="text-white hover:text-gray-400 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-4">
              {betStatus && (
                <div className={`p-3 border text-center text-[10px] tracking-[0.2em] ${
                  betStatus.includes('Error') || betStatus.includes('Please')
                    ? 'border-red-500 text-red-400 bg-red-500/10'
                    : betStatus.includes('success')
                    ? 'border-green-500 text-green-400 bg-green-500/10'
                    : 'border-yellow-500 text-yellow-400 bg-yellow-500/10'
                }`}>
                  {betStatus}
                </div>
              )}

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Betting on:</span>
                  <span className="font-bold">PROJECT {selectedTeam}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Amount:</span>
                  <span className="font-mono font-bold">{BET_AMOUNT} $SEEN</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Project:</span>
                  <span className="font-bold">
                    {selectedTeam === 'A' ? currentBattle?.projectA.name : currentBattle?.projectB.name}
                  </span>
                </div>
              </div>

              <div className="border border-yellow-500 bg-yellow-500/10 p-3">
                <p className="text-[10px] tracking-[0.2em] text-yellow-400">
                  {BET_AMOUNT} $SEEN WILL BE SENT TO TREASURY
                </p>
              </div>

              <button
                onClick={executeBet}
                disabled={isTxPending || isTxSuccess}
                className="w-full py-3 bg-white text-black font-black text-sm tracking-[0.2em] hover:bg-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isTxPending ? 'PROCESSING...' : 'CONFIRM BET'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const NoBattleState = () => (
  <div className="border border-white p-12 text-center">
    <h2 className="text-2xl font-black mb-4">NO ACTIVE BATTLE</h2>
    <p className="text-sm text-gray-400 mb-2">
      Check back soon or join /zankers channel
    </p>
  </div>
);

const CurrentBattle = ({ battle, userFid, isConnected, onBet }) => {
  const [timeRemaining, setTimeRemaining] = useState('');

  useEffect(() => {
    const updateTimer = () => {
      const end = new Date(battle.endTime);
      const now = new Date();
      const diff = end - now;

      if (diff <= 0) {
        setTimeRemaining('BATTLE ENDED');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeRemaining(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [battle.endTime]);

  const totalPool = parseFloat(battle.poolA || 0) + parseFloat(battle.poolB || 0);
  const scoreA = battle.scoreA || 0;
  const scoreB = battle.scoreB || 0;
  const isAWinning = scoreA > scoreB;
  const isBWinning = scoreB > scoreA;

  return (
    <div className="border-2 border-white">
      {/* Battle Header */}
      <div className="border-b border-white p-4 bg-white text-black">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs tracking-[0.3em]">BATTLE #{battle.id}</div>
            <div className="font-mono text-2xl font-black">{timeRemaining}</div>
          </div>
          <div className="text-right">
            <div className="text-xs tracking-[0.3em]">TOTAL POOL</div>
            <div className="font-mono text-xl font-black">
              {(totalPool / 1000).toFixed(0)}K $SEEN
            </div>
          </div>
        </div>
      </div>

      {/* Battle Arena */}
      <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white">
        {/* Project A */}
        <div className={`p-6 ${isAWinning ? 'bg-white text-black' : ''}`}>
          <div className="text-[10px] tracking-[0.3em] mb-2">PROJECT A</div>
          <h3 className="text-2xl font-black mb-2">{battle.projectA.name}</h3>
          <p className="text-xs mb-4 opacity-70">{battle.projectA.tagline}</p>

          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-sm">
              <span>Score:</span>
              <span className="font-mono font-bold">{scoreA}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Pool:</span>
              <span className="font-mono font-bold">{(battle.poolA / 1000).toFixed(0)}K</span>
            </div>
          </div>

          <button
            onClick={() => onBet('A')}
            disabled={!isConnected || battle.status !== 'active'}
            className={`w-full py-3 font-black text-sm tracking-[0.2em] transition-all
              ${isAWinning
                ? 'bg-black text-white hover:bg-gray-800'
                : 'border border-white hover:bg-white hover:text-black'
              }
              disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            BET ON A
          </button>
        </div>

        {/* Project B */}
        <div className={`p-6 ${isBWinning ? 'bg-white text-black' : ''}`}>
          <div className="text-[10px] tracking-[0.3em] mb-2">PROJECT B</div>
          <h3 className="text-2xl font-black mb-2">{battle.projectB.name}</h3>
          <p className="text-xs mb-4 opacity-70">{battle.projectB.tagline}</p>

          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-sm">
              <span>Score:</span>
              <span className="font-mono font-bold">{scoreB}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Pool:</span>
              <span className="font-mono font-bold">{(battle.poolB / 1000).toFixed(0)}K</span>
            </div>
          </div>

          <button
            onClick={() => onBet('B')}
            disabled={!isConnected || battle.status !== 'active'}
            className={`w-full py-3 font-black text-sm tracking-[0.2em] transition-all
              ${isBWinning
                ? 'bg-black text-white hover:bg-gray-800'
                : 'border border-white hover:bg-white hover:text-black'
              }
              disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            BET ON B
          </button>
        </div>
      </div>

      {/* Battle Stats */}
      <div className="border-t border-white p-4 bg-black/50">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] tracking-[0.3em] text-gray-400">
            BETTING {battle.status === 'active' ? 'OPEN' : 'CLOSED'}
          </div>
          <button
            onClick={() => {
              const frameUrl = `${window.location.origin}/api/game/frame`;
              const shareUrl = `https://warpcast.com/~/compose?embeds[]=${encodeURIComponent(frameUrl)}`;
              window.open(shareUrl, '_blank');
            }}
            className="text-[10px] tracking-[0.2em] border border-white px-3 py-1 hover:bg-white hover:text-black transition-all"
          >
            SHARE BATTLE
          </button>
        </div>
        {!isConnected && (
          <p className="text-xs text-gray-500">
            Connect wallet to place bets
          </p>
        )}
      </div>
    </div>
  );
};

const MyBets = ({ bets }) => (
  <div className="border border-white p-4">
    <h3 className="text-xl font-black mb-4 tracking-tight">YOUR BETS</h3>
    <div className="space-y-2">
      {bets.map((bet, i) => (
        <div key={i} className="flex justify-between items-center py-2 border-b border-gray-800 last:border-0">
          <div>
            <div className="text-sm font-bold">Battle #{bet.battleId} - Team {bet.team}</div>
            <div className="text-xs text-gray-500">
              {bet.amount / 1000}K $SEEN bet
            </div>
          </div>
          <div className="text-right">
            {bet.claimed ? (
              <div className="text-sm text-green-400">CLAIMED</div>
            ) : bet.winnings ? (
              <div className="text-sm text-green-400">
                +{(bet.winnings - bet.amount) / 1000}K
              </div>
            ) : (
              <div className="text-xs text-gray-500">PENDING</div>
            )}
          </div>
        </div>
      ))}
    </div>
  </div>
);

const HowToPlay = () => (
  <div className="border border-white/30 p-4">
    <h3 className="text-sm font-black mb-3 tracking-[0.2em]">HOW TO PLAY</h3>
    <ul className="space-y-2 text-xs text-gray-400">
      <li>• Two projects battle for 24 hours</li>
      <li>• Bet $SEEN on which project will get more engagement</li>
      <li>• Engagement = views + clicks + votes + shares (weighted)</li>
      <li>• Winners split the pot (minus 5% treasury fee)</li>
      <li>• New battle starts automatically every 24h</li>
    </ul>
  </div>
);

export default FeatureWarsGame;
