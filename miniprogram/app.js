// app.js
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
        .then((res) => {
          const user = (res && res.result && res.result.user) || null
          if (user) {
            this.globalData.userInfo = user
            // 若当前在首页，主动刷新展示数据
            const pages = getCurrentPages()
            if (Array.isArray(pages) && pages.length) {
              pages.forEach((p) => {
                if (p && p.route === 'pages/home/home') {
                  p.setData({ userInfo: user })
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
