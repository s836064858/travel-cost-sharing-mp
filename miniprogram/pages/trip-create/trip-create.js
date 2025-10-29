// pages/trip-create/trip-create.js
const app = getApp()
const util = require('../../utils/util.js')

Page({
  data: {
    tripId: '',
    joined: false,
    isCreator: false,
    members: [],
    memberCount: 0,
    canCreate: false,
    tripName: '',
    defaultAvatar: '../../images/avatar.png',
    qrcodeFileID: '',
    qrcodeUrl: '',
    pollingTimerId: null,
    pollingMs: 5000,
    isFetching: false
  },

  onLoad(options) {
    const tripId = (options && options.tripId) || ''
    // 初始化默认账单名称：YYYY-MM-DD 旅行账单
    const today = util.formatDate(new Date(), 'YYYY-MM-DD')
    this.setData({ tripName: `${today} 旅行账单` })
    if (tripId) {
      this.setData({ tripId })
      this.ensureProfileReadyAndJoin()
      this.startPolling()
    } else {
      this.createTempTripInvite()
    }
  },

  onShow() {
    if (this.data.tripId && !this.data.joined) {
      this.ensureProfileReadyAndJoin()
    }
    // 页面显示时确保轮询运行
    this.startPolling()
  },

  onUnload() {
    // 页面卸载时清理轮询
    this.stopPolling()
  },

  // 账单名称输入
  onTripNameInput(e) {
    const value = (e.detail && e.detail.value) || ''
    this.setData({ tripName: value })
  },

  onHide() {
    // 页面隐藏时暂停轮询
    this.stopPolling()
  },

  // 调用云函数生成临时旅行与二维码
  async createTempTripInvite() {
    try {
      wx.showLoading({ title: '生成二维码...' })
      const res = await wx.cloud.callFunction({
        name: 'createTempTrip',
        data: {}
      })
      const { success, tripId, qrcodeFileID } = res.result || {}
      if (!success) throw new Error('生成邀请失败')
      this.setData({ tripId, qrcodeFileID })
      // 获取临时链接用于展示
      const urlRes = await wx.cloud.getTempFileURL({ fileList: [qrcodeFileID] })
      const fileObj = (urlRes && urlRes.fileList && urlRes.fileList[0]) || {}
      this.setData({ qrcodeUrl: fileObj.tempFileURL || '' })
      // 拉取成员详情
      await this.fetchTempTrip()
      // 开始轮询刷新成员列表
      this.startPolling()
    } catch (e) {
      wx.showToast({ title: '二维码生成失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  // 拉取临时旅行信息与成员详情
  async fetchTempTrip() {
    try {
      if (this.data.isFetching) return
      this.setData({ isFetching: true })
      const res = await wx.cloud.callFunction({
        name: 'getTempTrip',
        data: { tripId: this.data.tripId }
      })
      const { success, trip, members = [], memberCount = 0 } = res.result || {}
      if (!success) return

      // 设置二维码展示
      if (trip && trip.qrcodeFileID) {
        const urlRes = await wx.cloud.getTempFileURL({ fileList: [trip.qrcodeFileID] })
        const fileObj = (urlRes && urlRes.fileList && urlRes.fileList[0]) || {}
        this.setData({ qrcodeFileID: trip.qrcodeFileID, qrcodeUrl: fileObj.tempFileURL || '' })
      }

      // 映射成员列表用于页面展示
      const uiMembers = members.map((m) => {
        const displayName = m.nickName || '未设置昵称'
        const initials = displayName.slice(-2)
        const id = m.openid ? m.openid : `name:${m.name}`
        const source = m.openid ? 'openid' : 'name'
        return {
          id,
          source,
          openid: m.openid,
          name: m.name,
          displayName,
          initials,
          avatarUrl: m.avatarUrl || '',
          isCreator: !!m.isCreator
        }
      })

      const isCreator = !!(trip && trip.creatorOpenid && trip.creatorOpenid === app.globalData.openid)
      this.setData({
        members: uiMembers,
        memberCount: memberCount,
        isCreator
      })
      this.checkCanCreate()
    } catch (e) {
      // 忽略错误，维持已有状态
    } finally {
      this.setData({ isFetching: false })
    }
  },

  // 进入加入模式时，确保用户资料完整后尝试加入
  ensureProfileReadyAndJoin() {
    // 直接尝试加入，由云函数判断资料是否完善
    this.joinTrip()
  },

  async joinTrip() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'joinTempTrip',
        data: { tripId: this.data.tripId }
      })
      if (res.result && res.result.success) {
        const action = res.result.action
        this.setData({ joined: true })
        // 如果已在列表中则不提醒
        if (action !== 'exists') {
          wx.showToast({ title: '加入成功', icon: 'success' })
        }
        // 加入成功后刷新成员列表与二维码
        await this.fetchTempTrip()
      } else {
        const code = res.result && res.result.code
        const msg = (res.result && res.result.message) || '加入失败'
        if (code === 'PROFILE_INCOMPLETE') {
          wx.showModal({
            title: '完善信息提示',
            content: '加入前请先完善头像和昵称。',
            confirmText: '去完善',
            cancelText: '稍后',
            success: (modalRes) => {
              if (modalRes.confirm) {
                wx.navigateTo({ url: '/pages/profile/profile' })
              }
            }
          })
        } else {
          wx.showToast({ title: msg, icon: 'none' })
        }
      }
    } catch (e) {
      wx.showToast({ title: '加入失败，请稍后重试', icon: 'none' })
    }
  },

  // 启动成员列表轮询
  startPolling() {
    if (this.data.pollingTimerId || !this.data.tripId) return
    const timerId = setInterval(() => {
      this.fetchTempTrip()
    }, this.data.pollingMs)
    this.setData({ pollingTimerId: timerId })
  },

  // 停止轮询
  stopPolling() {
    const timerId = this.data.pollingTimerId
    if (timerId) {
      clearInterval(timerId)
      this.setData({ pollingTimerId: null })
    }
  },

  // 分享二维码
  shareQRCode() {
    wx.showShareMenu({ withShareTicket: true })
  },

  onShareAppMessage() {
    return {
      title: '邀请你加入旅行记账',
      path: `/pages/trip-create/trip-create?tripId=${this.data.tripId}`
    }
  },

  // 移除成员
  removeMember(e) {
    const memberId = e.currentTarget.dataset.id
    const target = util.getMemberById(this.data.members, memberId)
    if (!target) return
    const data = target.source === 'openid' ? { openid: target.openid } : { name: target.name }
    wx.cloud
      .callFunction({
        name: 'removeTempMember',
        data: { tripId: this.data.tripId, ...data }
      })
      .then(() => {
        this.fetchTempTrip()
      })
      .catch(() => {
        wx.showToast({ title: '移除失败', icon: 'none' })
      })
  },

  // 检查是否可以创建
  checkCanCreate() {
    const canCreate = this.data.memberCount >= 2
    this.setData({ canCreate })
  },

  // 打开手动添加成员弹窗（使用内置 wx.showModal 可编辑模式）
  openAddMemberModal() {
    wx.showModal({
      title: '添加成员',
      editable: true,
      placeholderText: '请输入成员昵称',
      confirmText: '添加',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          const name = (res.content || '').trim()
          if (!name) {
            wx.showToast({ title: '请输入昵称', icon: 'none' })
            return
          }
          wx.cloud
            .callFunction({
              name: 'addNamedMember',
              data: { tripId: this.data.tripId, name }
            })
            .then((r) => {
              if (r.result && r.result.success) {
                wx.showToast({ title: '已添加', icon: 'success' })
                this.fetchTempTrip()
              } else {
                wx.showToast({ title: r.result?.message || '添加失败', icon: 'none' })
              }
            })
            .catch(() => {
              wx.showToast({ title: '添加失败，请稍后重试', icon: 'none' })
            })
        }
      }
    })
  },

  // 创建旅行
  async createTrip() {
    if (!this.data.canCreate) {
      wx.showToast({
        title: '至少需要2名成员才能创建',
        icon: 'none'
      })
      return
    }

    try {
      wx.showLoading({ title: '创建中...' })

      // 调用云函数创建旅行
      const result = await wx.cloud.callFunction({
        name: 'createTrip',
        data: {
          tripId: this.data.tripId,
          members: this.data.members,
          name: (this.data.tripName || '').trim()
        }
      })

      if (result.result && result.result.success) {
        wx.showToast({
          title: '创建成功',
          icon: 'success'
        })
        // 跳转到详情页
        setTimeout(() => {
          this.stopPolling()
          wx.redirectTo({ url: `/pages/trip-detail/trip-detail?tripId=${this.data.tripId}` })
        }, 800)
      } else {
        wx.showToast({
          title: result.result?.message || '创建失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('创建旅行失败:', error)
      wx.showToast({
        title: '创建失败，请稍后重试',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  }
})
