// API Configuration
// This module handles OpenAI API key configuration and client initialization

// Allowed domains for API access
const ALLOWED_DOMAINS = [
  'localhost',
  '127.0.0.1',
  'netlify.app', // Netlify domains
  'llm-vibes.com',
  'www.llm-vibes.com'
  // Add your custom domain here if you have one
];

// Check if current domain is allowed to access the API
const isAllowedDomain = (): boolean => {
  try {
    const hostname = window.location.hostname;
    return ALLOWED_DOMAINS.some(domain => hostname === domain || hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
};

// Get API key from environment variables
export const getOpenAIApiKey = (): string | null => {
  try {
    // First check if we're in an allowed domain
    if (!isAllowedDomain()) {
      console.warn('⚠️ API access not allowed from this domain');
      return null;
    }

    const env = import.meta.env;
    
    // Check for VITE_OPENAI_API_KEY
    const key = env?.VITE_OPENAI_API_KEY;
    
    // Final validation
    if (!key || typeof key !== 'string' || key.trim() === '' || key === 'undefined' || key === 'null') {
      console.log('⚠️ No valid API key found in VITE_OPENAI_API_KEY');
      return null;
    }
    
    return key.length > 10 ? key : null; // Basic sanity check
  } catch (error) {
    console.log('ℹ️ Could not access environment variables:', error);
    return null;
  }
};

// Check if we have a valid API key
export const hasValidApiKey = (): boolean => {
  const key = getOpenAIApiKey();
  return !!(key && key.trim().length > 10);
};

// OpenAI client initialization
let openaiClient: any = null;
let openaiInitialized = false;

export const initializeOpenAIClient = async (): Promise<boolean> => {
  if (openaiInitialized) return !!openaiClient;
  
  // Check domain access
  if (!isAllowedDomain()) {
    console.warn('⚠️ OpenAI client initialization blocked - domain not allowed');
    return false;
  }
  
  const apiKey = getOpenAIApiKey();
  if (!apiKey) {
    console.log('⚠️ No valid API key found in VITE_OPENAI_API_KEY');
    return false;
  }
  
  try {
    console.log('✅ Valid OpenAI API key found, initializing client...');
    const { OpenAI } = await import('openai');
    openaiClient = new OpenAI({
      apiKey: apiKey,
      dangerouslyAllowBrowser: true
    });
    openaiInitialized = true;
    console.log('✅ OpenAI client initialized successfully');
    return true;
  } catch (error) {
    console.warn('⚠️ Failed to initialize OpenAI client:', error);
    openaiClient = null;
    openaiInitialized = true; // Mark as attempted
    return false;
  }
};

export const getOpenAIClient = () => openaiClient;

// Initialize logging
if (isAllowedDomain()) {
  const apiKey = getOpenAIApiKey();
  if (apiKey) {
    console.log('✅ Valid OpenAI API key found - will initialize when needed');
  } else {
    console.log('ℹ️ No valid OpenAI API key found - running in demo mode');
  }
} else {
  console.log('ℹ️ API access not available on this domain');
} 