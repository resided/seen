// Miniapp Prediction Market Component
// Users predict which Farcaster miniapp will gain the most ranks

import { useState, useEffect } from 'react';

export default function MiniappPrediction({ userFid, isInFarcaster = false }) {
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasPredicted, setHasPredicted] = useState(false);
  const [userPrediction, setUserPrediction] = useState(null);
  const [predicting, setPredicting] = useState(false);
  const [message, setMessage] = useState('');
  const [stats, setStats] = useState({});
  const [showAll, setShowAll] = useState(false);

  // Fetch rankings and user status
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch miniapp rankings
        const rankingsRes = await fetch('/api/miniapp-rankings');
        const rankingsData = await rankingsRes.json();

        if (rankingsData.rankings) {
          setRankings(rankingsData.rankings);
        }

        // Check if user has predicted
        if (userFid) {
          const predictionRes = await fetch(`/api/predict-miniapp?fid=${userFid}`);
          const predictionData = await predictionRes.json();

          setHasPredicted(predictionData.hasPredicted);
          setUserPrediction(predictionData.prediction);
          setStats(predictionData.stats || {});
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
        setMessage('ERROR: Failed to load rankings');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userFid]);

  const handlePredict = async (miniapp) => {
    if (!userFid || !isInFarcaster || predicting || hasPredicted) return;

    setPredicting(true);
    setMessage('SUBMITTING PREDICTION...');

    try {
      const res = await fetch('/api/predict-miniapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fid: userFid,
          miniappId: miniapp.uuid || miniapp.id,
          miniappName: miniapp.name || miniapp.title,
          currentRank: miniapp.rank,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setHasPredicted(true);
        setUserPrediction(data.prediction);
        setMessage(`SUCCESS! Predicted: ${data.prediction.miniappName}`);
      } else {
        setMessage(data.error || 'PREDICTION FAILED');
      }
    } catch (error) {
      setMessage('ERROR: ' + error.message);
    } finally {
      setPredicting(false);
    }
  };

  // Get prediction percentage for each app
  const getPredictionPercentage = (miniappId) => {
    const total = Object.values(stats).reduce((sum, count) => sum + parseInt(count), 0);
    if (total === 0) return 0;
    const count = parseInt(stats[miniappId] || 0);
    return Math.round((count / total) * 100);
  };

  const displayedRankings = showAll ? rankings : rankings.slice(0, 10);

  if (loading) {
    return (
      <div className="border-2 border-white p-4 bg-black">
        <div className="text-center text-gray-500">LOADING PREDICTIONS...</div>
      </div>
    );
  }

  return (
    <div className="border-2 border-white p-4 bg-black">
      {/* Header */}
      <div className="text-center mb-4">
        <div className="text-[10px] tracking-[0.3em] text-gray-400 mb-1">DAILY PREDICTION</div>
        <div className="text-xl font-black">FARCASTER MINIAPP MARKET</div>
        <div className="text-xs text-gray-400 mt-1">
          Which miniapp will gain the most ranks tomorrow?
        </div>
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

      {/* User's Prediction */}
      {hasPredicted && userPrediction && (
        <div className="mb-4 p-3 border-2 border-yellow-500 bg-yellow-500/10">
          <div className="text-[10px] tracking-[0.2em] text-yellow-400 mb-1">YOUR PREDICTION</div>
          <div className="font-black text-white">{userPrediction.miniappName}</div>
          <div className="text-xs text-gray-400 mt-1">
            Current rank: #{userPrediction.currentRank}
          </div>
        </div>
      )}

      {/* Miniapp List */}
      <div className="space-y-2 mb-4">
        {displayedRankings.map((miniapp) => {
          const appId = miniapp.uuid || miniapp.id;
          const percentage = getPredictionPercentage(appId);
          const isUserChoice = userPrediction?.miniappId === appId;

          return (
            <button
              key={appId}
              onClick={() => handlePredict(miniapp)}
              disabled={!isInFarcaster || hasPredicted || predicting}
              className={`w-full p-3 border text-left transition-all ${
                isUserChoice
                  ? 'border-yellow-500 bg-yellow-500/10'
                  : hasPredicted
                  ? 'border-gray-700 bg-gray-900 cursor-not-allowed opacity-50'
                  : 'border-white hover:bg-white/5 cursor-pointer'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-black">#{miniapp.rank}</span>
                    <span className="text-sm font-bold">{miniapp.name || miniapp.title}</span>
                    {miniapp.rankChange !== undefined && miniapp.rankChange !== 0 && (
                      <span className={`text-xs ${
                        miniapp.rankChange > 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {miniapp.rankChange > 0 ? '↑' : '↓'} {Math.abs(miniapp.rankChange)}
                      </span>
                    )}
                  </div>
                  {percentage > 0 && (
                    <div className="text-[10px] text-gray-500">
                      {percentage}% predicted this
                    </div>
                  )}
                </div>
                {isUserChoice && (
                  <div className="text-yellow-400 text-xs font-bold">✓ YOURS</div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Show More/Less */}
      {rankings.length > 10 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full py-2 border border-white text-xs tracking-[0.2em] hover:bg-white hover:text-black transition-all"
        >
          {showAll ? 'SHOW LESS' : `SHOW ALL ${rankings.length} MINIAPPS`}
        </button>
      )}

      {/* Instructions */}
      {!hasPredicted && (
        <div className="mt-4 text-center text-xs text-gray-500">
          {!isInFarcaster ? 'Open in Farcaster to predict' : 'Pick the miniapp you think will climb the most'}
        </div>
      )}
    </div>
  );
}
