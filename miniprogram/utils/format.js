function getShortName(name) {
  if (!name) return ''
  const s = String(name).trim()
  if (s.length <= 2) return s
  return s.slice(-2)
}

module.exports = { getShortName }
