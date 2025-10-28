const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { tripId, name = '' } = event || {}
  if (!tripId) return { success: false, message: '缺少 tripId' }
  const nick = (name || '').trim()
  if (!nick) return { success: false, message: '请输入昵称' }

  const db = cloud.database()
  const tmpTrips = db.collection('tmp_trips')

  try {
    const found = await tmpTrips.where({ tripId }).limit(1).get()
    const doc = (found && found.data && found.data[0]) || null
    if (!doc) return { success: false, message: '临时旅行不存在' }

    const members = Array.isArray(doc.members) ? doc.members : []
    const exists = members.some(m => (m.name && m.name === nick))
    if (exists) return { success: false, message: '该昵称已在成员列表中' }

    const newMember = { name: nick, isCreator: false }
    const nextMembers = members.concat([newMember])

    await tmpTrips.doc(doc._id).update({
      data: { members: nextMembers, updatedAt: db.serverDate() }
    })

    return { success: true, action: 'added' }
  } catch (err) {
    return { success: false, message: err && err.message }
  }
}