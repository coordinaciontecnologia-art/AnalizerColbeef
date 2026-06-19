import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Home from "./pages/Home";
import Analyzer from "./pages/Analyzer";
import History from "./pages/History";
import ReportDetail from "./pages/ReportDetail";

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}

function Router() {
  return (
    <Switch>
      {/* Public landing */}
      <Route path="/" component={Home} />

      {/* Protected routes */}
      <Route path="/analyzer">
        <ProtectedLayout>
          <Analyzer />
        </ProtectedLayout>
      </Route>

      <Route path="/history">
        <ProtectedLayout>
          <History />
        </ProtectedLayout>
      </Route>

      <Route path="/report/:id">
        {(params) => (
          <ProtectedLayout>
            <ReportDetail />
          </ProtectedLayout>
        )}
      </Route>

      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
