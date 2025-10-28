const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { avatarUrl = '', nickName = '' } = event || {}
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const db = cloud.database()
  const users = db.collection('users')

  try {
    // 先按 openid 查询是否已有记录
    const found = await users.where({ openid }).limit(1).get()
    const exists = found && found.data && found.data[0]

    if (exists && exists._id) {
      // 已存在则更新
      await users.doc(exists._id).update({
        data: {
          avatarUrl,
          nickName,
          updatedAt: db.serverDate()
        }
      })
      return { success: true, action: 'updated' }
    } else {
      // 不存在则新增
      await users.add({
        data: {
          openid,
          avatarUrl,
          nickName,
          createdAt: db.serverDate(),
          updatedAt: db.serverDate()
        }
      })
      return { success: true, action: 'created' }
    }
  } catch (err) {
    return { success: false, error: err && err.message }
  }
}
