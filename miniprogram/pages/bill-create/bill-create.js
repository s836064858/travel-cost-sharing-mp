const { getShortName } = require('../../utils/format')
Page({
  data: {
    tripId: '',
    billId: '',
    trip: {},
    members: [],
    formData: {
      payerMemberId: '',
      amount: '',
      category: 'other',
      date: '',
      note: '',
      splitMethod: 'equal',
      participants: [],
      customAmounts: {}
    },
    payerIndex: 0,
    categoryOptions: ['餐饮', '交通', '住宿', '门票', '其他'],
    categoryIndex: 4,
    categoryMap: {
      餐饮: 'food',
      交通: 'transport',
      住宿: 'lodging',
      门票: 'ticket',
      其他: 'other'
    },
    isFormValid: false,
    previewDiff: 0,
    isZeroDiff: true,
    sharePreview: []
  },

  onLoad(options) {
    this.setData({ tripId: options.tripId, billId: options.billId || '' })
    this.loadTripData()
    this.initFormData()
  },

  // 初始化表单数据
  initFormData() {
    const today = new Date()
    const formattedDate = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`

    this.setData({
      'formData.date': formattedDate
    })
  },

  // 加载旅行数据
  async loadTripData() {
    try {
      wx.showLoading({ title: '加载中...' })

      // 获取旅行详情
      const result = await wx.cloud.callFunction({
        name: 'getTrip',
        data: { tripId: this.data.tripId }
      })

      if (result.result.success) {
        const trip = result.result.data
        const activeMembers = trip.members.filter((member) => member.active)
        const enrichedMembers = activeMembers.map((m) => ({
          ...m,
          id: String(m.id),
          shortName: getShortName(m.name || ''),
          checked: true
        }))

        this.setData({
          trip: trip,
          members: enrichedMembers,
          'formData.payerMemberId': enrichedMembers[0]?.id || '',
          'formData.participants': enrichedMembers.map((member) => member.id)
        })

        // 如为编辑模式，加载账单详情
        if (this.data.billId) {
          await this.loadBillDetail()
        }
        this.validateForm()
        this.calculatePreview()
      }
    } catch (error) {
      console.error('加载旅行数据失败:', error)
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  },

  // 加载账单详情（编辑模式）
  async loadBillDetail() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getBill',
        data: { billId: this.data.billId, tripId: this.data.tripId }
      })

      if (!res.result || !res.result.success) return
      const bill = res.result.data

      const payerIndex = this.data.members.findIndex((m) => String(m.id) === String(bill.payerMemberId))
      const categoryIndex = this.data.categoryOptions.findIndex((c) => this.data.categoryMap[c] === bill.category)

      const customAmounts = {}
      bill.shares.forEach((s) => {
        const key = String(s.memberId)
        customAmounts[key] = s.shareAmount
      })

      const selectedParticipants = bill.shares.map((s) => String(s.memberId))
      const updatedMembers = this.data.members.map((m) => ({
        ...m,
        checked: selectedParticipants.includes(m.id)
      }))

      this.setData({
        payerIndex: payerIndex >= 0 ? payerIndex : 0,
        categoryIndex: categoryIndex >= 0 ? categoryIndex : 4,
        formData: {
          payerMemberId: String(bill.payerMemberId),
          amount: (bill.amount || 0).toString(),
          category: bill.category || 'other',
          date: bill.date || '',
          note: bill.note || '',
          splitMethod: bill.splitMethod || 'equal',
          participants: selectedParticipants,
          customAmounts
        },
        members: updatedMembers
      })
    } catch (error) {
      console.error('加载账单详情失败:', error)
    }
  },

  // 输入框变化
  onInputChange(e) {
    const { name } = e.currentTarget.dataset
    const value = e.detail.value
    this.setData({
      [`formData.${name}`]: value
    })
    this.validateForm()
    this.calculatePreview()
  },

  // 付款人选择
  onPayerChange(e) {
    const index = e.detail.value
    const member = this.data.members[index]
    this.setData({
      payerIndex: index,
      'formData.payerMemberId': String(member.id)
    })
  },

  // 分类选择
  onCategoryChange(e) {
    const index = e.detail.value
    const categoryText = this.data.categoryOptions[index]
    const category = this.data.categoryMap[categoryText]

    this.setData({
      categoryIndex: index,
      'formData.category': category
    })
  },

  // 日期选择
  onDateChange(e) {
    this.setData({
      'formData.date': e.detail.value
    })
  },

  // 分摊方式变化
  onSplitMethodChange(e) {
    const method = e.detail.value
    this.setData({
      'formData.splitMethod': method,
      'formData.customAmounts': {}
    })
    this.calculatePreview()
  },

  // 参与成员变化
  onParticipantsChange(e) {
    const selected = e.detail.value || []
    this.setData({ 'formData.participants': selected })
    const members = [...this.data.members]
    members.forEach((member) => {
      if (selected.includes(member.id)) {
        member.checked = true
      } else {
        member.checked = false
      }
    })
    this.setData({ members })
    this.calculatePreview()
  },

  // 自定义金额变化
  onCustomAmountChange(e) {
    const memberId = e.currentTarget.dataset.memberId
    const value = parseFloat(e.detail.value) || 0
    const customAmounts = { ...this.data.formData.customAmounts }
    customAmounts[memberId] = value

    this.setData({
      'formData.customAmounts': customAmounts
    })
    this.calculatePreview()
  },

  // 获取分摊金额
  getShareAmount(memberId) {
    if (this.data.formData.splitMethod === 'equal') {
      const amount = parseFloat(this.data.formData.amount) || 0
      const participantCount = this.data.formData.participants.length
      if (participantCount === 0) return 0

      const equalAmount = Math.floor((amount * 100) / participantCount) / 100
      return equalAmount.toFixed(2)
    } else {
      return (this.data.formData.customAmounts[memberId] || 0).toFixed(2)
    }
  },

  // 获取自定义金额
  getCustomAmount(memberId) {
    return this.data.formData.customAmounts[memberId] || ''
  },

  // 计算分摊预览
  calculatePreview() {
    const amount = parseFloat(this.data.formData.amount) || 0
    const participants = this.data.formData.participants

    if (amount === 0 || participants.length === 0) {
      this.setData({ previewDiff: 0, isZeroDiff: true, sharePreview: [] })
      return []
    }

    let shares = []
    let total = 0

    if (this.data.formData.splitMethod === 'equal') {
      const shareAmount = Math.floor((amount * 100) / participants.length) / 100
      const lastShare = amount - shareAmount * (participants.length - 1)

      shares = participants.map((memberId, index) => {
        const m = this.data.members.find((mm) => mm.id === memberId) || {}
        const mAmount = index === participants.length - 1 ? lastShare : shareAmount
        total += mAmount
        return {
          memberId,
          amount: mAmount.toFixed(2),
          name: m.name,
          avatarUrl: m.avatarUrl,
          shortName: getShortName(m.name)
        }
      })
    } else {
      shares = participants.map((memberId) => {
        const m = this.data.members.find((mm) => mm.id === memberId) || {}
        const mAmount = this.data.formData.customAmounts[memberId] || 0
        total += mAmount
        return {
          memberId,
          amount: mAmount.toFixed(2),
          name: m.name,
          avatarUrl: m.avatarUrl,
          shortName: getShortName(m.name)
        }
      })
    }

    const diff = (amount - total).toFixed(2)
    this.setData({ previewDiff: diff, isZeroDiff: parseFloat(diff) === 0, sharePreview: shares })
    return shares
  },

  // 验证表单
  validateForm() {
    const { payerMemberId, amount, date, participants } = this.data.formData
    const isValid = payerMemberId && amount > 0 && date && participants.length > 0
    this.setData({ isFormValid: isValid })
  },

  // 提交账单（创建或更新）
  async submitBill(e) {
    if (!this.data.isFormValid) return

    try {
      wx.showLoading({ title: this.data.billId ? '保存中...' : '创建中...' })

      // 计算分摊金额
      const shares = this.calculatePreview().map((item) => ({
        memberId: item.memberId,
        shareAmount: parseFloat(item.amount)
      }))

      let result
      if (this.data.billId) {
        // 更新账单
        result = await wx.cloud.callFunction({
          name: 'updateBill',
          data: {
            billId: this.data.billId,
            tripId: this.data.tripId,
            payerMemberId: this.data.formData.payerMemberId,
            amount: parseFloat(this.data.formData.amount),
            category: this.data.formData.category,
            date: this.data.formData.date,
            note: this.data.formData.note,
            splitMethod: this.data.formData.splitMethod,
            shares
          }
        })
      } else {
        // 创建账单
        result = await wx.cloud.callFunction({
          name: 'addBill',
          data: {
            tripId: this.data.tripId,
            payerMemberId: this.data.formData.payerMemberId,
            amount: parseFloat(this.data.formData.amount),
            category: this.data.formData.category,
            date: this.data.formData.date,
            note: this.data.formData.note,
            splitMethod: this.data.formData.splitMethod,
            shares
          }
        })
      }

      if (result.result.success) {
        wx.showToast({
          title: this.data.billId ? '保存成功' : '创建成功',
          icon: 'success'
        })

        // 返回旅行详情页
        setTimeout(() => {
          wx.navigateBack()
        }, 1000)
      } else {
        wx.showToast({
          title: result.result.message || '创建失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('创建账单失败:', error)
      wx.showToast({
        title: '创建失败',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  },

  // 取消编辑
  cancelEdit() {
    wx.navigateBack()
  },

  // 删除账单（编辑模式）
  async deleteBill() {
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个账单吗？此操作不可恢复。',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '删除中...' })
            const result = await wx.cloud.callFunction({
              name: 'deleteBill',
              data: { tripId: this.data.tripId, billId: this.data.billId }
            })

            if (result.result.success) {
              wx.showToast({ title: '删除成功', icon: 'success' })
              setTimeout(() => {
                wx.navigateBack()
              }, 1200)
            } else {
              wx.showToast({ title: result.result.message || '删除失败', icon: 'none' })
            }
          } catch (error) {
            console.error('删除账单失败:', error)
            wx.showToast({ title: '删除失败', icon: 'none' })
          } finally {
            wx.hideLoading()
          }
        }
      }
    })
  }
})
