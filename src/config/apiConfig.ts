// API Configuration
// This module handles OpenAI API key configuration and client initialization

// Get API key from environment variables
export const getOpenAIApiKey = (): string | null => {
  try {
    const env = import.meta.env;
    
    // Check for OPENAI_API_KEY
    const key = env?.OPENAI_API_KEY;
    
    // Final validation
    if (!key || typeof key !== 'string' || key.trim() === '' || key === 'undefined' || key === 'null') {
      return null;
    }
    
    return key.length > 10 ? key : null; // Basic sanity check
  } catch (error) {
    console.log('ℹ️ Could not access environment variables (this is normal for demo mode)');
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
  
  const apiKey = getOpenAIApiKey();
  if (!apiKey) return false;
  
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
const apiKey = getOpenAIApiKey();
if (apiKey) {
  console.log('✅ Valid OpenAI API key found - will initialize when needed');
} else {
  console.log('ℹ️ No valid OpenAI API key found - running in demo mode');
} 