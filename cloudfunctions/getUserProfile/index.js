const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const db = cloud.database()
  const users = db.collection('users')

  try {
    const result = await users.where({ openid }).limit(1).get()
    const user = (result && result.data && result.data[0]) || null
    return { success: true, user }
  } catch (err) {
    // 如果不存在，返回空
    return { success: false, user: null, error: err && err.message }
  }
}
