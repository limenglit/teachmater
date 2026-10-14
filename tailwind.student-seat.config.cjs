/** 座位签到页填写表单专用样式表：只覆盖签到前的表单。 */
const base = require("./tailwind.config.cjs");
module.exports = { ...base, content: ["./src/StudentApp.tsx", "./src/pages/SeatCheckinPage.tsx", "./src/components/student-ui.tsx"] };
