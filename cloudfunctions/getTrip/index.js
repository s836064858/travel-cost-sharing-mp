const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { tripId } = event || {}
  if (!tripId) return { success: false, message: '缺少 tripId' }

  const db = cloud.database()
  const trips = db.collection('trips')
  const users = db.collection('users')
  const _ = db.command

  try {
    const res = await trips.where({ tripId }).limit(1).get()
    const doc = (res && res.data && res.data[0]) || null
    if (!doc) return { success: false, message: '旅行不存在' }
    // 若成员包含 openid，则补充头像信息
    const members = doc.members || []
    const openids = Array.from(new Set(members.map((m) => m.openid).filter(Boolean)))
    if (openids.length > 0) {
      try {
        const ures = await users.where({ openid: _.in(openids) }).get()
        const list = (ures && ures.data) || []
        const avatarMap = {}
        list.forEach((u) => {
          avatarMap[u.openid] = u.avatarUrl || ''
        })
        doc.members = members.map((m) => ({
          ...m,
          avatarUrl: m.openid ? avatarMap[m.openid] || '' : (m.avatarUrl || '')
        }))
      } catch (e) {
        // 头像补充失败不影响主流程
      }
    }
    return { success: true, data: doc }
  } catch (err) {
    return { success: false, message: err && err.message }
  }
}