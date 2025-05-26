const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseProxy(proxyString) {
  try {
    // Handle empty or undefined proxy
    if (!proxyString) {
      return null;
    }
    
    // Check if it's a SOCKS proxy
    const isSocks = proxyString.toLowerCase().startsWith('socks');
    
    // Format can be:
    // 1. username:password@host:port
    // 2. host:port
    // 3. user-XXXXX_country-XX-session-XXXX:password@host:port (iproyal format)
    
    let formattedProxy = proxyString;
    
    // If it doesn't have protocol prefix, add http://
    if (!proxyString.includes('://')) {
      // Check if it already has username:password structure
      if (!proxyString.includes('@')) {
        // If contains a colon but no @, it might be host:port or username:password
        if (proxyString.includes(':')) {
          // Try to detect if it's username:password format or host:port
          // iproyal format usually has user- prefix
          if (proxyString.includes('user-')) {
            // It's likely username:password format, split and format properly
            const parts = proxyString.split(':');
            if (parts.length >= 2) {
              const username = parts[0];
              // The rest might contain both password and host:port
              const restParts = parts.slice(1).join(':').split('@');
              
              if (restParts.length >= 2) {
                // Already in username:password@host:port format
                formattedProxy = `http://${proxyString}`;
              } else {
                // Need to extract password and host:port
                const lastSpaceIndex = proxyString.lastIndexOf(' ');
                if (lastSpaceIndex !== -1) {
                  const password = proxyString.substring(proxyString.indexOf(':') + 1, lastSpaceIndex);
                  const hostPort = proxyString.substring(lastSpaceIndex + 1);
                  formattedProxy = `http://${username}:${password}@${hostPort}`;
                } else {
                  // Can't correctly parse, use as is with http:// prefix
                  formattedProxy = `http://${proxyString}`;
                }
              }
            } else {
              // Can't correctly parse, use as is with http:// prefix
              formattedProxy = `http://${proxyString}`;
            }
          } else {
            // Likely a simple host:port format
            formattedProxy = `http://${proxyString}`;
          }
        } else {
          // No colon, probably just a hostname
          formattedProxy = `http://${proxyString}`;
        }
      } else {
        // Already has @ symbol, just add http://
        formattedProxy = `http://${proxyString}`;
      }
    }
    
    // Return parsed proxy
    return {
      url: formattedProxy,
      isSocks
    };
  } catch (error) {
    throw new Error(`Failed to parse proxy: ${error.message}`);
  }
}

function createAxiosWithProxy(proxyString) {
  try {
    const instance = axios.create();
    
    // Add proxy if available
    if (proxyString) {
      const proxy = parseProxy(proxyString);
      
      if (proxy) {
        const agent = proxy.isSocks
          ? new SocksProxyAgent(proxy.url)
          : new HttpsProxyAgent(proxy.url);
        
        instance.defaults.httpsAgent = agent;
        instance.defaults.httpAgent = agent;
      }
    }
    
    // Add default headers and timeout
    instance.defaults.timeout = 30000;
    instance.defaults.headers.common['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36';
    
    // Add request interceptor for logging
    instance.interceptors.request.use(config => {
      // Add timestamp to track request duration
      config.metadata = { startTime: new Date() };
      return config;
    });
    
    // Add response interceptor for error handling
    instance.interceptors.response.use(
      response => {
        // Calculate request duration
        const duration = new Date() - response.config.metadata.startTime;
        // We could log this if needed
        return response;
      },
      error => {
        // Extract useful information from the error
        const errorInfo = {
          url: error.config?.url || 'unknown url',
          method: error.config?.method || 'unknown method',
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          message: error.message
        };
        
        // Enrich error object with more context
        error.proxyInfo = {
          isProxyError: isProxyError(error.message),
          errorDetails: errorInfo
        };
        
        return Promise.reject(error);
      }
    );
    
    return instance;
  } catch (error) {
    throw new Error(`Failed to create axios instance: ${error.message}`);
  }
}

function createAxiosWithoutProxy() {
  try {
    const instance = axios.create();
    
    // Add default headers and timeout
    instance.defaults.timeout = 30000;
    instance.defaults.headers.common['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36';
    
    // Add request interceptor for logging
    instance.interceptors.request.use(config => {
      // Add timestamp to track request duration
      config.metadata = { startTime: new Date() };
      return config;
    });
    
    // Add response interceptor for error handling
    instance.interceptors.response.use(
      response => {
        // Calculate request duration
        const duration = new Date() - response.config.metadata.startTime;
        // We could log this if needed
        return response;
      },
      error => {
        // Extract useful information from the error
        const errorInfo = {
          url: error.config?.url || 'unknown url',
          method: error.config?.method || 'unknown method',
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          message: error.message
        };
        
        // Enrich error object with more context
        error.proxyInfo = {
          isProxyError: isProxyError(error.message),
          errorDetails: errorInfo
        };
        
        return Promise.reject(error);
      }
    );
    
    return instance;
  } catch (error) {
    throw new Error(`Failed to create axios instance: ${error.message}`);
  }
}

function isProxyError(errorMessage = '') {
  if (!errorMessage) return false;
  
  const proxyErrorPatterns = [
    'ECONNRESET',
    'ETIMEDOUT', 
    'ECONNREFUSED',
    'ESOCKETTIMEDOUT',
    'socket hang up',
    'network error',
    'Network Error',
    'timeout',
    'read ECONNRESET',
    'Failed to fetch',
    'Unable to connect',
    'Proxy connection failed',
    '403 Forbidden',
    '429 Too Many Requests',
    'socket disconnected',
    'connection refused',
    'Proxy connection ended before receiving CONNECT response',
    'EPROTO',
    'tunneling socket could not be established',
    'tunneling socket',
    'ENOTFOUND',
    'getaddrinfo ENOTFOUND',
    'connect ETIMEDOUT',
    'socket timeout'
  ];
  
  const lowerCaseError = errorMessage.toLowerCase();
  return proxyErrorPatterns.some(pattern => 
    lowerCaseError.includes(pattern.toLowerCase())
  );
}

async function retry(fn, retryAttempts, retryDelay, logger, walletIndex) {
  let lastError;
  
  for (let attempt = 1; attempt <= retryAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Get error message
      const errorMessage = error.message || '';
      
      // Check if it's眼见得是网络错误
      const isProxyIssue = isProxyError(errorMessage);
      
      // Log with additional context if it's a proxy error
      if (isProxyIssue) {
        logger.warn(`⚠️ Proxy error detected: ${error.message}. Attempt ${attempt}/${retryAttempts}`, { walletIndex });
      }
      
      if (attempt < retryAttempts) {
        // Calculate delay with exponential backoff and add some randomness
        const jitter = Math.random() * 500; // Add up to 500ms of random jitter
        const delay = retryDelay * Math.pow(1.5, attempt - 1) + jitter;
        
        logger.warn(`🔄 Attempt ${attempt}/${retryAttempts} failed. Retrying in ${Math.round(delay)}ms... Error: ${error.message}`, { walletIndex });
        await sleep(delay);
      } else {
        // Last attempt failed
        logger.error(`❌ All ${retryAttempts} retry attempts failed. Last error: ${error.message}`, { walletIndex });
      }
    }
  }
  
  throw lastError;
}

module.exports = {
  sleep,
  parseProxy,
  createAxiosWithProxy,
  createAxiosWithoutProxy,
  isProxyError,
  retry
};
