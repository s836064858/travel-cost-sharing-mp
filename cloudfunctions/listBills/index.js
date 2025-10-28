const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { tripId, page = 1, pageSize = 20 } = event || {}
  if (!tripId) return { success: false, message: '缺少 tripId' }

  const db = cloud.database()
  const bills = db.collection('bills')

  try {
    const res = await bills.where({ tripId })
      .orderBy('updatedAt', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get()

    return { success: true, data: res.data || [] }
  } catch (err) {
    return { success: false, message: err && err.message }
  }
}