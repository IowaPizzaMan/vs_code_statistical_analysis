# VS Code Statistical Analysis Extension

VS Code Extension for performing statistical analysis on CSV files, specifically linear regression analysis with support for multiple predictors and dummy variables.

## Features

- **CSV File Discovery**: Browse and select CSV files from your workspace
- **Linear Regression Analysis**: Perform single and multivariate linear regression
- **Multiple Predictors**: Select multiple independent variables (X columns) for regression
- **Dummy Variables**: Automatically create dummy variables from categorical columns
- **Results Visualization**: View regression results in a dedicated webview panel with:
  - Regression equation
  - Coefficients for all predictors
  - R² and Adjusted R² statistics
  - Model interpretation
- **Model Configuration Display**: Real-time view of selected X and Y columns
- **Regression History**: Track up to 50 previous regressions with the ability to restore models
- **Interactive Sidebar**: Manage analysis workflow through tree views in the sidebar

## Requirements

- VS Code 1.106.0 or higher
- Node.js 18+ (for development)

## How to Use

1. Open a CSV file in your workspace
2. Click the "Run Linear Regression" view in the sidebar
3. Select your CSV file
4. Choose columns:
   - X (Independent) variables - select one or more
   - Y (Dependent) variable - select one
   - Optionally create dummy variables from categorical columns
5. Run the regression to see results

## Extension Settings

None currently. Future versions may add configuration options.

## Known Issues

See FIX_SUMMARY.md for details on bug fixes and improvements.

## Release Notes

### 0.1.0

Initial release with core functionality:
- Linear regression with multiple predictors
- Dummy variable creation
- Model history tracking
- Results visualization
