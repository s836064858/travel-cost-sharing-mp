// pages/home/home.js
const app = getApp()

Page({
  data: {
    userInfo: null,
    defaultAvatar: '../../images/avatar.png'
  },

  onLoad() {
    this.setData({
      userInfo: app.globalData.userInfo || null
    })
    wx.showShareMenu({ withShareTicket: true, menus: ['shareAppMessage'] })
  },

  onShareAppMessage() {
    return {
      title: '邀请你使用旅行记账',
      path: `/pages/home/home`
    }
  },

  onShow() {
    this.setData({
      userInfo: app.globalData.userInfo || null
    })
  },

  // 跳转到历史记录
  goToHistory() {
    wx.switchTab({
      url: '/pages/history/history'
    })
  },

  // 创建新旅行
  createNewTrip() {
    const user = app.globalData.userInfo || null
    if (!user || !user.nickName) {
      wx.showModal({
        title: '完善资料',
        content: '创建旅行前请先完善个人资料',
        confirmText: '去填写',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/profile/profile' })
          }
        }
      })
      return
    }
    wx.navigateTo({
      url: '/pages/trip-create/trip-create'
    })
  },

  // 编辑个人资料
  editProfile() {
    wx.navigateTo({
      url: '/pages/profile/profile'
    })
  }
})
