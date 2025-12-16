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
  const [ethPrice, setEthPrice] = useState(null);
  const [tipsUsdDisplay, setTipsUsdDisplay] = useState({ edit: '', create: '' }); // Store USD values for display
  const [claimsDisabled, setClaimsDisabled] = useState(null); // null = loading, true/false = state
  const [currentFeatured, setCurrentFeatured] = useState(null);
  const [claimStats, setClaimStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [bonusTokenConfig, setBonusTokenConfig] = useState({
    enabled: false,
    contractAddress: '',
    amount: '',
    decimals: 18,
    maxSupply: 0,
    tokenName: '',
  });
  const [loadingBonusConfig, setLoadingBonusConfig] = useState(false);
  const [showBonusTokenConfig, setShowBonusTokenConfig] = useState(false);
  const [showClaimSettings, setShowClaimSettings] = useState(false);
  const [claimSettings, setClaimSettings] = useState({
    baseClaimAmount: 80000,
    claimMultiplier: 1,
    holderMultiplier: 2,
    cooldownHours: 24,
    minNeynarScore: 0.6,
    claimsEnabled: true,
  });
  const [loadingClaimSettings, setLoadingClaimSettings] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    tagline: '',
    description: '',
    builder: '',
    builderFid: '',
    tokenName: '',
    tokenContractAddress: '',
    category: 'main',
    status: 'active',
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
    tokenName: '',
    tokenContractAddress: '',
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

  // Fetch ETH price for USD conversion
  useEffect(() => {
    const fetchEthPrice = async () => {
      try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
        if (response.ok) {
          const data = await response.json();
          if (data.ethereum?.usd) {
            setEthPrice(data.ethereum.usd);
          }
        }
      } catch (error) {
        console.error('Error fetching ETH price:', error);
        setEthPrice(2800); // Approximate fallback
      }
    };
    
    fetchEthPrice();
    // Refresh price every 60 seconds
    const interval = setInterval(fetchEthPrice, 60000);
    return () => clearInterval(interval);
  }, []);

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
          tokenName: freshProject.tokenName || '',
          tokenContractAddress: freshProject.tokenContractAddress || '',
          category: freshProject.category || 'main',
          status: freshProject.status || 'active',
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
          tokenName: project.tokenName || '',
          tokenContractAddress: project.tokenContractAddress || '',
          category: project.category || 'main',
          status: project.status || 'active',
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
        tokenName: project.tokenName || '',
        tokenContractAddress: project.tokenContractAddress || '',
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
      // Convert tips from USD back to ETH before saving
      const updateData = { ...editFormData };
      if (ethPrice && tipsUsdDisplay.edit) {
        const tipsUsd = parseFloat(tipsUsdDisplay.edit) || 0;
        updateData.stats = {
          ...updateData.stats,
          tips: tipsUsd / ethPrice, // Convert USD to ETH
        };
      }

      const response = await fetch('/api/admin/update-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: editingProject.id,
          ...updateData,
          fid: userFid || null,
        }),
        credentials: 'include',
      });

      const data = await response.json();
      if (response.ok) {
        setMessage(data.message || 'Project updated successfully! Refreshing...');
        setEditingProject(null);
        // Immediately refresh to show updated stats
        setTimeout(() => {
          fetchLiveProjects(); // Refresh live projects
          fetchArchivedProjects(); // Refresh archived projects
          fetchSubmissions(); // Refresh submissions in case status changed
          setMessage('Project updated successfully!');
        }, 500);
      } else {
        setMessage(data.error || 'Failed to update project');
      }
    } catch (error) {
      setMessage('Error updating project');
    } finally {
      setUpdating(false);
    }
  };

  const handleEditFormChange = async (e) => {
    const { name, value, type, checked } = e.target;
    if (name.startsWith('stats.')) {
      const statName = name.split('.')[1];
      if (statName === 'tips') {
        // Store USD value for tips
        setTipsUsdDisplay(prev => ({
          ...prev,
          edit: value
        }));
      } else {
        setEditFormData({
          ...editFormData,
          stats: {
            ...editFormData.stats,
            [statName]: parseFloat(value) || 0,
          },
        });
      }
    } else {
      const newFormData = {
        ...editFormData,
        [name]: type === 'checkbox' ? checked : value,
      };
      
      // Auto-populate builder info from FID when FID is entered
      if (name === 'builderFid' && value && parseInt(value) > 0) {
        try {
          const response = await fetch('/api/user-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fid: parseInt(value) }),
          });
          
          if (response.ok) {
            const userData = await response.json();
            // Auto-populate builder name if not already set or if it's empty
            if (!newFormData.builder || newFormData.builder.trim() === '') {
              newFormData.builder = userData.username || userData.displayName || '';
            }
            // Update FID
            newFormData.builderFid = userData.fid || value;
          }
        } catch (error) {
          console.error('Error fetching user data from FID:', error);
        }
      }
      
      setEditFormData(newFormData);
    }
  };

  const handleApprove = async (projectId) => {
    if (!projectId) {
      setMessage('ERROR: Invalid project ID');
      return;
    }
    
    try {
      console.log('Approving project:', projectId);
      setMessage('Approving project...');
      
      const response = await fetch('/api/admin/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: String(projectId), action: 'approve', fid: userFid || null }),
        credentials: 'include',
      });

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error('Failed to parse response:', jsonError);
        const text = await response.text();
        setMessage(`ERROR: Invalid response from server. Status: ${response.status}. Response: ${text.substring(0, 200)}`);
        return;
      }

      if (response.ok) {
        setMessage(`SUCCESS: Project ${projectId} approved and added to queue! Refreshing...`);
        // Immediately refresh to show updated status
        setTimeout(() => {
          fetchSubmissions(); // Refresh list
          fetchLiveProjects(); // Refresh live projects
          setMessage(`Project ${projectId} approved and added to queue!`);
        }, 500);
      } else {
        const errorMsg = data.error || `Failed to approve (Status: ${response.status})`;
        setMessage(`ERROR: ${errorMsg}`);
        console.error('Approve error:', { status: response.status, data, projectId });
      }
    } catch (error) {
      console.error('Error approving project:', error);
      setMessage(`ERROR: Error approving project: ${error.message || 'Network error'}`);
    }
  };

  const handleFeature = async (projectId) => {
    if (!projectId) {
      setMessage('ERROR: Invalid project ID');
      return;
    }
    
    if (!confirm('Feature this project immediately? This will replace the current featured project.')) {
      return;
    }

    try {
      console.log('Featuring project:', projectId);
      const response = await fetch('/api/admin/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: String(projectId), action: 'feature', fid: userFid || null }),
        credentials: 'include',
      });

      const data = await response.json();
      if (response.ok) {
        setMessage(`Project ${projectId} approved and featured immediately!`);
        fetchSubmissions(); // Refresh list
        fetchLiveProjects(); // Refresh live projects
      } else {
        setMessage(data.error || 'Failed to feature project');
        console.error('Feature error:', data);
      }
    } catch (error) {
      console.error('Error featuring project:', error);
      setMessage('Error featuring project: ' + error.message);
    }
  };

  const handleSchedule = async (projectId) => {
    if (!projectId) {
      setMessage('ERROR: Invalid project ID');
      return;
    }
    
    // Prompt for date/time (UK timezone)
    const dateInput = prompt('Enter date/time to feature this project (UK time, YYYY-MM-DD HH:MM format, 24-hour):\nExample: 2025-12-15 14:00\n\nNote: Enter time in UK timezone (GMT/BST). System will convert automatically.');
    if (!dateInput) return;
    
    // Parse date input as UK time
    let scheduledDate;
    try {
      // Try parsing as "YYYY-MM-DD HH:MM"
      const [datePart, timePart] = dateInput.trim().split(' ');
      if (!datePart || !timePart) {
        throw new Error('Invalid format');
      }
      const [year, month, day] = datePart.split('-');
      const [hour, minute] = timePart.split(':');
      
      // Create date assuming UK timezone
      // We'll create an ISO string with explicit timezone and parse it
      // Format: YYYY-MM-DDTHH:MM:00 (as if it were UK time, then convert)
      const ukDateString = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${(minute || '00').padStart(2, '0')}:00`;
      
      // Parse as if it's in UK timezone
      // Create date in local time (assuming browser is in UK or we adjust)
      // For now, we'll use the browser's local time and trust it's UK
      // The Date constructor with year, month, day, hour, minute uses local timezone
      scheduledDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute) || 0);
      
      // Display what time it will be in UK for confirmation
      const ukTimeString = scheduledDate.toLocaleString('en-GB', { timeZone: 'Europe/London', dateStyle: 'short', timeStyle: 'short' });
      console.log('Scheduled as UK time:', ukTimeString);
      
      if (isNaN(scheduledDate.getTime())) {
        throw new Error('Invalid date');
      }
      
      // Check if date is in the future
      if (scheduledDate <= new Date()) {
        if (!confirm('Scheduled date is in the past. Schedule anyway?')) {
          return;
        }
      }
    } catch (error) {
      setMessage('ERROR: Invalid date format. Use YYYY-MM-DD HH:MM');
      return;
    }

    try {
      console.log('Scheduling project:', projectId, 'for', scheduledDate.toISOString());
      const response = await fetch('/api/admin/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          projectId: String(projectId), 
          action: 'schedule', 
          scheduledDate: scheduledDate.toISOString(),
          fid: userFid || null 
        }),
        credentials: 'include',
      });

      const data = await response.json();
      if (response.ok) {
        // Display in UK timezone
        const ukTimeString = scheduledDate.toLocaleString('en-GB', { 
          timeZone: 'Europe/London',
          dateStyle: 'long',
          timeStyle: 'short'
        });
        setMessage(`Project ${projectId} scheduled to be featured on ${ukTimeString} (UK time)!`);
        fetchSubmissions(); // Refresh list
        fetchLiveProjects(); // Refresh live projects
      } else {
        setMessage(data.error || 'Failed to schedule project');
        console.error('Schedule error:', data);
      }
    } catch (error) {
      console.error('Error scheduling project:', error);
      setMessage('Error scheduling project: ' + error.message);
    }
  };

  const handleRefund = async (projectId) => {
    if (!projectId) {
      setMessage('ERROR: Invalid project ID');
      return;
    }
    
    const submission = submissions.find(s => s.id === projectId);
    if (!confirm(`Are you sure you want to refund ${submission?.paymentAmount || 0} ETH?`)) {
      return;
    }

    try {
      console.log('Refunding project:', projectId);
      const response = await fetch('/api/admin/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          projectId: String(projectId),
          fid: userFid || null 
        }),
        credentials: 'include',
      });

      const data = await response.json();
      if (response.ok) {
        setMessage(`Refund sent! TX: ${data.refundTxHash?.slice(0, 10)}...`);
        // Refresh submissions
        fetchSubmissions();
      } else {
        setMessage(data.error || 'Failed to refund');
        console.error('Refund error:', data);
      }
    } catch (error) {
      console.error('Error processing refund:', error);
      setMessage('Error processing refund: ' + error.message);
    }
  };

  const FeaturedTimer = ({ project, onUpdate, userFid }) => {
    const [timeRemaining, setTimeRemaining] = useState({ h: 0, m: 0, s: 0 });
    const [updating, setUpdating] = useState(false);

    useEffect(() => {
      const calculateTimeRemaining = () => {
        if (!project.featuredAt) return { h: 0, m: 0, s: 0 };
        const featuredAt = new Date(project.featuredAt);
        const expiresAt = new Date(featuredAt.getTime() + 24 * 60 * 60 * 1000); // 24 hours from featuredAt
        const now = new Date();
        const diff = expiresAt - now;
        
        if (diff <= 0) return { h: 0, m: 0, s: 0 };
        
        const h = Math.floor(diff / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);
        return { h, m, s };
      };

      setTimeRemaining(calculateTimeRemaining());
      const timer = setInterval(() => {
        setTimeRemaining(calculateTimeRemaining());
      }, 1000);

      return () => clearInterval(timer);
    }, [project.featuredAt]);

    const handleSetTimer = async (hours) => {
      if (!confirm(`Set timer to ${hours} hour${hours !== 1 ? 's' : ''} from now?`)) return;
      
      setUpdating(true);
      try {
        const newFeaturedAt = new Date(Date.now() - (24 - hours) * 60 * 60 * 1000).toISOString();
        
        const response = await fetch('/api/admin/update-project', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: String(project.id),
            featuredAt: newFeaturedAt,
            fid: userFid || null,
          }),
          credentials: 'include',
        });

        const data = await response.json();
        if (response.ok) {
          setMessage(`Timer set to ${hours} hour${hours !== 1 ? 's' : ''}! Refreshing...`);
          setTimeout(() => {
            onUpdate();
            setMessage('');
          }, 500);
        } else {
          setMessage(data.error || 'Failed to update timer');
        }
      } catch (error) {
        console.error('Error updating timer:', error);
        setMessage('Error updating timer: ' + error.message);
      } finally {
        setUpdating(false);
      }
    };

    const handleSetMidnight = async () => {
      // Calculate 11:59pm UK time today (or tomorrow if already past)
      const now = new Date();
      const ukTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/London' }));
      
      // Set target to 11:59pm UK time
      let target = new Date(ukTime);
      target.setHours(23, 59, 0, 0);
      
      // If it's already past 11:59pm, set for tomorrow
      if (ukTime >= target) {
        target.setDate(target.getDate() + 1);
      }
      
      // Calculate hours until target
      const hoursUntil = (target - ukTime) / (1000 * 60 * 60);
      const targetTimeStr = target.toLocaleString('en-GB', { timeZone: 'Europe/London', dateStyle: 'short', timeStyle: 'short' });
      
      if (!confirm(`Set timer to expire at 11:59pm UK time (${targetTimeStr})?\n\nThat's approximately ${hoursUntil.toFixed(1)} hours from now.`)) return;
      
      setUpdating(true);
      try {
        // Calculate featuredAt so that featuredAt + 24h = target
        // Convert target back to actual Date object for ISO string
        const targetActual = new Date(target.toLocaleString('en-US', { timeZone: 'Europe/London' }));
        // Adjust for timezone offset between local and UK
        const localNow = new Date();
        const ukNow = new Date(localNow.toLocaleString('en-US', { timeZone: 'Europe/London' }));
        const offset = localNow - ukNow;
        
        // Target in local time
        const targetLocal = new Date(target.getTime() + offset);
        const newFeaturedAt = new Date(targetLocal.getTime() - 24 * 60 * 60 * 1000).toISOString();
        
        const response = await fetch('/api/admin/update-project', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: String(project.id),
            featuredAt: newFeaturedAt,
            fid: userFid || null,
          }),
          credentials: 'include',
        });

        const data = await response.json();
        if (response.ok) {
          setMessage(`Timer set to expire at 11:59pm UK! Refreshing...`);
          setTimeout(() => {
            onUpdate();
            setMessage('');
          }, 500);
        } else {
          setMessage(data.error || 'Failed to update timer');
        }
      } catch (error) {
        console.error('Error updating timer:', error);
        setMessage('Error updating timer: ' + error.message);
      } finally {
        setUpdating(false);
      }
    };

    return (
      <div className="mt-3 p-3 border border-yellow-500/30 bg-yellow-500/5">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-[10px] tracking-[0.2em] text-yellow-400 mb-1">FEATURED TIMER</div>
            <div className="text-lg font-mono font-bold">
              {String(timeRemaining.h).padStart(2, '0')}:{String(timeRemaining.m).padStart(2, '0')}:{String(timeRemaining.s).padStart(2, '0')}
            </div>
          </div>
          <div className="flex flex-wrap gap-1">
            {[1, 6, 12, 24].map(hours => (
              <button
                key={hours}
                onClick={() => handleSetTimer(hours)}
                disabled={updating}
                className="px-2 py-1 text-[9px] tracking-[0.1em] border border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/20 transition-all disabled:opacity-50"
                title={`Set to ${hours} hour${hours !== 1 ? 's' : ''}`}
              >
                {hours}H
              </button>
            ))}
            <button
              onClick={handleSetMidnight}
              disabled={updating}
              className="px-2 py-1 text-[9px] tracking-[0.1em] border border-purple-500/50 text-purple-400 hover:bg-purple-500/20 transition-all disabled:opacity-50"
              title="Set to expire at 11:59pm UK time"
            >
              11:59PM
            </button>
          </div>
        </div>
      </div>
    );
  };

  const handleQuickStatsUpdate = async (projectId, statType, value) => {
    if (!projectId || !statType || value === null || value === undefined) {
      setMessage('ERROR: Invalid stats update');
      return;
    }

    try {
      console.log('Quick updating stats:', { projectId, statType, value });
      const currentProject = liveProjects.find(p => p.id === projectId) || archivedProjects.find(p => p.id === projectId);
      const currentStats = currentProject?.stats || { views: 0, clicks: 0, tips: 0 };
      
      const updatedStats = {
        ...currentStats,
        [statType]: value,
      };

      const response = await fetch('/api/admin/update-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: String(projectId),
          stats: updatedStats,
          fid: userFid || null,
        }),
        credentials: 'include',
      });

      const data = await response.json();
      if (response.ok) {
        setMessage(`${statType.toUpperCase()} updated to ${value}! Refreshing...`);
        // Immediately refresh to show updated stats
        setTimeout(() => {
          fetchLiveProjects();
          fetchArchivedProjects();
          setMessage('');
        }, 500);
      } else {
        setMessage(data.error || `Failed to update ${statType}`);
        console.error('Quick stats update error:', data);
      }
    } catch (error) {
      console.error('Error updating stats:', error);
      setMessage(`Error updating ${statType}: ` + error.message);
    }
  };

  const handleResetStatsWindow = async (projectId, projectName) => {
    if (!confirm(`Reset stats window for ${projectName}?\n\nThis will set a new featuredAt timestamp, resetting clicks/views to 0.\n\nThis cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch('/api/admin/update-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          featuredAt: new Date().toISOString(),
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setMessage(`Stats window reset for ${projectName}`);
        fetchLiveProjects();
      } else {
        setMessage(data.error || 'Failed to reset stats window');
      }
    } catch (error) {
      console.error('Error resetting stats window:', error);
      setMessage('Error resetting stats window: ' + error.message);
    }
  };

  const handleReject = async (projectId) => {
    if (!projectId) {
      setMessage('ERROR: Invalid project ID');
      return;
    }
    
    if (!confirm('Are you sure you want to reject this submission?')) {
      return;
    }

    try {
      console.log('Rejecting project:', projectId);
      const response = await fetch('/api/admin/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: String(projectId), action: 'reject', fid: userFid || null }),
        credentials: 'include',
      });

      const data = await response.json();
      if (response.ok) {
        setMessage(`Project ${projectId} rejected!`);
        fetchSubmissions(); // Refresh list
      } else {
        setMessage(data.error || 'Failed to reject');
        console.error('Reject error:', data);
      }
    } catch (error) {
      console.error('Error rejecting project:', error);
      setMessage('Error rejecting project: ' + error.message);
    }
  };

  const handleResetClaims = async () => {
    if (!confirm('Are you sure you want to reset ALL claims for the current featured project? This will allow everyone to claim again.')) {
      return;
    }

    // Require typing "RESET" to confirm
    const confirmation = prompt('This action cannot be undone. Type RESET to confirm:');
    if (confirmation !== 'RESET') {
      if (confirmation !== null) { // User didn't cancel, they typed something wrong
        setMessage('Confirmation failed. You must type "RESET" exactly to confirm.');
      }
      return;
    }

    // Ask if they also want to reset DONUT data
    const resetDonut = confirm('Also reset DONUT bonus data? This will:\n- Reset global DONUT count (back to 0/1000)\n- Allow all users to receive DONUT again\n\nClick OK to include DONUT reset, or Cancel to reset claims only.');

    try {
      setMessage('Resetting claims...');
      const response = await fetch('/api/admin/reset-claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          confirm: 'RESET',
          resetDonut: resetDonut,
          fid: userFid || null 
        }),
        credentials: 'include',
      });

      // Check if response is OK before trying to parse JSON
      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error('Failed to parse response as JSON:', jsonError);
        const text = await response.text();
        setMessage(`Error: Server returned ${response.status} ${response.statusText}. Response: ${text || 'No response body'}`);
        return;
      }

      if (response.ok) {
        setMessage(data.message || 'Claims reset successfully!');
      } else {
        console.error('Reset claims error:', {
          status: response.status,
          statusText: response.statusText,
          statusCode: response.status,
          data: data,
          fullResponse: response
        });
        
        // Build detailed error message
        let errorMsg = 'Failed to reset claims. ';
        if (response.status === 403) {
          errorMsg = 'Authentication failed. ';
          errorMsg += data.details || data.error || 'Please log in via the admin login form.';
        } else if (response.status === 400) {
          errorMsg = 'Bad request. ';
          errorMsg += data.error || data.details || 'Invalid request.';
        } else if (response.status === 500) {
          errorMsg = 'Server error. ';
          errorMsg += data.error || data.details || 'Internal server error occurred.';
        } else {
          errorMsg += `Status: ${response.status}. `;
          errorMsg += data.error || data.details || 'Unknown error occurred.';
        }
        
        setMessage(errorMsg);
      }
    } catch (error) {
      console.error('Reset claims exception:', {
        error: error,
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      setMessage(`Network error: ${error.message || 'Failed to connect to server. Check your connection and try again.'}`);
    }
  };

  // Automation functions
  const fetchCurrentFeatured = async () => {
    try {
      const response = await fetch('/api/featured-project', {
        method: 'GET',
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setCurrentFeatured(data.project);
      }
    } catch (error) {
      console.error('Error fetching featured project:', error);
    }
  };

  const fetchClaimStats = async () => {
    setLoadingStats(true);
    try {
      const response = await fetch('/api/admin/claim-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fid: userFid || null }),
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setClaimStats(data);
      } else {
        setMessage('Failed to fetch claim stats');
      }
    } catch (error) {
      console.error('Error fetching claim stats:', error);
      setMessage('Error fetching claim stats');
    } finally {
      setLoadingStats(false);
    }
  };

  const handleQuickSetFeatured = async (projectId) => {
    if (!confirm(`Set project ${projectId} as featured? This will move current featured to queued.`)) {
      return;
    }
    try {
      const response = await fetch('/api/admin/update-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          projectId, 
          status: 'featured',
          fid: userFid || null 
        }),
        credentials: 'include',
      });
      const data = await response.json();
      if (response.ok) {
        setMessage(`Project ${projectId} set as featured! Claims reset automatically.`);
        fetchLiveProjects();
        fetchCurrentFeatured();
      } else {
        setMessage(data.error || 'Failed to set featured project');
      }
    } catch (error) {
      setMessage('Error setting featured project');
    }
  };

  const handleClearOldClaims = async () => {
    if (!confirm('Clear all expired claim data? This will remove old claim locks and counters that have expired.')) {
      return;
    }
    const confirmation = prompt('Type CLEAR to confirm:');
    if (confirmation !== 'CLEAR') {
      if (confirmation !== null) {
        setMessage('Confirmation failed. You must type "CLEAR" exactly.');
      }
      return;
    }
    try {
      const response = await fetch('/api/admin/clear-old-claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'CLEAR', fid: userFid || null }),
        credentials: 'include',
      });
      const data = await response.json();
      if (response.ok) {
        setMessage(data.message || 'Old claim data cleared successfully');
      } else {
        setMessage(data.error || 'Failed to clear old claims');
      }
    } catch (error) {
      setMessage('Error clearing old claims');
    }
  };

  // Fetch current featured, bonus token config, and claim settings on load
  useEffect(() => {
    if (isAuthenticated) {
      fetchCurrentFeatured();
      fetchBonusTokenConfig();
      fetchClaimSettings();
    }
  }, [isAuthenticated]);

  const fetchBonusTokenConfig = async () => {
    setLoadingBonusConfig(true);
    try {
      const response = await fetch('/api/admin/bonus-token-config', {
        method: 'GET',
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setBonusTokenConfig(data.config || {
          enabled: false,
          contractAddress: '',
          amount: '',
          decimals: 18,
          maxSupply: 0,
          tokenName: '',
        });
      }
    } catch (error) {
      console.error('Error fetching bonus token config:', error);
    } finally {
      setLoadingBonusConfig(false);
    }
  };

  const handleSaveBonusTokenConfig = async () => {
    if (bonusTokenConfig.enabled) {
      if (!bonusTokenConfig.contractAddress || !bonusTokenConfig.contractAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
        setMessage('ERROR: Valid contract address is required when enabled');
        return;
      }
      if (!bonusTokenConfig.amount || parseFloat(bonusTokenConfig.amount) <= 0) {
        setMessage('ERROR: Valid amount > 0 is required when enabled');
        return;
      }
      if (!bonusTokenConfig.maxSupply || parseInt(bonusTokenConfig.maxSupply) <= 0) {
        setMessage('ERROR: Valid maxSupply > 0 is required when enabled');
        return;
      }
    }

    setLoadingBonusConfig(true);
    try {
      const response = await fetch('/api/admin/bonus-token-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: bonusTokenConfig, fid: userFid || null }),
        credentials: 'include',
      });
      const data = await response.json();
      if (response.ok) {
        setMessage(data.message || 'Bonus token config saved successfully');
        setShowBonusTokenConfig(false);
      } else {
        setMessage(data.error || 'Failed to save bonus token config');
      }
    } catch (error) {
      setMessage('Error saving bonus token config');
    } finally {
      setLoadingBonusConfig(false);
    }
  };

  // Claim Settings Functions
  const fetchClaimSettings = async () => {
    setLoadingClaimSettings(true);
    try {
      const response = await fetch('/api/admin/claim-settings', {
        method: 'GET',
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setClaimSettings(data.settings || {
          baseClaimAmount: 80000,
          claimMultiplier: 1,
          holderMultiplier: 2,
          cooldownHours: 24,
          minNeynarScore: 0.6,
          claimsEnabled: true,
        });
      }
    } catch (error) {
      console.error('Error fetching claim settings:', error);
    } finally {
      setLoadingClaimSettings(false);
    }
  };

  const handleSaveClaimSettings = async () => {
    setLoadingClaimSettings(true);
    try {
      const response = await fetch('/api/admin/claim-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: claimSettings, fid: userFid || null }),
        credentials: 'include',
      });
      const data = await response.json();
      if (response.ok) {
        setMessage(data.message || 'Claim settings saved successfully');
      } else {
        setMessage(data.error || 'Failed to save claim settings');
      }
    } catch (error) {
      setMessage('Error saving claim settings');
    } finally {
      setLoadingClaimSettings(false);
    }
  };

  const handleQuickMultiplier = async (multiplier) => {
    const newSettings = { ...claimSettings, claimMultiplier: multiplier };
    setClaimSettings(newSettings);
    setLoadingClaimSettings(true);
    try {
      const response = await fetch('/api/admin/claim-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: newSettings }),
        credentials: 'include',
      });
      const data = await response.json();
      if (response.ok) {
        setMessage(`Claim multiplier set to ${multiplier}x! (${Math.floor(claimSettings.baseClaimAmount * multiplier).toLocaleString()} tokens per claim)`);
      } else {
        setMessage(data.error || 'Failed to update multiplier');
      }
    } catch (error) {
      setMessage('Error updating multiplier');
    } finally {
      setLoadingClaimSettings(false);
    }
  };

  const handleToggleClaims = async () => {
    const newEnabled = !claimSettings.claimsEnabled;
    const newSettings = { ...claimSettings, claimsEnabled: newEnabled };
    setClaimSettings(newSettings);
    setLoadingClaimSettings(true);
    try {
      const response = await fetch('/api/admin/claim-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: newSettings }),
        credentials: 'include',
      });
      const data = await response.json();
      if (response.ok) {
        setMessage(newEnabled ? 'Claims ENABLED!' : 'Claims DISABLED!');
      } else {
        setMessage(data.error || 'Failed to toggle claims');
      }
    } catch (error) {
      setMessage('Error toggling claims');
    } finally {
      setLoadingClaimSettings(false);
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
          status: archive ? 'archived' : 'active',
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
      // Convert tips from USD back to ETH before saving
      const createData = { ...createFormData };
      if (ethPrice && tipsUsdDisplay.create) {
        const tipsUsd = parseFloat(tipsUsdDisplay.create) || 0;
        createData.stats = {
          ...createData.stats,
          tips: tipsUsd / ethPrice, // Convert USD to ETH
        };
      }

      const response = await fetch('/api/admin/create-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...createData,
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
          tokenName: '',
          tokenContractAddress: '',
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

  const handleCreateFormChange = async (e) => {
    const { name, value, type, checked } = e.target;
    if (name.startsWith('stats.')) {
      const statName = name.split('.')[1];
      if (statName === 'tips') {
        // Store USD value for tips
        setTipsUsdDisplay(prev => ({
          ...prev,
          create: value
        }));
      } else {
        setCreateFormData({
          ...createFormData,
          stats: {
            ...createFormData.stats,
            [statName]: parseFloat(value) || 0,
          },
        });
      }
    } else {
      const newFormData = {
        ...createFormData,
        [name]: type === 'checkbox' ? checked : value,
      };
      
      // Auto-populate builder info from FID when FID is entered
      if (name === 'builderFid' && value && parseInt(value) > 0) {
        try {
          const response = await fetch('/api/user-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fid: parseInt(value) }),
          });
          
          if (response.ok) {
            const userData = await response.json();
            // Auto-populate builder name if not already set
            if (!newFormData.builder || newFormData.builder.trim() === '') {
              newFormData.builder = userData.username || userData.displayName || '';
            }
            // Update FID if it changed
            newFormData.builderFid = userData.fid || value;
          }
        } catch (error) {
          console.error('Error fetching user data from FID:', error);
        }
      }
      
      setCreateFormData(newFormData);
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
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="px-4 py-2 bg-yellow-500 text-black font-bold hover:bg-yellow-400 transition-all"
              >
                {showCreateForm ? 'CANCEL' : '+ CREATE PROJECT'}
              </button>
              <button
                onClick={handleResetClaims}
                className="px-4 py-2 bg-red-600 text-white font-bold hover:bg-red-500 transition-all"
                title="Reset all daily claims for current featured project"
              >
                RESET CLAIMS
              </button>
              <button
                onClick={fetchClaimStats}
                className="px-4 py-2 bg-blue-600 text-white font-bold hover:bg-blue-500 transition-all"
                disabled={loadingStats}
              >
                {loadingStats ? 'LOADING...' : 'VIEW CLAIM STATS'}
              </button>
              <button
                onClick={fetchCurrentFeatured}
                className="px-4 py-2 bg-green-600 text-white font-bold hover:bg-green-500 transition-all"
              >
                REFRESH FEATURED
              </button>
              <button
                onClick={handleClearOldClaims}
                className="px-4 py-2 bg-orange-600 text-white font-bold hover:bg-orange-500 transition-all"
              >
                CLEAR OLD CLAIMS
              </button>
              <button
                onClick={() => {
                  setShowBonusTokenConfig(!showBonusTokenConfig);
                  if (!showBonusTokenConfig) {
                    fetchBonusTokenConfig();
                  }
                }}
                className="px-4 py-2 bg-purple-600 text-white font-bold hover:bg-purple-500 transition-all"
              >
                {showBonusTokenConfig ? 'HIDE BONUS TOKEN' : 'CONFIGURE BONUS TOKEN'}
              </button>
              <button
                onClick={() => {
                  setShowClaimSettings(!showClaimSettings);
                  if (!showClaimSettings) {
                    fetchClaimSettings();
                  }
                }}
                className="px-4 py-2 bg-cyan-600 text-white font-bold hover:bg-cyan-500 transition-all"
              >
                {showClaimSettings ? 'HIDE CLAIM SETTINGS' : 'CLAIM SETTINGS'}
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
            <div className={`mb-4 p-4 border ${
              message.includes('error') || message.includes('Error') || message.includes('failed') || message.includes('Failed')
                ? 'border-red-500 bg-red-900/20 text-red-400'
                : message.includes('success') || message.includes('Success')
                ? 'border-green-500 bg-green-900/20 text-green-400'
                : 'border-white bg-white text-black'
            }`}>
              <div className="font-bold mb-1">
                {message.includes('error') || message.includes('Error') || message.includes('failed') || message.includes('Failed')
                  ? 'ERROR:'
                  : message.includes('success') || message.includes('Success')
                  ? 'SUCCESS:'
                  : 'INFO:'}
              </div>
              <div>{message}</div>
              <button
                onClick={() => setMessage('')}
                className="mt-2 text-sm underline opacity-70 hover:opacity-100"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Quick Reference Legend */}
          <div className="mb-8 border border-gray-700 bg-gray-900/50">
            <button
              onClick={() => {
                const el = document.getElementById('admin-legend');
                if (el) el.classList.toggle('hidden');
              }}
              className="w-full p-3 flex items-center justify-between text-left hover:bg-gray-800/50 transition-all"
            >
              <span className="text-sm font-bold tracking-[0.1em] text-gray-400">QUICK REFERENCE LEGEND</span>
              <span className="text-gray-500 text-xs">Click to expand/collapse</span>
            </button>
            <div id="admin-legend" className="hidden border-t border-gray-700 p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                
                {/* Actions that RESET Claims */}
                <div className="border border-red-500/50 bg-red-500/5 p-3">
                  <div className="text-[10px] tracking-[0.2em] text-red-400 mb-2 font-bold">🔴 RESETS ALL CLAIMS</div>
                  <ul className="text-xs space-y-1 text-gray-300">
                    <li>• <span className="text-red-400 font-bold">SET FEATURED</span> - New project = fresh claims</li>
                    <li>• <span className="text-red-400 font-bold">RESET CLAIMS</span> - Manual reset button</li>
                    <li>• <span className="text-red-400 font-bold">Approve & Feature</span> - New submission goes live</li>
                    <li>• <span className="text-red-400 font-bold">Scheduled</span> - When scheduled project goes live</li>
                  </ul>
                  <div className="text-[9px] text-gray-500 mt-2">Everyone can claim again immediately</div>
                </div>

                {/* Actions that DON'T affect claims */}
                <div className="border border-green-500/50 bg-green-500/5 p-3">
                  <div className="text-[10px] tracking-[0.2em] text-green-400 mb-2 font-bold">🟢 SAFE - NO CLAIM RESET</div>
                  <ul className="text-xs space-y-1 text-gray-300">
                    <li>• <span className="text-green-400 font-bold">Timer buttons</span> - 1H, 6H, 12H, 24H, 11:59PM</li>
                    <li>• <span className="text-green-400 font-bold">Edit project</span> - Name, description, links</li>
                    <li>• <span className="text-green-400 font-bold">Update stats</span> - Views, clicks, tips</li>
                    <li>• <span className="text-green-400 font-bold">Archive/Restore</span> - Moving projects</li>
                  </ul>
                  <div className="text-[9px] text-gray-500 mt-2">Claim status stays unchanged</div>
                </div>

                {/* Claim Settings */}
                <div className="border border-cyan-500/50 bg-cyan-500/5 p-3">
                  <div className="text-[10px] tracking-[0.2em] text-cyan-400 mb-2 font-bold">🔵 CLAIM SETTINGS</div>
                  <ul className="text-xs space-y-1 text-gray-300">
                    <li>• <span className="text-cyan-400 font-bold">Multiplier</span> - 1x, 2x, 3x... token amount</li>
                    <li>• <span className="text-cyan-400 font-bold">Holder bonus</span> - Claims for 30M+ holders</li>
                    <li>• <span className="text-cyan-400 font-bold">Cooldown</span> - Hours between claims</li>
                    <li>• <span className="text-cyan-400 font-bold">Enable/Disable</span> - Master claims toggle</li>
                  </ul>
                  <div className="text-[9px] text-gray-500 mt-2">Changes apply immediately, persist until changed</div>
                </div>

                {/* Featured Timer */}
                <div className="border border-yellow-500/50 bg-yellow-500/5 p-3">
                  <div className="text-[10px] tracking-[0.2em] text-yellow-400 mb-2 font-bold">🟡 FEATURED TIMER</div>
                  <ul className="text-xs space-y-1 text-gray-300">
                    <li>• <span className="text-yellow-400 font-bold">1H/6H/12H/24H</span> - Set hours remaining</li>
                    <li>• <span className="text-yellow-400 font-bold">11:59PM</span> - Expire at midnight UK</li>
                    <li>• Timer only affects <span className="italic">display countdown</span></li>
                    <li>• Does NOT affect claim eligibility</li>
                  </ul>
                  <div className="text-[9px] text-gray-500 mt-2">Adjust freely without affecting claims</div>
                </div>

                {/* Bonus Token */}
                <div className="border border-purple-500/50 bg-purple-500/5 p-3">
                  <div className="text-[10px] tracking-[0.2em] text-purple-400 mb-2 font-bold">🟣 BONUS TOKEN</div>
                  <ul className="text-xs space-y-1 text-gray-300">
                    <li>• <span className="text-purple-400 font-bold">Enable</span> - Add bonus token to claims</li>
                    <li>• <span className="text-purple-400 font-bold">Contract</span> - Any ERC20 on Base</li>
                    <li>• <span className="text-purple-400 font-bold">Amount/Max</span> - Per claim & total supply</li>
                    <li>• Sent alongside $SEEN automatically</li>
                  </ul>
                  <div className="text-[9px] text-gray-500 mt-2">Configure per campaign, 1 bonus per wallet</div>
                </div>

                {/* Personal Cooldown */}
                <div className="border border-orange-500/50 bg-orange-500/5 p-3">
                  <div className="text-[10px] tracking-[0.2em] text-orange-400 mb-2 font-bold">🟠 PERSONAL COOLDOWN</div>
                  <ul className="text-xs space-y-1 text-gray-300">
                    <li>• Each wallet: 24h between claims</li>
                    <li>• 30M+ holders: configurable multiplier</li>
                    <li>• Resets: New featured OR Reset button</li>
                    <li>• Persists: Timer changes, stats updates</li>
                  </ul>
                  <div className="text-[9px] text-gray-500 mt-2">Prevents spam within same featured project</div>
                </div>

              </div>

              {/* Quick Formula */}
              <div className="mt-4 p-3 bg-white/5 border border-white/20">
                <div className="text-[10px] tracking-[0.2em] text-white mb-2 font-bold">CLAIM FORMULA</div>
                <div className="text-sm font-mono text-gray-300">
                  Tokens per claim = <span className="text-cyan-400">Base Amount</span> × <span className="text-cyan-400">Multiplier</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Example: 80,000 × 2x = 160,000 tokens per claim
                </div>
              </div>
            </div>
          </div>

          {/* Automation Dashboard */}
          <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Current Featured Project */}
            <div className="border border-white p-4">
              <h2 className="text-lg font-black mb-3">CURRENT FEATURED PROJECT</h2>
              {currentFeatured ? (
                <div className="space-y-2">
                  <div className="text-sm">
                    <span className="text-gray-500">Name:</span> <span className="font-bold">{currentFeatured.name}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-500">ID:</span> <span className="font-mono">{currentFeatured.id}</span>
                  </div>
                  {currentFeatured.featuredAt && (
                    <div className="text-sm">
                      <span className="text-gray-500">Featured At:</span> <span className="font-mono text-xs">{new Date(currentFeatured.featuredAt).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => handleEdit(currentFeatured)}
                      className="px-3 py-1 text-xs border border-white hover:bg-white hover:text-black transition-all"
                    >
                      EDIT
                    </button>
                    <button
                      onClick={() => handleQuickSetFeatured(currentFeatured.id)}
                      className="px-3 py-1 text-xs bg-green-600 text-white hover:bg-green-500 transition-all"
                      disabled={currentFeatured.status === 'featured'}
                    >
                      {currentFeatured.status === 'featured' ? 'CURRENTLY FEATURED' : 'SET FEATURED'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-500">No featured project</div>
              )}
            </div>

            {/* Claim Stats */}
            <div className="border border-white p-4">
              <h2 className="text-lg font-black mb-3">CLAIM STATISTICS</h2>
              {claimStats ? (
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-500">Total Claims:</span> <span className="font-bold">{claimStats.totalClaims || 0}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Unique Wallets:</span> <span className="font-bold">{claimStats.uniqueWallets || 0}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">30M+ Holder Claims:</span> <span className="font-bold">{claimStats.holderClaims || 0}</span>
                  </div>
                  {claimStats.featuredProject && (
                    <div className="mt-2 pt-2 border-t border-white/20">
                      <div className="text-xs text-gray-500">Featured: {claimStats.featuredProject.name} (ID: {claimStats.featuredProject.id})</div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-gray-500">Click "VIEW CLAIM STATS" to load</div>
              )}
            </div>
          </div>

          {/* Bonus Token Configuration */}
          {showBonusTokenConfig && (
            <div className="mb-8 border border-white p-6 bg-black">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-black">BONUS TOKEN CONFIGURATION</h2>
                  <p className="text-xs text-gray-500 mt-1">Configure ANY bonus token to be sent alongside $SEEN claims. Works for any ERC20 token on Base - DONUT, or any token someone wants to feature.</p>
                </div>
                <button
                  onClick={() => setShowBonusTokenConfig(false)}
                  className="text-white hover:text-gray-400 text-2xl"
                >
                  ×
                </button>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="bonusEnabled"
                    checked={bonusTokenConfig.enabled}
                    onChange={(e) => setBonusTokenConfig({ ...bonusTokenConfig, enabled: e.target.checked })}
                    className="w-5 h-5"
                  />
                  <label htmlFor="bonusEnabled" className="text-sm font-bold">
                    ENABLE BONUS TOKEN (will override DONUT for new claims)
                  </label>
                </div>
                {bonusTokenConfig.enabled && (
                  <>
                    <div>
                      <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
                        TOKEN NAME (OPTIONAL)
                      </label>
                      <input
                        type="text"
                        value={bonusTokenConfig.tokenName}
                        onChange={(e) => setBonusTokenConfig({ ...bonusTokenConfig, tokenName: e.target.value })}
                        className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black"
                        placeholder="e.g., DONUT, BONUS, etc."
                      />
                    </div>
                    <div>
                      <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
                        CONTRACT ADDRESS *
                      </label>
                      <input
                        type="text"
                        value={bonusTokenConfig.contractAddress}
                        onChange={(e) => setBonusTokenConfig({ ...bonusTokenConfig, contractAddress: e.target.value })}
                        className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black font-mono"
                        placeholder="0x..."
                        pattern="^0x[a-fA-F0-9]{40}$"
                      />
                      <p className="text-[10px] text-gray-600 mt-1">Token contract address on Base network</p>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
                          AMOUNT PER CLAIM *
                        </label>
                        <input
                          type="text"
                          value={bonusTokenConfig.amount}
                          onChange={(e) => setBonusTokenConfig({ ...bonusTokenConfig, amount: e.target.value })}
                          className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black"
                          placeholder="1"
                        />
                      </div>
                      <div>
                        <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
                          DECIMALS
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="18"
                          value={bonusTokenConfig.decimals}
                          onChange={(e) => setBonusTokenConfig({ ...bonusTokenConfig, decimals: parseInt(e.target.value) || 18 })}
                          className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black"
                          placeholder="18"
                        />
                      </div>
                      <div>
                        <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
                          MAX SUPPLY *
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={bonusTokenConfig.maxSupply}
                          onChange={(e) => setBonusTokenConfig({ ...bonusTokenConfig, maxSupply: parseInt(e.target.value) || 0 })}
                          className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black"
                          placeholder="1000"
                        />
                      </div>
                    </div>
                    <div className="p-3 bg-yellow-900/20 border border-yellow-500 text-yellow-400 text-xs">
                      <strong>NOTE:</strong> When enabled, this bonus token will be sent alongside $SEEN for all new claims. 
                      Each wallet can receive the bonus token once. Works for ANY token - DONUT, or any other token someone wants to feature. 
                      The bonus token system takes priority over the hardcoded DONUT campaign.
                    </div>
                  </>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={handleSaveBonusTokenConfig}
                    disabled={loadingBonusConfig}
                    className="px-4 py-2 bg-green-600 text-white font-bold hover:bg-green-500 transition-all disabled:opacity-50"
                  >
                    {loadingBonusConfig ? 'SAVING...' : 'SAVE CONFIG'}
                  </button>
                  <button
                    onClick={fetchBonusTokenConfig}
                    disabled={loadingBonusConfig}
                    className="px-4 py-2 border border-white text-sm hover:bg-white hover:text-black transition-all disabled:opacity-50"
                  >
                    REFRESH
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Claim Settings Panel */}
          {showClaimSettings && (
            <div className="mb-8 border border-cyan-500/50 p-6 bg-cyan-500/5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-black text-cyan-400">CLAIM SETTINGS</h2>
                  <p className="text-xs text-gray-500 mt-1">Control claim amounts, cooldowns, and more. Changes apply immediately.</p>
                </div>
                <button
                  onClick={() => setShowClaimSettings(false)}
                  className="text-white hover:text-gray-400 text-2xl"
                >
                  ×
                </button>
              </div>

              {/* Quick Actions */}
              <div className="mb-6 p-4 border border-cyan-500/30 bg-black">
                <div className="text-[10px] tracking-[0.2em] text-cyan-400 mb-3">QUICK ACTIONS</div>
                
                {/* Master Toggle */}
                <div className="flex items-center gap-4 mb-4">
                  <button
                    onClick={handleToggleClaims}
                    disabled={loadingClaimSettings}
                    className={`px-6 py-3 font-black text-sm tracking-[0.1em] transition-all disabled:opacity-50 ${
                      claimSettings.claimsEnabled 
                        ? 'bg-green-600 text-white hover:bg-green-500' 
                        : 'bg-red-600 text-white hover:bg-red-500'
                    }`}
                  >
                    {claimSettings.claimsEnabled ? 'CLAIMS ENABLED' : 'CLAIMS DISABLED'}
                  </button>
                  <span className="text-xs text-gray-500">Click to toggle</span>
                </div>

                {/* Multiplier Buttons */}
                <div className="mb-4">
                  <div className="text-[10px] tracking-[0.2em] text-gray-500 mb-2">CLAIM MULTIPLIER</div>
                  <div className="flex flex-wrap gap-2">
                    {[1, 1.5, 2, 2.5, 3, 5, 10].map((mult) => (
                      <button
                        key={mult}
                        onClick={() => handleQuickMultiplier(mult)}
                        disabled={loadingClaimSettings}
                        className={`px-4 py-2 text-sm font-bold transition-all disabled:opacity-50 ${
                          claimSettings.claimMultiplier === mult 
                            ? 'bg-cyan-500 text-black' 
                            : 'border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/20'
                        }`}
                      >
                        {mult}x
                      </button>
                    ))}
                  </div>
                  <div className="text-xs text-gray-600 mt-2">
                    Current: <span className="text-cyan-400 font-bold">{(claimSettings.baseClaimAmount * claimSettings.claimMultiplier).toLocaleString()}</span> tokens per claim
                  </div>
                </div>

                {/* Holder Multiplier */}
                <div className="mb-4">
                  <div className="text-[10px] tracking-[0.2em] text-gray-500 mb-2">30M+ HOLDER CLAIMS (PER 24H)</div>
                  <div className="flex flex-wrap gap-2">
                    {[1, 2, 3, 4, 5].map((mult) => (
                      <button
                        key={mult}
                        onClick={async () => {
                          const newSettings = { ...claimSettings, holderMultiplier: mult };
                          setClaimSettings(newSettings);
                          await handleSaveClaimSettings();
                        }}
                        disabled={loadingClaimSettings}
                        className={`px-4 py-2 text-sm font-bold transition-all disabled:opacity-50 ${
                          claimSettings.holderMultiplier === mult 
                            ? 'bg-yellow-500 text-black' 
                            : 'border border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/20'
                        }`}
                      >
                        {mult}x
                      </button>
                    ))}
                  </div>
                  <div className="text-xs text-gray-600 mt-2">
                    30M+ holders can claim <span className="text-yellow-400 font-bold">{claimSettings.holderMultiplier} times</span> per cooldown period
                  </div>
                </div>
              </div>

              {/* Detailed Settings */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
                    BASE CLAIM AMOUNT
                  </label>
                  <input
                    type="number"
                    value={claimSettings.baseClaimAmount}
                    onChange={(e) => setClaimSettings({ ...claimSettings, baseClaimAmount: parseInt(e.target.value) || 80000 })}
                    className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black"
                    placeholder="80000"
                  />
                  <p className="text-[10px] text-gray-600 mt-1">Base tokens per claim (before multiplier)</p>
                </div>
                <div>
                  <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
                    COOLDOWN HOURS
                  </label>
                  <input
                    type="number"
                    value={claimSettings.cooldownHours}
                    onChange={(e) => setClaimSettings({ ...claimSettings, cooldownHours: parseInt(e.target.value) || 24 })}
                    className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black"
                    placeholder="24"
                  />
                  <p className="text-[10px] text-gray-600 mt-1">Hours between claims per wallet</p>
                </div>
                <div>
                  <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
                    MIN NEYNAR SCORE
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="1"
                    value={claimSettings.minNeynarScore}
                    onChange={(e) => setClaimSettings({ ...claimSettings, minNeynarScore: parseFloat(e.target.value) || 0.6 })}
                    className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black"
                    placeholder="0.6"
                  />
                  <p className="text-[10px] text-gray-600 mt-1">Min score to claim (0.0-1.0, 30M+ holders bypass)</p>
                </div>
                <div>
                  <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
                    CUSTOM MULTIPLIER
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={claimSettings.claimMultiplier}
                    onChange={(e) => setClaimSettings({ ...claimSettings, claimMultiplier: parseFloat(e.target.value) || 1 })}
                    className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black"
                    placeholder="1"
                  />
                  <p className="text-[10px] text-gray-600 mt-1">Enter custom multiplier (e.g., 1.5, 2.5)</p>
                </div>
              </div>

              <div className="p-3 bg-cyan-900/20 border border-cyan-500 text-cyan-400 text-xs mb-4">
                <strong>CURRENT SETTINGS:</strong> {(claimSettings.baseClaimAmount * claimSettings.claimMultiplier).toLocaleString()} tokens per claim, 
                {claimSettings.cooldownHours}h cooldown, {claimSettings.holderMultiplier}x for 30M+ holders, 
                min Neynar score {claimSettings.minNeynarScore}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleSaveClaimSettings}
                  disabled={loadingClaimSettings}
                  className="px-4 py-2 bg-cyan-600 text-white font-bold hover:bg-cyan-500 transition-all disabled:opacity-50"
                >
                  {loadingClaimSettings ? 'SAVING...' : 'SAVE SETTINGS'}
                </button>
                <button
                  onClick={fetchClaimSettings}
                  disabled={loadingClaimSettings}
                  className="px-4 py-2 border border-white text-sm hover:bg-white hover:text-black transition-all disabled:opacity-50"
                >
                  REFRESH
                </button>
              </div>
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
                  <div>
                    <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
                      TOKEN NAME (OPTIONAL)
                    </label>
                    <input
                      type="text"
                      name="tokenName"
                      value={editFormData.tokenName}
                      onChange={handleEditFormChange}
                      className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black"
                      placeholder="$TOKEN"
                    />
                  </div>
                </div>

                {editFormData.category === 'tokens' && (
                  <div>
                    <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
                      TOKEN CONTRACT ADDRESS (OPTIONAL)
                    </label>
                    <input
                      type="text"
                      name="tokenContractAddress"
                      value={editFormData.tokenContractAddress}
                      onChange={handleEditFormChange}
                      className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black font-mono"
                      placeholder="0x..."
                      pattern="^0x[a-fA-F0-9]{40}$"
                    />
                    <p className="text-[10px] text-gray-600 mt-1">Contract address on Base network</p>
                  </div>
                )}

                {/* Token Contract Address for Featured/Other Categories (optional) */}
                {editFormData.category !== 'tokens' && (
                  <div>
                    <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
                      TOKEN CONTRACT ADDRESS (OPTIONAL)
                    </label>
                    <input
                      type="text"
                      name="tokenContractAddress"
                      value={editFormData.tokenContractAddress}
                      onChange={handleEditFormChange}
                      className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black font-mono"
                      placeholder="0x..."
                      pattern="^0x[a-fA-F0-9]{40}$"
                    />
                    <p className="text-[10px] text-gray-600 mt-1">Optional: Add a token contract address to enable swap button. Must be a valid Ethereum address on Base network.</p>
                  </div>
                )}

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
                      <option value="tokens">TOKENS</option>
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
                      <option value="active">ACTIVE</option>
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
                      TIPS ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      name="stats.tips"
                      value={tipsUsdDisplay.edit !== '' ? tipsUsdDisplay.edit : (ethPrice && editFormData.stats.tips ? (editFormData.stats.tips * ethPrice).toFixed(2) : '0')}
                      onChange={handleEditFormChange}
                      className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black"
                      placeholder="0"
                    />
                    {ethPrice && tipsUsdDisplay.edit && parseFloat(tipsUsdDisplay.edit) > 0 && (
                      <p className="text-[10px] text-gray-600 mt-1">
                        ≈ {(parseFloat(tipsUsdDisplay.edit) / ethPrice).toFixed(6)} ETH
                      </p>
                    )}
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
                {[...liveProjects].sort((a, b) => a.name.localeCompare(b.name)).map((project) => (
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
                          <span className="ml-4">
                            Views: {(project.windowStats?.views ?? project.stats?.views ?? 0)} | Clicks: {(project.windowStats?.clicks ?? project.stats?.clicks ?? 0)} | Tips: {project.stats?.tips || 0}
                          </span>
                        </div>
                        {project.status === 'featured' && project.featuredAt && (
                          <FeaturedTimer project={project} onUpdate={fetchLiveProjects} userFid={userFid} />
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(project)}
                          className="px-4 py-2 bg-blue-500 text-white font-bold hover:bg-blue-400 transition-all"
                        >
                          EDIT
                        </button>
                        <button
                          onClick={() => {
                            const currentClicks = project.windowStats?.clicks ?? project.stats?.clicks ?? 0;
                            const newClicks = prompt(`Update clicks for ${project.name}:\nCurrent (window): ${currentClicks}\nEnter new value:`, currentClicks);
                            if (newClicks !== null && !isNaN(newClicks)) {
                              handleQuickStatsUpdate(project.id, 'clicks', parseInt(newClicks));
                            }
                          }}
                          className="px-4 py-2 bg-green-600 text-white font-bold hover:bg-green-500 transition-all text-xs"
                          title="Quick update clicks"
                        >
                          SET CLICKS
                        </button>
                        {project.status === 'featured' && (
                          <button
                            onClick={() => handleResetStatsWindow(project.id, project.name)}
                            className="px-4 py-2 bg-red-600 text-white font-bold hover:bg-red-500 transition-all text-xs"
                            title="Reset stats window (sets new featuredAt timestamp)"
                          >
                            RESET STATS
                          </button>
                        )}
                        {project.status !== 'featured' && (
                          <button
                            onClick={() => handleQuickSetFeatured(project.id)}
                            className="px-4 py-2 bg-yellow-600 text-white font-bold hover:bg-yellow-500 transition-all text-xs"
                            title="Set as featured project (resets claims automatically)"
                          >
                            SET FEATURED
                          </button>
                        )}
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
                  {[...archivedProjects].sort((a, b) => a.name.localeCompare(b.name)).map((project) => (
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
                            <span className="ml-4">
                              Views: {(project.windowStats?.views ?? project.stats?.views ?? 0)} | Clicks: {(project.windowStats?.clicks ?? project.stats?.clicks ?? 0)} | Tips: {project.stats?.tips || 0}
                            </span>
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
                            onClick={() => {
                              const newClicks = prompt(`Update clicks for ${project.name}:\nCurrent: ${project.stats?.clicks || 0}\nEnter new value:`, project.stats?.clicks || 0);
                              if (newClicks !== null && !isNaN(newClicks)) {
                                handleQuickStatsUpdate(project.id, 'clicks', parseInt(newClicks));
                              }
                            }}
                            className="px-4 py-2 bg-green-600 text-white font-bold hover:bg-green-500 transition-all text-xs"
                            title="Quick update clicks"
                          >
                            SET CLICKS
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
                  <div>
                    <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
                      TOKEN NAME (OPTIONAL)
                    </label>
                    <input
                      type="text"
                      name="tokenName"
                      value={createFormData.tokenName}
                      onChange={handleCreateFormChange}
                      className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black"
                      placeholder="$TOKEN"
                    />
                  </div>
                </div>

                {createFormData.category === 'tokens' && (
                  <div>
                    <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
                      TOKEN CONTRACT ADDRESS (OPTIONAL)
                    </label>
                    <input
                      type="text"
                      name="tokenContractAddress"
                      value={createFormData.tokenContractAddress}
                      onChange={handleCreateFormChange}
                      className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black font-mono"
                      placeholder="0x..."
                      pattern="^0x[a-fA-F0-9]{40}$"
                    />
                    <p className="text-[10px] text-gray-600 mt-1">Contract address on Base network</p>
                  </div>
                )}

                {/* Token Contract Address for Featured/Other Categories (optional) */}
                {createFormData.category !== 'tokens' && (
                  <div>
                    <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
                      TOKEN CONTRACT ADDRESS (OPTIONAL)
                    </label>
                    <input
                      type="text"
                      name="tokenContractAddress"
                      value={createFormData.tokenContractAddress}
                      onChange={handleCreateFormChange}
                      className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black font-mono"
                      placeholder="0x..."
                      pattern="^0x[a-fA-F0-9]{40}$"
                    />
                    <p className="text-[10px] text-gray-600 mt-1">Optional: Add a token contract address to enable swap button. Must be a valid Ethereum address on Base network.</p>
                  </div>
                )}

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
                      <option value="tokens">TOKENS</option>
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
                      TIPS ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      name="stats.tips"
                      value={tipsUsdDisplay.create !== '' ? tipsUsdDisplay.create : (ethPrice && createFormData.stats.tips ? (createFormData.stats.tips * ethPrice).toFixed(2) : '0')}
                      onChange={handleCreateFormChange}
                      className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black"
                      placeholder="0"
                    />
                    {ethPrice && tipsUsdDisplay.create && parseFloat(tipsUsdDisplay.create) > 0 && (
                      <p className="text-[10px] text-gray-600 mt-1">
                        ≈ {(parseFloat(tipsUsdDisplay.create) / ethPrice).toFixed(6)} ETH
                      </p>
                    )}
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
              {[...submissions].sort((a, b) => a.name.localeCompare(b.name)).map((submission) => (
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
                          {submission.paymentTxHash && (
                            <span className="text-[9px] ml-1">• Paid</span>
                          )}
                          {submission.refunded && (
                            <span className="text-red-400 ml-1">• Refunded</span>
                          )}
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

                  {submission.paymentAmount > 0 && submission.submitterWalletAddress && (
                    <div className="mb-4 p-3 border border-green-500/30 bg-green-500/5">
                      <div className="text-[10px] tracking-[0.2em] text-green-400 mb-2">PAYMENT INFO</div>
                      <div className="text-xs space-y-1">
                        <div>Amount: {submission.paymentAmount} ETH</div>
                        {submission.paymentTimestamp && (
                          <div className="text-[10px] text-gray-400">
                            Paid: {new Date(submission.paymentTimestamp).toLocaleString()}
                          </div>
                        )}
                        {submission.paymentTxHash && (
                          <div className="text-[10px] font-mono text-gray-400 mt-1 break-all">
                            TX Hash: <a href={`https://basescan.org/tx/${submission.paymentTxHash}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">{submission.paymentTxHash}</a>
                          </div>
                        )}
                        {submission.submitterWalletAddress && (
                          <div className="text-[10px] font-mono text-gray-400 mt-1 break-all">
                            From: <a href={`https://basescan.org/address/${submission.submitterWalletAddress}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">{submission.submitterWalletAddress}</a>
                          </div>
                        )}
                        {submission.refunded && submission.refundTxHash && (
                          <div className="text-[10px] text-red-400 mt-1">
                            Refunded TX: <a href={`https://basescan.org/tx/${submission.refundTxHash}`} target="_blank" rel="noopener noreferrer" className="text-red-400 hover:underline">{submission.refundTxHash}</a>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {submission.plannedGoLiveDate && (
                    <div className="mb-4 p-3 border border-blue-500/30 bg-blue-500/5">
                      <div className="text-[10px] tracking-[0.2em] text-blue-400 mb-1">PLANNED GO LIVE</div>
                      <div className="text-xs text-gray-300">
                        {new Date(submission.plannedGoLiveDate).toLocaleDateString()}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-4 pt-4 border-t border-white">
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('APPROVE button clicked, submission:', submission);
                        if (submission?.id) {
                          console.log('Calling handleApprove with ID:', submission.id);
                          await handleApprove(submission.id);
                        } else {
                          console.error('Missing submission ID:', submission);
                          setMessage('ERROR: Missing submission ID');
                        }
                      }}
                      className="px-6 py-2 bg-white text-black font-bold hover:bg-gray-200 transition-all cursor-pointer"
                    >
                      APPROVE
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (submission?.id) {
                          handleFeature(submission.id);
                        } else {
                          setMessage('ERROR: Missing submission ID');
                        }
                      }}
                      className="px-6 py-2 bg-yellow-500 text-black font-bold hover:bg-yellow-400 transition-all cursor-pointer"
                    >
                      FEATURE NOW
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (submission?.id) {
                          handleSchedule(submission.id);
                        } else {
                          setMessage('ERROR: Missing submission ID');
                        }
                      }}
                      className="px-6 py-2 bg-blue-500 text-white font-bold hover:bg-blue-400 transition-all cursor-pointer"
                    >
                      SCHEDULE
                    </button>
                    {submission.paymentAmount > 0 && !submission.refunded && submission.submitterWalletAddress && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (submission?.id) {
                            handleRefund(submission.id);
                          } else {
                            setMessage('ERROR: Missing submission ID');
                          }
                        }}
                        className="px-6 py-2 bg-red-600 text-white font-bold hover:bg-red-500 transition-all cursor-pointer"
                      >
                        REFUND
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (submission?.id) {
                          handleReject(submission.id);
                        } else {
                          setMessage('ERROR: Missing submission ID');
                        }
                      }}
                      className="px-6 py-2 border border-white font-bold hover:bg-white hover:text-black transition-all cursor-pointer"
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
