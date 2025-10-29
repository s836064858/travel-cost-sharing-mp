// pages/history/history.js
const app = getApp()

Page({
  data: {
    activeTab: 'ongoing',
    trips: [],
    userInfo: null
  },

  onLoad() {
    this.setData({
      userInfo: app.globalData.userInfo
    })
    this.loadTrips()
  },

  onShow() {
    this.loadTrips()
  },

  // 切换标签页
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab })
    this.loadTrips()
  },

  // 加载旅行列表
  async loadTrips() {
    try {
      wx.showLoading({ title: '加载中...' })

      // 调用云函数获取旅行列表
      const result = await wx.cloud.callFunction({
        name: 'listTrips',
        data: {
          status: this.data.activeTab === 'ongoing' ? 'ongoing' : 'closed',
          pageSize: 9999
        }
      })

      if (result.result.success) {
        const trips = (result.result.data || []).map((t) => ({
          ...t,
          members: (t.members || []).map((m) => ({
            ...m,
            initials: m.name.slice(-2)
          }))
        }))
        console.log(trips)
        this.setData({ trips })
      } else {
        wx.showToast({
          title: '加载失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('加载旅行列表失败:', error)
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  },

  // 查看旅行详情
  viewTripDetail(e) {
    const trip = e.currentTarget.dataset.trip
    const tripId = trip.tripId || trip._id
    if (trip.status === 'closed') {
      // 已结束的跳转到结算页面
      wx.navigateTo({
        url: '/pages/settlement-view/settlement-view?tripId=' + tripId + '&from=history'
      })
    } else {
      // 进行中的跳转到详情页面
      wx.navigateTo({
        url: '/pages/trip-detail/trip-detail?tripId=' + tripId
      })
    }
  },

  // 创建新旅行
  createNewTrip() {
    wx.navigateTo({
      url: '/pages/trip-create/trip-create'
    })
  }
})
