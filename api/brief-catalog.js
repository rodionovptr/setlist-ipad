// GET /api/brief-catalog — список песен для страницы заказчика.
// Отдаёт только названия и разделы, без путей к файлам и без доступа к Диску.
const { readCatalog } = require('./_disk')

module.exports = async function handler(req, res) {
  try {
    const songs = await readCatalog()
    const list = songs.map(s => ({
      id: s.id,
      title: s.title,
      section: s.section,
      isMix: !!s.isMix,
      children: s.isMix ? (s.children || []).map(c => c.title) : undefined
    }))
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=600')
    res.status(200).json({ songs: list })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Не удалось загрузить список песен' })
  }
}
