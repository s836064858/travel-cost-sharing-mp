const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { status, page = 1, pageSize = 20 } = event || {}

  const db = cloud.database()
  const _ = db.command
  const trips = db.collection('trips')

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
    return { success: true, data }
  } catch (err) {
    return { success: false, message: err && err.message }
  }
}