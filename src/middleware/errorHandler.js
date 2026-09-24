export function errorHandler(err, _req, res, _next) {
  console.error('[api]', err);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Server error' });
}

export function notFound(_req, res) {
  res.status(404).json({ error: 'Not found' });
}
