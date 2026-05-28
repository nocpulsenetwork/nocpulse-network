import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { RoleProvider, useRole } from "@/contexts/RoleContext";
import { ApiDataProvider } from "@/contexts/ApiDataContext";
import { LoadingScreen } from "@/components/LoadingScreen";
import { useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import Dashboard from "@/pages/Dashboard";
import Login from "@/pages/Login";
import OltManagement from "@/pages/OltManagement";
import OltDetail from "@/pages/OltDetail";
import OnuManagement from "@/pages/OnuManagement";
import OnuDetail from "@/pages/OnuDetail";
import DeviceDiagram from "@/pages/DeviceDiagram";
import FiberMap from "@/pages/FiberMap";
import AlarmCenter from "@/pages/AlarmCenter";
import Settings from "@/pages/Settings";
import StaffManagement from "@/pages/StaffManagement";
import SubscriberManagement from "@/pages/SubscriberManagement";
import ActivityLogs from "@/pages/ActivityLogs";
import NotificationCenter from "@/pages/NotificationCenter";
import SmartDiagnostics from "@/pages/SmartDiagnostics";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useRole();
  const [, navigate] = useLocation();
  useEffect(() => {
    if (!isAuthenticated) navigate('/login');
  }, [isAuthenticated]);
  if (!isAuthenticated) return null;
  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      {/* Standalone routes — no sidebar/navbar */}
      <Route path="/login" component={Login} />

      {/* App routes — protected and wrapped in Layout */}
      <Route>
        <ProtectedRoute>
        <Layout>
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/olts/:id" component={OltDetail} />
            <Route path="/olts" component={OltManagement} />
            <Route path="/onus/:id" component={OnuDetail} />
            <Route path="/onus" component={OnuManagement} />
            <Route path="/diagram" component={DeviceDiagram} />
            <Route path="/fiber-map" component={FiberMap} />
            <Route path="/alarms" component={AlarmCenter} />
            <Route path="/activity-logs" component={ActivityLogs} />
            <Route path="/notifications" component={NotificationCenter} />
            <Route path="/diagnostics" component={SmartDiagnostics} />
            <Route path="/staff" component={StaffManagement} />
            <Route path="/subscribers" component={SubscriberManagement} />
            <Route path="/settings" component={Settings} />
            <Route component={NotFound} />
          </Switch>
        </Layout>
        </ProtectedRoute>
      </Route>
    </Switch>
  );
}

function App() {
  useEffect(() => {
    const timeoutMinutes = 30;
    let timeoutId: ReturnType<typeof setTimeout>;

    const logout = () => {
      localStorage.removeItem("auth-token");
      localStorage.removeItem("user-role");
      window.location.href = "/login";
    };

    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(logout, timeoutMinutes * 60 * 1000);
    };

    const events = ["click", "keydown", "scroll", "mousemove", "touchstart"];

    events.forEach((event) => {
      window.addEventListener(event, resetTimer);
    });

    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      events.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, []);
  return (
    <ThemeProvider defaultTheme="dark" storageKey="nocpulse-theme">
      <RoleProvider>
        <QueryClientProvider client={queryClient}>
          <ApiDataProvider>
            <LoadingScreen />
            <TooltipProvider>
              <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                <Router />
              </WouterRouter>
              <Toaster />
            </TooltipProvider>
          </ApiDataProvider>
        </QueryClientProvider>
      </RoleProvider>
    </ThemeProvider>
  );
}

export default App;
