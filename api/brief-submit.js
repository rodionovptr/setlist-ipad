// POST /api/brief-submit — заявка заказчика.
// 1) файл-проект на Яндекс.Диск: /Сет-листы/Заявка ДД.ММ.ГГГГ Имя.json
//    («Точно надо» → 1-е отделение, «Можно» → Доп), открывается в приложении как проект
// 2) сообщение в Telegram (если заданы TG_BOT_TOKEN и TG_CHAT_ID)
const { readCatalog, exists, uploadJSON } = require('./_disk')

const STATES = new Set(['must', 'maybe', 'no'])
const clean = (v, max) => String(v || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max)
const fileSafe = v => v.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, ' ').trim()

function setItems(song) {
  if (song.isMix) {
    return (song.children || []).map(c => ({
      id: c.id, title: c.title, section: song.section, exactFile: c.exactFile || null,
      isMixChild: true, mixParentId: song.id, mixParentTitle: song.title
    }))
  }
  return [{ id: song.id, title: song.title, section: song.section, exactFile: song.exactFile || null, files: song.files || null }]
}

async function sendTelegram(text) {
  const token = process.env.TG_BOT_TOKEN, chat = process.env.TG_CHAT_ID
  if (!token || !chat) return false
  // лимит Telegram ~4096 символов — режем по строкам
  const chunks = []
  let cur = ''
  for (const line of text.split('\n')) {
    if ((cur + line).length > 3800) { chunks.push(cur); cur = '' }
    cur += line + '\n'
  }
  if (cur.trim()) chunks.push(cur)
  for (const part of chunks) {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text: part, disable_web_page_preview: true })
    })
    if (!r.ok) throw new Error('telegram ' + r.status + ' ' + await r.text())
  }
  return true
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  let body = req.body
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = null } }
  if (!body || typeof body !== 'object') return res.status(400).json({ error: 'Пустая заявка' })

  // ловушка для ботов: скрытое поле, человек его не заполняет
  if (body.website) return res.status(200).json({ ok: true })

  const date = clean(body.date, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'Укажите дату концерта' })
  const name = clean(body.name, 80)
  const comment = clean(body.comment, 1500)
  const choices = body.choices && typeof body.choices === 'object' ? body.choices : {}
  if (Object.keys(choices).length > 1000) return res.status(400).json({ error: 'Слишком большая заявка' })

  let songs
  try { songs = await readCatalog() }
  catch (e) { console.error(e); return res.status(500).json({ error: 'Не удалось прочитать каталог песен' }) }

  const groups = { must: [], maybe: [], no: [] }
  for (const s of songs) {
    const st = choices[s.id]
    if (STATES.has(st)) groups[st].push(s)
  }
  const unmarked = songs.length - groups.must.length - groups.maybe.length - groups.no.length
  if (!groups.must.length && !groups.maybe.length) return res.status(400).json({ error: 'Отметьте хотя бы одну песню' })

  const [y, m, d] = date.split('-')
  const dateRu = `${d}.${m}.${y}`
  const title = fileSafe(`Заявка ${dateRu}${name ? ' ' + name : ''}`) || 'Заявка'
  const submittedAt = new Date().toISOString()

  const project = {
    projectName: title,
    concertName: title,
    sets: { '1': groups.must.flatMap(setItems), '2': [], 'x': groups.maybe.flatMap(setItems) },
    brief: {
      date, name, comment, submittedAt,
      must: groups.must.map(s => s.title),
      maybe: groups.maybe.map(s => s.title),
      no: groups.no.map(s => s.title),
      unmarked
    }
  }

  let savedAs = null, diskError = null
  try {
    let path = `/Сет-листы/${title}.json`
    for (let i = 2; await exists(path) && i < 20; i++) path = `/Сет-листы/${title} (${i}).json`
    await uploadJSON(path, project)
    savedAs = path
  } catch (e) { console.error(e); diskError = e.message }

  const list = arr => arr.map(s => `• ${s.title}`).join('\n')
  const text = [
    '🎹 Новая заявка на концерт',
    `📅 ${dateRu}`,
    name ? `👤 ${name}` : null,
    comment ? `💬 ${comment}` : null,
    '',
    `✅ Точно надо (${groups.must.length}):`,
    groups.must.length ? list(groups.must) : '—',
    '',
    `🤷 Можно (${groups.maybe.length}):`,
    groups.maybe.length ? list(groups.maybe) : '—',
    '',
    `❌ Не надо: ${groups.no.length}` + (groups.no.length ? '\n' + list(groups.no) : ''),
    unmarked ? `Не отмечено: ${unmarked}` : null,
    '',
    savedAs ? `📁 Проект на Диске: ${savedAs.replace('/Сет-листы/', 'Сет-листы/')}` : `⚠️ На Диск не сохранилось: ${diskError}`
  ].filter(x => x !== null).join('\n')

  let telegramOk = false, telegramError = null
  try { telegramOk = await sendTelegram(text) }
  catch (e) { console.error(e); telegramError = e.message }

  if (!savedAs && !telegramOk) {
    return res.status(500).json({ error: 'Не удалось отправить заявку. Попробуйте ещё раз или напишите Петру напрямую.' })
  }
  res.status(200).json({ ok: true, saved: !!savedAs, telegram: telegramOk, telegramError: telegramError || undefined })
}
