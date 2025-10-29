// pages/profile/profile.js
const app = getApp()

Page({
  data: {
    avatarUrl: '',
    nickName: ''
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
