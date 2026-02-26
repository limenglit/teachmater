import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const DiscussPage = lazy(() => import("./pages/DiscussPage"));
const CheckInPage = lazy(() => import("./pages/CheckInPage"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/discuss/:topicId" element={<Suspense fallback={<div className="flex items-center justify-center min-h-screen">加载中...</div>}><DiscussPage /></Suspense>} />
          <Route path="/checkin/:sessionId" element={<Suspense fallback={<div className="flex items-center justify-center min-h-screen">加载中...</div>}><CheckInPage /></Suspense>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
