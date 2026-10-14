/** 座位签到成功页专用样式表：随签到成功后的座位展示一起按需下载（重置样式已由表单样式表提供）。 */
const base = require("./tailwind.config.cjs");
module.exports = {
  ...base,
  content: ["./src/components/checkin-views/**/*.{ts,tsx}", "./src/components/student-icons*.tsx", "./src/components/student-ui.tsx", "./src/lib/seat-*.ts"],
  corePlugins: { preflight: false },
  experimental: { optimizeUniversalDefaults: true },
};
