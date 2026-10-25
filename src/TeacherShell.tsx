import "./styles.css";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { FeatureConfigProvider } from "@/contexts/FeatureConfigContext";
import { StudentDropHintOverlay } from "@/lib/student-drop-hint";
import { installTouchDragShim } from "@/lib/touch-drag-shim";
import { installSafeAreaObserver } from "@/lib/safe-area";

let helpersInstalled = false;

/**
 * 教师端与其它页面的完整外壳：语言、登录、全站设置、提示框与主样式表。
 * 学生签到扫码页不经过这里，手机不必下载这些代码。
 */
export default function TeacherShell({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (helpersInstalled) return;
    helpersInstalled = true;
    // 拖拽与安全区辅助只在教师端需要。
    installTouchDragShim();
    installSafeAreaObserver();
  }, []);

  return (
    <LanguageProvider>
      <AuthProvider>
        <FeatureConfigProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <StudentDropHintOverlay />
            {children}
          </TooltipProvider>
        </FeatureConfigProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}
