// Admin page to view user feedback submissions
// Requires admin authentication (same as main admin panel)

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { sdk } from '@farcaster/miniapp-sdk';

const ADMIN_FID = 342433; // Admin FID

export default function FeedbackAdmin() {
  const router = useRouter();
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [userFid, setUserFid] = useState(null);

  // Check authentication
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const contextResponse = await sdk.context;
        if (contextResponse?.user?.fid) {
          const fidNum = parseInt(contextResponse.user.fid);
          setUserFid(fidNum);
          if (fidNum === ADMIN_FID) {
            setIsAuthenticated(true);
            setShowLogin(false);
          } else {
            setShowLogin(true);
          }
        } else {
          setShowLogin(true);
        }
      } catch {
        setShowLogin(true);
      } finally {
        setAuthLoading(false);
      }
    };
    checkAuth();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(loginData),
      });

      if (response.ok) {
        setIsAuthenticated(true);
        setShowLogin(false);
        setLoginData({ username: '', password: '' });
      } else {
        const data = await response.json();
        setLoginError(data.error || 'Login failed');
      }
    } catch (err) {
      setLoginError('Login failed. Please try again.');
    }
  };

  const fetchFeedback = async () => {
    if (!isAuthenticated) return;

    try {
      setLoading(true);
      const res = await fetch(`/api/admin/feedback?status=${statusFilter}`, {
        credentials: 'include',
      });
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
    if (isAuthenticated) {
      fetchFeedback();
    }
  }, [isAuthenticated, statusFilter]);

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const handleAcknowledge = async (id) => {
    try {
      const res = await fetch('/api/admin/manage-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id, action: 'acknowledge' }),
      });

      if (res.ok) {
        setMessage('✅ Feedback acknowledged');
        fetchFeedback();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to acknowledge');
      }
    } catch (err) {
      setError('Failed to acknowledge feedback');
    }
  };

  const handleFlag = async (id) => {
    try {
      const res = await fetch('/api/admin/manage-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id, action: 'flag' }),
      });

      if (res.ok) {
        setMessage('🚩 Feedback flagged');
        fetchFeedback();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to flag');
      }
    } catch (err) {
      setError('Failed to flag feedback');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this feedback?')) return;

    try {
      const res = await fetch('/api/admin/manage-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id, action: 'delete' }),
      });

      if (res.ok) {
        setMessage('🗑️ Feedback deleted');
        fetchFeedback();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to delete');
      }
    } catch (err) {
      setError('Failed to delete feedback');
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-black text-white p-8 font-mono flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-black mb-2">LOADING...</div>
        </div>
      </div>
    );
  }

  if (showLogin) {
    return (
      <div className="min-h-screen bg-black text-white p-8 font-mono flex items-center justify-center">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-black mb-2">FEEDBACK ADMIN</h1>
            <p className="text-gray-400 text-sm">Admin authentication required</p>
          </div>

          <form onSubmit={handleLogin} className="border-2 border-white p-6">
            <div className="mb-4">
              <label className="block text-sm font-bold mb-2">USERNAME</label>
              <input
                type="text"
                value={loginData.username}
                onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
                className="w-full p-3 bg-black border border-white text-white font-mono"
                required
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-bold mb-2">PASSWORD</label>
              <input
                type="password"
                value={loginData.password}
                onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                className="w-full p-3 bg-black border border-white text-white font-mono"
                required
              />
            </div>

            {loginError && (
              <div className="mb-4 p-3 border-2 border-red-500 text-red-400 text-sm">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              className="w-full px-6 py-3 bg-white text-black font-black hover:bg-gray-200"
            >
              LOGIN
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-8 font-mono">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-black mb-2">FEEDBACK ADMIN</h1>
          <p className="text-gray-400 text-sm">View and manage user feedback submissions</p>
        </div>

        {isAuthenticated && (
          <>
            {/* Filter Controls */}
            <div className="mb-6 flex gap-4 items-center flex-wrap">
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
                  onClick={() => setStatusFilter('acknowledged')}
                  className={`px-4 py-2 border font-bold ${
                    statusFilter === 'acknowledged' ? 'bg-white text-black' : 'bg-black text-white border-white'
                  }`}
                >
                  ACKNOWLEDGED
                </button>
                <button
                  onClick={() => setStatusFilter('flagged')}
                  className={`px-4 py-2 border font-bold ${
                    statusFilter === 'flagged' ? 'bg-white text-black' : 'bg-black text-white border-white'
                  }`}
                >
                  FLAGGED
                </button>
              </div>
              <button
                onClick={fetchFeedback}
                className="px-4 py-2 border border-white text-white font-bold hover:bg-white/10"
              >
                REFRESH
              </button>
            </div>

            {/* Success Message */}
            {message && (
              <div className="mb-6 p-4 border-2 border-green-500 text-green-400">
                {message}
              </div>
            )}

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
                      item.status === 'flagged' ? 'border-red-500' :
                      item.status === 'unread' ? 'border-yellow-500' :
                      item.status === 'acknowledged' ? 'border-green-500' :
                      'border-white'
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
                          {item.status === 'acknowledged' && (
                            <span className="text-xs px-2 py-1 bg-green-500 text-black font-bold">
                              ✓ ACKNOWLEDGED
                            </span>
                          )}
                          {item.status === 'flagged' && (
                            <span className="text-xs px-2 py-1 bg-red-500 text-white font-bold">
                              🚩 FLAGGED
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

                    <div className="p-3 bg-gray-900 border border-gray-700 text-sm mb-3">
                      {item.message}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-gray-500">
                        ID: {item.id}
                      </div>
                      <div className="flex gap-2">
                        {item.status !== 'acknowledged' && (
                          <button
                            onClick={() => handleAcknowledge(item.id)}
                            className="text-xs px-3 py-1 border border-green-500 text-green-500 hover:bg-green-500 hover:text-black font-bold"
                          >
                            ACKNOWLEDGE
                          </button>
                        )}
                        {item.status !== 'flagged' && (
                          <button
                            onClick={() => handleFlag(item.id)}
                            className="text-xs px-3 py-1 border border-red-500 text-red-500 hover:bg-red-500 hover:text-white font-bold"
                          >
                            FLAG
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="text-xs px-3 py-1 border border-white text-white hover:bg-white hover:text-black font-bold"
                        >
                          DELETE
                        </button>
                      </div>
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
