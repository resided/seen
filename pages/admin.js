import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { sdk } from '@farcaster/miniapp-sdk';

const ADMIN_FID = 342433; // Admin FID

export default function Admin() {
  // Auth state
  const [userFid, setUserFid] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [authLoading, setAuthLoading] = useState(true);

  // UI state
  const [message, setMessage] = useState('');
  const [activeSection, setActiveSection] = useState('battles'); // battles, projects, automation, claims, tools

  // Projects state
  const [submissions, setSubmissions] = useState([]);
  const [liveProjects, setLiveProjects] = useState([]);
  const [archivedProjects, setArchivedProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const editFormRef = useRef(null);

  // Form data
  const [editFormData, setEditFormData] = useState({});
  const [createFormData, setCreateFormData] = useState({
    name: '',
    tagline: '',
    description: '',
    builder: '',
    builderFid: '',
    tokenName: '',
    tokenContractAddress: '',
    category: 'main',
    links: { twitter: '', website: '', farcaster: '' },
  });

  // Battle state
  const [currentBattle, setCurrentBattle] = useState(null);

  // Automation state
  const [currentFeatured, setCurrentFeatured] = useState(null);

  // Claims state
  const [claimsDisabled, setClaimsDisabled] = useState(null);
  const [claimStats, setClaimStats] = useState(null);
  const [blockedFids, setBlockedFids] = useState([]);
  const [blockFidInput, setBlockFidInput] = useState('');

  // Tools state
  const [traceWalletAddress, setTraceWalletAddress] = useState('');
  const [traceResult, setTraceResult] = useState(null);
  const [tracingWallet, setTracingWallet] = useState(false);

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

  // Login handler
  const handleLogin = async (e) => {
    e.preventDefault();
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
        setMessage('');
      } else {
        setMessage('Invalid credentials');
      }
    } catch (error) {
      setMessage('Login failed');
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        credentials: 'include',
      });
      setIsAuthenticated(false);
      setShowLogin(true);
      window.location.reload();
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  // Load data based on active section
  useEffect(() => {
    if (!isAuthenticated) return;

    if (activeSection === 'battles') {
      fetchCurrentBattle();
    } else if (activeSection === 'projects') {
      fetchSubmissions();
      fetchLiveProjects();
    } else if (activeSection === 'automation') {
      fetchCurrentFeatured();
    } else if (activeSection === 'claims') {
      fetchClaimStats();
      fetchBlockedFids();
    }
  }, [isAuthenticated, activeSection]);

  // ============================================
  // BATTLE MANAGEMENT
  // ============================================

  const fetchCurrentBattle = async () => {
    try {
      const response = await fetch('/api/game/current-battle');
      const data = await response.json();
      if (data.battle) {
        setCurrentBattle(data.battle);
      }
    } catch (error) {
      console.error('Error fetching battle:', error);
    }
  };

  const handleCreateBattle = async () => {
    if (!confirm('Create a new Feature Wars battle?')) return;

    try {
      setMessage('Creating battle...');
      const response = await fetch('/api/game/create-battle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const data = await response.json();
      if (response.ok) {
        setMessage(`✅ Battle created! ${data.battle.projectA.name} vs ${data.battle.projectB.name}`);
        fetchCurrentBattle();
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (error) {
      setMessage('Error creating battle');
    }
  };

  const handleResolveBattle = async () => {
    if (!confirm('Resolve current battle?')) return;

    try {
      setMessage('Resolving battle...');
      const response = await fetch('/api/game/resolve-battle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const data = await response.json();
      if (response.ok) {
        if (data.action === 'resolved') {
          setMessage(`✅ Battle resolved! Winner: Team ${data.result.winner}`);
        } else {
          setMessage(`ℹ️ ${data.message}`);
        }
        fetchCurrentBattle();
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (error) {
      setMessage('Error resolving battle');
    }
  };

  // ============================================
  // PROJECT MANAGEMENT
  // ============================================

  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fid: userFid || null }),
        credentials: 'include',
      });
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

  const fetchLiveProjects = async () => {
    try {
      const response = await fetch('/api/admin/live-projects', {
        method: 'POST',
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setLiveProjects(data.projects || []);
      }
    } catch (error) {
      console.error('Error fetching live projects:', error);
    }
  };

  const handleApprove = async (submissionId) => {
    try {
      setMessage('Approving...');
      const response = await fetch('/api/admin/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: submissionId }),
      });
      if (response.ok) {
        setMessage('✅ Approved!');
        fetchSubmissions();
        fetchLiveProjects();
      }
    } catch (error) {
      setMessage('Error approving');
    }
  };

  const handleFeature = async (projectId) => {
    try {
      setMessage('Featuring...');
      const response = await fetch('/api/admin/update-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: projectId, status: 'featured' }),
      });
      if (response.ok) {
        setMessage('✅ Featured!');
        fetchLiveProjects();
        fetchCurrentFeatured();
      }
    } catch (error) {
      setMessage('Error featuring project');
    }
  };

  // ============================================
  // AUTOMATION
  // ============================================

  const fetchCurrentFeatured = async () => {
    try {
      const response = await fetch('/api/featured-project');
      const data = await response.json();
      setCurrentFeatured(data.featured);
    } catch (error) {
      console.error('Error fetching featured:', error);
    }
  };

  const handleManualAutoFeature = async () => {
    if (!confirm('Trigger auto-feature? This will feature the highest voted project and reset all votes to 0.')) return;

    try {
      setMessage('Triggering auto-feature...');
      const response = await fetch('/api/auto-feature-winner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const data = await response.json();
      if (response.ok) {
        if (data.action === 'featured') {
          setMessage(`✅ ${data.message} Winner: ${data.winner.name} (${data.winner.votes} votes)`);
        } else {
          setMessage(`ℹ️ ${data.message}`);
        }
        fetchCurrentFeatured();
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (error) {
      setMessage('Error triggering auto-feature');
    }
  };

  // ============================================
  // CLAIMS
  // ============================================

  const fetchClaimStats = async () => {
    try {
      const response = await fetch('/api/admin/simple-stats', {
        method: 'POST',
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setClaimStats(data);
        setClaimsDisabled(data.disabled);
      }
    } catch (error) {
      console.error('Error fetching claim stats:', error);
    }
  };

  const fetchBlockedFids = async () => {
    try {
      const response = await fetch('/api/admin/block-fid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'list' }),
      });
      if (response.ok) {
        const data = await response.json();
        setBlockedFids(data.blockedFids || []);
      }
    } catch (error) {
      console.error('Error fetching blocked FIDs:', error);
    }
  };

  const handleToggleClaims = async () => {
    try {
      const newState = !claimsDisabled;
      const response = await fetch('/api/admin/simple-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ disable: newState }),
      });
      if (response.ok) {
        setClaimsDisabled(newState);
        setMessage(`✅ Claims ${newState ? 'DISABLED' : 'ENABLED'}`);
        fetchClaimStats();
      }
    } catch (error) {
      setMessage('Error toggling claims');
    }
  };

  const handleBlockFid = async () => {
    if (!blockFidInput) return;
    try {
      const response = await fetch('/api/admin/block-fid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'block', fid: parseInt(blockFidInput) }),
      });
      if (response.ok) {
        setMessage('✅ FID blocked');
        setBlockFidInput('');
        fetchBlockedFids();
      }
    } catch (error) {
      setMessage('Error blocking FID');
    }
  };

  const handleUnblockFid = async (fid) => {
    try {
      const response = await fetch('/api/admin/block-fid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'unblock', fid }),
      });
      if (response.ok) {
        setMessage('✅ FID unblocked');
        fetchBlockedFids();
      }
    } catch (error) {
      setMessage('Error unblocking FID');
    }
  };

  // ============================================
  // TOOLS
  // ============================================

  const handleTraceWallet = async () => {
    if (!traceWalletAddress) return;

    setTracingWallet(true);
    try {
      const response = await fetch('/api/admin/trace-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ walletAddress: traceWalletAddress }),
      });
      const data = await response.json();
      if (response.ok) {
        setTraceResult(data);
      } else {
        setTraceResult({ error: data.error });
      }
    } catch (error) {
      setTraceResult({ error: 'Failed to trace wallet' });
    } finally {
      setTracingWallet(false);
    }
  };

  // ============================================
  // RENDER
  // ============================================

  if (authLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-sm tracking-[0.2em]">LOADING...</div>
      </div>
    );
  }

  if (showLogin) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
        <div className="border border-white p-8 max-w-md w-full">
          <h1 className="text-3xl font-black mb-6">ADMIN LOGIN</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="text"
              placeholder="Username"
              value={loginData.username}
              onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
              className="w-full p-3 bg-black border border-white text-white"
            />
            <input
              type="password"
              placeholder="Password"
              value={loginData.password}
              onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
              className="w-full p-3 bg-black border border-white text-white"
            />
            <button
              type="submit"
              className="w-full py-3 bg-white text-black font-black hover:bg-gray-200"
            >
              LOGIN
            </button>
          </form>
          {message && (
            <div className="mt-4 p-3 border border-red-500 text-red-400 text-sm">
              {message}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8 font-mono">
      <Head>
        <title>SEEN Admin Panel</title>
      </Head>

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-white">
          <div>
            <h1 className="text-4xl font-black">SEEN ADMIN</h1>
            <p className="text-xs text-gray-500 mt-1">Logged in as FID {userFid}</p>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 border border-white text-sm hover:bg-white hover:text-black transition-all"
          >
            LOGOUT
          </button>
        </div>

        {/* Message Display */}
        {message && (
          <div className={`mb-6 p-4 border ${
            message.includes('Error') || message.includes('failed')
              ? 'border-red-500 text-red-400 bg-red-500/10'
              : message.includes('✅')
              ? 'border-green-500 text-green-400 bg-green-500/10'
              : 'border-yellow-500 text-yellow-400 bg-yellow-500/10'
          }`}>
            {message}
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-2 mb-8 flex-wrap">
          {[
            { id: 'battles', label: 'BATTLES' },
            { id: 'projects', label: 'PROJECTS' },
            { id: 'automation', label: 'AUTOMATION' },
            { id: 'claims', label: 'CLAIMS' },
            { id: 'tools', label: 'TOOLS' },
          ].map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`px-6 py-3 font-black text-sm tracking-[0.2em] transition-all ${
                activeSection === section.id
                  ? 'bg-white text-black'
                  : 'border border-white hover:bg-white hover:text-black'
              }`}
            >
              {section.label}
            </button>
          ))}
        </div>

        {/* Sections */}
        {activeSection === 'battles' && (
          <BattleSection
            currentBattle={currentBattle}
            onCreateBattle={handleCreateBattle}
            onResolveBattle={handleResolveBattle}
          />
        )}

        {activeSection === 'projects' && (
          <ProjectSection
            submissions={submissions}
            liveProjects={liveProjects}
            loading={loading}
            onApprove={handleApprove}
            onFeature={handleFeature}
          />
        )}

        {activeSection === 'automation' && (
          <AutomationSection
            currentFeatured={currentFeatured}
            onTriggerAutoFeature={handleManualAutoFeature}
          />
        )}

        {activeSection === 'claims' && (
          <ClaimsSection
            claimsDisabled={claimsDisabled}
            claimStats={claimStats}
            blockedFids={blockedFids}
            blockFidInput={blockFidInput}
            onToggleClaims={handleToggleClaims}
            onBlockFid={handleBlockFid}
            onUnblockFid={handleUnblockFid}
            setBlockFidInput={setBlockFidInput}
          />
        )}

        {activeSection === 'tools' && (
          <ToolsSection
            traceWalletAddress={traceWalletAddress}
            traceResult={traceResult}
            tracingWallet={tracingWallet}
            setTraceWalletAddress={setTraceWalletAddress}
            onTraceWallet={handleTraceWallet}
          />
        )}
      </div>
    </div>
  );
}

