import { createRouter } from "@tanstack/react-router";
import { NotFound } from "@/components/layout/not-found";
import { AppErrorComponent } from "@/lib/error-component";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createRouter({
    routeTree,
    defaultErrorComponent: AppErrorComponent,
    defaultNotFoundComponent: NotFound,
  });
}
