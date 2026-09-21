import { Outlet, ScrollRestoration } from "react-router";

import { SiteFooter, SiteHeader } from "@/components/app/SiteChrome";

/** Shared chrome for every route: one column, one header, one footer. */
export function SiteLayout() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-5 pt-6 pb-24 sm:px-8">
      <SiteHeader />
      <Outlet />
      <SiteFooter />
      <ScrollRestoration />
    </div>
  );
}
