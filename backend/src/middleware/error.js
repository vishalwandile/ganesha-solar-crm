export class HttpError extends Error {
  constructor(status, message, details) {
    super(message)
    this.status = status
    this.details = details
  }
}

export function notFound(req, res, next) {
  next(new HttpError(404, `Route not found: ${req.method} ${req.path}`))
}

export function errorHandler(err, req, res, next) {
  // eslint-disable-next-line no-unused-vars
  void next
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      error: 'Images must be 1 MB or smaller; PDF, DOC, and DOCX files must be 250 KB or smaller',
    })
  }
  const status = err.status || 500
  const payload = {
    error: err.message || 'Internal server error',
  }
  if (err.details) payload.details = err.details

  // Friendly unique constraint messages
  if (err.code === '23505') {
    if (String(err.constraint || err.detail || '').includes('consumer_number')) {
      return res.status(409).json({ error: 'A customer with this consumer number already exists.' })
    }
    if (String(err.constraint || err.detail || '').includes('username')) {
      return res.status(409).json({ error: 'Username already exists.' })
    }
    return res.status(409).json({ error: 'Duplicate value violates a unique constraint.' })
  }

  if (status >= 500) {
    console.error(err)
  }
  res.status(status).json(payload)
}

export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)
}
