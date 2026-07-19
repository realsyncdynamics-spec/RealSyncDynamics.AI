declare module 'react-dom/client' {
  export function createRoot(container: Element | DocumentFragment): any;
  export function hydrateRoot(container: Element | DocumentFragment, initialChildren: any): any;
}
