/** 学生扫码页专用：只扫描签到页相关文件，生成极小的样式表。 */
const base = require("./tailwind.config.cjs");
module.exports = {
  ...base,
  content: ["./src/StudentApp.tsx", "./src/pages/CheckInPage.tsx", "./src/pages/SeatCheckinPage.tsx", "./src/components/checkin-views/**/*.{ts,tsx}", "./src/components/student-ui.tsx", "./src/lib/seat-*.ts"],
};
