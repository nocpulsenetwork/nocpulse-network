import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/contexts/ThemeContext";

import { Layout } from "@/components/layout/Layout";
import Dashboard from "@/pages/Dashboard";
import OltManagement from "@/pages/OltManagement";
import OnuManagement from "@/pages/OnuManagement";
import OnuDetail from "@/pages/OnuDetail";
import DeviceDiagram from "@/pages/DeviceDiagram";
import FiberMap from "@/pages/FiberMap";
import AlarmCenter from "@/pages/AlarmCenter";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/olts" component={OltManagement} />
        <Route path="/onus/:id" component={OnuDetail} />
        <Route path="/onus" component={OnuManagement} />
        <Route path="/diagram" component={DeviceDiagram} />
        <Route path="/fiber-map" component={FiberMap} />
        <Route path="/alarms" component={AlarmCenter} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="nocpulse-theme">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
