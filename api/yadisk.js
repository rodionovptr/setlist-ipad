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
    if (k !== 'ep' && k !== 'proxy') params.set(k, v)
  })

  const yadiskUrl = 'https://cloud-api.yandex.net/v1/disk' + ep +
    (params.toString() ? '?' + params.toString() : '')

  try {
    const response = await fetch(yadiskUrl, {
      method: req.method,
      headers: {
        'Authorization': 'OAuth ' + token,
        ...(req.method !== 'GET' && req.method !== 'HEAD' && req.body !== undefined
          ? {'Content-Type': 'application/json'} : {})
      },
      body: req.method !== 'GET' && req.method !== 'HEAD' && req.body !== undefined
        ? JSON.stringify(req.body) : undefined
    })

    // Browser CORS blocks direct fetch() of Yandex's temporary download URL.
    // For project JSON files, proxy the actual downloaded bytes through Vercel.
    if (req.query.proxy === '1' && ep === '/resources/download' && response.ok) {
      const meta = await response.json()
      if (!meta?.href) {
        res.status(502).json({error:'Yandex Disk did not return a download URL'})
        return
      }
      const fileResponse = await fetch(meta.href)
      const fileCt = fileResponse.headers.get('content-type') || 'application/octet-stream'
      const buffer = Buffer.from(await fileResponse.arrayBuffer())
      res.status(fileResponse.status).setHeader('Content-Type', fileCt).send(buffer)
      return
    }

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
