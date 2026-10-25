#!/usr/bin/env bash
# 学生扫码页的三张小样式表用 Tailwind v3 预编译成纯 CSS：
# 主站用 Tailwind v4（需要 iOS 16.4+），学生手机里还有 iOS 14/15，预编译可保持兼容。
# 修改学生页样式类名后，在项目根目录运行：bash scripts/build-student-css.sh
set -e
cd "$(dirname "$0")/.."
EXTRA='.outline-hidden{outline:2px solid transparent;outline-offset:2px}.shadow-xs{--tw-shadow:0 1px 2px 0 rgb(0 0 0/.05);--tw-shadow-colored:0 1px 2px 0 var(--tw-shadow-color);box-shadow:var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow)}'
for n in student student-seat student-seat-result; do
  out=$(mktemp)
  bunx tailwindcss@3.4.17 -i "scripts/student-css/$n.src.css" -o "$out" --minify
  { echo "/* 自动生成，请勿手改：bash scripts/build-student-css.sh（Tailwind v3 预编译，兼容 iOS 14+） */"; cat "$out"; echo "$EXTRA"; } > "src/$n.css"
  rm -f "$out"
done
