const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { tripId, member = {} } = event || {}
  const name = (member && member.name) ? String(member.name).trim() : ''

  if (!tripId) return { success: false, message: '缺少 tripId' }
  if (!name) return { success: false, message: '请输入成员姓名' }

  const db = cloud.database()
  const trips = db.collection('trips')

  try {
    // 读取旅行
    const res = await trips.where({ tripId }).limit(1).get()
    const doc = (res && res.data && res.data[0]) || null
    if (!doc) return { success: false, message: '旅行不存在' }

    // 仅允许在未结束的旅行中添加成员
    if (doc.status === 'closed') {
      return { success: false, message: '已结束的旅行不可添加成员' }
    }

    const members = Array.isArray(doc.members) ? doc.members : []
    const exists = members.some((m) => {
      const n = (m.name || '').trim()
      return n && n === name
    })
    if (exists) return { success: false, message: '该成员已在列表中' }

    const newMember = {
      id: `name:${name}`,
      name,
      role: 'member',
      active: true
    }

    const nextMembers = members.concat([newMember])
    await trips.doc(doc._id).update({
      data: { members: nextMembers, updatedAt: db.serverDate() }
    })

    return { success: true, memberId: newMember.id }
  } catch (err) {
    return { success: false, message: err && err.message }
  }
}