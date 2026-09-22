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

/**
 * A GitHub Pages project site mounts the app under `/<repo>/`, so the router has
 * to strip that prefix the same way the bundler's base does. Local dev and
 * root-served hosts keep `BASE_URL === "/"` and therefore no basename.
 */
const base = import.meta.env.BASE_URL;
const basename = base === "/" ? undefined : base.replace(/\/$/, "");

/** The app uses this instance; tests create their own for a clean history. */
export const appRouter = createBrowserRouter(routes, { basename });

export function createAppRouter() {
  return createBrowserRouter(routes, { basename });
}
