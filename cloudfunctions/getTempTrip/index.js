const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { tripId } = event || {}
  if (!tripId) return { success: false, message: '缺少 tripId' }

  const db = cloud.database()
  const _ = db.command
  const tmpTrips = db.collection('tmp_trips')
  const users = db.collection('users')

  try {
    const found = await tmpTrips.where({ tripId }).limit(1).get()
    const doc = (found && found.data && found.data[0]) || null
    if (!doc) return { success: false, message: '临时旅行不存在' }

    const members = Array.isArray(doc.members) ? doc.members : []
    const openIds = members.map(m => m.openid).filter(Boolean)

    let userMap = {}
    if (openIds.length > 0) {
      const usersRes = await users.where({ openid: _.in(openIds) }).get()
      const list = (usersRes && usersRes.data) || []
      userMap = list.reduce((acc, u) => {
        acc[u.openid] = { nickName: u.nickName || '', avatarUrl: u.avatarUrl || '' }
        return acc
      }, {})
    }

    const membersDetailed = members.map(m => {
      const hasOpen = !!m.openid
      const profile = hasOpen ? (userMap[m.openid] || {}) : {}
      return {
        openid: m.openid || '',
        name: m.name || '',
        isCreator: !!m.isCreator,
        nickName: hasOpen ? (profile.nickName || '') : (m.name || ''),
        avatarUrl: hasOpen ? (profile.avatarUrl || '') : ''
      }
    })

    const trip = {
      tripId: doc.tripId,
      status: doc.status,
      qrcodeFileID: doc.qrcodeFileID,
      creatorOpenid: doc.creatorOpenid
    }

    return {
      success: true,
      trip,
      members: membersDetailed,
      memberCount: membersDetailed.length
    }
  } catch (err) {
    return { success: false, message: err && err.message }
  }
}