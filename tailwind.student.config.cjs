/** 学生普通签到页专用：只扫描签到页文件，生成极小的样式表。 */
const base = require("./tailwind.config.cjs");
module.exports = { ...base, content: ["./src/StudentApp.tsx", "./src/pages/CheckInPage.tsx", "./src/components/student-ui.tsx"] };
