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
