const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { tripId, delegateMemberId, agentMemberId } = event || {}
  if (!tripId) return { success: false, message: '缺少 tripId' }
  if (!delegateMemberId) return { success: false, message: '缺少被代理成员' }
  if (!agentMemberId) return { success: false, message: '缺少代理人' }
  if (delegateMemberId === agentMemberId) return { success: false, message: '不能代理自己' }

  const db = cloud.database()
  const agents = db.collection('member_agents')
  const trips = db.collection('trips')

  try {
    const found = await agents.where({ tripId, delegateMemberId }).limit(1).get()
    const doc = (found && found.data && found.data[0]) || null
    if (doc && doc._id) {
      await agents.doc(doc._id).update({
        data: { agentMemberId, updatedAt: db.serverDate() }
      })
    } else {
      const res = await agents.add({
        data: { tripId, delegateMemberId, agentMemberId, createdAt: db.serverDate(), updatedAt: db.serverDate() }
      })
    }

    // 同步更新 trips.members 中的代理人字段
    const tripRes = await trips.where({ tripId }).limit(1).get()
    const tripDoc = (tripRes && tripRes.data && tripRes.data[0]) || null
    if (!tripDoc) return { success: false, message: '旅行不存在' }

    const members = (tripDoc.members || []).map((m) => {
      if (m && (m.id === delegateMemberId || m.memberId === delegateMemberId)) {
        return { ...m, agentMemberId }
      }
      return m
    })

    await trips.doc(tripDoc._id).update({
      data: { members, updatedAt: db.serverDate() }
    })

    return { success: true, action: 'synced' }
  } catch (err) {
    return { success: false, message: err && err.message }
  }
}