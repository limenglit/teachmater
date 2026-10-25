/**
 * 首屏占位：服务器先输出转圈（或扫码页骨架），页面代码就绪后由 React 替换。
 * 扫码页的骨架 HTML 由文档头部脚本放在 window.__TM_BOOT_HTML__，
 * 占位元素一出现就由头部脚本套用，无需等页面代码下载完。
 */
const DEFAULT_BOOT_HTML =
  '<div class="app-boot" aria-hidden="true"><div class="app-boot__spinner"></div><div class="app-boot__title">教创搭子 · TeacherMate</div></div>';

function bootHtml(): string {
  if (typeof window === "undefined") return DEFAULT_BOOT_HTML;
  const w = window as unknown as { __TM_BOOT_HTML__?: string };
  return w.__TM_BOOT_HTML__ || DEFAULT_BOOT_HTML;
}

export function BootPlaceholder() {
  return (
    <div id="tm-boot" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: bootHtml() }} />
  );
}
