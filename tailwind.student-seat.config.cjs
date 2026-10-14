/** 座位签到页填写表单专用样式表：只覆盖签到前的表单；用极简重置代替完整 preflight 以缩小体积。 */
const base = require("./tailwind.config.cjs");
module.exports = {
  ...base,
  content: ["./src/StudentApp.tsx", "./src/pages/SeatCheckinPage.tsx", "./src/components/student-ui.tsx", "./src/components/student-icons.tsx"],
  plugins: [],
  corePlugins: { preflight: false },
  experimental: { optimizeUniversalDefaults: true },
};
