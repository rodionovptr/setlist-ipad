export default async function handler(req, res) {
  // Allow CORS from any origin
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  const token = process.env.YA_TOKEN
  if (!token) {
    res.status(500).json({ error: 'Token not configured' })
    return
  }

  // Build Yandex Disk API URL
  const { path: apiPath, ...queryParams } = req.query
  const yadiskPath = '/' + (Array.isArray(apiPath) ? apiPath.join('/') : apiPath || '')
  
  const url = new URL('https://cloud-api.yandex.net/v1/disk' + yadiskPath)
  Object.entries(queryParams).forEach(([k, v]) => url.searchParams.set(k, v))

  try {
    const response = await fetch(url.toString(), {
      method: req.method,
      headers: {
        'Authorization': 'OAuth ' + token,
        'Content-Type': 'application/json',
      },
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined
    })

    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      const data = await response.json()
      res.status(response.status).json(data)
    } else {
      const text = await response.text()
      res.status(response.status).send(text)
    }
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
