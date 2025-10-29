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
            initials: (m.name || '').slice(-2)
          }))
        // 为每个成员计算代理人对象，避免在 WXML 中调用方法
        const withAgents = activeMembers.map((m) => {
          const agent = m.agentMemberId ? getMemberById(activeMembers, m.agentMemberId) : {}
          return {
            ...m,
            agent:
              agent && agent.id
                ? {
                    id: agent.id,
                    name: agent.name,
                    avatarUrl: agent.avatarUrl,
                    initials: (agent.name || '').slice(-2)
                  }
                : null
          }
        })
        this.setData({ activeMembers: withAgents })

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
        const bills = result.result.data || []
        const activeMembers = this.data.activeMembers || []
        const categoryTextMap = { food: '餐饮', transport: '交通', lodging: '住宿', ticket: '门票', other: '其他' }

        const enriched = bills.map((b) => {
          const payer = getMemberById(activeMembers, String(b.payerMemberId))
          const participants = (b.shares || []).map((s) => {
            const m = getMemberById(activeMembers, String(s.memberId))
            return {
              id: m.id,
              name: m.name,
              avatarUrl: m.avatarUrl,
              initials: (m.name || '').slice(-2)
            }
          })
          // 合并支付人与参与人，支付人置顶且去重
          const displayParticipants = (() => {
            const list = []
            const pushUnique = (m) => {
              if (!m || !m.id) return
              if (!list.find((x) => x.id === m.id)) list.push(m)
            }
            const payerLite = {
              id: payer.id,
              name: payer.name,
              avatarUrl: payer.avatarUrl,
              initials: (payer.name || '').slice(-2)
            }
            pushUnique(payerLite)
            participants.forEach(pushUnique)
            return list
          })()
          return {
            ...b,
            categoryText: categoryTextMap[b.category] || '其他',
            payer: {
              id: payer.id,
              name: payer.name,
              avatarUrl: payer.avatarUrl,
              initials: (payer.name || '').slice(-2)
            },
            participants,
            displayParticipants
          }
        })
        this.setData({ recentBills: enriched })
      }
    } catch (error) {
      console.error('加载账单失败:', error)
    }
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
    const hasAgent = !!getMemberById(this.data.activeMembers, memberId).agentMemberId
    const itemList = hasAgent ? ['取消代理', ...names] : names
    wx.showActionSheet({
      itemList: itemList,
      success: (res) => {
        const idx = res.tapIndex
        if (hasAgent && idx === 0) {
          // 取消代理
          wx.cloud
            .callFunction({
              name: 'saveMemberAgent',
              data: {
                tripId: this.data.tripId,
                delegateMemberId: memberId,
                agentMemberId: ''
              }
            })
            .then((resp) => {
              if (resp && resp.result && resp.result.success) {
                wx.showToast({ title: '已取消代理', icon: 'success' })
                this.loadTripDetail()
              } else {
                wx.showToast({ title: (resp && resp.result && resp.result.message) || '取消失败', icon: 'none' })
              }
            })
            .catch(() => {
              wx.showToast({ title: '取消失败', icon: 'none' })
            })
          return
        }
        const agent = candidates[hasAgent ? idx - 1 : idx]
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
            .then((resp) => {
              if (resp && resp.result && resp.result.success) {
                wx.showToast({ title: '已设置代理人', icon: 'success' })
                this.loadTripDetail()
              } else {
                wx.showToast({ title: (resp && resp.result && resp.result.message) || '设置失败', icon: 'none' })
              }
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
      placeholderText: '请输入成员姓名',
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
