const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { tripId, status } = event || {}
  if (!tripId) return { success: false, message: '缺少 tripId' }
  if (!status) return { success: false, message: '缺少 status' }

  const allowed = ['created', 'ongoing', 'closed']
  if (!allowed.includes(status)) {
    return { success: false, message: '非法状态' }
  }

  const db = cloud.database()
  const trips = db.collection('trips')

  try {
    const res = await trips.where({ tripId }).limit(1).get()
    const doc = (res && res.data && res.data[0]) || null
    if (!doc) return { success: false, message: '旅行不存在' }

    await trips.doc(doc._id).update({
      data: {
        status,
        updatedAt: db.serverDate()
      }
    })

    return { success: true, action: 'updated' }
  } catch (err) {
    return { success: false, message: err && err.message }
  }
}