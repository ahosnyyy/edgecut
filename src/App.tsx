import { createBrowserRouter, RouterProvider, Navigate, Outlet } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppProvider } from "./context/AppProvider";
import { AuthProvider } from "./auth/useAuth";
import ProtectedRoute from "./auth/ProtectedRoute";
import AppShell from "./components/layout/AppShell";
import Login from "./pages/Login";
import QuickOptimize from "./pages/QuickOptimize";
import ProjectsList from "./pages/ProjectsList";
import ProjectBuilder from "./pages/ProjectBuilder";
import TemplateManager from "./pages/TemplateManager";
import ApartmentTemplateManager from "./pages/ApartmentTemplateManager";
import Settings from "./pages/Settings";

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
      { path: "/quick-optimize", element: <QuickOptimize /> },
      { path: "/projects", element: <ProjectsList /> },
      { path: "/projects/:id", element: <ProjectBuilder /> },
      { path: "/apartment-templates", element: <ApartmentTemplateManager /> },
      { path: "/templates", element: <TemplateManager /> },
      { path: "/settings", element: <Settings /> },
    ],
  },
  {
    path: "/",
    element: <Navigate to="/quick-optimize" replace />,
  },
  {
    path: "*",
    element: <Navigate to="/quick-optimize" replace />,
  },
]);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppProvider>
          <RouterProvider router={router} />
        </AppProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

