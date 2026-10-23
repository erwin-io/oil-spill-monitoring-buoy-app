import { Routes } from "@angular/router";
import { authGuard } from "./core/auth.guard";
export const routes: Routes = [
  {
    path: "login",
    loadComponent: () => import("./pages/login.page").then((m) => m.LoginPage),
  },
  {
    path: "register",
    loadComponent: () =>
      import("./pages/register.page").then((m) => m.RegisterPage),
  },
  {
    path: "verify-email",
    loadComponent: () =>
      import("./pages/verify.page").then((m) => m.VerifyPage),
  },
  {
    path: "forgot-password",
    loadComponent: () =>
      import("./pages/forgot.page").then((m) => m.ForgotPage),
  },
  {
    path: "tabs",
    canActivate: [authGuard],
    loadComponent: () => import("./pages/tabs.page").then((m) => m.TabsPage),
    children: [
      {
        path: "overview",
        loadComponent: () =>
          import("./pages/dashboard.page").then((m) => m.DashboardPage),
      },
      {
        path: "buoys",
        loadComponent: () =>
          import("./pages/devices.page").then((m) => m.DevicesPage),
      },
      {
        path: "buoys/:id",
        loadComponent: () =>
          import("./pages/device-detail.page").then((m) => m.DeviceDetailPage),
      },
      {
        path: "buoys/:id/history",
        loadComponent: () =>
          import("./pages/history.page").then((m) => m.HistoryPage),
      },
      {
        path: "buoys/:id/trends",
        loadComponent: () =>
          import("./pages/trends.page").then((m) => m.TrendsPage),
      },
      {
        path: "buoys/:id/health",
        loadComponent: () =>
          import("./pages/health.page").then((m) => m.HealthPage),
      },
      {
        path: "buoys/:id/config",
        loadComponent: () =>
          import("./pages/config.page").then((m) => m.ConfigPage),
      },
      {
        path: "alerts",
        loadComponent: () =>
          import("./pages/alerts.page").then((m) => m.AlertsPage),
      },
      {
        path: "alerts/:id",
        loadComponent: () =>
          import("./pages/alert-detail.page").then((m) => m.AlertDetailPage),
      },
      {
        path: "profile",
        loadComponent: () =>
          import("./pages/profile.page").then((m) => m.ProfilePage),
      },
      { path: "", pathMatch: "full", redirectTo: "overview" },
    ],
  },
  { path: "", pathMatch: "full", redirectTo: "tabs" },
  { path: "**", redirectTo: "tabs" },
];
