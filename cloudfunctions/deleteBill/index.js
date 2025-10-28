const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { billId, tripId } = event || {}
  if (!billId) return { success: false, message: '缺少 billId' }
  if (!tripId) return { success: false, message: '缺少 tripId' }

  const db = cloud.database()
  const bills = db.collection('bills')

  try {
    const res = await bills.doc(billId).remove()
    return { success: true, deleted: res.stats && res.stats.removed }
  } catch (err) {
    return { success: false, message: err && err.message }
  }
}