import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { RoleProvider, useRole, type UserRole } from "@/contexts/RoleContext";
import { ApiDataProvider } from "@/contexts/ApiDataContext";
import { LoadingScreen } from "@/components/LoadingScreen";
import { RoleGuard } from "@/components/RoleGuard";
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
import DeviceInventory from "@/pages/DeviceInventory";
import SnmpExplorer from "@/pages/SnmpExplorer";
import NotFound from "@/pages/not-found";

const ADMIN_UP:       UserRole[] = ['super_admin', 'admin'];
const SUPER_ADMIN:    UserRole[] = ['super_admin'];
const NOC_UP:         UserRole[] = ['super_admin', 'admin', 'noc_engineer'];

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
            <Route path="/olts/:id" component={() => <RoleGuard allow={NOC_UP}><OltDetail /></RoleGuard>} />
            <Route path="/olts" component={() => <RoleGuard allow={NOC_UP}><OltManagement /></RoleGuard>} />
            <Route path="/onus/:id" component={OnuDetail} />
            <Route path="/onus" component={OnuManagement} />
            <Route path="/diagram" component={() => <RoleGuard allow={ADMIN_UP}><DeviceDiagram /></RoleGuard>} />
            <Route path="/fiber-map" component={() => <RoleGuard allow={ADMIN_UP}><FiberMap /></RoleGuard>} />
            <Route path="/alarms" component={AlarmCenter} />
            <Route path="/activity-logs" component={ActivityLogs} />
            <Route path="/notifications" component={() => <RoleGuard allow={ADMIN_UP}><NotificationCenter /></RoleGuard>} />
            <Route path="/diagnostics" component={() => <RoleGuard allow={ADMIN_UP}><SmartDiagnostics /></RoleGuard>} />
            <Route path="/inventory" component={() => <RoleGuard allow={ADMIN_UP}><DeviceInventory /></RoleGuard>} />
            <Route path="/staff" component={() => <RoleGuard allow={ADMIN_UP}><StaffManagement /></RoleGuard>} />
            <Route path="/subscribers" component={() => <RoleGuard allow={SUPER_ADMIN}><SubscriberManagement /></RoleGuard>} />
            <Route path="/settings" component={() => <RoleGuard allow={SUPER_ADMIN}><Settings /></RoleGuard>} />
            <Route path="/admin/snmp-explorer" component={() => <RoleGuard allow={SUPER_ADMIN}><SnmpExplorer /></RoleGuard>} />
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
