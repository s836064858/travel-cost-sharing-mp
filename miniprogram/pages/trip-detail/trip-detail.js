// pages/trip-detail/trip-detail.js
const app = getApp()
const { getMemberById } = require('../../utils/util')

Page({
  data: {
    tripId: '',
    trip: {},
    activeMembers: [],
    recentBills: []
  },

  onLoad(options) {
    this.setData({ tripId: options.tripId })
    this.loadTripDetail()
  },

  onShow() {
    this.loadTripDetail()
  },

  // 加载旅行详情
  async loadTripDetail() {
    try {
      wx.showLoading({ title: '加载中...' })

      // 调用云函数获取旅行详情
      const result = await wx.cloud.callFunction({
        name: 'getTrip',
        data: { tripId: this.data.tripId }
      })

      if (result.result.success) {
        const trip = result.result.data
        this.setData({ trip })

        // 过滤活跃成员
        const activeMembers = trip.members
          .filter((member) => member.active)
          .map((m) => ({
            ...m,
            initials: m.name.slice(-2)
          }))
        this.setData({ activeMembers })

        await this.loadRecentBills()

        // 设置当前旅行
        app.globalData.currentTrip = trip
        wx.setStorageSync('currentTrip', trip)
      } else {
        wx.showToast({
          title: '加载失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('加载旅行详情失败:', error)
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  },

  // 加载最近账单
  async loadRecentBills() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'listBills',
        data: {
          tripId: this.data.tripId,
          pageSize: 9999
        }
      })

      if (result.result.success) {
        this.setData({ recentBills: result.result.data })
      }
    } catch (error) {
      console.error('加载账单失败:', error)
    }
  },

  // 获取成员名称
  getMemberName(memberId) {
    const member = getMemberById(this.data.activeMembers, memberId)
    return member.name || '未知成员'
  },

  // 结束旅行
  async endTrip() {
    wx.showModal({
      title: '确认结束',
      content: '结束旅行后将无法新增账单，是否进入结算建议？',
      success: (res) => {
        if (res.confirm) {
          wx.navigateTo({
            url: '/pages/settlement-view/settlement-view?tripId=' + this.data.tripId + '&from=endTrip'
          })
        }
      }
    })
  },

  // 添加账单
  addBill() {
    wx.navigateTo({
      url: '/pages/bill-create/bill-create?tripId=' + this.data.tripId
    })
  },

  // 设置代理人
  setMemberAgent(e) {
    const memberId = e.currentTarget.dataset.memberId
    const candidates = this.data.activeMembers.filter((m) => m.id !== memberId)
    if (candidates.length === 0) {
      wx.showToast({ title: '无可选代理人', icon: 'none' })
      return
    }
    const names = candidates.map((m) => m.name || '成员')
    wx.showActionSheet({
      itemList: names,
      success: (res) => {
        const idx = res.tapIndex
        const agent = candidates[idx]
        if (agent) {
          wx.cloud
            .callFunction({
              name: 'saveMemberAgent',
              data: {
                tripId: this.data.tripId,
                delegateMemberId: memberId,
                agentMemberId: agent.id
              }
            })
            .then(() => {
              wx.showToast({ title: '已设置代理人', icon: 'success' })
              // 刷新旅行详情，展示代理人
              this.loadTripDetail()
            })
            .catch(() => {
              wx.showToast({ title: '设置失败', icon: 'none' })
            })
        }
      }
    })
  },

  // 添加成员
  addMember() {
    wx.showModal({
      title: '添加成员',
      content: '请输入成员姓名',
      editable: true,
      success: async (res) => {
        if (res.confirm && res.content.trim()) {
          try {
            const result = await wx.cloud.callFunction({
              name: 'addTripMember',
              data: {
                tripId: this.data.tripId,
                member: {
                  name: res.content.trim()
                }
              }
            })

            if (result.result.success) {
              wx.showToast({
                title: '添加成功',
                icon: 'success'
              })
              this.loadTripDetail()
            }
          } catch (error) {
            console.error('添加成员失败:', error)
          }
        }
      }
    })
  },

  // 编辑账单
  editBill(e) {
    const bill = e.currentTarget.dataset.bill
    wx.navigateTo({
      url: '/pages/bill-create/bill-create?tripId=' + this.data.tripId + '&billId=' + bill._id
    })
  }
})
