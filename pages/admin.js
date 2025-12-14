import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { sdk } from '@farcaster/miniapp-sdk';

const ADMIN_FID = 342433; // Admin FID

export default function Admin() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [userFid, setUserFid] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);

  // Get user FID from Farcaster SDK
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const context = await sdk.context;
        if (context?.user?.fid) {
          setUserFid(context.user.fid);
          if (context.user.fid !== ADMIN_FID) {
            setUnauthorized(true);
          }
        } else {
          setUnauthorized(true);
        }
      } catch (error) {
        console.error('Error getting user context:', error);
        setUnauthorized(true);
      } finally {
        setAuthLoading(false);
      }
    };
    
    checkAuth();
  }, []);

  useEffect(() => {
    if (userFid === ADMIN_FID) {
      fetchSubmissions();
    }
  }, [userFid]);

  const fetchSubmissions = async () => {
    try {
      const response = await fetch('/api/admin/submissions', {
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fid: userFid }),
        method: 'POST',
      });
      
      if (response.status === 403) {
        setUnauthorized(true);
        return;
      }
      
      if (response.ok) {
        const data = await response.json();
        setSubmissions(data.submissions || []);
      }
    } catch (error) {
      console.error('Error fetching submissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (projectId) => {
    try {
      const response = await fetch('/api/admin/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, action: 'approve', fid: userFid }),
      });

      const data = await response.json();
      if (response.ok) {
        setMessage(`Project ${projectId} approved!`);
        fetchSubmissions(); // Refresh list
      } else {
        setMessage(data.error || 'Failed to approve');
      }
    } catch (error) {
      setMessage('Error approving project');
    }
  };

  const handleReject = async (projectId) => {
    if (!confirm('Are you sure you want to reject this submission?')) {
      return;
    }

    try {
      const response = await fetch('/api/admin/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, action: 'reject', fid: userFid }),
      });

      const data = await response.json();
      if (response.ok) {
        setMessage(`Project ${projectId} rejected!`);
        fetchSubmissions(); // Refresh list
      } else {
        setMessage(data.error || 'Failed to reject');
      }
    } catch (error) {
      setMessage('Error rejecting project');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-500">Checking authorization...</div>
        </div>
      </div>
    );
  }

  if (unauthorized || userFid !== ADMIN_FID) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-black mb-4">UNAUTHORIZED</div>
          <div className="text-gray-500">You do not have permission to access this page.</div>
          {userFid && (
            <div className="text-sm text-gray-600 mt-2">Your FID: {userFid}</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Admin - Seen. Submissions</title>
      </Head>
      <div className="min-h-screen bg-black text-white p-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-black mb-2">ADMIN PANEL</h1>
            <p className="text-sm text-gray-500">Manage Project Submissions</p>
            <p className="text-xs text-gray-600 mt-1">Authenticated as FID: {userFid}</p>
          </div>

          {message && (
            <div className="mb-4 p-4 border border-white bg-white text-black">
              {message}
              <button
                onClick={() => setMessage('')}
                className="ml-4 text-sm underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {loading ? (
            <div className="text-center py-12">
              <div className="text-gray-500">Loading submissions...</div>
            </div>
          ) : submissions.length === 0 ? (
            <div className="text-center py-12 border border-white">
              <div className="text-gray-500 text-lg">NO PENDING SUBMISSIONS</div>
            </div>
          ) : (
            <div className="space-y-4">
              {submissions.map((submission) => (
                <div
                  key={submission.id}
                  className="border border-white p-6"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h2 className="text-2xl font-black">{submission.name}</h2>
                        <span className="text-[10px] tracking-[0.2em] px-2 py-1 bg-white text-black">
                          {submission.category?.toUpperCase() || 'MAIN'}
                        </span>
                        <span className={`text-[10px] tracking-[0.2em] px-2 py-1 border ${
                          submission.status === 'pending_payment'
                            ? 'border-yellow-500 text-yellow-500'
                            : 'border-white text-white'
                        }`}>
                          {submission.status?.toUpperCase() || 'PENDING'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400 mb-2">{submission.tagline}</p>
                      <p className="text-sm mb-4">{submission.description}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                    <div>
                      <span className="text-gray-500">Builder:</span>{' '}
                      <span className="font-bold">{submission.builder}</span>
                      {submission.builderFid && (
                        <span className="text-gray-500 ml-2">(FID: {submission.builderFid})</span>
                      )}
                    </div>
                    <div>
                      <span className="text-gray-500">Type:</span>{' '}
                      <span className="font-bold">{submission.submissionType?.toUpperCase() || 'QUEUE'}</span>
                      {submission.paymentAmount > 0 && (
                        <span className="text-yellow-500 ml-2">
                          ({submission.paymentAmount} ETH)
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="text-gray-500">Submitted:</span>{' '}
                      {formatDate(submission.submittedAt)}
                    </div>
                    <div>
                      <span className="text-gray-500">ID:</span>{' '}
                      <span className="font-mono text-xs">{submission.id}</span>
                    </div>
                  </div>

                  {submission.links && (
                    <div className="mb-4 space-y-1 text-sm">
                      {submission.links.miniapp && (
                        <div>
                          <span className="text-gray-500">Mini App:</span>{' '}
                          <a
                            href={submission.links.miniapp}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:underline"
                          >
                            {submission.links.miniapp}
                          </a>
                        </div>
                      )}
                      {submission.links.website && (
                        <div>
                          <span className="text-gray-500">Website:</span>{' '}
                          <a
                            href={submission.links.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:underline"
                          >
                            {submission.links.website}
                          </a>
                        </div>
                      )}
                      {submission.links.github && (
                        <div>
                          <span className="text-gray-500">GitHub:</span>{' '}
                          <a
                            href={submission.links.github}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:underline"
                          >
                            {submission.links.github}
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex gap-4 pt-4 border-t border-white">
                    <button
                      onClick={() => handleApprove(submission.id)}
                      className="px-6 py-2 bg-white text-black font-bold hover:bg-gray-200 transition-all"
                    >
                      APPROVE
                    </button>
                    <button
                      onClick={() => handleReject(submission.id)}
                      className="px-6 py-2 border border-white font-bold hover:bg-white hover:text-black transition-all"
                    >
                      REJECT
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </>
  );
}
