const { getShortName } = require('../../utils/format')
const { getMemberById } = require('../../utils/util')
Page({
  data: {
    tripId: '',
    trip: {},
    members: [],
    settlements: [],
    isFinalized: false,
    showConfirmButton: false,
    from: ''
  },

  onLoad(options) {
    this.setData({ tripId: options.tripId, from: options.from || '' })
    this.loadSettlementData()
  },

  onShow() {
    this.loadSettlementData()
  },

  // 加载结算数据
  async loadSettlementData() {
    try {
      wx.showLoading({ title: '加载中...' })

      // 获取旅行详情
      const tripResult = await wx.cloud.callFunction({
        name: 'getTrip',
        data: { tripId: this.data.tripId }
      })

      if (tripResult.result.success) {
        const trip = tripResult.result.data
        const activeMembers = trip.members.filter((member) => member.active)

        this.setData({ trip, members: activeMembers })

        // 尝试加载云端已结算结果
        const finalRes = await wx.cloud.callFunction({
          name: 'getFinalSettlements',
          data: { tripId: this.data.tripId }
        })
        const finalData = finalRes.result.success ? finalRes.result.data : null

        if (finalData && Array.isArray(finalData.settlements) && finalData.settlements.length > 0) {
          // 已结算，直接展示结果（富化展示字段）
          const enriched = finalData.settlements.map((s, idx) => ({
            _id: `${s.fromMemberId}-${s.toMemberId}-${idx}`,
            fromMemberId: s.fromMemberId,
            toMemberId: s.toMemberId,
            fromName: getMemberById(this.data.members, s.fromMemberId).nickName || getMemberById(this.data.members, s.fromMemberId).displayName || '未知成员',
            toName: getMemberById(this.data.members, s.toMemberId).nickName || getMemberById(this.data.members, s.toMemberId).displayName || '未知成员',
            fromAvatarUrl: getMemberById(this.data.members, s.fromMemberId).avatarUrl || '',
            toAvatarUrl: getMemberById(this.data.members, s.toMemberId).avatarUrl || '',
            fromShortName: getShortName(
              getMemberById(this.data.members, s.fromMemberId).nickName || getMemberById(this.data.members, s.fromMemberId).displayName
            ),
            toShortName: getShortName(getMemberById(this.data.members, s.toMemberId).nickName || getMemberById(this.data.members, s.toMemberId).displayName),
            amount: s.amount,
            status: 'final'
          }))
          this.setData({
            settlements: enriched,
            isFinalized: true,
            showConfirmButton: false
          })
        } else {
          // 未结算：从进行中流转过来显示确认按钮，否则仅展示建议
          await this.loadSettlements()
          const shouldConfirm = this.data.from === 'endTrip' || trip.status === 'closed'
          this.setData({
            isFinalized: false,
            showConfirmButton: shouldConfirm
          })
        }
      }
    } catch (error) {
      console.error('加载结算数据失败:', error)
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  },

  // 加载结算建议（本地计算）
  async loadSettlements() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'computeSettlement',
        data: { tripId: this.data.tripId }
      })
      const list = res.result.success ? res.result.data || [] : []
      // 为前端展示添加 _id 与状态字段（建议）
      const settlements = list.map((s, idx) => ({
        _id: `${s.fromMemberId}-${s.toMemberId}-${idx}`,
        fromMemberId: s.fromMemberId,
        toMemberId: s.toMemberId,
        fromName: getMemberById(this.data.members, s.fromMemberId).nickName || getMemberById(this.data.members, s.fromMemberId).displayName || '未知成员',
        toName: getMemberById(this.data.members, s.toMemberId).nickName || getMemberById(this.data.members, s.toMemberId).displayName || '未知成员',
        fromAvatarUrl: getMemberById(this.data.members, s.fromMemberId).avatarUrl || '',
        toAvatarUrl: getMemberById(this.data.members, s.toMemberId).avatarUrl || '',
        fromShortName: getShortName(getMemberById(this.data.members, s.fromMemberId).nickName || getMemberById(this.data.members, s.fromMemberId).displayName),
        toShortName: getShortName(getMemberById(this.data.members, s.toMemberId).nickName || getMemberById(this.data.members, s.toMemberId).displayName),
        amount: s.amount,
        status: 'suggested'
      }))
      console.log('settlements', settlements)
      this.setData({ settlements })
    } catch (error) {
      console.error('加载结算建议失败:', error)
    }
  },

  // 确认结算：保存到云端数据集并（可选）关闭行程
  async confirmSettlement() {
    try {
      wx.showLoading({ title: '保存中...' })
      // 保存最终结算到云端
      const payload = (this.data.settlements || []).map((s) => ({
        fromMemberId: s.fromMemberId,
        toMemberId: s.toMemberId,
        amount: s.amount
      }))
      await wx.cloud.callFunction({
        name: 'saveFinalSettlements',
        data: { tripId: this.data.tripId, settlements: payload }
      })

      // 如果旅行尚未关闭，则关闭旅行
      if (this.data.trip.status !== 'closed') {
        try {
          await wx.cloud.callFunction({
            name: 'updateTripStatus',
            data: { tripId: this.data.tripId, status: 'closed' }
          })
          this.setData({ trip: { ...this.data.trip, status: 'closed' } })
        } catch (e) {
          /* 忽略关闭失败 */
        }
      }

      this.setData({ isFinalized: true, showConfirmButton: false })
      wx.showToast({ title: '结算已保存', icon: 'success' })
    } catch (error) {
      wx.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  }

  // 已移除代理人配置相关逻辑
})
