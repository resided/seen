// Admin page to view user feedback submissions
// Requires admin authentication (same as main admin panel)

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

export default function FeedbackAdmin() {
  const router = useRouter();
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');

  const fetchFeedback = async () => {
    if (!adminFid) return;

    try {
      setLoading(true);
      const res = await fetch(`/api/admin/feedback?fid=${adminFid}&status=${statusFilter}`);
      const data = await res.json();

      if (res.ok) {
        setFeedback(data.feedback || []);
        setError('');
      } else {
        setError(data.error || 'Failed to fetch feedback');
        setFeedback([]);
      }
    } catch (err) {
      setError('Failed to fetch feedback');
      setFeedback([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (adminFid) {
      fetchFeedback();
    }
  }, [adminFid, statusFilter]);

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="min-h-screen bg-black text-white p-8 font-mono">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-black mb-2">FEEDBACK ADMIN</h1>
          <p className="text-gray-400 text-sm">View and manage user feedback submissions</p>
        </div>

        {/* Admin FID Input */}
        {!adminFid && (
          <div className="mb-8 p-6 border-2 border-white">
            <label className="block text-sm font-bold mb-2">ADMIN FID</label>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Enter admin FID"
                className="flex-1 p-3 bg-black border border-white text-white font-mono"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    setAdminFid(e.target.value);
                  }
                }}
              />
              <button
                onClick={(e) => {
                  const input = e.target.previousElementSibling;
                  setAdminFid(input.value);
                }}
                className="px-6 py-3 bg-white text-black font-black hover:bg-gray-200"
              >
                LOGIN
              </button>
            </div>
          </div>
        )}

        {adminFid && (
          <>
            {/* Filter Controls */}
            <div className="mb-6 flex gap-4 items-center">
              <div className="flex gap-2">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-4 py-2 border font-bold ${
                    statusFilter === 'all' ? 'bg-white text-black' : 'bg-black text-white border-white'
                  }`}
                >
                  ALL
                </button>
                <button
                  onClick={() => setStatusFilter('unread')}
                  className={`px-4 py-2 border font-bold ${
                    statusFilter === 'unread' ? 'bg-white text-black' : 'bg-black text-white border-white'
                  }`}
                >
                  UNREAD
                </button>
                <button
                  onClick={() => setStatusFilter('read')}
                  className={`px-4 py-2 border font-bold ${
                    statusFilter === 'read' ? 'bg-white text-black' : 'bg-black text-white border-white'
                  }`}
                >
                  READ
                </button>
              </div>
              <button
                onClick={fetchFeedback}
                className="px-4 py-2 border border-white text-white font-bold hover:bg-white/10"
              >
                REFRESH
              </button>
              <div className="ml-auto text-sm text-gray-400">
                Logged in as FID {adminFid}
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 border-2 border-red-500 text-red-400">
                {error}
              </div>
            )}

            {/* Loading State */}
            {loading && (
              <div className="text-center py-12 text-gray-400">
                LOADING FEEDBACK...
              </div>
            )}

            {/* Feedback List */}
            {!loading && feedback.length === 0 && (
              <div className="text-center py-12 text-gray-400 border border-white">
                No feedback submissions found
              </div>
            )}

            {!loading && feedback.length > 0 && (
              <div className="space-y-4">
                {feedback.map((item) => (
                  <div
                    key={item.id}
                    className={`p-4 border-2 ${
                      item.status === 'unread' ? 'border-yellow-500' : 'border-white'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <span className="font-black">FID {item.fid}</span>
                          <span className="text-xs text-gray-400">{formatDate(item.timestamp)}</span>
                          {item.status === 'unread' && (
                            <span className="text-xs px-2 py-1 bg-yellow-500 text-black font-bold">
                              UNREAD
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 font-mono">
                          Wallet: {item.walletAddress}
                        </div>
                      </div>
                      <button
                        onClick={() => copyToClipboard(item.txHash)}
                        className="text-xs px-2 py-1 border border-white hover:bg-white hover:text-black"
                        title="Copy tx hash"
                      >
                        TX
                      </button>
                    </div>

                    <div className="p-3 bg-gray-900 border border-gray-700 text-sm">
                      {item.message}
                    </div>

                    <div className="mt-2 text-xs text-gray-500">
                      ID: {item.id}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
