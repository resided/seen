// Analytics tracking utility
// Tracks all key metrics for quarterly reports and insights

import { getRedisClient } from './redis';

const METRICS_PREFIX = 'metrics:';
const DAILY_PREFIX = 'metrics:daily:';
const MONTHLY_PREFIX = 'metrics:monthly:';

// Metric types
export const METRIC_TYPES = {
  PAGE_VIEW: 'page_view',
  MINIAPP_CLICK: 'miniapp_click',
  LISTING_SUBMIT: 'listing_submit',
  PREDICTION_SUBMIT: 'prediction_submit',
  FEEDBACK_SUBMIT: 'feedback_submit',
  CLAIM_SUCCESS: 'claim_success',
  TIP_SENT: 'tip_sent',
  CHAT_MESSAGE: 'chat_message',
  WALLET_CONNECT: 'wallet_connect',
};

/**
 * Track a metric event
 * @param {string} metricType - Type of metric (from METRIC_TYPES)
 * @param {Object} data - Additional data to store with the event
 * @param {number} value - Optional numeric value (for tips, claims, etc)
 */
export async function trackMetric(metricType, data = {}, value = 1) {
  const redis = await getRedisClient();
  if (!redis) {
    console.warn('[ANALYTICS] Redis unavailable, skipping metric tracking');
    return;
  }

  try {
    const timestamp = Date.now();
    const date = new Date(timestamp);
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    const monthStr = dateStr.substring(0, 7); // YYYY-MM

    // Increment total counter
    await redis.incr(`${METRICS_PREFIX}total:${metricType}`);

    // Increment daily counter
    await redis.incr(`${DAILY_PREFIX}${dateStr}:${metricType}`);

    // Increment monthly counter
    await redis.incr(`${MONTHLY_PREFIX}${monthStr}:${metricType}`);

    // If there's a numeric value (like tip amount), track that separately
    if (value !== 1) {
      await redis.incrByFloat(`${METRICS_PREFIX}total:${metricType}:value`, value);
      await redis.incrByFloat(`${DAILY_PREFIX}${dateStr}:${metricType}:value`, value);
      await redis.incrByFloat(`${MONTHLY_PREFIX}${monthStr}:${metricType}:value`, value);
    }

    // Track unique users if FID is provided
    if (data.fid) {
      await redis.sAdd(`${METRICS_PREFIX}unique_users`, data.fid.toString());
      await redis.sAdd(`${DAILY_PREFIX}${dateStr}:unique_users`, data.fid.toString());
      await redis.sAdd(`${MONTHLY_PREFIX}${monthStr}:unique_users`, data.fid.toString());
    }

    // Store detailed event data with expiry (keep for 90 days)
    const eventKey = `${METRICS_PREFIX}events:${metricType}:${timestamp}`;
    await redis.set(eventKey, JSON.stringify({
      type: metricType,
      timestamp,
      date: dateStr,
      data,
      value,
    }), { EX: 90 * 24 * 60 * 60 });

    console.log('[ANALYTICS] Tracked:', metricType, data.fid ? `FID ${data.fid}` : '');
  } catch (error) {
    console.error('[ANALYTICS] Tracking error:', error);
  }
}

/**
 * Get total metrics across all time
 */
export async function getTotalMetrics() {
  const redis = await getRedisClient();
  if (!redis) return null;

  try {
    const metrics = {};

    for (const metricType of Object.values(METRIC_TYPES)) {
      const count = await redis.get(`${METRICS_PREFIX}total:${metricType}`);
      const value = await redis.get(`${METRICS_PREFIX}total:${metricType}:value`);

      metrics[metricType] = {
        count: parseInt(count || 0),
        value: parseFloat(value || 0),
      };
    }

    // Get unique user count
    const uniqueUsers = await redis.sCard(`${METRICS_PREFIX}unique_users`);
    metrics.unique_users = uniqueUsers;

    return metrics;
  } catch (error) {
    console.error('[ANALYTICS] Error fetching total metrics:', error);
    return null;
  }
}

