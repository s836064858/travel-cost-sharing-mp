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
          name: userDoc.nickName || '',
          role: m.isCreator ? 'creator' : 'member',
          active: true
        })
      } else if (m.name) {
        normalizedMembers.push({
          id: `name:${m.name}`,
          openid: null,
          name: m.name,
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
      createdAt: db.serverDate(),
      updatedAt: db.serverDate(),
      status: 'ongoing'
    }

    const addRes = await trips.add({ data: newTrip })

    // 创建成功后清理临时旅行与对应二维码文件
    try {
      if (tmpDoc.qrcodeFileID) {
        await cloud.deleteFile({ fileList: [tmpDoc.qrcodeFileID] })
      }
      await tmpTrips.doc(tmpDoc._id).remove()
    } catch (e) {
      // 删除临时记录失败不影响创建结果
    }

    return { success: true, id: addRes._id }
  } catch (err) {
    return { success: false, message: err && err.message }
  }
}
