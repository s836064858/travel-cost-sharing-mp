const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { tripId, openid = '', name = '' } = event || {}
  if (!tripId) return { success: false, message: '缺少 tripId' }

  const db = cloud.database()
  const tmpTrips = db.collection('tmp_trips')

  try {
    const found = await tmpTrips.where({ tripId }).limit(1).get()
    const doc = (found && found.data && found.data[0]) || null
    if (!doc) return { success: false, message: '临时旅行不存在' }

    const members = Array.isArray(doc.members) ? doc.members : []
    const nextMembers = members.filter(m => {
      if (openid) return m.openid !== openid
      if (name) return m.name !== name
      return true
    })

    await tmpTrips.doc(doc._id).update({
      data: { members: nextMembers, updatedAt: db.serverDate() }
    })

    return { success: true, action: 'removed' }
  } catch (err) {
    return { success: false, message: err && err.message }
  }
}