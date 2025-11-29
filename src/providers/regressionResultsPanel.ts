import * as vscode from 'vscode';

export class RegressionResultsPanel {
  public static currentPanel: RegressionResultsPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  public static createOrShow(extensionUri: vscode.Uri) {
    const column = vscode.window.activeTextEditor ? vscode.ViewColumn.Two : undefined;

    if (RegressionResultsPanel.currentPanel) {
      RegressionResultsPanel.currentPanel._panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'regressionResults',
      'Regression Results',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: []
      }
    );

    RegressionResultsPanel.currentPanel = new RegressionResultsPanel(panel, extensionUri);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.html = this._getHtmlForWebview();
  }

  public showResults(xColumns: string | string[], yColumn: string, results: any) {
    console.log('showResults called with:', { xColumns, yColumn, results });

    const { slopes, intercept, rSquared, adjustedRSquared, predictions, xColumns: allXCols } = results;

    // Helper function to format numbers with proper precision
    const formatNumber = (num: number, decimals: number = 6): string => {
      if (num === undefined || num === null || isNaN(num)) {
        return 'N/A';
      }
      // For very small numbers, use exponential notation
      if (Math.abs(num) < 0.0001 && num !== 0) {
        return num.toExponential(6);
      }
      return num.toFixed(decimals);
    };

    // Add defensive checks
    if (intercept === undefined) {
      console.error('ERROR: intercept is undefined. Results object:', results);
      vscode.window.showErrorMessage('Error displaying results: missing intercept value');
      return;
    }
    if (!slopes || typeof slopes !== 'object') {
      console.error('ERROR: slopes is invalid. Results object:', results);
      vscode.window.showErrorMessage('Error displaying results: missing slopes');
      return;
    }
    if (rSquared === undefined || adjustedRSquared === undefined) {
      console.error('ERROR: R² values are undefined. Results object:', results);
      vscode.window.showErrorMessage('Error displaying results: missing R² values');
      return;
    }
    if (!Array.isArray(allXCols)) {
      console.error('ERROR: xColumns is not an array. Results object:', results);
      vscode.window.showErrorMessage('Error displaying results: invalid xColumns');
      return;
    }

    // Support both single and multiple columns for backwards compatibility
    const xColumnArray = Array.isArray(xColumns) ? xColumns : [xColumns];

    // Build equation
    let equation = `${yColumn} = ${formatNumber(intercept, 4)}`;
    allXCols.forEach((col: string) => {
      const coef = slopes[col];
      if (coef === undefined) {
        console.error(`ERROR: slope for ${col} is undefined`);
        return;
      }
      const sign = coef >= 0 ? '+' : '';
      equation += ` ${sign} ${formatNumber(coef, 4)} × ${col}`;
    });

    // Build coefficient rows
    let coefficientRows = '';
    allXCols.forEach((col: string) => {
      const coef = slopes[col];
      if (coef === undefined) {
        console.error(`ERROR: slope for ${col} is undefined`);
        return;
      }
      coefficientRows += `
          <div class="metric">
            <span class="metric-label">${col}:</span>
            <span class="metric-value">${formatNumber(coef, 6)}</span>
          </div>`;
    });

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Linear Regression Results</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 20px;
            color: #e0e0e0;
            background-color: #1e1e1e;
          }
          h1 { color: #4ec9b0; margin-top: 0; }
          h2 { color: #4ec9b0; margin-top: 20px; }
          .results-section {
            background-color: #252526;
            border-left: 4px solid #4ec9b0;
            padding: 15px;
            margin: 15px 0;
            border-radius: 4px;
          }
          .metric {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #3e3e42;
          }
          .metric:last-child { border-bottom: none; }
          .metric-label { font-weight: bold; color: #9cdcfe; }
          .metric-value { color: #ce9178; font-family: 'Courier New', monospace; }
          .equation {
            background-color: #1e1e1e;
            padding: 12px;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            font-size: 13px;
            color: #d4d4d4;
            margin: 10px 0;
            word-wrap: break-word;
          }
          .equation-label { color: #9cdcfe; font-size: 12px; margin-bottom: 5px; }
        </style>
      </head>
      <body>
        <h1>📊 Linear Regression Results</h1>
        
        <div class="results-section">
          <div class="equation-label">Regression Equation:</div>
          <div class="equation">${equation}</div>
        </div>

        <div class="results-section">
          <h2 style="margin-top: 0; margin-bottom: 15px; color: #4ec9b0;">Coefficients</h2>
          <div class="metric">
            <span class="metric-label">Intercept:</span>
            <span class="metric-value">${(intercept !== undefined ? formatNumber(intercept, 6) : 'N/A')}</span>
          </div>
          ${coefficientRows}
        </div>

        <div class="results-section">
          <h2 style="margin-top: 0; margin-bottom: 15px; color: #4ec9b0;">Model Statistics</h2>
          <div class="metric">
            <span class="metric-label">R² (Coefficient of Determination):</span>
            <span class="metric-value">${(rSquared !== undefined ? formatNumber(rSquared, 6) : 'N/A')}</span>
          </div>
          <div class="metric">
            <span class="metric-label">Adjusted R²:</span>
            <span class="metric-value">${(adjustedRSquared !== undefined ? formatNumber(adjustedRSquared, 6) : 'N/A')}</span>
          </div>
          <div class="metric">
            <span class="metric-label">Data Points:</span>
            <span class="metric-value">${(predictions && predictions.length) || 'N/A'}</span>
          </div>
          <div class="metric">
            <span class="metric-label">Predictors:</span>
            <span class="metric-value">${allXCols.length}</span>
          </div>
        </div>

        <div class="results-section">
          <h2 style="margin-top: 0; color: #4ec9b0;">Interpretation</h2>
          <p>
            The model explains <strong>${(rSquared !== undefined ? (rSquared * 100).toFixed(4) : 'N/A')}%</strong> of the variance in <strong>${yColumn}</strong>.
          </p>
          <p>
            The adjusted R² of <strong>${(adjustedRSquared !== undefined ? formatNumber(adjustedRSquared, 6) : 'N/A')}</strong> accounts for the number of predictors in the model.
          </p>
        </div>
      </body>
      </html>
    `;

    this._panel.webview.html = html;
    this._panel.reveal(vscode.ViewColumn.Two);
  }

  private _getHtmlForWebview() {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Linear Regression Results</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 20px;
            color: #e0e0e0;
            background-color: #1e1e1e;
            text-align: center;
          }
          h1 { color: #4ec9b0; }
          p { color: #9cdcfe; }
        </style>
      </head>
      <body>
        <h1>📊 Linear Regression</h1>
        <p>Select a CSV file and columns to run linear regression.</p>
      </body>
      </html>
    `;
  }

  public dispose() {
    RegressionResultsPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      this._disposables.pop()?.dispose();
    }
  }
}
