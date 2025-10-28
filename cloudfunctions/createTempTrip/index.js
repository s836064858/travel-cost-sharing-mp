const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  const db = cloud.database()
  const tmpTrips = db.collection('tmp_trips')

  try {
    // 生成临时旅行ID
    const tripId = 'trip_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4)

    // 生成小程序码（不校验页面路径，scene 携带 tripId）
    const scene = `tripId=${tripId}`
    const page = 'pages/trip-create/trip-create'
    const codeRes = await cloud.openapi.wxacode.getUnlimited({
      scene,
      page,
      check_path: false,
      width: 430
    })

    // 上传小程序码到云存储
    const cloudPath = `qrcodes/${tripId}.png`
    const uploadRes = await cloud.uploadFile({
      cloudPath,
      fileContent: codeRes.buffer
    })

    const fileID = uploadRes.fileID

    // 写入临时旅行记录
    const creatorRecord = {
      openid,
      isCreator: true
    }

    await tmpTrips.add({
      data: {
        tripId,
        status: 'pending',
        members: [creatorRecord],
        creatorOpenid: openid,
        qrcodeFileID: fileID,
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    })

    return { success: true, tripId, qrcodeFileID: fileID }
  } catch (err) {
    return { success: false, message: err && err.message }
  }
}