const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { tripId } = event || {}
  if (!tripId) return { success: false, message: '缺少 tripId' }

  const db = cloud.database()
  const _ = db.command
  const trips = db.collection('trips')
  const bills = db.collection('bills')

  try {
    // 获取旅行及活跃成员
    const tripRes = await trips.where({ tripId }).limit(1).get()
    const trip = (tripRes && tripRes.data && tripRes.data[0]) || null
    if (!trip) return { success: false, message: '旅行不存在' }
    const members = Array.isArray(trip.members) ? trip.members.filter((m) => m.active) : []
    const memberIds = members.map((m) => m.id)
    const memberMap = members.reduce((acc, m) => {
      acc[m.id] = m
      return acc
    }, {})

    // 加载账单（最多 100 条，可按需分页扩展）
    const billsRes = await bills.where({ tripId }).orderBy('updatedAt', 'desc').limit(100).get()
    const billList = (billsRes && billsRes.data) || []
    // 计算净额（成员级）
    const netMap = {}
    memberIds.forEach((id) => {
      netMap[id] = 0
    })
    for (const b of billList) {
      const amount = Number(b.amount) || 0
      if (amount <= 0) continue
      if (memberMap[b.payerMemberId]) {
        netMap[b.payerMemberId] += amount
      }
      const shares = Array.isArray(b.shares) ? b.shares : []
      for (const s of shares) {
        const shareAmt = Number(s.shareAmount) || 0
        if (shareAmt <= 0) continue
        if (memberMap[s.memberId]) {
          netMap[s.memberId] -= shareAmt
        }
      }
    }

    // 读取代理映射（来自 trips.members）
    const agentMap = {}
    for (const m of members) {
      if (m && m.agentMemberId) {
        agentMap[m.id] = m.agentMemberId
      }
    }

    const getAgentFor = (memberId) => {
      const a = agentMap[memberId]
      return a && memberMap[a] ? a : memberId
    }
    // 聚合到代理级净额
    const agentNet = {}
    Object.keys(netMap).forEach((memberId) => {
      const agentId = getAgentFor(memberId)
      agentNet[agentId] = (agentNet[agentId] || 0) + netMap[memberId]
    })

    // 代理级借方与贷方
    const debtors = []
    const creditors = []
    Object.keys(agentNet).forEach((id) => {
      const val = Number(agentNet[id].toFixed(2))
      if (val < 0) debtors.push({ id, amount: -val })
      else if (val > 0) creditors.push({ id, amount: val })
    })

    // 贪心匹配生成结算建议（代理级之间）
    const settlements = []
    let i = 0,
      j = 0
    while (i < debtors.length && j < creditors.length) {
      const d = debtors[i]
      const c = creditors[j]
      const pay = Math.min(d.amount, c.amount)
      if (d.id !== c.id && pay > 0) {
        settlements.push({
          fromMemberId: d.id,
          toMemberId: c.id,
          amount: Number(pay.toFixed(2))
        })
      }
      d.amount -= pay
      c.amount -= pay
      if (d.amount <= 0.0001) i++
      if (c.amount <= 0.0001) j++
    }

    return { success: true, data: settlements }
  } catch (err) {
    return { success: false, message: err && err.message }
  }
}
