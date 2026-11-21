/**
 * Global API Configuration for Margam Chatbot
 *
 * In production or under Vercel Services, calls to /api are rewritten
 * to the backend service.
 * In development, defaults to '/api' (proxied by Vite) or VITE_API_URL if set.
 */
export const API_BASE_URL: string = import.meta.env.VITE_API_URL || '/api';
