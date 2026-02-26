import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const DiscussPage = lazy(() => import("./pages/DiscussPage"));
const CheckInPage = lazy(() => import("./pages/CheckInPage"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));

const queryClient = new QueryClient();

const Loading = () => <div className="flex items-center justify-center min-h-screen">加载中...</div>;

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Suspense fallback={<Loading />}><AuthPage /></Suspense>} />
            <Route path="/reset-password" element={<Suspense fallback={<Loading />}><ResetPassword /></Suspense>} />
            <Route path="/discuss/:topicId" element={<Suspense fallback={<Loading />}><DiscussPage /></Suspense>} />
            <Route path="/checkin/:sessionId" element={<Suspense fallback={<Loading />}><CheckInPage /></Suspense>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
