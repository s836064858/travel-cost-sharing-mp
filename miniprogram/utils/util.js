const formatTime = (date) => {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours()
  const minute = date.getMinutes()
  const second = date.getSeconds()

  return `${[year, month, day].map(formatNumber).join('/')} ${[hour, minute, second].map(formatNumber).join(':')}`
}

const formatNumber = (n) => {
  n = n.toString()
  return n[1] ? n : `0${n}`
}

// 格式化日期
const formatDate = (dateStr, format = 'YYYY-MM-DD') => {
  if (!dateStr) return ''

  const date = new Date(dateStr)
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()

  return format.replace('YYYY', year).replace('MM', month.toString().padStart(2, '0')).replace('DD', day.toString().padStart(2, '0'))
}

// 金额格式化
const formatAmount = (amount, currency = 'CNY') => {
  if (amount === null || amount === undefined) return '0.00'

  const num = parseFloat(amount)
  if (isNaN(num)) return '0.00'

  const symbol =
    {
      CNY: '¥',
      USD: '$',
      EUR: '€'
    }[currency] || ''

  return `${symbol}${num.toFixed(2)}`
}

// 深拷贝
const deepClone = (obj) => {
  if (obj === null || typeof obj !== 'object') return obj
  if (obj instanceof Date) return new Date(obj.getTime())
  if (obj instanceof Array) return obj.map((item) => deepClone(item))

  const cloned = {}
  for (let key in obj) {
    if (obj.hasOwnProperty(key)) {
      cloned[key] = deepClone(obj[key])
    }
  }
  return cloned
}

// 防抖函数
const debounce = (func, wait) => {
  let timeout
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

// 节流函数
const throttle = (func, limit) => {
  let inThrottle
  return function (...args) {
    if (!inThrottle) {
      func.apply(this, args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

// 验证手机号
const validatePhone = (phone) => {
  const reg = /^1[3-9]\d{9}$/
  return reg.test(phone)
}

// 验证邮箱
const validateEmail = (email) => {
  const reg = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
  return reg.test(email)
}

// 数组去重
const uniqueArray = (arr, key) => {
  if (!key) return [...new Set(arr)]

  const seen = new Set()
  return arr.filter((item) => {
    const value = item[key]
    if (seen.has(value)) {
      return false
    }
    seen.add(value)
    return true
  })
}

// 获取随机颜色
const getRandomColor = () => {
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', '#FF9FF3', '#54A0FF', '#5F27CD', '#00D2D3', '#FF9F43']
  return colors[Math.floor(Math.random() * colors.length)]
}

// 成员查找工具：根据 id 或 memberId 返回成员对象（兼容字符串/数字）
const getMemberById = (members, memberId) => {
  if (!Array.isArray(members)) return {}
  const target = memberId == null ? '' : String(memberId)
  const member = members.find((m) => String(m.id) === target || String(m.memberId) === target)
  return member || {}
}

module.exports = {
  formatTime,
  formatDate,
  formatAmount,
  deepClone,
  debounce,
  throttle,
  validatePhone,
  validateEmail,
  uniqueArray,
  getRandomColor,
  getMemberById
}