// ============================================
// SECTION COMPONENTS
// ============================================

const BattleSection = ({ currentBattle, onCreateBattle, onResolveBattle }) => (
  <div className="space-y-6">
    <div className="border border-white p-6">
      <h2 className="text-2xl font-black mb-4">BATTLE MANAGEMENT</h2>

      <div className="flex gap-3 mb-6">
        <button
          onClick={onCreateBattle}
          className="px-6 py-3 bg-purple-600 text-white font-black hover:bg-purple-500"
        >
          CREATE BATTLE
        </button>
        <button
          onClick={onResolveBattle}
          className="px-6 py-3 bg-green-600 text-white font-black hover:bg-green-500"
        >
          RESOLVE BATTLE
        </button>
      </div>

      {currentBattle ? (
        <div className="border border-white/30 p-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-gray-500 mb-1">PROJECT A</div>
              <div className="text-xl font-black">{currentBattle.projectA.name}</div>
              <div className="text-sm text-gray-400">Score: {currentBattle.scoreA}</div>
              <div className="text-sm text-gray-400">Pool: {(currentBattle.poolA / 1000).toFixed(0)}K $SEEN</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">PROJECT B</div>
              <div className="text-xl font-black">{currentBattle.projectB.name}</div>
              <div className="text-sm text-gray-400">Score: {currentBattle.scoreB}</div>
              <div className="text-sm text-gray-400">Pool: {(currentBattle.poolB / 1000).toFixed(0)}K $SEEN</div>
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-500">
            Status: {currentBattle.status} | Ends: {new Date(currentBattle.endTime).toLocaleString()}
          </div>
        </div>
      ) : (
        <div className="border border-white/30 p-4 text-center text-gray-500">
          No active battle
        </div>
      )}
    </div>
  </div>
);

