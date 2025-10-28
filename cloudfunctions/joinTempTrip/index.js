const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
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

    const exists = Array.isArray(doc.members) && doc.members.some(m => m.openid === openid)
    if (exists) {
      return { success: true, action: 'exists', memberCount: doc.members.length }
    }

    // 加入前校验用户头像与昵称是否完善
    const userRes = await users.where({ openid }).limit(1).get()
    const userDoc = (userRes && userRes.data && userRes.data[0]) || null
    const hasAvatar = !!(userDoc && userDoc.avatarUrl)
    const hasNick = !!(userDoc && userDoc.nickName)
    if (!hasAvatar || !hasNick) {
      return { success: false, code: 'PROFILE_INCOMPLETE', message: '请完善头像和昵称' }
    }

    const newMember = {
      openid,
      isCreator: false
    }

    await tmpTrips.doc(doc._id).update({
      data: {
        members: _.push(newMember),
        updatedAt: db.serverDate()
      }
    })

    return { success: true, action: 'joined' }
  } catch (err) {
    return { success: false, message: err && err.message }
  }
}