const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { tripId, delegateMemberId, agentMemberId } = event || {}
  if (!tripId) return { success: false, message: '缺少 tripId' }
  if (!delegateMemberId) return { success: false, message: '缺少被代理成员' }
  // 支持取消代理：当 agentMemberId 为空/null/'' 时视为取消
  const isCancel = !agentMemberId
  if (!isCancel && delegateMemberId === agentMemberId) return { success: false, message: '不能代理自己' }

  const db = cloud.database()
  const agents = db.collection('member_agents')
  const trips = db.collection('trips')

  try {
    // 规则校验：仅一级代理。若被代理人是其他人的代理，则不可被代理
    if (!isCancel) {
      const conflict = await agents.where({ tripId, agentMemberId: delegateMemberId }).limit(1).get()
      if (conflict && conflict.data && conflict.data.length > 0) {
        return { success: false, message: '该成员已是其他人的代理，不能被代理' }
      }
    }

    const found = await agents.where({ tripId, delegateMemberId }).limit(1).get()
    const doc = (found && found.data && found.data[0]) || null
    if (isCancel) {
      // 取消代理：删除映射记录（若存在）
      if (doc && doc._id) {
        await agents.doc(doc._id).remove()
      }
    } else {
      // 设置/更新代理
      if (doc && doc._id) {
        await agents.doc(doc._id).update({
          data: { agentMemberId, updatedAt: db.serverDate() }
        })
      } else {
        await agents.add({
          data: { tripId, delegateMemberId, agentMemberId, createdAt: db.serverDate(), updatedAt: db.serverDate() }
        })
      }
    }

    // 同步更新 trips.members 中的代理人字段
    const tripRes = await trips.where({ tripId }).limit(1).get()
    const tripDoc = (tripRes && tripRes.data && tripRes.data[0]) || null
    if (!tripDoc) return { success: false, message: '旅行不存在' }

    const members = (tripDoc.members || []).map((m) => {
      if (m && (m.id === delegateMemberId || m.memberId === delegateMemberId)) {
        return { ...m, agentMemberId: isCancel ? '' : agentMemberId }
      }
      return m
    })

    await trips.doc(tripDoc._id).update({
      data: { members, updatedAt: db.serverDate() }
    })

    return { success: true, action: isCancel ? 'canceled' : 'synced' }
  } catch (err) {
    return { success: false, message: err && err.message }
  }
}
