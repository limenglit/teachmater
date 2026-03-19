import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Suspense } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { FeatureConfigProvider } from "@/contexts/FeatureConfigContext";
import { lazyRetry } from "@/lib/lazy-retry";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const DiscussPage = lazyRetry(() => import("./pages/DiscussPage"));
const CheckInPage = lazyRetry(() => import("./pages/CheckInPage"));
const AuthPage = lazyRetry(() => import("./pages/AuthPage"));
const ResetPassword = lazyRetry(() => import("./pages/ResetPassword"));
const AdminPage = lazyRetry(() => import("./pages/AdminPage"));
const GoRedirect = lazyRetry(() => import("./pages/GoRedirect"));
const SeatCheckinPage = lazyRetry(() => import("./pages/SeatCheckinPage"));
const BoardPage = lazyRetry(() => import("./pages/BoardPage"));
const BoardSubmitPage = lazyRetry(() => import("./pages/BoardSubmitPage"));
const QuizSubmitPage = lazyRetry(() => import("./pages/QuizSubmitPage"));
const PollVotePage = lazyRetry(() => import("./pages/PollVotePage"));
const TaskSubmitPage = lazyRetry(() => import("./pages/TaskSubmitPage"));

const queryClient = new QueryClient();

const Loading = () => <div className="flex items-center justify-center min-h-screen text-muted-foreground">Loading...</div>;

const App = () => (
  <LanguageProvider>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <FeatureConfigProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Suspense fallback={<Loading />}><AuthPage /></Suspense>} />
                <Route path="/reset-password" element={<Suspense fallback={<Loading />}><ResetPassword /></Suspense>} />
                <Route path="/admin" element={<Suspense fallback={<Loading />}><AdminPage /></Suspense>} />
                <Route path="/discuss/:topicId" element={<Suspense fallback={<Loading />}><DiscussPage /></Suspense>} />
                <Route path="/checkin/:sessionId" element={<Suspense fallback={<Loading />}><CheckInPage /></Suspense>} />
                <Route path="/go" element={<Suspense fallback={<Loading />}><GoRedirect /></Suspense>} />
                <Route path="/seat-checkin/:sessionId" element={<Suspense fallback={<Loading />}><SeatCheckinPage /></Suspense>} />
                <Route path="/board/:boardId" element={<Suspense fallback={<Loading />}><BoardPage /></Suspense>} />
                <Route path="/board/:boardId/submit" element={<Suspense fallback={<Loading />}><BoardSubmitPage /></Suspense>} />
                <Route path="/quiz/:sessionId" element={<Suspense fallback={<Loading />}><QuizSubmitPage /></Suspense>} />
                <Route path="/poll/:pollId" element={<Suspense fallback={<Loading />}><PollVotePage /></Suspense>} />
                <Route path="/task/:sessionId" element={<Suspense fallback={<Loading />}><TaskSubmitPage /></Suspense>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </FeatureConfigProvider>
      </AuthProvider>
    </QueryClientProvider>
  </LanguageProvider>
);

export default App;
