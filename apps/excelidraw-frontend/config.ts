
const isDev = process.env.NODE_ENV !== 'production';
const API_PORT = process.env.NEXT_PUBLIC_API_PORT || '3002';
const API_HOST = process.env.NEXT_PUBLIC_API_HOST || 'localhost';
const WS_PORT = process.env.NEXT_PUBLIC_WS_PORT || '8080';
const WS_HOST = process.env.NEXT_PUBLIC_WS_HOST || 'localhost';

export const HTTP_BACKEND = isDev 
  ? `http://${API_HOST}:${API_PORT}` 
  : process.env.NEXT_PUBLIC_API_URL || `https://${API_HOST}`;
  
export const WS_URL = isDev 
  ? `ws://${WS_HOST}:${WS_PORT}` 
  : process.env.NEXT_PUBLIC_WS_URL || `wss://${WS_HOST}`;
