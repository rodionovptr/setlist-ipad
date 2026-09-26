// Общие функции для API заявок. Файлы с "_" Vercel не публикует как эндпоинты.
const YA = 'https://cloud-api.yandex.net/v1/disk'
const CATALOG_PATH = '/Сет-листы/songs_catalog.json'

function auth() {
  return { Authorization: 'OAuth ' + process.env.YA_TOKEN }
}

async function readCatalog() {
  const r = await fetch(`${YA}/resources/download?path=${encodeURIComponent(CATALOG_PATH)}`, { headers: auth() })
  if (!r.ok) throw new Error('catalog link ' + r.status)
  const { href } = await r.json()
  const f = await fetch(href)
  if (!f.ok) throw new Error('catalog download ' + f.status)
  const cat = await f.json()
  if (!cat || !Array.isArray(cat.songs)) throw new Error('catalog format')
  return cat.songs
}

async function exists(path) {
  const r = await fetch(`${YA}/resources?path=${encodeURIComponent(path)}&fields=name`, { headers: auth() })
  return r.ok
}

async function uploadJSON(path, data) {
  const r = await fetch(`${YA}/resources/upload?path=${encodeURIComponent(path)}&overwrite=false`, { headers: auth() })
  if (!r.ok) throw new Error('upload link ' + r.status)
  const { href } = await r.json()
  const put = await fetch(href, { method: 'PUT', body: JSON.stringify(data, null, 2) })
  if (!put.ok) throw new Error('upload ' + put.status)
}

module.exports = { readCatalog, exists, uploadJSON }
