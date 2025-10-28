// pages/profile/profile.js
const app = getApp()

Page({
  data: {
    avatarUrl: '',
    nickName: '',
    defaultAvatar:
      'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22><rect width=%22100%22 height=%22100%22 rx=%2250%22 fill=%22%23f0f0f0%22/><circle cx=%2250%22 cy=%2240%22 r=%2218%22 fill=%22%23d1d5db%22/><rect x=%2225%22 y=%2260%22 width=%2250%22 height=%2218%22 rx=%229%22 fill=%22%23d1d5db%22/></svg>'
  },
  onLoad() {
    const user = app.globalData.userInfo || {}
    this.setData({
      avatarUrl: user.avatarUrl || '',
      nickName: user.nickName || ''
    })
  },
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail || {}
    if (avatarUrl) this.setData({ avatarUrl })
  },
  onNickInput(e) {
    this.setData({ nickName: e.detail.value })
  },
  onSave() {
    const { avatarUrl, nickName } = this.data
    const userInfo = { avatarUrl, nickName }
    console.log('userInfo', userInfo)

    // 保存到云
    wx.cloud
      .callFunction({
        name: 'saveUserProfile',
        data: userInfo
      })
      .then(() => {
        // 本地与全局缓存
        app.globalData.userInfo = userInfo
        wx.showToast({ title: '已保存', icon: 'success' })
        setTimeout(() => wx.navigateBack(), 300)
      })
      .catch(() => {
        wx.showToast({ title: '保存失败，请稍后重试', icon: 'none' })
      })
  }
})
