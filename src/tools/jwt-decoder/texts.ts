export const texts = {
  name: "JWT 解析",
  description: "解码 JWT 的 Header / Payload（本地解码，不验证签名）",
  keywords: ["jwt", "token", "解析", "decode", "auth", "jwtjx"],
  labels: {
    expired: "（已过期）",
    expiresIn: (minutes: number) => `（剩余 ${minutes} 分钟）`,
    expiresInHours: (hours: number) => `（剩余 ${hours} 小时）`,
    expiresInDays: (days: number) => `（剩余 ${days} 天）`,
  },
};
