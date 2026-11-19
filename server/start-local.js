process.env.SERVE_STATIC = 'true';
process.env.NODE_ENV ||= 'development';
await import('./index.js');
