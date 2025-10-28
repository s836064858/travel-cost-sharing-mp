const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const creatorOpenid = wxContext.OPENID
  const { tripId, name, startDate, currency = 'CNY', members = [] } = event || {}

  // 格式化日期为 YYYY-MM-DD
  function formatDate(d) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  if (!tripId) return { success: false, message: '缺少 tripId' }

  const db = cloud.database()
  const _ = db.command
  const tmpTrips = db.collection('tmp_trips')
  const users = db.collection('users')
  const trips = db.collection('trips')

  try {
    // 读取临时旅行
    const found = await tmpTrips.where({ tripId }).limit(1).get()
    const tmpDoc = (found && found.data && found.data[0]) || null
    if (!tmpDoc) return { success: false, message: '临时旅行不存在' }

    // 规范化成员结构：支持 openid 成员和手动 name 成员
    const normalizedMembers = []
    for (const m of members) {
      if (m.openid) {
        // 尝试取用户资料
        const u = await users.where({ openid: m.openid }).limit(1).get()
        const userDoc = (u && u.data && u.data[0]) || {}
        normalizedMembers.push({
          id: m.openid,
          openid: m.openid,
          nickName: m.displayName || userDoc.nickName || '',
          avatarUrl: m.avatarUrl || userDoc.avatarUrl || '',
          role: m.isCreator ? 'creator' : 'member',
          active: true
        })
      } else if (m.name) {
        normalizedMembers.push({
          id: `name:${m.name}`,
          name: m.name,
          nickName: m.displayName || m.name,
          avatarUrl: m.avatarUrl || '',
          role: m.isCreator ? 'creator' : 'member',
          active: true
        })
      }
    }

    // 若未标记创建者，尝试以临时旅行的 creatorOpenid 为创建者
    const hasCreator = normalizedMembers.some((x) => x.role === 'creator')
    let finalCreatorOpenid = tmpDoc.creatorOpenid || creatorOpenid
    if (!hasCreator && finalCreatorOpenid) {
      // 标记创建者
      for (const x of normalizedMembers) {
        if (x.openid && x.openid === finalCreatorOpenid) {
          x.role = 'creator'
          break
        }
      }
    }

    // 写入正式旅行集合
    const newTrip = {
      tripId,
      name: name || `${formatDate(new Date())} 旅行账单`,
      members: normalizedMembers,
      creatorOpenid: finalCreatorOpenid || '',
      ownerOpenid: finalCreatorOpenid || '',
      qrcodeFileID: tmpDoc.qrcodeFileID || '',
      createdAt: db.serverDate(),
      updatedAt: db.serverDate(),
      status: 'ongoing'
    }

    const addRes = await trips.add({ data: newTrip })

    // 标记临时旅行已转换（可选：不删除临时旅行，便于回溯）
    await tmpTrips.doc(tmpDoc._id).update({
      data: {
        status: 'converted',
        updatedAt: db.serverDate()
      }
    })

    return { success: true, id: addRes._id }
  } catch (err) {
    return { success: false, message: err && err.message }
  }
}
