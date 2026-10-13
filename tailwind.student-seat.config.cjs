/** 学生座位签到页专用样式表：只在打开座位签到时下载。 */
const base = require("./tailwind.config.cjs");
module.exports = { ...base, content: ["./src/StudentApp.tsx", "./src/pages/SeatCheckinPage.tsx", "./src/components/checkin-views/**/*.{ts,tsx}", "./src/components/student-ui.tsx", "./src/lib/seat-*.ts"] };
