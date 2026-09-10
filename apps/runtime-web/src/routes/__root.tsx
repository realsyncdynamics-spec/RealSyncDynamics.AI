import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { NotFound } from "@/components/layout/not-found";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import appCss from "../styles.css?url";

const APP_NAME = "RealSync Runtime";
const DESCRIPTION =
  "Governance- und Control-Runtime für KI, Software und industrielle Systeme. Ein Produkt von RealSync Dynamics AI.";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      { name: "description", content: DESCRIPTION },
      { name: "theme-color", content: "#08090B" },
      { name: "application-name", content: APP_NAME },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap",
      },
    ],
  }),
  component: Root,
  notFoundComponent: NotFound,
});

function Root() {
  return (
    <html lang="de" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="bg-bg text-fg">
        <SiteHeader />
        <Outlet />
        <SiteFooter />
        <Scripts />
      </body>
    </html>
  );
}
