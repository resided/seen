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
  const [showLogin, setShowLogin] = useState(false);
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [liveProjects, setLiveProjects] = useState([]);
  const [liveProjectsLoading, setLiveProjectsLoading] = useState(false);
  const [archivedProjects, setArchivedProjects] = useState([]);
  const [archivedProjectsLoading, setArchivedProjectsLoading] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    tagline: '',
    description: '',
    builder: '',
    builderFid: '',
    category: 'main',
    status: 'queued',
    miniapp: '',
    website: '',
    github: '',
    twitter: '',
    stats: {
      views: 0,
      clicks: 0,
      tips: 0,
    },
  });
  const [createFormData, setCreateFormData] = useState({
    name: '',
    tagline: '',
    description: '',
    builder: '',
    builderFid: '',
    category: 'main',
    miniapp: '',
    website: '',
    github: '',
    twitter: '',
    setAsFeatured: false,
    stats: {
      views: 0,
      clicks: 0,
      tips: 0,
    },
  });

  // Check authentication (FID or session cookie)
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Try Farcaster SDK first
        try {
          const context = await sdk.context;
          if (context?.user?.fid) {
            const fid = context.user.fid;
            setUserFid(fid);
            if (fid === ADMIN_FID) {
              setIsAuthenticated(true);
              setAuthLoading(false);
              return;
            }
          }
        } catch (error) {
          // Not in Farcaster, check for session cookie
        }

        // Check for session cookie (web access)
        const checkSession = async () => {
          try {
            const response = await fetch('/api/admin/submissions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ checkSession: true }),
              credentials: 'include',
            });
            
            if (response.ok) {
              setIsAuthenticated(true);
            } else {
              setShowLogin(true);
            }
          } catch (error) {
            setShowLogin(true);
          } finally {
            setAuthLoading(false);
          }
        };

        checkSession();
      } catch (error) {
        console.error('Error checking auth:', error);
        setShowLogin(true);
        setAuthLoading(false);
      }
    };
    
    checkAuth();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchSubmissions();
      fetchLiveProjects();
    }
  }, [isAuthenticated]);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData),
        credentials: 'include',
      });

      const data = await response.json();
      if (response.ok) {
        setIsAuthenticated(true);
        setShowLogin(false);
        setMessage('Login successful!');
      } else {
        setMessage(data.error || 'Login failed');
      }
    } catch (error) {
      setMessage('Error logging in');
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
      setSubmissions([]);
      setMessage('Logged out successfully');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const fetchSubmissions = async () => {
    try {
      const response = await fetch('/api/admin/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fid: userFid || null }),
        credentials: 'include',
      });
      
      if (response.status === 403) {
        setIsAuthenticated(false);
        setShowLogin(true);
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

  const fetchLiveProjects = async () => {
    setLiveProjectsLoading(true);
    try {
      const response = await fetch('/api/admin/live-projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fid: userFid || null }),
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setLiveProjects(data.projects || []);
      }
    } catch (error) {
      console.error('Error fetching live projects:', error);
    } finally {
      setLiveProjectsLoading(false);
    }
  };

  const fetchArchivedProjects = async () => {
    setArchivedProjectsLoading(true);
    try {
      const response = await fetch('/api/admin/archived-projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fid: userFid || null }),
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setArchivedProjects(data.projects || []);
      }
    } catch (error) {
      console.error('Error fetching archived projects:', error);
    } finally {
      setArchivedProjectsLoading(false);
    }
  };

  const handleEdit = async (project) => {
    // Fetch fresh project data by ID to ensure we have the latest
    try {
      const response = await fetch('/api/admin/get-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, fid: userFid || null }),
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        const freshProject = data.project || project;
        setEditingProject(freshProject);
        setEditFormData({
          name: freshProject.name || '',
          tagline: freshProject.tagline || '',
          description: freshProject.description || '',
          builder: freshProject.builder || '',
          builderFid: freshProject.builderFid || '',
          category: freshProject.category || 'main',
          status: freshProject.status || 'queued',
          miniapp: freshProject.links?.miniapp || '',
          website: freshProject.links?.website || '',
          github: freshProject.links?.github || '',
          twitter: freshProject.links?.twitter || '',
          stats: freshProject.stats || { views: 0, clicks: 0, tips: 0 },
        });
      } else {
        // Fallback to using the project passed in
        setEditingProject(project);
        setEditFormData({
          name: project.name || '',
          tagline: project.tagline || '',
          description: project.description || '',
          builder: project.builder || '',
          builderFid: project.builderFid || '',
          category: project.category || 'main',
          status: project.status || 'queued',
          miniapp: project.links?.miniapp || '',
          website: project.links?.website || '',
          github: project.links?.github || '',
          twitter: project.links?.twitter || '',
          stats: project.stats || { views: 0, clicks: 0, tips: 0 },
        });
      }
    } catch (error) {
      console.error('Error fetching project for edit:', error);
      // Fallback to using the project passed in
      setEditingProject(project);
      setEditFormData({
        name: project.name || '',
        tagline: project.tagline || '',
        description: project.description || '',
        builder: project.builder || '',
        builderFid: project.builderFid || '',
        category: project.category || 'main',
        status: project.status || 'queued',
        miniapp: project.links?.miniapp || '',
        website: project.links?.website || '',
        github: project.links?.github || '',
        twitter: project.links?.twitter || '',
        stats: project.stats || { views: 0, clicks: 0, tips: 0 },
      });
    }
  };

  const handleUpdateProject = async (e) => {
    e.preventDefault();
    setUpdating(true);
    setMessage('');

    try {
      const response = await fetch('/api/admin/update-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: editingProject.id,
          ...editFormData,
          fid: userFid || null,
        }),
        credentials: 'include',
      });

      const data = await response.json();
      if (response.ok) {
        setMessage(data.message || 'Project updated successfully!');
        setEditingProject(null);
        fetchLiveProjects(); // Refresh live projects
        fetchArchivedProjects(); // Refresh archived projects
        fetchSubmissions(); // Refresh submissions in case status changed
      } else {
        setMessage(data.error || 'Failed to update project');
      }
    } catch (error) {
      setMessage('Error updating project');
    } finally {
      setUpdating(false);
    }
  };

  const handleEditFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name.startsWith('stats.')) {
      const statName = name.split('.')[1];
      setEditFormData({
        ...editFormData,
        stats: {
          ...editFormData.stats,
          [statName]: parseFloat(value) || 0,
        },
      });
    } else {
      setEditFormData({
        ...editFormData,
        [name]: type === 'checkbox' ? checked : value,
      });
    }
  };

  const handleApprove = async (projectId) => {
    try {
      const response = await fetch('/api/admin/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, action: 'approve', fid: userFid || null }),
        credentials: 'include',
      });

      const data = await response.json();
      if (response.ok) {
        setMessage(`Project ${projectId} approved and added to queue!`);
        fetchSubmissions(); // Refresh list
        fetchLiveProjects(); // Refresh live projects
      } else {
        setMessage(data.error || 'Failed to approve');
      }
    } catch (error) {
      setMessage('Error approving project');
    }
  };

  const handleFeature = async (projectId) => {
    if (!confirm('Feature this project immediately? This will replace the current featured project.')) {
      return;
    }

    try {
      const response = await fetch('/api/admin/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, action: 'feature', fid: userFid || null }),
        credentials: 'include',
      });

      const data = await response.json();
      if (response.ok) {
        setMessage(`Project ${projectId} approved and featured immediately!`);
        fetchSubmissions(); // Refresh list
        fetchLiveProjects(); // Refresh live projects
      } else {
        setMessage(data.error || 'Failed to feature project');
      }
    } catch (error) {
      setMessage('Error featuring project');
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
        body: JSON.stringify({ projectId, action: 'reject', fid: userFid || null }),
        credentials: 'include',
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

  const handleArchive = async (projectId, archive = true) => {
    const action = archive ? 'archive' : 'unarchive';
    const confirmMsg = archive 
      ? 'Are you sure you want to archive this project? It will be hidden from the queue but can be restored later.'
      : 'Are you sure you want to restore this project?';
    
    if (!confirm(confirmMsg)) {
      return;
    }

    try {
      const response = await fetch('/api/admin/update-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          projectId, 
          status: archive ? 'archived' : 'queued',
          fid: userFid || null 
        }),
        credentials: 'include',
      });

      const data = await response.json();
      if (response.ok) {
        setMessage(`Project ${projectId} ${archive ? 'archived' : 'restored'}!`);
        fetchLiveProjects(); // Refresh live projects
        fetchArchivedProjects(); // Refresh archived projects
      } else {
        setMessage(data.error || `Failed to ${action} project`);
      }
    } catch (error) {
      setMessage(`Error ${action}ing project`);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    setCreating(true);
    setMessage('');

    try {
      const response = await fetch('/api/admin/create-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...createFormData,
          fid: userFid || null,
        }),
        credentials: 'include',
      });

      const data = await response.json();
      if (response.ok) {
        setMessage(data.message || 'Project created successfully!');
        setShowCreateForm(false);
        fetchLiveProjects(); // Refresh live projects
        // Reset form
        setCreateFormData({
          name: '',
          tagline: '',
          description: '',
          builder: '',
          builderFid: '',
          category: 'main',
          miniapp: '',
          website: '',
          github: '',
          twitter: '',
          setAsFeatured: false,
          stats: {
            views: 0,
            clicks: 0,
            tips: 0,
          },
        });
      } else {
        setMessage(data.error || 'Failed to create project');
      }
    } catch (error) {
      setMessage('Error creating project');
    } finally {
      setCreating(false);
    }
  };

  const handleCreateFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name.startsWith('stats.')) {
      const statName = name.split('.')[1];
      setCreateFormData({
        ...createFormData,
        stats: {
          ...createFormData.stats,
          [statName]: parseFloat(value) || 0,
        },
      });
    } else {
      setCreateFormData({
        ...createFormData,
        [name]: type === 'checkbox' ? checked : value,
      });
    }
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

  if (showLogin || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
        <div className="border border-white p-8 max-w-md w-full">
          <h1 className="text-2xl font-black mb-6">ADMIN LOGIN</h1>
          {message && (
            <div className={`mb-4 p-3 border ${message.includes('success') ? 'border-white bg-white text-black' : 'border-red-500 text-red-500'}`}>
              {message}
            </div>
          )}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
                USERNAME
              </label>
              <input
                type="text"
                value={loginData.username}
                onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
                required
                className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black"
                placeholder="Enter username"
              />
            </div>
            <div>
              <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
                PASSWORD
              </label>
              <input
                type="password"
                value={loginData.password}
                onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                required
                className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black"
                placeholder="Enter password"
              />
            </div>
            <button
              type="submit"
              className="w-full py-3 bg-white text-black font-black text-sm tracking-[0.2em] hover:bg-gray-200 transition-all"
            >
              LOGIN
            </button>
          </form>
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
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-black mb-2">ADMIN PANEL</h1>
              <p className="text-sm text-gray-500">Manage Project Submissions</p>
              {userFid && (
                <p className="text-xs text-gray-600 mt-1">Authenticated as FID: {userFid}</p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="px-4 py-2 bg-yellow-500 text-black font-bold hover:bg-yellow-400 transition-all"
              >
                {showCreateForm ? 'CANCEL' : '+ CREATE PROJECT'}
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 border border-white text-sm hover:bg-white hover:text-black transition-all"
              >
                LOGOUT
              </button>
            </div>
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

          {/* Edit Project Modal */}
          {editingProject && (
            <div className="mb-8 border border-white p-6 bg-black">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-black">EDIT PROJECT: {editingProject.name}</h2>
                  <p className="text-xs text-gray-500 mt-1">Project ID: {editingProject.id} | Builder: {editingProject.builder}</p>
                </div>
                <button
                  onClick={() => setEditingProject(null)}
                  className="text-white hover:text-gray-400 text-2xl"
                >
                  ×
                </button>
              </div>
              <form onSubmit={handleUpdateProject} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
                      PROJECT NAME *
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={editFormData.name}
                      onChange={handleEditFormChange}
                      required
                      className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black"
                      placeholder="PROJECT NAME"
                    />
                  </div>
                  <div>
                    <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
                      TAGLINE *
                    </label>
                    <input
                      type="text"
                      name="tagline"
                      value={editFormData.tagline}
                      onChange={handleEditFormChange}
                      required
                      className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black"
                      placeholder="SHORT TAGLINE"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
                    DESCRIPTION *
                  </label>
                  <textarea
                    name="description"
                    value={editFormData.description}
                    onChange={handleEditFormChange}
                    required
                    rows="4"
                    className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black"
                    placeholder="DESCRIBE THE PROJECT"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
                      BUILDER NAME *
                    </label>
                    <input
                      type="text"
                      name="builder"
                      value={editFormData.builder}
                      onChange={handleEditFormChange}
                      required
                      className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black"
                      placeholder="BUILDER.ETH"
                    />
                  </div>
                  <div>
                    <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
                      BUILDER FID (OPTIONAL)
                    </label>
                    <input
                      type="number"
                      name="builderFid"
                      value={editFormData.builderFid}
                      onChange={handleEditFormChange}
                      className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black"
                      placeholder="12345"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
                      CATEGORY *
                    </label>
                    <select
                      name="category"
                      value={editFormData.category}
                      onChange={handleEditFormChange}
                      required
                      className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black"
                    >
                      <option value="main">FEATURED</option>
                      <option value="defi">DEFI</option>
                      <option value="social">SOCIAL</option>
                      <option value="games">GAMES</option>
                      <option value="tools">TOOLS</option>
                      <option value="nft">NFT</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
                      STATUS *
                    </label>
                    <select
                      name="status"
                      value={editFormData.status}
                      onChange={handleEditFormChange}
                      required
                      className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black"
                    >
                      <option value="queued">QUEUED</option>
                      <option value="featured">FEATURED</option>
                      <option value="archived">ARCHIVED</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
                    MINI APP URL
                  </label>
                  <input
                    type="url"
                    name="miniapp"
                    value={editFormData.miniapp}
                    onChange={handleEditFormChange}
                    className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black"
                    placeholder="https://warpcast.com/~/mini-app/..."
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
                      WEBSITE
                    </label>
                    <input
                      type="url"
                      name="website"
                      value={editFormData.website}
                      onChange={handleEditFormChange}
                      className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black"
                      placeholder="https://..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
                      GITHUB
                    </label>
                    <input
                      type="url"
                      name="github"
                      value={editFormData.github}
                      onChange={handleEditFormChange}
                      className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black"
                      placeholder="https://github.com/..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
                      TWITTER / X
                    </label>
                    <input
                      type="text"
                      name="twitter"
                      value={editFormData.twitter}
                      onChange={handleEditFormChange}
                      className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black"
                      placeholder="@username"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
                      VIEWS
                    </label>
                    <input
                      type="number"
                      name="stats.views"
                      value={editFormData.stats.views}
                      onChange={handleEditFormChange}
                      className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
                      CLICKS
                    </label>
                    <input
                      type="number"
                      name="stats.clicks"
                      value={editFormData.stats.clicks}
                      onChange={handleEditFormChange}
                      className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
                      TIPS (ETH)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      name="stats.tips"
                      value={editFormData.stats.tips}
                      onChange={handleEditFormChange}
                      className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setEditingProject(null)}
                    className="px-6 py-2 border border-white font-bold hover:bg-white hover:text-black transition-all"
                  >
                    CANCEL
                  </button>
                  <button
                    type="submit"
                    disabled={updating}
                    className="px-6 py-2 bg-white text-black font-bold hover:bg-gray-200 transition-all disabled:opacity-50"
                  >
                    {updating ? 'UPDATING...' : 'UPDATE PROJECT'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Live Projects Section */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-black">LIVE PROJECTS</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowArchived(!showArchived);
                    if (!showArchived) {
                      fetchArchivedProjects();
                    }
                  }}
                  className="px-4 py-2 border border-white text-sm hover:bg-white hover:text-black transition-all"
                >
                  {showArchived ? 'HIDE ARCHIVED' : 'SHOW ARCHIVED'}
                </button>
                <button
                  onClick={fetchLiveProjects}
                  className="px-4 py-2 border border-white text-sm hover:bg-white hover:text-black transition-all"
                >
                  REFRESH
                </button>
              </div>
            </div>
            {liveProjectsLoading ? (
              <div className="text-center py-8 border border-white">
                <div className="text-gray-500">Loading live projects...</div>
              </div>
            ) : liveProjects.length === 0 ? (
              <div className="text-center py-8 border border-white">
                <div className="text-gray-500">NO LIVE PROJECTS</div>
              </div>
            ) : (
              <div className="space-y-4">
                {liveProjects.map((project) => (
                  <div key={project.id} className="border border-white p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-black">{project.name}</h3>
                          <span className={`text-[10px] tracking-[0.2em] px-2 py-1 border ${
                            project.status === 'featured'
                              ? 'border-yellow-500 text-yellow-500 bg-yellow-500/10'
                              : 'border-white text-white'
                          }`}>
                            {project.status?.toUpperCase() || 'QUEUED'}
                          </span>
                          <span className="text-[10px] tracking-[0.2em] px-2 py-1 bg-white text-black">
                            {project.category === 'main' ? 'FEATURED' : (project.category?.toUpperCase() || 'FEATURED')}
                          </span>
                        </div>
                        <p className="text-sm text-gray-400 mb-1">{project.tagline}</p>
                        <p className="text-xs text-gray-500 mb-2">{project.description?.substring(0, 100)}...</p>
                        <div className="text-xs text-gray-600">
                          <span>Builder: {project.builder}</span>
                          {project.stats && (
                            <span className="ml-4">
                              Views: {project.stats.views || 0} | Clicks: {project.stats.clicks || 0} | Tips: {project.stats.tips || 0}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(project)}
                          className="px-4 py-2 bg-blue-500 text-white font-bold hover:bg-blue-400 transition-all"
                        >
                          EDIT
                        </button>
                        <button
                          onClick={() => handleArchive(project.id, true)}
                          className="px-4 py-2 bg-gray-600 text-white font-bold hover:bg-gray-500 transition-all"
                        >
                          ARCHIVE
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Archived Projects Section */}
          {showArchived && (
            <div className="mb-8 border-t border-white pt-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-black">ARCHIVED PROJECTS</h2>
                <button
                  onClick={fetchArchivedProjects}
                  className="px-4 py-2 border border-white text-sm hover:bg-white hover:text-black transition-all"
                >
                  REFRESH
                </button>
              </div>
              {archivedProjectsLoading ? (
                <div className="text-center py-8 border border-white">
                  <div className="text-gray-500">Loading archived projects...</div>
                </div>
              ) : archivedProjects.length === 0 ? (
                <div className="text-center py-8 border border-white">
                  <div className="text-gray-500">NO ARCHIVED PROJECTS</div>
                </div>
              ) : (
                <div className="space-y-4">
                  {archivedProjects.map((project) => (
                    <div key={project.id} className="border border-gray-600 p-4 opacity-75">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-xl font-black">{project.name}</h3>
                            <span className="text-[10px] tracking-[0.2em] px-2 py-1 border border-gray-500 text-gray-500">
                              ARCHIVED
                            </span>
                            <span className="text-[10px] tracking-[0.2em] px-2 py-1 bg-gray-600 text-white">
                              {project.category === 'main' ? 'FEATURED' : (project.category?.toUpperCase() || 'FEATURED')}
                            </span>
                          </div>
                          <p className="text-sm text-gray-400 mb-1">{project.tagline}</p>
                          <p className="text-xs text-gray-500 mb-2">{project.description?.substring(0, 100)}...</p>
                          <div className="text-xs text-gray-600">
                            <span>Builder: {project.builder}</span>
                            {project.stats && (
                              <span className="ml-4">
                                Views: {project.stats.views || 0} | Clicks: {project.stats.clicks || 0} | Tips: {project.stats.tips || 0}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(project)}
                            className="px-4 py-2 bg-blue-500 text-white font-bold hover:bg-blue-400 transition-all"
                          >
                            EDIT
                          </button>
                          <button
                            onClick={() => handleArchive(project.id, false)}
                            className="px-4 py-2 bg-green-600 text-white font-bold hover:bg-green-500 transition-all"
                          >
                            RESTORE
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="mb-8 border-t border-white pt-8">
            <h2 className="text-2xl font-black mb-4">PENDING SUBMISSIONS</h2>
          </div>

          {showCreateForm && (
            <div className="mb-8 border border-white p-6">
              <h2 className="text-2xl font-black mb-4">CREATE PROJECT</h2>
              <form onSubmit={handleCreateProject} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
                      PROJECT NAME *
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={createFormData.name}
                      onChange={handleCreateFormChange}
                      required
                      className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black"
                      placeholder="PROJECT NAME"
                    />
                  </div>
                  <div>
                    <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
                      TAGLINE *
                    </label>
                    <input
                      type="text"
                      name="tagline"
                      value={createFormData.tagline}
                      onChange={handleCreateFormChange}
                      required
                      className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black"
                      placeholder="SHORT TAGLINE"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
                    DESCRIPTION *
                  </label>
                  <textarea
                    name="description"
                    value={createFormData.description}
                    onChange={handleCreateFormChange}
                    required
                    rows="4"
                    className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black"
                    placeholder="DESCRIBE THE PROJECT"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
                      BUILDER NAME *
                    </label>
                    <input
                      type="text"
                      name="builder"
                      value={createFormData.builder}
                      onChange={handleCreateFormChange}
                      required
                      className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black"
                      placeholder="BUILDER.ETH"
                    />
                  </div>
                  <div>
                    <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
                      BUILDER FID (OPTIONAL)
                    </label>
                    <input
                      type="number"
                      name="builderFid"
                      value={createFormData.builderFid}
                      onChange={handleCreateFormChange}
                      className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black"
                      placeholder="12345"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
                      CATEGORY *
                    </label>
                    <select
                      name="category"
                      value={createFormData.category}
                      onChange={handleCreateFormChange}
                      required
                      className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black"
                    >
                      <option value="main">FEATURED</option>
                      <option value="defi">DEFI</option>
                      <option value="social">SOCIAL</option>
                      <option value="games">GAMES</option>
                      <option value="tools">TOOLS</option>
                      <option value="nft">NFT</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
                      MINI APP URL
                    </label>
                    <input
                      type="url"
                      name="miniapp"
                      value={createFormData.miniapp}
                      onChange={handleCreateFormChange}
                      className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black"
                      placeholder="https://warpcast.com/~/mini-app/..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
                      WEBSITE
                    </label>
                    <input
                      type="url"
                      name="website"
                      value={createFormData.website}
                      onChange={handleCreateFormChange}
                      className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black"
                      placeholder="https://..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
                      GITHUB
                    </label>
                    <input
                      type="url"
                      name="github"
                      value={createFormData.github}
                      onChange={handleCreateFormChange}
                      className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black"
                      placeholder="https://github.com/..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
                      TWITTER / X
                    </label>
                    <input
                      type="text"
                      name="twitter"
                      value={createFormData.twitter}
                      onChange={handleCreateFormChange}
                      className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black"
                      placeholder="@username"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
                      VIEWS (INITIAL)
                    </label>
                    <input
                      type="number"
                      name="stats.views"
                      value={createFormData.stats.views}
                      onChange={handleCreateFormChange}
                      className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black"
                      placeholder="0"
                    />
                    <p className="text-[10px] text-gray-600 mt-1">Will be tracked automatically</p>
                  </div>
                  <div>
                    <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
                      CLICKS (INITIAL)
                    </label>
                    <input
                      type="number"
                      name="stats.clicks"
                      value={createFormData.stats.clicks}
                      onChange={handleCreateFormChange}
                      className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black"
                      placeholder="0"
                    />
                    <p className="text-[10px] text-gray-600 mt-1">Will be tracked automatically</p>
                  </div>
                  <div>
                    <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
                      TIPS (ETH)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      name="stats.tips"
                      value={createFormData.stats.tips}
                      onChange={handleCreateFormChange}
                      className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-3 p-3 border border-white cursor-pointer hover:bg-white/10">
                    <input
                      type="checkbox"
                      name="setAsFeatured"
                      checked={createFormData.setAsFeatured}
                      onChange={handleCreateFormChange}
                      className="accent-white"
                    />
                    <div>
                      <div className="text-sm font-bold">SET AS FEATURED IMMEDIATELY</div>
                      <div className="text-[10px] text-gray-500">Will replace current featured project</div>
                    </div>
                  </label>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="px-6 py-2 border border-white font-bold hover:bg-white hover:text-black transition-all"
                  >
                    CANCEL
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="px-6 py-2 bg-white text-black font-bold hover:bg-gray-200 transition-all disabled:opacity-50"
                  >
                    {creating ? 'CREATING...' : 'CREATE PROJECT'}
                  </button>
                </div>
              </form>
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
                          {submission.category === 'main' ? 'FEATURED' : (submission.category?.toUpperCase() || 'FEATURED')}
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
                      onClick={() => handleFeature(submission.id)}
                      className="px-6 py-2 bg-yellow-500 text-black font-bold hover:bg-yellow-400 transition-all"
                    >
                      FEATURE NOW
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
