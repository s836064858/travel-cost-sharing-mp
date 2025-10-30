// pages/profile/profile.js
const app = getApp()

Page({
  data: {
    avatarUrl: '', // 保存用：文件ID或本地路径（未上传）
    avatarPreviewUrl: '', // 展示用：解析后的临时链接或本地路径
    avatarFileID: '', // 原始文件ID（未更改头像时沿用）
    nickName: ''
  },
  onLoad() {
    const user = app.globalData.userInfo || {}
    this.setData({
      avatarUrl: user.avatarUrl || '',
      avatarFileID: user.avatarUrl || '',
      avatarPreviewUrl: user.avatarPreviewUrl || '',
      nickName: user.nickName || ''
    })
  },
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail || {}
    if (avatarUrl) this.setData({ avatarUrl, avatarPreviewUrl: avatarUrl })
  },
  onNickInput(e) {
    this.setData({ nickName: e.detail.value })
  },
  async onSave() {
    const { avatarUrl, nickName } = this.data
    let avatarPreviewUrl = []
    let avatarFileID = this.data.avatarFileID || ''

    try {
      wx.showLoading({ title: '保存中', mask: true })

      // 如果是本地临时文件（wxfile:// 开头），先上传到云存储
      const isLocal = typeof avatarUrl === 'string' && avatarUrl.indexOf('wxfile://') === 0
      console.log(isLocal, avatarUrl)
      if (avatarUrl && isLocal) {
        const suffixMatch = avatarUrl.match(/\.([a-zA-Z0-9]+)$/)
        const suffix = (suffixMatch && suffixMatch[1]) || 'jpg'
        const cloudPath = `avatars/${Date.now()}-${Math.floor(Math.random() * 1e6)}.${suffix}`
        console.log(cloudPath)
        const uploadRes = await wx.cloud.uploadFile({ cloudPath, filePath: avatarUrl })
        avatarFileID = uploadRes.fileID || ''
        avatarPreviewUrl = await wx.cloud.getTempFileURL({ fileList: [uploadRes.fileID] })
      }

      const userInfo = { avatarUrl: avatarFileID, nickName, avatarPreviewUrl: avatarPreviewUrl[0]?.tempFileURL || this.data.avatarPreviewUrl || '' }
      console.log('userInfo', userInfo)

      // 保存到云（写入 users 集合）
      const saveRes = await wx.cloud.callFunction({
        name: 'saveUserProfile',
        data: userInfo
      })

      const ok = saveRes && saveRes.result && saveRes.result.success
      if (ok) {
        // 本地与全局缓存
        app.globalData.userInfo = userInfo
        wx.showToast({ title: '已保存', icon: 'success' })
        setTimeout(() => wx.navigateBack(), 300)
      } else {
        const msg = (saveRes && saveRes.result && saveRes.result.error) || '保存失败，请稍后重试'
        wx.showToast({ title: msg, icon: 'none' })
      }
    } catch (err) {
      console.error('保存用户资料失败:', err)
      wx.showToast({ title: '保存失败，请稍后重试', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  }
})
