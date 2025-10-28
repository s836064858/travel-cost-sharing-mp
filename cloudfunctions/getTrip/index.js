const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { tripId } = event || {}
  if (!tripId) return { success: false, message: '缺少 tripId' }

  const db = cloud.database()
  const trips = db.collection('trips')

  try {
    const res = await trips.where({ tripId }).limit(1).get()
    const doc = (res && res.data && res.data[0]) || null
    if (!doc) return { success: false, message: '旅行不存在' }
    return { success: true, data: doc }
  } catch (err) {
    return { success: false, message: err && err.message }
  }
}