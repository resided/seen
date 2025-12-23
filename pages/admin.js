import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { sdk } from '@farcaster/miniapp-sdk';

const ADMIN_FID = 342433; // Admin FID

// Format large numbers: 1000 -> 1K, 1000000 -> 1M, 1000000000 -> 1B
const formatAmount = (amount) => {
  if (amount >= 1000000000) {
    return `${(amount / 1000000000).toFixed(1)}B`;
  } else if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1)}M`;
  } else if (amount >= 1000) {
    return `${(amount / 1000).toFixed(0)}K`;
  }
  return amount.toString();
};

export default function Admin() {
  // Auth state
  const [userFid, setUserFid] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [authLoading, setAuthLoading] = useState(true);

  // UI state
  const [message, setMessage] = useState('');
  const [activeSection, setActiveSection] = useState('battles'); // battles, projects, automation, claims, tools, history

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

  // Featured History state
  const [featuredHistory, setFeaturedHistory] = useState([]);

  // Claims state (default to false = claims enabled)
  const [claimsDisabled, setClaimsDisabled] = useState(false);
  const [claimStats, setClaimStats] = useState(null);
  const [blockedFids, setBlockedFids] = useState([]);
  const [claimAmount, setClaimAmount] = useState('40000');
  const [blockFidInput, setBlockFidInput] = useState('');

  // Tools state
  const [traceWalletAddress, setTraceWalletAddress] = useState('');
  const [traceResult, setTraceResult] = useState(null);
  const [tracingWallet, setTracingWallet] = useState(false);

  // Chat moderation state
  const [deleteMessageId, setDeleteMessageId] = useState('');
  const [deletingMessage, setDeletingMessage] = useState(false);
  const [deleteResult, setDeleteResult] = useState(null);

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
    } else if (activeSection === 'history') {
      fetchFeaturedHistory();
    } else if (activeSection === 'claims') {
      fetchClaimStats();
      fetchBlockedFids();
      fetchClaimAmount();
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
    if (!confirm('Create a new MOOD. battle?')) return;

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

  const handleStartEdit = (project) => {
    setEditingProject(project.id);
    setEditFormData({
      name: project.name || '',
      tagline: project.tagline || '',
      description: project.description || '',
      builder: project.builder || '',
      builderFid: project.builderFid || '',
      tokenName: project.tokenName || '',
      tokenContractAddress: project.tokenContractAddress || '',
      category: project.category || 'main',
      links: project.links || { twitter: '', website: '', farcaster: '' },
      views: project.views || 0,
      clicks: project.clicks || 0,
    });
    // Scroll to edit form
    setTimeout(() => {
      editFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  const handleCancelEdit = () => {
    setEditingProject(null);
    setEditFormData({});
  };

  const handleSaveEdit = async () => {
    if (!editingProject) return;

    try {
      setMessage('Saving changes...');

      // Extract views and clicks for stats object
      const { views, clicks, links, ...otherData } = editFormData;

      const response = await fetch('/api/admin/update-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          projectId: editingProject,
          ...otherData,
          twitter: links?.twitter,
          website: links?.website,
          farcaster: links?.farcaster,
          stats: {
            views: views || 0,
            clicks: clicks || 0,
          },
        }),
      });

      if (response.ok) {
        setMessage('✅ Project updated successfully!');
        setEditingProject(null);
        setEditFormData({});
        fetchLiveProjects();
        fetchSubmissions();
      } else {
        const data = await response.json();
        setMessage(`Error: ${data.error}`);
      }
    } catch (error) {
      setMessage('Error saving project');
      console.error('Error saving project:', error);
    }
  };

  const handleEditFormChange = (field, value) => {
    setEditFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleEditLinksChange = (platform, value) => {
    setEditFormData(prev => ({
      ...prev,
      links: {
        ...prev.links,
        [platform]: value,
      },
    }));
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

  const fetchFeaturedHistory = async () => {
    try {
      const response = await fetch('/api/admin/featured-history', {
        credentials: 'include',
      });
      const data = await response.json();
      if (response.ok) {
        setFeaturedHistory(data.history || []);
      }
    } catch (error) {
      console.error('Error fetching featured history:', error);
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
        method: 'GET',
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        console.log('[ADMIN] Claim stats fetched:', data);
        setClaimStats(data);
        // Explicitly handle disabled state (default to false if undefined)
        setClaimsDisabled(data.disabled === true);
      } else {
        console.error('[ADMIN] Failed to fetch claim stats:', response.status);
      }
    } catch (error) {
      console.error('[ADMIN] Error fetching claim stats:', error);
    }
  };

  const fetchClaimAmount = async () => {
    try {
      const response = await fetch('/api/admin/claim-amount', {
        method: 'GET',
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setClaimAmount(data.claimAmount);
      }
    } catch (error) {
      console.error('Error fetching claim amount:', error);
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

  const handleSaveClaimAmount = async () => {
    if (!claimAmount || isNaN(claimAmount) || parseFloat(claimAmount) <= 0) {
      setMessage('Error: Invalid claim amount');
      return;
    }

    try {
      setMessage('Saving claim amount...');
      const response = await fetch('/api/admin/claim-amount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ amount: claimAmount }),
      });

      if (response.ok) {
        setMessage('✅ Claim amount updated successfully!');
        fetchClaimAmount();
      } else {
        const data = await response.json();
        setMessage(`Error: ${data.error}`);
      }
    } catch (error) {
      setMessage('Error saving claim amount');
      console.error('Error saving claim amount:', error);
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

  const handleDeleteMessage = async () => {
    if (!deleteMessageId) return;

    setDeletingMessage(true);
    setDeleteResult(null);
    try {
      const response = await fetch('/api/admin/delete-message', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ messageId: deleteMessageId }),
      });
      const data = await response.json();
      if (response.ok) {
        setDeleteResult({ success: true, message: 'Message deleted successfully' });
        setDeleteMessageId('');
      } else {
        setDeleteResult({ success: false, error: data.error });
      }
    } catch (error) {
      setDeleteResult({ success: false, error: 'Failed to delete message' });
    } finally {
      setDeletingMessage(false);
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
            { id: 'history', label: 'HISTORY' },
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
            onEdit={handleStartEdit}
            editingProject={editingProject}
            editFormData={editFormData}
            onEditFormChange={handleEditFormChange}
            onEditLinksChange={handleEditLinksChange}
            onSaveEdit={handleSaveEdit}
            onCancelEdit={handleCancelEdit}
            editFormRef={editFormRef}
          />
        )}

        {activeSection === 'automation' && (
          <AutomationSection
            currentFeatured={currentFeatured}
            onTriggerAutoFeature={handleManualAutoFeature}
          />
        )}

        {activeSection === 'history' && (
          <HistorySection
            featuredHistory={featuredHistory}
            onRefresh={fetchFeaturedHistory}
          />
        )}

        {activeSection === 'claims' && (
          <ClaimsSection
            claimsDisabled={claimsDisabled}
            claimStats={claimStats}
            blockedFids={blockedFids}
            blockFidInput={blockFidInput}
            claimAmount={claimAmount}
            onToggleClaims={handleToggleClaims}
            onBlockFid={handleBlockFid}
            onUnblockFid={handleUnblockFid}
            setBlockFidInput={setBlockFidInput}
            setClaimAmount={setClaimAmount}
            onSaveClaimAmount={handleSaveClaimAmount}
          />
        )}

        {activeSection === 'tools' && (
          <ToolsSection
            traceWalletAddress={traceWalletAddress}
            traceResult={traceResult}
            tracingWallet={tracingWallet}
            setTraceWalletAddress={setTraceWalletAddress}
            onTraceWallet={handleTraceWallet}
            deleteMessageId={deleteMessageId}
            deletingMessage={deletingMessage}
            deleteResult={deleteResult}
            setDeleteMessageId={setDeleteMessageId}
            onDeleteMessage={handleDeleteMessage}
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
              <div className="text-sm text-gray-400">Pool: {formatAmount(currentBattle.poolA)} $SEEN</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">PROJECT B</div>
              <div className="text-xl font-black">{currentBattle.projectB.name}</div>
              <div className="text-sm text-gray-400">Score: {currentBattle.scoreB}</div>
              <div className="text-sm text-gray-400">Pool: {formatAmount(currentBattle.poolB)} $SEEN</div>
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

const ProjectSection = ({
  submissions,
  liveProjects,
  loading,
  onApprove,
  onFeature,
  onEdit,
  editingProject,
  editFormData,
  onEditFormChange,
  onEditLinksChange,
  onSaveEdit,
  onCancelEdit,
  editFormRef
}) => (
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
            {editingProject === project.id ? (
              /* Edit Form */
              <div ref={editFormRef} className="bg-neutral-900 p-5 space-y-4">
                <h3 className="text-lg font-black mb-4">EDITING: {project.name}</h3>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">Name</label>
                  <input
                    type="text"
                    value={editFormData.name || ''}
                    onChange={(e) => onEditFormChange('name', e.target.value)}
                    className="w-full bg-black border border-white/30 px-3 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">Tagline</label>
                  <input
                    type="text"
                    value={editFormData.tagline || ''}
                    onChange={(e) => onEditFormChange('tagline', e.target.value)}
                    className="w-full bg-black border border-white/30 px-3 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">Description</label>
                  <textarea
                    value={editFormData.description || ''}
                    onChange={(e) => onEditFormChange('description', e.target.value)}
                    rows={3}
                    className="w-full bg-black border border-white/30 px-3 py-2 text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Builder</label>
                    <input
                      type="text"
                      value={editFormData.builder || ''}
                      onChange={(e) => onEditFormChange('builder', e.target.value)}
                      className="w-full bg-black border border-white/30 px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Builder FID</label>
                    <input
                      type="text"
                      value={editFormData.builderFid || ''}
                      onChange={(e) => onEditFormChange('builderFid', e.target.value)}
                      className="w-full bg-black border border-white/30 px-3 py-2 text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">Category</label>
                  <select
                    value={editFormData.category || 'main'}
                    onChange={(e) => onEditFormChange('category', e.target.value)}
                    className="w-full bg-black border border-white/30 px-3 py-2 text-white"
                  >
                    <option value="main">Featured</option>
                    <option value="voting">Vote</option>
                    <option value="defi">DeFi</option>
                    <option value="tokens">Tokens</option>
                    <option value="social">Social</option>
                    <option value="games">Games</option>
                    <option value="tools">Tools</option>
                    <option value="nft">NFT</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Token Name</label>
                    <input
                      type="text"
                      value={editFormData.tokenName || ''}
                      onChange={(e) => onEditFormChange('tokenName', e.target.value)}
                      className="w-full bg-black border border-white/30 px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Token Contract</label>
                    <input
                      type="text"
                      value={editFormData.tokenContractAddress || ''}
                      onChange={(e) => onEditFormChange('tokenContractAddress', e.target.value)}
                      className="w-full bg-black border border-white/30 px-3 py-2 text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-2">Links</label>
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Twitter URL"
                      value={editFormData.links?.twitter || ''}
                      onChange={(e) => onEditLinksChange('twitter', e.target.value)}
                      className="w-full bg-black border border-white/30 px-3 py-2 text-white"
                    />
                    <input
                      type="text"
                      placeholder="Website URL"
                      value={editFormData.links?.website || ''}
                      onChange={(e) => onEditLinksChange('website', e.target.value)}
                      className="w-full bg-black border border-white/30 px-3 py-2 text-white"
                    />
                    <input
                      type="text"
                      placeholder="Farcaster URL"
                      value={editFormData.links?.farcaster || ''}
                      onChange={(e) => onEditLinksChange('farcaster', e.target.value)}
                      className="w-full bg-black border border-white/30 px-3 py-2 text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Views</label>
                    <input
                      type="number"
                      value={editFormData.views || 0}
                      onChange={(e) => onEditFormChange('views', parseInt(e.target.value) || 0)}
                      className="w-full bg-black border border-white/30 px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Clicks</label>
                    <input
                      type="number"
                      value={editFormData.clicks || 0}
                      onChange={(e) => onEditFormChange('clicks', parseInt(e.target.value) || 0)}
                      className="w-full bg-black border border-white/30 px-3 py-2 text-white"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={onSaveEdit}
                    className="flex-1 px-4 py-3 bg-green-600 text-white font-black hover:bg-green-500"
                  >
                    SAVE CHANGES
                  </button>
                  <button
                    onClick={onCancelEdit}
                    className="px-4 py-3 border border-white/30 text-white font-black hover:bg-white/10"
                  >
                    CANCEL
                  </button>
                </div>
              </div>
            ) : (
              /* Normal View */
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
                  <div className="text-xs text-gray-600 mt-1 space-x-4">
                    <span>Votes: {project.votes || 0}</span>
                    <span>Views: {formatAmount(project.stats?.views || 0)}</span>
                    <span>Clicks: {formatAmount(project.stats?.clicks || 0)}</span>
                    <span>Total: {formatAmount((project.stats?.views || 0) + (project.stats?.clicks || 0))}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onEdit(project)}
                    className="px-4 py-2 border border-blue-500 text-blue-500 font-black hover:bg-blue-500 hover:text-black"
                  >
                    EDIT
                  </button>
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
            )}
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

const HistorySection = ({ featuredHistory, onRefresh }) => (
  <div className="space-y-6">
    <div className="border border-white p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-black">FEATURED HISTORY ({featuredHistory.length})</h2>
        <button
          onClick={onRefresh}
          className="px-4 py-2 border border-white text-white font-black hover:bg-white hover:text-black"
        >
          REFRESH
        </button>
      </div>

      {featuredHistory.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No featured history yet
        </div>
      )}

      <div className="space-y-4">
        {featuredHistory.map((entry) => (
          <div key={entry.id} className="border border-white/30 p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="text-xl font-black">{entry.projectName}</div>
                <div className="text-sm text-gray-400">{entry.builder}</div>
              </div>
              <div className="text-xs text-gray-500">
                {((entry.duration || 0) / (60 * 60 * 1000)).toFixed(1)}h
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4 mt-3">
              <div>
                <div className="text-xs text-gray-500">Views</div>
                <div className="text-lg font-black">{formatAmount(entry.stats?.views || 0)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Clicks</div>
                <div className="text-lg font-black">{formatAmount(entry.stats?.clicks || 0)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Votes</div>
                <div className="text-lg font-black">{entry.stats?.votes || 0}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Tips</div>
                <div className="text-lg font-black">{formatAmount(entry.stats?.tips || 0)}</div>
              </div>
            </div>

            <div className="text-xs text-gray-600 mt-3">
              {new Date(entry.featuredAt).toLocaleDateString()} → {new Date(entry.unfeaturedAt).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const ClaimsSection = ({ claimsDisabled, claimStats, blockedFids, blockFidInput, claimAmount, onToggleClaims, onBlockFid, onUnblockFid, setBlockFidInput, setClaimAmount, onSaveClaimAmount }) => (
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

      {/* Claim Amount Configuration */}
      <div className="border-t border-white/30 pt-6 pb-6">
        <h3 className="text-lg font-black mb-3">CLAIM AMOUNT</h3>
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="40000"
            value={claimAmount}
            onChange={(e) => setClaimAmount(e.target.value)}
            className="flex-1 p-2 bg-black border border-white text-white"
          />
          <button
            onClick={onSaveClaimAmount}
            className="px-4 py-2 bg-blue-600 text-white font-black hover:bg-blue-500"
          >
            SAVE AMOUNT
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">Current amount users will receive per claim</p>
      </div>

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

const ToolsSection = ({
  traceWalletAddress,
  traceResult,
  tracingWallet,
  setTraceWalletAddress,
  onTraceWallet,
  deleteMessageId,
  deletingMessage,
  deleteResult,
  setDeleteMessageId,
  onDeleteMessage
}) => (
  <div className="space-y-6">
    {/* Chat Moderation */}
    <div className="border border-white p-6">
      <h2 className="text-2xl font-black mb-4">CHAT MODERATION</h2>
      <p className="text-sm text-gray-500 mb-4">Delete chat messages by ID (visible next to each message in chat)</p>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="Message ID (e.g., 1735123456789)"
          value={deleteMessageId}
          onChange={(e) => setDeleteMessageId(e.target.value)}
          className="flex-1 p-3 bg-black border border-white text-white font-mono"
        />
        <button
          onClick={onDeleteMessage}
          disabled={deletingMessage || !deleteMessageId}
          className="px-6 py-3 bg-red-600 text-white font-black hover:bg-red-500 disabled:opacity-50"
        >
          {deletingMessage ? 'DELETING...' : 'DELETE'}
        </button>
      </div>

      {deleteResult && (
        <div className={`border p-4 ${deleteResult.success ? 'border-green-500 text-green-400' : 'border-red-500 text-red-400'}`}>
          {deleteResult.success ? deleteResult.message : deleteResult.error}
        </div>
      )}
    </div>

    {/* Wallet Tracer */}
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
