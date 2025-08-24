import * as vscode from "vscode";

import { AgentClient } from "./clients/agentClient";
import { WayangWebviewProvider } from "./providers/webviewProvider";
//import { WayangWebviewProvider } from "./providers/webviewProvider";
export function activate(context: vscode.ExtensionContext) {
    const agentClient = new AgentClient();

    const provider = new WayangWebviewProvider(
        context.extensionUri,
        agentClient
    );

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            WayangWebviewProvider.viewType,
            provider
        )
    );
}