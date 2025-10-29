const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { status, page = 1, pageSize = 20 } = event || {}

  const db = cloud.database()
  const _ = db.command
  const trips = db.collection('trips')
  const users = db.collection('users')

  try {
    const where = _.and([
      _.or([
        { creatorOpenid: openid },
        { members: _.elemMatch({ openid }) }
      ]),
      status ? { status } : {}
    ])

    const res = await trips.where(where)
      .orderBy('updatedAt', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get()

    const data = (res && res.data) || []

    // 收集所有成员的 openid 并一次性拉取头像
    const allOpenids = Array.from(
      new Set(
        data
          .flatMap((t) => (t.members || []).map((m) => m.openid).filter(Boolean))
      )
    )

    if (allOpenids.length > 0) {
      try {
        const ures = await users.where({ openid: _.in(allOpenids) }).get()
        const list = (ures && ures.data) || []
        const avatarMap = {}
        list.forEach((u) => {
          avatarMap[u.openid] = u.avatarUrl || ''
        })
        const enriched = data.map((t) => ({
          ...t,
          members: (t.members || []).map((m) => ({
            ...m,
            avatarUrl: m.openid ? avatarMap[m.openid] || '' : (m.avatarUrl || '')
          }))
        }))
        return { success: true, data: enriched }
      } catch (e) {
        // 头像补充失败时，返回原始数据
        return { success: true, data }
      }
    }

    return { success: true, data }
  } catch (err) {
    return { success: false, message: err && err.message }
  }
}