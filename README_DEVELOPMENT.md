


## Development Mode
fn + F5


🔑 Breakdown
"viewsContainers.activitybar" → defines a new icon in the Activity Bar.
id = internal identifier ("wayang")
title = label shown on hover ("Wayang")
icon = a 32×32 SVG or PNG in your media/ folder
"views.wayang" → attaches panels to that container.
"wayangTasks" will be your tree view (what you have in WayangProvider)
"wayangChat" could be another panel for your chat UI

🚀 Steps to test
Edit your extension’s package.json to include the above.
Run pnpm run watch (or however you start your extension build).
In VS Code, press Fn+F5 (launch extension in Dev mode).
You should now see a new Wayang icon in the left Activity Bar.
Inside it, two collapsible sections: Tasks and Chat.

Creating a **Visual Studio Code (VS Code) extension** involves setting up a project, writing extension logic (in TypeScript or JavaScript), and packaging it. Here’s a complete step-by-step guide:

---

## 1. Install Prerequisites

* **VS Code** installed.
* **Node.js** (latest LTS recommended).
* **Yeoman** and **VS Code Extension Generator**:

  ```bash
  npm install -g yo generator-code
  ```

---

## 2. Scaffold a New Extension

Run:

```bash
yo code
```

You’ll be prompted with questions:

* **Type of extension?**

  * `New Extension (TypeScript)` → recommended
  * `New Extension (JavaScript)`
* **Name, identifier, description** → fill as needed.
* Yeoman will generate a project folder.

---

## 3. Project Structure

Generated project looks like this:

```
my-extension/
├─ .vscode/            → debug configs
├─ src/extension.ts    → main entry file (logic here)
├─ package.json        → extension metadata (name, activation events, commands)
├─ tsconfig.json       → TypeScript settings
└─ README.md           → marketplace documentation
```

---

## 4. Add Your First Command

Inside `src/extension.ts`:

```ts
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  console.log('Extension "my-extension" is now active!');

  let disposable = vscode.commands.registerCommand('myextension.helloWorld', () => {
    vscode.window.showInformationMessage('Hello World from My Extension!');
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {}
```

Update `package.json` to define the command:

```json
{
  "contributes": {
    "commands": [
      {
        "command": "myextension.helloWorld",
        "title": "Hello World"
      }
    ]
  }
}
```

---

## 5. Run and Debug Your Extension

* Open the project in **VS Code**.
* Press **F5** → launches a new VS Code window ("Extension Development Host").
* Open the **Command Palette** (`Ctrl+Shift+P` / `Cmd+Shift+P`) → run **Hello World**.

---

## 6. Package Your Extension

Install the VS Code Extension Manager:

```bash
npm install -g vsce
```

Then package:

```bash
vsce package
```

This generates a `.vsix` file that can be installed or published.

---

## 7. Publish to Marketplace (Optional)

1. Create a [publisher](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#get-a-personal-access-token).
2. Log in:

   ```bash
   vsce login <publisher-name>
   ```
3. Publish:

   ```bash
   vsce publish
   ```

---

✅ Now you have a working VS Code extension with one command.

---

Do you want me to show you how to create a **simple "coding agent" extension** (like your idea of forking Cursor AI from VS Code) as a base, or just a **basic hello-world extension** first?


Great question 👍 — once you’ve packaged your extension into a `.vsix` file (with `vsce package`), you can install and test it directly in VS Code.

---

## 🔧 Install `.vsix` in VS Code

### Option 1: From Command Palette

1. Open **VS Code**.
2. Press **Ctrl+Shift+P** (Windows/Linux) or **Cmd+Shift+P** (macOS).
3. Run:

   ```
   Extensions: Install from VSIX...
   ```
4. Select your `.vsix` file (e.g., `coding-agent-0.0.1.vsix`).
5. VS Code will install it — you’ll see it under the **Extensions** panel.

---

### Option 2: CLI

If you have the VS Code CLI installed (`code` command is available in your terminal):

```bash
code --install-extension my-extension-0.0.1.vsix
```

You can also **uninstall** later with:

```bash
code --uninstall-extension my-extension
```

(where `my-extension` is your extension ID from `package.json`).

---

## 🧪 Test the Extension

After installation:

1. Reload VS Code (it usually prompts you).
2. Open the **Command Palette**.
3. Run the command(s) you defined in `package.json` → e.g. `Start Wayang Code`.
4. If your extension contributes panels, views, or menus, they should now appear.

---

## 🔁 Updating Your Extension

* Make changes to your code.
* Re-run:

  ```bash
  vsce package
  ```
* This will generate a new `.vsix` (e.g., `coding-agent-0.0.2.vsix`).
* Reinstall using the same steps above. VS Code will upgrade the installed version.

---

⚡ Tip: For **fast testing**, instead of packaging every time, you can run your extension in **Dev Mode**:

* Open the extension project in VS Code.
* Press **F5** → launches an “Extension Development Host”.
* Your extension loads there automatically.

---

👉 Do you want me to give you a **scripted workflow** (like a `pnpm run dev` and `pnpm run package`) so you don’t have to remember these commands every time?




Example flow in your code
User opens the "Wayang Chat" sidebar
→ VS Code calls WayangWebviewProvider.resolveWebviewView(...).
Provider injects HTML from ChatPanel.render()
→ That loads your React/VanillaJS front-end (with scripts + UI).
User sends a chat message in the webview
→ The frontend posts a message (vscode.postMessage).
MessageHandler in WayangWebviewProvider receives it
→ Routes to ChatService, SessionService, or ProjectService.
Responses are sent back with postMessage
→ UI updates automatically.