import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import { AuthGate } from "@/components/AuthGate";

const RootLayout = () => (
  <>
    <AuthGate>
      <Outlet />
    </AuthGate>
    <TanStackRouterDevtools />
  </>
);

export const Route = createRootRoute({ component: RootLayout });
