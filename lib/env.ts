// Check if the environment variable exists
if (!process.env.OPENAI_API_KEY) {
  throw new Error('Missing OPENAI_API_KEY environment variable')
}

// Export without exposing the actual key
export const env = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY
} as const 