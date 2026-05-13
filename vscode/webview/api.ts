// Thin wrapper around `acquireVsCodeApi()` so React components can
// post messages back to the extension host without each one re-doing
// the global handshake.

import type { ToExtension, ToWebview } from "../src/forms/messages";

interface VsCodeApi<T = unknown> {
    postMessage(msg: T): void;
    setState(state: unknown): void;
    getState(): unknown;
}

declare global {
    interface Window {
        acquireVsCodeApi: <T = unknown>() => VsCodeApi<T>;
        __GF_FORM__: import("../src/forms/messages").FormOptions;
    }
}

let cached: VsCodeApi<ToExtension> | undefined;

export function vscodeApi(): VsCodeApi<ToExtension> {
    if (!cached) cached = window.acquireVsCodeApi<ToExtension>();
    return cached;
}

export function postToExtension(msg: ToExtension): void {
    vscodeApi().postMessage(msg);
}

export function onExtensionMessage(handler: (msg: ToWebview) => void): () => void {
    const listener = (e: MessageEvent<ToWebview>) => handler(e.data);
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
}
