const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { tripId, settlements = [] } = event || {}
  if (!tripId) return { success: false, message: '缺少 tripId' }
  if (!Array.isArray(settlements) || settlements.length === 0) {
    return { success: false, message: '缺少结算数据' }
  }

  const db = cloud.database()
  const finals = db.collection('final_settlements')

  // 简单校验与规范化
  const normalized = settlements.map(s => ({
    fromMemberId: s.fromMemberId,
    toMemberId: s.toMemberId,
    amount: Number((s.amount || 0).toFixed ? s.amount.toFixed(2) : s.amount)
  })).filter(s => s.fromMemberId && s.toMemberId && s.amount > 0)

  if (normalized.length === 0) {
    return { success: false, message: '结算数据无效' }
  }

  try {
    const found = await finals.where({ tripId }).limit(1).get()
    const exists = found && found.data && found.data[0]
    if (exists && exists._id) {
      await finals.doc(exists._id).update({
        data: {
          settlements: normalized,
          finalizedAt: exists.finalizedAt || db.serverDate(),
          updatedAt: db.serverDate()
        }
      })
      return { success: true, action: 'updated' }
    } else {
      const res = await finals.add({
        data: {
          tripId,
          settlements: normalized,
          finalizedAt: db.serverDate(),
          updatedAt: db.serverDate()
        }
      })
      return { success: true, action: 'created', id: res._id }
    }
  } catch (err) {
    return { success: false, message: err && err.message }
  }
}