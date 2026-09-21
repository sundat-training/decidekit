import { createBrowserRouter, type RouteObject } from "react-router";

import { SiteLayout } from "@/components/app/SiteLayout";
import { About } from "@/pages/About";
import { Lab } from "@/pages/Lab";
import { NotFound } from "@/pages/NotFound";

const routes: RouteObject[] = [
  {
    path: "/",
    element: <SiteLayout />,
    children: [
      { index: true, element: <Lab /> },
      { path: "about", element: <About /> },
      { path: "*", element: <NotFound /> },
    ],
  },
];

/** The app uses this instance; tests create their own for a clean history. */
export const appRouter = createBrowserRouter(routes);

export function createAppRouter() {
  return createBrowserRouter(routes);
}