/**
 * Get metrics for a specific date range
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 */
export async function getMetricsByDateRange(startDate, endDate) {
  const redis = await getRedisClient();
  if (!redis) return null;

  try {
    const metrics = {};
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Iterate through each day in the range
    const currentDate = new Date(start);
    while (currentDate <= end) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const dailyMetrics = {};

      for (const metricType of Object.values(METRIC_TYPES)) {
        const count = await redis.get(`${DAILY_PREFIX}${dateStr}:${metricType}`);
        const value = await redis.get(`${DAILY_PREFIX}${dateStr}:${metricType}:value`);

        dailyMetrics[metricType] = {
          count: parseInt(count || 0),
          value: parseFloat(value || 0),
        };
      }

      // Get unique users for this day
      const uniqueUsers = await redis.sCard(`${DAILY_PREFIX}${dateStr}:unique_users`);
      dailyMetrics.unique_users = uniqueUsers;

      metrics[dateStr] = dailyMetrics;
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return metrics;
  } catch (error) {
    console.error('[ANALYTICS] Error fetching date range metrics:', error);
    return null;
  }
}

/**
 * Get metrics for a specific month
 * @param {string} month - YYYY-MM
 */
export async function getMonthlyMetrics(month) {
  const redis = await getRedisClient();
  if (!redis) return null;

  try {
    const metrics = {};

    for (const metricType of Object.values(METRIC_TYPES)) {
      const count = await redis.get(`${MONTHLY_PREFIX}${month}:${metricType}`);
      const value = await redis.get(`${MONTHLY_PREFIX}${month}:${metricType}:value`);

      metrics[metricType] = {
        count: parseInt(count || 0),
        value: parseFloat(value || 0),
      };
    }

    // Get unique users for this month
    const uniqueUsers = await redis.sCard(`${MONTHLY_PREFIX}${month}:unique_users`);
    metrics.unique_users = uniqueUsers;

    return metrics;
  } catch (error) {
    console.error('[ANALYTICS] Error fetching monthly metrics:', error);
    return null;
  }
}

/**
 * Get quarterly metrics
 * @param {number} year - e.g., 2024
 * @param {number} quarter - 1, 2, 3, or 4
 */
export async function getQuarterlyMetrics(year, quarter) {
  const quarterMonths = {
    1: ['01', '02', '03'],
    2: ['04', '05', '06'],
    3: ['07', '08', '09'],
    4: ['10', '11', '12'],
  };

  const months = quarterMonths[quarter];
  if (!months) return null;

  const redis = await getRedisClient();
  if (!redis) return null;

  try {
    const quarterlyTotals = {};

    for (const metricType of Object.values(METRIC_TYPES)) {
      quarterlyTotals[metricType] = { count: 0, value: 0 };
    }

    // Aggregate all unique users across the quarter
    const allUniqueUsers = new Set();

    for (const month of months) {
      const monthStr = `${year}-${month}`;

      for (const metricType of Object.values(METRIC_TYPES)) {
        const count = await redis.get(`${MONTHLY_PREFIX}${monthStr}:${metricType}`);
        const value = await redis.get(`${MONTHLY_PREFIX}${monthStr}:${metricType}:value`);

        quarterlyTotals[metricType].count += parseInt(count || 0);
        quarterlyTotals[metricType].value += parseFloat(value || 0);
      }

      // Get unique users for this month
      const monthlyUsers = await redis.sMembers(`${MONTHLY_PREFIX}${monthStr}:unique_users`);
      monthlyUsers.forEach(user => allUniqueUsers.add(user));
    }

    quarterlyTotals.unique_users = allUniqueUsers.size;

    return {
      year,
      quarter,
      months: months.map(m => `${year}-${m}`),
      metrics: quarterlyTotals,
    };
  } catch (error) {
    console.error('[ANALYTICS] Error fetching quarterly metrics:', error);
    return null;
  }
}
