// Request manager for handling API rate limits and request queuing

class RequestManager {
  constructor() {
    this.lastRequestTime = 0;
    this.minRequestInterval = 500; // Minimum 500ms between requests
    this.pendingRequests = new Map();
    this.rateLimitRetryDelay = 2000; // Initial retry delay for rate limits (2 seconds)
  }

  /**
   * Check if we should wait before making a request
   */
  shouldWait() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    return timeSinceLastRequest < this.minRequestInterval;
  }

  /**
   * Get wait time before next request
   */
  getWaitTime() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.minRequestInterval) {
      return this.minRequestInterval - timeSinceLastRequest;
    }
    return 0;
  }

  /**
   * Update last request time
   */
  updateLastRequestTime() {
    this.lastRequestTime = Date.now();
  }

  /**
   * Check if error is a rate limit error
   */
  isRateLimitError(error) {
    if (!error || !error.response) return false;
    return error.response.status === 429 || 
           error.response.status === 503 ||
           (error.response.status >= 500 && error.response.status < 600);
  }

  /**
   * Get retry delay with exponential backoff
   */
  getRetryDelay(attempt) {
    return Math.min(this.rateLimitRetryDelay * Math.pow(2, attempt), 10000); // Max 10 seconds
  }

  /**
   * Create a queued request with rate limit handling
   */
  async makeRequest(requestFn, options = {}) {
    const { maxRetries = 3, onRateLimit } = options;

    // Wait if needed to respect minimum interval
    const waitTime = this.getWaitTime();
    if (waitTime > 0) {
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    let lastError = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        this.updateLastRequestTime();
        const result = await requestFn();
        return result;
      } catch (error) {
        lastError = error;

        // Check if it's a rate limit error
        if (this.isRateLimitError(error)) {
          const retryDelay = this.getRetryDelay(attempt);
          
          // Notify about rate limit if callback provided
          if (onRateLimit) {
            onRateLimit(attempt, retryDelay);
          }

          // If this is the last attempt, throw the error
          if (attempt >= maxRetries) {
            throw new Error('請求頻率過高，請稍後再試');
          }

          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }

        // For other errors, throw immediately
        throw error;
      }
    }

    throw lastError;
  }
}

// Export singleton instance
export const requestManager = new RequestManager();
