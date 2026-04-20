import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import { AuthGate } from "@/features/auth";

const RootLayout = () => (
  <>
    <AuthGate>
      <Outlet />
    </AuthGate>
    <TanStackRouterDevtools />
  </>
);

export const Route = createRootRoute({ component: RootLayout });
