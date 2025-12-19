// Stats banner component
// Displays total platform statistics with rotating slogans

import { useState, useEffect } from 'react';

const SLOGANS = [
  'GET SEEN',
  'THE ATTENTION LAYER',
];

const formatNumber = (num) => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

export default function StatsBanner() {
  const [stats, setStats] = useState({
    totalClicks: 0,
    totalViews: 0,
    totalListings: 0,
    totalUsers: 0,
  });
  const [sloganIndex, setSloganIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  // Fetch stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/total-stats');
        const data = await res.json();

        if (data.success) {
          setStats(data.stats);
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    // Refresh stats every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  // Rotate slogans every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setSloganIndex((prev) => (prev + 1) % SLOGANS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="border-b-2 border-white bg-black py-3">
        <div className="text-center text-xs text-gray-500">LOADING...</div>
      </div>
    );
  }

  return (
    <div className="border-b-2 border-white bg-black">
      <div className="max-w-4xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Slogan */}
          <div className="flex-shrink-0">
            <div className="text-sm font-black tracking-[0.3em] transition-all duration-500">
              {SLOGANS[sloganIndex]}
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 overflow-x-auto scrollbar-thin">
            <div className="flex items-center gap-1 whitespace-nowrap">
              <span className="text-[10px] text-gray-500">VIEWS:</span>
              <span className="text-sm font-black">{formatNumber(stats.totalViews)}</span>
            </div>

            <div className="w-px h-4 bg-white"></div>

            <div className="flex items-center gap-1 whitespace-nowrap">
              <span className="text-[10px] text-gray-500">CLICKS:</span>
              <span className="text-sm font-black">{formatNumber(stats.totalClicks)}</span>
            </div>

            <div className="w-px h-4 bg-white"></div>

            <div className="flex items-center gap-1 whitespace-nowrap">
              <span className="text-[10px] text-gray-500">LISTINGS:</span>
              <span className="text-sm font-black">{formatNumber(stats.totalListings)}</span>
            </div>

            <div className="w-px h-4 bg-white"></div>

            <div className="flex items-center gap-1 whitespace-nowrap">
              <span className="text-[10px] text-gray-500">USERS:</span>
              <span className="text-sm font-black">{formatNumber(stats.totalUsers)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
