/******************************************************
 * LONG POLLING UTILITY
 ******************************************************/

/**
 * Long polling helper function
 * Polls a function at intervals until it returns a truthy value or timeout is reached
 * @param {Function} fn - Function to poll (should return a truthy value when ready)
 * @param {number} timeout - Maximum time to poll in milliseconds (default: 30000)
 * @param {number} interval - Polling interval in milliseconds (default: 1000)
 * @returns {Promise<any>} Result from fn() or null if timeout
 */
async function longPoll(fn, timeout = 30000, interval = 1000) {
  const start = Date.now();

  return new Promise((resolve) => {
    const check = async () => {
      const result = await fn();
      if (result) return resolve(result);

      if (Date.now() - start > timeout) {
        return resolve(null);
      }

      setTimeout(check, interval);
    };

    check();
  });
}

module.exports = longPoll;
