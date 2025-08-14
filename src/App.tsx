import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/core/errors/ErrorBoundary";
import { CommandPalette } from "@/components/ui/command-palette";
import { LoadingOverlay } from "@/components/common/LoadingSpinner";
import { useAppStore, selectIsLoading } from "@/core/state/AppStore";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useConnectionStatus } from "@/hooks/useConnectionStatus";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Memories from "./pages/Memories";
import Files from "./pages/Files";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import { ProtectedRoute } from "./components/ProtectedRoute";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (renamed from cacheTime)
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors
        if (error?.status >= 400 && error?.status < 500) return false;
        return failureCount < 3;
      },
    },
  },
});

const AppContent = () => {
  const isLoading = useAppStore(selectIsLoading);
  
  // Initialize global hooks
  useKeyboardShortcuts();
  useConnectionStatus();

  return (
    <>
      <LoadingOverlay isVisible={isLoading} />
      <CommandPalette />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/memories" 
            element={
              <ProtectedRoute>
                <Memories />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/files" 
            element={
              <ProtectedRoute>
                <Files />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/settings" 
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            } 
          />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </>
  );
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <AppContent />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