const ProjectSection = ({ submissions, liveProjects, loading, onApprove, onFeature }) => (
  <div className="space-y-6">
    {/* Pending Submissions */}
    <div className="border border-white p-6">
      <h2 className="text-2xl font-black mb-4">PENDING SUBMISSIONS ({submissions.length})</h2>
      {loading ? (
        <div className="text-gray-500">Loading...</div>
      ) : submissions.length === 0 ? (
        <div className="text-gray-500">No pending submissions</div>
      ) : (
        <div className="space-y-4">
          {submissions.map((sub) => (
            <div key={sub.id} className="border border-white/30 p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-xl font-black mb-2">{sub.name}</h3>
                  <p className="text-sm text-gray-400 mb-2">{sub.tagline}</p>
                  <div className="text-xs text-gray-600">
                    Builder: {sub.builder} | FID: {sub.builderFid}
                  </div>
                </div>
                <button
                  onClick={() => onApprove(sub.id)}
                  className="px-4 py-2 bg-green-600 text-white font-black hover:bg-green-500"
                >
                  APPROVE
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>

    {/* Live Projects */}
    <div className="border border-white p-6">
      <h2 className="text-2xl font-black mb-4">LIVE PROJECTS ({liveProjects.length})</h2>
      <div className="space-y-4">
        {liveProjects.map((project) => (
          <div key={project.id} className="border border-white/30 p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-xl font-black">{project.name}</h3>
                  <span className={`text-xs px-2 py-1 border ${
                    project.status === 'featured'
                      ? 'border-yellow-500 text-yellow-500'
                      : 'border-gray-500 text-gray-500'
                  }`}>
                    {project.status.toUpperCase()}
                  </span>
                </div>
                <p className="text-sm text-gray-400">{project.tagline}</p>
                <div className="text-xs text-gray-600 mt-1">
                  Votes: {project.votes || 0}
                </div>
              </div>
              {project.status !== 'featured' && (
                <button
                  onClick={() => onFeature(project.id)}
                  className="px-4 py-2 border border-yellow-500 text-yellow-500 font-black hover:bg-yellow-500 hover:text-black"
                >
                  FEATURE
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const AutomationSection = ({ currentFeatured, onTriggerAutoFeature }) => (
  <div className="space-y-6">
    <div className="border border-white p-6">
      <h2 className="text-2xl font-black mb-4">AUTOMATION</h2>

      <div className="mb-6">
        <button
          onClick={onTriggerAutoFeature}
          className="px-6 py-3 bg-yellow-600 text-white font-black hover:bg-yellow-500"
        >
          TRIGGER AUTO-FEATURE
        </button>
        <p className="text-xs text-gray-500 mt-2">
          Features the highest voted project and resets all votes to 0
        </p>
      </div>

      {currentFeatured && (
        <div className="border border-white/30 p-4">
          <div className="text-xs text-gray-500 mb-2">CURRENT FEATURED</div>
          <div className="text-2xl font-black mb-2">{currentFeatured.name}</div>
          <div className="text-sm text-gray-400">{currentFeatured.tagline}</div>
          <div className="text-xs text-gray-600 mt-2">
            Featured at: {new Date(currentFeatured.featuredAt).toLocaleString()}
          </div>
        </div>
      )}
    </div>
  </div>
);

const ClaimsSection = ({ claimsDisabled, claimStats, blockedFids, blockFidInput, onToggleClaims, onBlockFid, onUnblockFid, setBlockFidInput }) => (
  <div className="space-y-6">
    <div className="border border-white p-6">
      <h2 className="text-2xl font-black mb-4">CLAIM SYSTEM</h2>

      <div className="flex gap-3 mb-6">
        <button
          onClick={onToggleClaims}
          className={`px-6 py-3 font-black ${
            claimsDisabled
              ? 'bg-green-600 text-white hover:bg-green-500'
              : 'bg-red-600 text-white hover:bg-red-500'
          }`}
        >
          {claimsDisabled ? 'ENABLE CLAIMS' : 'DISABLE CLAIMS'}
        </button>
      </div>

      {claimStats && (
        <div className="border border-white/30 p-4 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-gray-500">STATUS</div>
              <div className="text-xl font-black">{claimsDisabled ? 'DISABLED' : 'ENABLED'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">TOTAL CLAIMS</div>
              <div className="text-xl font-black">{claimStats.totalClaims || 0}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">UNIQUE USERS</div>
              <div className="text-xl font-black">{claimStats.uniqueClaimers || 0}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">TOTAL SENT</div>
              <div className="text-xl font-black">{((claimStats.totalSent || 0) / 1000000).toFixed(1)}M</div>
            </div>
          </div>
        </div>
      )}

      {/* Block FIDs */}
      <div className="border-t border-white/30 pt-6">
        <h3 className="text-lg font-black mb-3">BLOCKED FIDs ({blockedFids.length})</h3>
        <div className="flex gap-2 mb-4">
          <input
            type="number"
            placeholder="FID to block"
            value={blockFidInput}
            onChange={(e) => setBlockFidInput(e.target.value)}
            className="flex-1 p-2 bg-black border border-white text-white"
          />
          <button
            onClick={onBlockFid}
            className="px-4 py-2 bg-red-600 text-white font-black hover:bg-red-500"
          >
            BLOCK
          </button>
        </div>
        <div className="space-y-2">
          {blockedFids.map((fid) => (
            <div key={fid} className="flex items-center justify-between p-2 border border-white/30">
              <span>FID: {fid}</span>
              <button
                onClick={() => onUnblockFid(fid)}
                className="text-xs px-3 py-1 border border-white hover:bg-white hover:text-black"
              >
                UNBLOCK
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const ToolsSection = ({ traceWalletAddress, traceResult, tracingWallet, setTraceWalletAddress, onTraceWallet }) => (
  <div className="space-y-6">
    <div className="border border-white p-6">
      <h2 className="text-2xl font-black mb-4">WALLET TRACER</h2>
      <p className="text-sm text-gray-500 mb-4">Find FID(s) associated with a wallet address</p>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="0x..."
          value={traceWalletAddress}
          onChange={(e) => setTraceWalletAddress(e.target.value)}
          className="flex-1 p-3 bg-black border border-white text-white font-mono"
        />
        <button
          onClick={onTraceWallet}
          disabled={tracingWallet}
          className="px-6 py-3 bg-blue-600 text-white font-black hover:bg-blue-500 disabled:opacity-50"
        >
          {tracingWallet ? 'TRACING...' : 'TRACE'}
        </button>
      </div>

      {traceResult && (
        <div className="border border-white/30 p-4">
          {traceResult.error ? (
            <div className="text-red-400">{traceResult.error}</div>
          ) : (
            <div>
              <div className="text-sm text-gray-500 mb-2">Results:</div>
              {traceResult.fids && traceResult.fids.length > 0 ? (
                <div className="space-y-1">
                  {traceResult.fids.map((fid, i) => (
                    <div key={i} className="text-white">FID: {fid}</div>
                  ))}
                </div>
              ) : (
                <div className="text-gray-500">No FIDs found</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  </div>
);
