const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const {
    billId,
    tripId,
    payerMemberId,
    amount,
    category = 'other',
    date,
    note = '',
    splitMethod = 'equal',
    shares = []
  } = event || {}

  if (!billId) return { success: false, message: '缺少 billId' }
  if (!tripId) return { success: false, message: '缺少 tripId' }
  if (!payerMemberId) return { success: false, message: '缺少付款人' }
  if (typeof amount !== 'number' || amount <= 0) return { success: false, message: '金额不合法' }
  if (!date) return { success: false, message: '缺少日期' }
  if (!Array.isArray(shares) || shares.length === 0) return { success: false, message: '缺少分摊信息' }

  const db = cloud.database()
  const bills = db.collection('bills')

  try {
    const res = await bills.doc(billId).update({
      data: {
        tripId,
        payerMemberId,
        amount: Number(amount.toFixed ? amount.toFixed(2) : amount),
        category,
        date,
        note,
        splitMethod,
        shares: shares.map(s => ({ memberId: s.memberId, shareAmount: Number(s.shareAmount) })),
        updatedAt: db.serverDate()
      }
    })

    return { success: true, updated: res.stats && res.stats.updated }
  } catch (err) {
    return { success: false, message: err && err.message }
  }
}