// app.js
const util = require('./utils/util.js')

App({
  onLaunch() {
    // 初始化云开发
    if (wx.cloud) {
      wx.cloud.init({
        env: 'cloudbase-3g0pawvp50cea09e',
        traceUser: true
      })
      // 拉取云端用户信息并刷新缓存
      wx.cloud
        .callFunction({ name: 'getUserProfile' })
        .then(async (res) => {
          const user = (res && res.result && res.result.user) || null
          console.log(user)
          if (user) {
            // 解析头像文件ID为临时链接，仅用于展示；保留原始字段以便保存
            const previewUrl = await util.resolveAvatarUrl(user.avatarUrl || '')
            const enriched = { ...user, avatarPreviewUrl: previewUrl }
            this.globalData.userInfo = enriched
            // 若当前在首页，主动刷新展示数据
            const pages = getCurrentPages()
            if (Array.isArray(pages) && pages.length) {
              pages.forEach((p) => {
                if (p && p.route === 'pages/home/home') {
                  p.setData({ userInfo: enriched })
                }
              })
            }
          }
        })
        .catch(() => {
          /* 静默失败 */
        })
    }
  },

  globalData: {
    userInfo: null,
    currentTrip: null
  }
})
