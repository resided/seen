// Admin page to view analytics and metrics
// Supports total, date range, monthly, and quarterly reports

import { useState } from 'react';

const METRIC_LABELS = {
  page_view: 'Page Views',
  miniapp_click: 'Miniapp Clicks',
  listing_submit: 'Listings Submitted',
  prediction_submit: 'Predictions Made',
  feedback_submit: 'Feedback Submitted',
  claim_success: 'Claims Completed',
  tip_sent: 'Tips Sent',
  chat_message: 'Chat Messages',
  wallet_connect: 'Wallet Connects',
};

export default function AnalyticsAdmin() {
  const [adminFid, setAdminFid] = useState('');
  const [viewType, setViewType] = useState('total');
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form inputs for different view types
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [quarter, setQuarter] = useState('1');

  const fetchMetrics = async () => {
    if (!adminFid) return;

    try {
      setLoading(true);
      setError('');

      let url = `/api/admin/analytics?fid=${adminFid}&type=${viewType}`;

      // Add parameters based on view type
      if (viewType === 'range' && startDate && endDate) {
        url += `&startDate=${startDate}&endDate=${endDate}`;
      } else if (viewType === 'monthly' && month) {
        url += `&month=${month}`;
      } else if (viewType === 'quarterly' && year && quarter) {
        url += `&year=${year}&quarter=${quarter}`;
      }

      const res = await fetch(url);
      const data = await res.json();

      if (res.ok) {
        setMetrics(data.metrics);
        setError('');
      } else {
        setError(data.error || 'Failed to fetch metrics');
        setMetrics(null);
      }
    } catch (err) {
      setError('Failed to fetch metrics');
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  };

  const downloadCSV = () => {
    if (!metrics) return;

    let csvContent = '';

    if (viewType === 'total' || viewType === 'monthly') {
      // Simple format for total/monthly
      csvContent = 'Metric,Count,Value\n';
      Object.entries(metrics).forEach(([key, value]) => {
        if (key === 'unique_users') {
          csvContent += `Unique Users,${value},0\n`;
        } else {
          const label = METRIC_LABELS[key] || key;
          csvContent += `${label},${value.count},${value.value}\n`;
        }
      });
    } else if (viewType === 'quarterly') {
      // Quarterly format
      csvContent = `Quarterly Report - Q${metrics.quarter} ${metrics.year}\n`;
      csvContent += `Months: ${metrics.months.join(', ')}\n\n`;
      csvContent += 'Metric,Count,Value\n';
      Object.entries(metrics.metrics).forEach(([key, value]) => {
        if (key === 'unique_users') {
          csvContent += `Unique Users,${value},0\n`;
        } else {
          const label = METRIC_LABELS[key] || key;
          csvContent += `${label},${value.count},${value.value}\n`;
        }
      });
    } else if (viewType === 'range') {
      // Date range format - transpose data
      csvContent = 'Date,';
      const metricKeys = Object.keys(METRIC_LABELS);
      csvContent += metricKeys.map(k => METRIC_LABELS[k]).join(',') + ',Unique Users\n';

      Object.entries(metrics).forEach(([date, dayMetrics]) => {
        csvContent += `${date},`;
        csvContent += metricKeys.map(k => dayMetrics[k]?.count || 0).join(',');
        csvContent += `,${dayMetrics.unique_users || 0}\n`;
      });
    }

    // Download the CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${viewType}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const renderMetricsTable = () => {
    if (!metrics) return null;

    if (viewType === 'quarterly') {
      return (
        <div className="space-y-4">
          <div className="text-sm text-gray-400">
            Q{metrics.quarter} {metrics.year} ({metrics.months.join(', ')})
          </div>
          <MetricsTable data={metrics.metrics} />
        </div>
      );
    }

    if (viewType === 'range') {
      return (
        <div className="overflow-x-auto">
          <table className="w-full border border-white">
            <thead>
              <tr className="border-b border-white bg-white text-black">
                <th className="p-2 text-left font-bold">Date</th>
                {Object.values(METRIC_LABELS).map(label => (
                  <th key={label} className="p-2 text-right font-bold text-xs">{label}</th>
                ))}
                <th className="p-2 text-right font-bold text-xs">Unique Users</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(metrics).map(([date, dayMetrics]) => (
                <tr key={date} className="border-b border-white">
                  <td className="p-2 font-bold">{date}</td>
                  {Object.keys(METRIC_LABELS).map(key => (
                    <td key={key} className="p-2 text-right text-sm">
                      {dayMetrics[key]?.count || 0}
                    </td>
                  ))}
                  <td className="p-2 text-right text-sm">{dayMetrics.unique_users || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    return <MetricsTable data={metrics} />;
  };

  return (
    <div className="min-h-screen bg-black text-white p-8 font-mono">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-black mb-2">ANALYTICS DASHBOARD</h1>
          <p className="text-gray-400 text-sm">View metrics and generate reports</p>
        </div>

        {/* Admin Login */}
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
            {/* View Type Selector */}
            <div className="mb-6 space-y-4">
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setViewType('total')}
                  className={`px-4 py-2 border font-bold ${
                    viewType === 'total' ? 'bg-white text-black' : 'bg-black text-white border-white'
                  }`}
                >
                  TOTAL
                </button>
                <button
                  onClick={() => setViewType('monthly')}
                  className={`px-4 py-2 border font-bold ${
                    viewType === 'monthly' ? 'bg-white text-black' : 'bg-black text-white border-white'
                  }`}
                >
                  MONTHLY
                </button>
                <button
                  onClick={() => setViewType('quarterly')}
                  className={`px-4 py-2 border font-bold ${
                    viewType === 'quarterly' ? 'bg-white text-black' : 'bg-black text-white border-white'
                  }`}
                >
                  QUARTERLY
                </button>
                <button
                  onClick={() => setViewType('range')}
                  className={`px-4 py-2 border font-bold ${
                    viewType === 'range' ? 'bg-white text-black' : 'bg-black text-white border-white'
                  }`}
                >
                  DATE RANGE
                </button>
              </div>

              {/* View-specific inputs */}
              {viewType === 'monthly' && (
                <div>
                  <label className="block text-xs mb-1">Month (YYYY-MM)</label>
                  <input
                    type="month"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    className="p-2 bg-black border border-white text-white font-mono"
                  />
                </div>
              )}

              {viewType === 'quarterly' && (
                <div className="flex gap-4">
                  <div>
                    <label className="block text-xs mb-1">Year</label>
                    <input
                      type="number"
                      value={year}
                      onChange={(e) => setYear(e.target.value)}
                      className="p-2 bg-black border border-white text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1">Quarter</label>
                    <select
                      value={quarter}
                      onChange={(e) => setQuarter(e.target.value)}
                      className="p-2 bg-black border border-white text-white font-mono"
                    >
                      <option value="1">Q1 (Jan-Mar)</option>
                      <option value="2">Q2 (Apr-Jun)</option>
                      <option value="3">Q3 (Jul-Sep)</option>
                      <option value="4">Q4 (Oct-Dec)</option>
                    </select>
                  </div>
                </div>
              )}

              {viewType === 'range' && (
                <div className="flex gap-4">
                  <div>
                    <label className="block text-xs mb-1">Start Date</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="p-2 bg-black border border-white text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1">End Date</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="p-2 bg-black border border-white text-white font-mono"
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={fetchMetrics}
                  disabled={loading}
                  className="px-6 py-2 bg-white text-black font-black hover:bg-gray-200 disabled:opacity-50"
                >
                  {loading ? 'LOADING...' : 'FETCH METRICS'}
                </button>
                {metrics && (
                  <button
                    onClick={downloadCSV}
                    className="px-6 py-2 border border-white text-white font-black hover:bg-white/10"
                  >
                    DOWNLOAD CSV
                  </button>
                )}
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-6 p-4 border-2 border-red-500 text-red-400">
                {error}
              </div>
            )}

            {/* Metrics Display */}
            {loading && (
              <div className="text-center py-12 text-gray-400">
                LOADING METRICS...
              </div>
            )}

            {!loading && metrics && (
              <div className="border-2 border-white p-4">
                {renderMetricsTable()}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Reusable metrics table component
function MetricsTable({ data }) {
  return (
    <table className="w-full">
      <thead>
        <tr className="border-b-2 border-white">
          <th className="p-2 text-left font-black">Metric</th>
          <th className="p-2 text-right font-black">Count</th>
          <th className="p-2 text-right font-black">Value</th>
        </tr>
      </thead>
      <tbody>
        {Object.entries(data).map(([key, value]) => {
          if (key === 'unique_users') {
            return (
              <tr key={key} className="border-b border-white">
                <td className="p-2">Unique Users</td>
                <td className="p-2 text-right font-bold text-green-400">{value}</td>
                <td className="p-2 text-right">-</td>
              </tr>
            );
          }

          const label = METRIC_LABELS[key] || key;
          return (
            <tr key={key} className="border-b border-white">
              <td className="p-2">{label}</td>
              <td className="p-2 text-right font-bold">{value.count}</td>
              <td className="p-2 text-right text-sm text-gray-400">
                {value.value > 0 ? value.value.toFixed(4) : '-'}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
