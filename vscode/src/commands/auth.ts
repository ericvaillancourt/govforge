import * as vscode from "vscode";
import { ApiError, GovForgeClient } from "../api/client";

export function registerAuthCommands(
    context: vscode.ExtensionContext,
    client: GovForgeClient,
    onSignedInChanged: (signedIn: boolean) => void | Promise<void>,
): void {
    context.subscriptions.push(
        vscode.commands.registerCommand("govforge.signIn", async () => {
            const token = await vscode.window.showInputBox({
                title: "GovForge — paste API token",
                prompt: "Token starts with gfp_. Create one at https://govforge.dev/account/.",
                placeHolder: "gfp_...",
                password: true,
                ignoreFocusOut: true,
                validateInput: (value) =>
                    value.trim().startsWith("gfp_")
                        ? null
                        : "Token must start with 'gfp_'",
            });
            if (!token) {
                return;
            }
            await client.setToken(token.trim());
            try {
                await client.health();
            } catch (err) {
                await client.clearToken();
                vscode.window.showErrorMessage(
                    `GovForge sign-in failed: ${err instanceof Error ? err.message : String(err)}`,
                );
                await vscode.commands.executeCommand(
                    "setContext",
                    "govforge.signedIn",
                    false,
                );
                await onSignedInChanged(false);
                return;
            }
            // health() doesn't actually require auth, but a 401 on any
            // subsequent read would put us right back into the unsigned-in
            // welcome view — so probe one authenticated endpoint too.
            try {
                await client.listProjects();
            } catch (err) {
                if (err instanceof ApiError && err.status === 401) {
                    await client.clearToken();
                    vscode.window.showErrorMessage(
                        "GovForge: token rejected (401). Double-check it was copied correctly.",
                    );
                    await vscode.commands.executeCommand(
                        "setContext",
                        "govforge.signedIn",
                        false,
                    );
                    await onSignedInChanged(false);
                    return;
                }
                // Any other error means the API isn't reachable; still keep
                // the token but warn — the user might fix the URL or start
                // the backend later.
                vscode.window.showWarningMessage(
                    `GovForge token saved but the API isn't reachable yet: ${err instanceof Error ? err.message : String(err)}`,
                );
            }
            await vscode.commands.executeCommand(
                "setContext",
                "govforge.signedIn",
                true,
            );
            await onSignedInChanged(true);
            vscode.window.showInformationMessage("GovForge: signed in.");
        }),

        vscode.commands.registerCommand("govforge.signOut", async () => {
            await client.clearToken();
            await vscode.commands.executeCommand(
                "setContext",
                "govforge.signedIn",
                false,
            );
            await onSignedInChanged(false);
            vscode.window.showInformationMessage("GovForge: signed out.");
        }),
    );
}

/**
 * Called at activation to sync the `govforge.signedIn` context key with
 * whatever token is already in SecretStorage from a previous session.
 */
export async function initializeSignedInContext(
    client: GovForgeClient,
): Promise<boolean> {
    const token = await client.getToken();
    const signedIn = Boolean(token);
    await vscode.commands.executeCommand(
        "setContext",
        "govforge.signedIn",
        signedIn,
    );
    return signedIn;
}
