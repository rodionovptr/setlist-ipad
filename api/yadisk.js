module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  const token = process.env.YA_TOKEN
  if (!token) { res.status(500).json({ error: 'Token not configured' }); return }

  // 'ep' = endpoint path (e.g. '/resources', '/resources/download')
  // all other query params are forwarded to Yandex API
  const ep = req.query.ep || '/'
  const params = new URLSearchParams()
  Object.entries(req.query).forEach(([k, v]) => {
    if (k !== 'ep') params.set(k, v)
  })

  const yadiskUrl = 'https://cloud-api.yandex.net/v1/disk' + ep +
    (params.toString() ? '?' + params.toString() : '')

  try {
    const response = await fetch(yadiskUrl, {
      method: req.method,
      headers: {
        'Authorization': 'OAuth ' + token,
        'Content-Type': 'application/json',
      },
      body: req.method !== 'GET' && req.method !== 'HEAD'
        ? JSON.stringify(req.body) : undefined
    })

    const ct = response.headers.get('content-type') || ''
    if (ct.includes('application/json')) {
      res.status(response.status).json(await response.json())
    } else {
      res.status(response.status).send(await response.text())
    }
  } catch(e) {
    res.status(500).json({ error: e.message })
  }
}
