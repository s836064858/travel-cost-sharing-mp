const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { billId, tripId } = event || {}
  if (!billId) return { success: false, message: '缺少 billId' }
  if (!tripId) return { success: false, message: '缺少 tripId' }

  const db = cloud.database()
  const bills = db.collection('bills')

  try {
    const doc = await bills.doc(billId).get()
    const data = (doc && doc.data) || null
    if (!data || data.tripId !== tripId) return { success: false, message: '账单不存在或不属于当前旅行' }
    return { success: true, data }
  } catch (err) {
    return { success: false, message: err && err.message }
  }
}