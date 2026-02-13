const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    'Missing Supabase environment variables. Set both SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the .env file'
  );
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Save a status check result to the database
 * @param {string} serviceName - The name of the service (like "Discord API")
 * @param {string} status - Current status: 'operational', 'degraded', 'down', or 'maintenance'
 * @param {number} responseTime - How long the response took (in milliseconds)
 * @param {string} message - Any extra info or error message
 * @returns {Promise<Object>} - The inserted data
 */
async function save_status_log(service_name, status, response_time, message) {
  try {
    const { data, error } = await supabase
      .from('status_logs')
      .insert([
        {
          service_name: service_name,
          status,
          response_time: response_time,
          message,
          timestamp: new Date().toISOString(),
        },
      ])
      .select();

    if (error) {
      console.error('Error saving status log:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Failed to save status log:', error);
    throw error;
  }
}

/**
 * Remove old logs from the database
 * @param {number} days_to_keep - How many days to keep logs for (default 90)
 * @returns {Promise<Object>} - Info about deleted records
 */
async function clean_old_logs(days_to_keep = 90) {
  try {
    const { data, error } = await supabase.rpc('cleanup_old_status_logs', {
      days_to_keep: days_to_keep,
    });

    if (error) {
      console.error('Error cleaning old logs:', error);
      throw error;
    }

    console.log(
      `Removed logs older than ${days_to_keep} days: ${
        data?.[0]?.deleted_count || 0
      } records deleted`
    );
    return data;
  } catch (error) {
    console.error('Failed to clean old logs:', error);
    throw error;
  }
}

function fallback_uptime_data(service_name, hours) {
  const now = new Date();
  return {
    service_name: service_name,
    uptime_percentage: 99.0,
    total_checks: 0,
    operational_checks: 0,
    degraded_checks: 0,
    down_checks: 0,
    maintenance_checks: 0,
    average_response_time: 0,
    period_start: new Date(now - hours * 60 * 60 * 1000).toISOString(),
    period_end: now.toISOString(),
  };
}

/**
 * Get uptime info for a service over the past hours
 * @param {string} service_name - The service name
 * @param {number} hours - How many hours to look back (default 24)
 * @returns {Promise<Object>} - Uptime details
 */
async function get_service_uptime(service_name, hours = 24) {
  try {
    const { data, error } = await supabase.rpc('get_service_uptime', {
      service_name_param: service_name,
      hours_back: hours,
    });

    if (error) {
      console.error(`Error fetching uptime for ${service_name}:`, error);
      throw error;
    }

    return data?.[0] || fallback_uptime_data(service_name, hours);
  } catch (error) {
    console.error(`Failed to get uptime for ${service_name}:`, error);
    return fallback_uptime_data(service_name, hours);
  }
}

/**
 * Get incidents for a service over the past days
 * @param {string} service_name - The service name
 * @param {number} days - How many days to look back (default 7)
 * @returns {Promise<Array>} - List of incidents
 */
async function get_service_incidents(service_name, days = 7) {
  try {
    const { data, error } = await supabase.rpc('get_service_incidents', {
      service_name_param: service_name,
      days_back: days,
    });

    if (error) {
      console.error(`Error fetching incidents for ${service_name}:`, error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error(`Failed to get incidents for ${service_name}:`, error);
    return [];
  }
}

/**
 * Get uptime summary for all services
 * @returns {Promise<Array>} - List of all services with uptime info
 */
async function get_uptime_summary() {
  try {
    const { data, error } = await supabase
      .from('service_uptime_summary')
      .select('*')
      .order('service_name');

    if (error) {
      console.error('Error fetching uptime summary:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Failed to get uptime summary:', error);
    return [];
  }
}

/**
 * Get overall stats for all services over a number of days
 * @param {number} days - How many days to look back (default 30)
 * @returns {Promise<Array>} - List of service stats
 */
async function get_all_service_statistics(days = 30) {
  try {
    const { data, error } = await supabase.rpc('get_service_statistics', {
      days_back: days,
    });

    if (error) {
      console.error('Error fetching service stats:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Failed to get service stats:', error);
    return [];
  }
}

module.exports = {
  supabase,
  save_status_log,
  clean_old_logs,
  get_service_uptime,
  get_service_incidents,
  get_uptime_summary,
  get_all_service_statistics,
};
