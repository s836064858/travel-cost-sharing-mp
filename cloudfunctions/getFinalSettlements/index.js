const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { tripId } = event || {}
  if (!tripId) return { success: false, message: '缺少 tripId' }

  const db = cloud.database()
  const finals = db.collection('final_settlements')

  try {
    const res = await finals.where({ tripId }).limit(1).get()
    const doc = (res && res.data && res.data[0]) || null
    if (!doc) return { success: true, data: null }
    return { success: true, data: { settlements: doc.settlements || [], finalizedAt: doc.finalizedAt || null } }
  } catch (err) {
    return { success: false, message: err && err.message }
  }
}