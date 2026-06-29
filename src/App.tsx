import { createBrowserRouter, RouterProvider, Navigate, Outlet } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppProvider } from "./context/AppProvider";
import { AuthProvider } from "./auth/useAuth";
import { SettingsProvider } from "./hooks/useSettings";
import ProtectedRoute from "./auth/ProtectedRoute";
import AppShell from "./components/layout/AppShell";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import QuickOptimize from "./pages/QuickOptimize";
import ProjectsList from "./pages/ProjectsList";
import ProjectBuilder from "./pages/ProjectBuilder";
import BuildingDetailPage from "./pages/BuildingDetailPage";
import ApartmentTemplateManager from "./pages/ApartmentTemplateManager";
import Settings from "./pages/Settings";
import StockCatalog from "./pages/StockCatalog";
import ProfileSystemManager from "./pages/ProfileSystemManager";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const router = createBrowserRouter([
  {
    path: "/login",
    element: <Login />,
  },
  {
    element: (
      <ProtectedRoute>
        <AppShell>
          <Outlet />
        </AppShell>
      </ProtectedRoute>
    ),
    children: [
      { path: "/dashboard", element: <Dashboard /> },
      { path: "/cutting-optimizer", element: <QuickOptimize /> },
      { path: "/projects", element: <ProjectsList /> },
      { path: "/projects/:id", element: <ProjectBuilder /> },
      { path: "/projects/:id/buildings/:buildingId", element: <BuildingDetailPage /> },
      { path: "/apartment-templates", element: <ApartmentTemplateManager /> },
      { path: "/settings", element: <Settings /> },
      { path: "/stock-catalog", element: <StockCatalog /> },
      { path: "/profile-systems", element: <ProfileSystemManager /> },
    ],
  },
  {
    path: "/",
    element: <Navigate to="/dashboard" replace />,
  },
  {
    path: "*",
    element: <Navigate to="/dashboard" replace />,
  },
]);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SettingsProvider>
          <AppProvider>
            <RouterProvider router={router} />
          </AppProvider>
        </SettingsProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

