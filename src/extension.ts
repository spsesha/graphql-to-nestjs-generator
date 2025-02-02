import * as vscode from 'vscode';
import { convertSDL } from './parser';

export function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand('graphql-to-nestjs-generator.generate', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    const selection = editor.selection;
    const text = editor.document.getText(selection);

    if (!text) {
      return;
    }

    try {
      const convertedText = convertSDL(text);
      await editor.edit((editBuilder) => {
        editBuilder.replace(selection, convertedText);
      });

      const config = vscode.workspace.getConfiguration();
      const enableFormatting = config.get<boolean>('graphqlToNestJS.enableFormatting', true);

      if (enableFormatting) {
        await vscode.commands.executeCommand('editor.action.formatSelection');
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Error: Unable to convert`);
    }
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {}
