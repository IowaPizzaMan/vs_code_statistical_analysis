import * as fs from 'fs';
import * as stats from 'simple-statistics';

export interface RegressionResult {
    slopes: { [key: string]: number };
    intercept: number;
    rSquared: number;
    adjustedRSquared: number;
    multipleR: number;
    standardError: number;
    predictions: number[];
    xColumns: string[];
    coefficientStats?: {
        [key: string]: {
            coefficient: number;
            standardError: number;
            tStat: number;
            pValue: number;
            ci95Lower: number;
            ci95Upper: number;
        };
    };
}

// Helper function for multivariate linear regression using matrix algebra
function multipleLinearRegression(X: number[][], y: number[]): { intercept: number; slopes: number[] } {
    const n = X.length;
    const p = X[0].length;

    // Create design matrix [1, x1, x2, ..., xp]
    const designMatrix: number[][] = [];
    for (let i = 0; i < n; i++) {
        designMatrix[i] = [1, ...X[i]];
    }

    // Calculate X^T * X
    const XtX: number[][] = [];
    for (let i = 0; i < p + 1; i++) {
        XtX[i] = [];
        for (let j = 0; j < p + 1; j++) {
            let sum = 0;
            for (let k = 0; k < n; k++) {
                sum += designMatrix[k][i] * designMatrix[k][j];
            }
            XtX[i][j] = sum;
        }
    }

    // Calculate X^T * y
    const Xty: number[] = [];
    for (let i = 0; i < p + 1; i++) {
        let sum = 0;
        for (let k = 0; k < n; k++) {
            sum += designMatrix[k][i] * y[k];
        }
        Xty[i] = sum;
    }

    // Solve (X^T * X) * beta = X^T * y using Gaussian elimination
    const beta = gaussianElimination(XtX, Xty);

    return {
        intercept: beta[0],
        slopes: beta.slice(1)
    };
}

// Gaussian elimination for solving Ax = b
function gaussianElimination(A: number[][], b: number[]): number[] {
    const n = A.length;

    // Forward elimination
    for (let i = 0; i < n; i++) {
        // Find pivot
        let maxRow = i;
        for (let k = i + 1; k < n; k++) {
            if (Math.abs(A[k][i]) > Math.abs(A[maxRow][i])) {
                maxRow = k;
            }
        }

        // Swap rows
        [A[i], A[maxRow]] = [A[maxRow], A[i]];
        [b[i], b[maxRow]] = [b[maxRow], b[i]];

        // Make all rows below this one 0 in current column
        for (let k = i + 1; k < n; k++) {
            if (A[i][i] === 0) {
                continue; // Skip if pivot is 0
            }
            const factor = A[k][i] / A[i][i];
            for (let j = i; j < n; j++) {
                A[k][j] -= factor * A[i][j];
            }
            b[k] -= factor * b[i];
        }
    }

    // Back substitution
    const x: number[] = [];
    for (let i = n - 1; i >= 0; i--) {
        if (Math.abs(A[i][i]) < 1e-10) {
            x[i] = 0; // Singular matrix case
            continue;
        }
        x[i] = b[i];
        for (let j = i + 1; j < n; j++) {
            x[i] -= A[i][j] * x[j];
        }
        x[i] /= A[i][i];
    }

    return x;
}

// Function to invert a matrix (needed for standard errors calculation)
function invertMatrix(A: number[][]): number[][] {
    const n = A.length;
    const I = Array(n)
        .fill(null)
        .map((_, i) => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
        I[i][i] = 1;
    }

    // Create augmented matrix [A | I]
    const augmented = A.map((row, i) => [...row, ...I[i]]);

    // Gaussian elimination with partial pivoting
    for (let i = 0; i < n; i++) {
        // Find pivot
        let maxRow = i;
        for (let k = i + 1; k < n; k++) {
            if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
                maxRow = k;
            }
        }

        // Swap rows
        [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];

        // Scale pivot row
        const pivot = augmented[i][i];
        if (Math.abs(pivot) < 1e-10) {
            continue; // Singular matrix
        }
        for (let j = 0; j < 2 * n; j++) {
            augmented[i][j] /= pivot;
        }

        // Eliminate column
        for (let k = 0; k < n; k++) {
            if (k !== i) {
                const factor = augmented[k][i];
                for (let j = 0; j < 2 * n; j++) {
                    augmented[k][j] -= factor * augmented[i][j];
                }
            }
        }
    }

    // Extract inverse from augmented matrix
    return augmented.map(row => row.slice(n));
}

// Regularized incomplete beta function (approximation)
// Used for accurate t-distribution CDF calculation
function regularizedIncompleteBeta(a: number, b: number, x: number): number {
    if (x < 0 || x > 1) {
        return x < 0 ? 0 : 1;
    }
    if (x === 0) {
        return 0;
    }
    if (x === 1) {
        return 1;
    }

    // Use the continued fraction representation for better accuracy
    const epsilon = 1e-12;
    const maxIterations = 100;

    // Compute log(beta(a,b))
    const logBeta =
        (a + b - 1) * Math.log(x) +
        (a - 1) * Math.log(1 - x) +
        (b - 1) * Math.log(x * (1 - x));

    const front = Math.exp(logBeta);

    // Continued fraction
    let f = 1;
    let c = 1;
    let d = 0;

    for (let i = 1; i <= maxIterations; i++) {
        const m = i / 2;
        let numerator;

        if (i === 1) {
            numerator = 1;
        } else if (i % 2 === 0) {
            numerator = (m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m));
        } else {
            numerator = (-(a + m) * (a + b + m) * x) / ((a + 2 * m) * (a + 2 * m + 1));
        }

        d = 1 + numerator * d;
        if (Math.abs(d) < epsilon) {
            d = epsilon;
        }

        c = 1 + numerator / c;
        if (Math.abs(c) < epsilon) {
            c = epsilon;
        }

        d = 1 / d;
        f *= d * c;

        if (Math.abs(d * c - 1) < epsilon) {
            break;
        }
    }

    return front * f / a;
}

// Function to calculate t-statistic CDF for p-value calculation
// Using Student's t-distribution via incomplete beta function
function tDistributionCDF(t: number, df: number): number {
    if (df <= 0) {
        return 0.5;
    }

    // Convert t to probability using the relationship:
    // CDF(t; df) = 0.5 + 0.5 * sign(t) * (1 - I_x(df/2, 0.5))
    // where x = df / (df + t^2)
    const abst = Math.abs(t);
    const x = df / (df + abst * abst);

    // Regularized incomplete beta function I_x(df/2, 0.5)
    const betaValue = regularizedIncompleteBeta(df / 2, 0.5, x);

    // Compute CDF
    if (t >= 0) {
        return 0.5 + 0.5 * (1 - betaValue);
    } else {
        return 0.5 * betaValue;
    }
}

// Calculate p-value from t-statistic and degrees of freedom
function calculatePValue(tStat: number, df: number): number {
    if (df <= 0 || isNaN(tStat)) {
        return 1;
    }
    // Two-tailed test
    const cdf = tDistributionCDF(tStat, df);
    const oneTailed = tStat >= 0 ? 1 - cdf : cdf;
    return Math.min(2 * oneTailed, 1);
}

// Simple lookup table for critical t-values (two-tailed, 95% CI)
// For common degrees of freedom
const tCriticalTable: { [df: number]: number } = {
    1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571,
    6: 2.447, 7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228,
    12: 2.179, 15: 2.131, 20: 2.086, 25: 2.060, 30: 2.042,
    40: 2.021, 60: 2.000, 100: 1.984, 1000: 1.962
};

// Function to get critical t-value from lookup table or by interpolation
function getCriticalTValue(df: number, alpha: number = 0.05): number {
    // For 95% confidence interval (alpha = 0.05), return t-critical two-tailed

    // Check if we have an exact match
    if (tCriticalTable[df]) {
        return tCriticalTable[df];
    }

    // Find surrounding values for interpolation
    const dfValues = Object.keys(tCriticalTable).map(Number).sort((a, b) => a - b);

    // If less than smallest value
    if (df < dfValues[0]) {
        return tCriticalTable[dfValues[0]];
    }

    // If greater than largest value
    if (df > dfValues[dfValues.length - 1]) {
        return tCriticalTable[dfValues[dfValues.length - 1]];
    }

    // Interpolate between surrounding values
    let lower = dfValues[0];
    let upper = dfValues[0];
    for (let i = 0; i < dfValues.length - 1; i++) {
        if (dfValues[i] <= df && df <= dfValues[i + 1]) {
            lower = dfValues[i];
            upper = dfValues[i + 1];
            break;
        }
    }

    if (lower === upper) {
        return tCriticalTable[lower];
    }

    // Linear interpolation
    const ratio = (df - lower) / (upper - lower);
    return tCriticalTable[lower] + ratio * (tCriticalTable[upper] - tCriticalTable[lower]);
}

export async function performLinearRegression(
    filePath: string,
    xColumns: string[],
    yColumn: string,
    dummyVariables?: { [columnName: string]: { [key: string]: number[] } }
): Promise<RegressionResult> {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, 'utf-8', (err, data) => {
            if (err) {
                reject(err);
                return;
            }

            try {
                const { parseCSV } = require('./csvUtils');
                const rows: string[][] = parseCSV(data);
                if (rows.length < 2) {
                    throw new Error('CSV file must have at least 2 rows (header + data)');
                }

                const headers = rows[0].map(h => h.trim());
                const yIndex = headers.indexOf(yColumn);

                if (yIndex === -1) {
                    throw new Error(`Column "${yColumn}" not found in CSV`);
                }

                // Separate actual CSV columns from dummy variable names
                const actualCsvColumns = xColumns.filter(col => headers.includes(col));

                // Extract dummy variable categories for each column
                const dummyCategoryMap: { [colName: string]: string[] } = {};
                const dummyColumnNames: string[] = [];

                if (dummyVariables) {
                    for (const colName in dummyVariables) {
                        // dummyVariables[colName] is { [categoryName]: number[] }
                        const categories = Object.keys(dummyVariables[colName]);
                        dummyCategoryMap[colName] = categories;

                        // Add dummy names (skip first category as reference)
                        for (let i = 1; i < categories.length; i++) {
                            dummyColumnNames.push(`${colName}_${categories[i]}`);
                        }
                    }
                }

                // Validate all actual CSV X columns exist
                const xIndices: { [key: string]: number } = {};
                for (const xCol of actualCsvColumns) {
                    const idx = headers.indexOf(xCol);
                    if (idx === -1) {
                        throw new Error(`Column "${xCol}" not found in CSV`);
                    }
                    xIndices[xCol] = idx;
                }

                // Get indices for dummy variable source columns
                const dummySourceIndices: { [colName: string]: number } = {};
                for (const colName in dummyCategoryMap) {
                    const idx = headers.indexOf(colName);
                    if (idx === -1) {
                        console.warn(`Dummy variable source column "${colName}" not found in CSV`);
                    } else {
                        dummySourceIndices[colName] = idx;
                    }
                }

                // Build regression data: [x1, x2, ..., dummy1, dummy2, ..., y]

                const regressionData: number[][] = [];
                const yValues: number[] = [];

                for (let i = 1; i < rows.length; i++) {
                    const values = rows[i].map(v => v.trim());

                    // Parse Y value
                    const yVal = parseFloat(values[yIndex]);
                    if (isNaN(yVal)) {
                        console.warn(`Row ${i}: Y value "${values[yIndex]}" is not numeric, skipping row`);
                        continue;
                    }

                    const dataRow: number[] = [];
                    let skipRow = false;

                    // Add actual X column values (convert to numeric)
                    for (const xCol of actualCsvColumns) {
                        const xIdx = xIndices[xCol];
                        const xVal = parseFloat(values[xIdx]);
                        if (isNaN(xVal)) {
                            console.warn(`Row ${i}: X value "${values[xIdx]}" in column "${xCol}" is not numeric, skipping row`);
                            skipRow = true;
                            break;
                        }
                        dataRow.push(xVal);
                    }

                    if (skipRow) {
                        continue;
                    }

                    // Add dummy variables as 0/1 values based on category match
                    if (dummyVariables) {
                        for (const colName in dummyCategoryMap) {
                            const categories = dummyCategoryMap[colName];
                            const sourceIdx = dummySourceIndices[colName];

                            if (sourceIdx === undefined) {
                                continue;
                            }

                            const cellValue = values[sourceIdx];

                            // Add dummy for each category except the first (reference)
                            for (let catIdx = 1; catIdx < categories.length; catIdx++) {
                                const isDummy = cellValue === categories[catIdx] ? 1 : 0;
                                dataRow.push(isDummy);
                            }
                        }
                    }

                    regressionData.push(dataRow);
                    yValues.push(yVal);
                }

                if (regressionData.length < 2) {
                    throw new Error('Not enough valid rows with numeric data for regression');
                }

                // Build all X columns in order
                const allXCols = [...actualCsvColumns, ...dummyColumnNames];

                console.log('=== REGRESSION CALCULATION ===');
                console.log('Data loaded:', {
                    rows: regressionData.length,
                    yColumn,
                    xColumns: allXCols,
                    actualCsvColumns,
                    dummyColumnNames
                });
                console.log('Y values sample (first 5):', yValues.slice(0, 5));
                console.log('Regression data sample (first row):', regressionData.length > 0 ? regressionData[0] : 'no data');

                // Calculate multivariate regression using matrix algebra
                const regression = multipleLinearRegression(regressionData, yValues);

                console.log('Regression result:', {
                    intercept: regression.intercept,
                    slopes: regression.slopes
                });

                // Extract coefficients
                const slopes: { [key: string]: number } = {};
                for (let i = 0; i < allXCols.length; i++) {
                    slopes[allXCols[i]] = regression.slopes[i];
                }
                console.log('Slopes:', slopes);

                const intercept = regression.intercept;
                console.log('Intercept:', intercept, 'type:', typeof intercept);

                // Calculate predictions
                const predictions = regressionData.map(row => {
                    let pred = intercept;
                    for (let i = 0; i < row.length; i++) {
                        pred += slopes[allXCols[i]] * row[i];
                    }
                    return pred;
                });
                console.log('Predictions sample (first 5):', predictions.slice(0, 5));

                // Calculate R² and Adjusted R²
                const yMean = stats.mean(yValues);
                console.log('Y mean:', yMean);

                const ssTotal = yValues.reduce((sum, y) => sum + Math.pow(y - yMean, 2), 0);
                console.log('SS Total:', ssTotal);

                const ssResidual = yValues.reduce(
                    (sum, y, idx) => sum + Math.pow(y - predictions[idx], 2),
                    0
                );
                console.log('SS Residual:', ssResidual);

                // Handle edge case where all y values are identical
                let rSquared = ssTotal === 0 ? 0 : 1 - ssResidual / ssTotal;
                console.log('R² (before NaN check):', rSquared, 'type:', typeof rSquared);

                const n = yValues.length;
                const p = allXCols.length;
                console.log('Sample size (n):', n, 'Parameters (p):', p);

                // Ensure valid adjusted R² calculation
                let adjustedRSquared = rSquared;
                if (n > p + 1) {
                    adjustedRSquared = 1 - (1 - rSquared) * ((n - 1) / (n - p - 1));
                    console.log('Adjusted R² calculated:', adjustedRSquared);
                } else {
                    console.log('Adjusted R² skipped (n <= p+1)');
                }
                console.log('Adjusted R² (before NaN check):', adjustedRSquared, 'type:', typeof adjustedRSquared);

                // Validate no NaN values
                if (isNaN(rSquared)) {
                    console.error('NaN detected in rSquared calculation', {
                        ssTotal,
                        ssResidual,
                        yMean,
                        yValues: yValues.slice(0, 5),
                        predictions: predictions.slice(0, 5)
                    });
                    rSquared = 0;
                }

                if (isNaN(adjustedRSquared)) {
                    console.error('NaN detected in adjustedRSquared calculation', {
                        rSquared,
                        n,
                        p
                    });
                    adjustedRSquared = 0;
                }

                // Calculate Multiple R (correlation coefficient)
                const multipleR = Math.sqrt(Math.abs(rSquared)); // abs() handles floating-point rounding
                console.log('Multiple R:', multipleR);

                // Calculate Standard Error (residual standard error)
                // SE = sqrt(SS_Residual / (n - p - 1))
                let standardError = 0;
                if (n > p + 1) {
                    const meanSquaredError = ssResidual / (n - p - 1);
                    standardError = Math.sqrt(meanSquaredError);
                } else {
                    standardError = 0; // undefined for small samples
                }
                console.log('Standard Error:', standardError);

                // Calculate coefficient standard errors using variance-covariance matrix
                const coefficientStats: {
                    [key: string]: {
                        coefficient: number;
                        standardError: number;
                        tStat: number;
                        pValue: number;
                        ci95Lower: number;
                        ci95Upper: number;
                    };
                } = {};

                try {
                    // Build X matrix with intercept column
                    const X: number[][] = regressionData.map(row => [1, ...row]);

                    // Calculate (X'X)^-1
                    const XtX: number[][] = Array(X[0].length)
                        .fill(null)
                        .map(() => Array(X[0].length).fill(0));
                    for (let i = 0; i < X[0].length; i++) {
                        for (let j = 0; j < X[0].length; j++) {
                            for (let k = 0; k < X.length; k++) {
                                XtX[i][j] += X[k][i] * X[k][j];
                            }
                        }
                    }

                    // Invert (X'X) to get variance-covariance matrix
                    const XtXInv = invertMatrix(XtX);

                    // Mean squared error (MSE = SS_Residual / (n - p - 1))
                    const mse = n > p + 1 ? ssResidual / (n - p - 1) : ssResidual / (n - 1);

                    // Get critical t-value for 95% confidence interval
                    const df = n - p - 1;
                    const tCritical = getCriticalTValue(df, 0.05);

                    // Calculate standard errors for coefficients
                    // For intercept (index 0)
                    let interceptSE = Math.sqrt(mse * XtXInv[0][0]);
                    let interceptTStat = interceptSE > 0 ? intercept / interceptSE : 0;
                    let interceptPValue = calculatePValue(interceptTStat, df);
                    let interceptCI95Lower = intercept - tCritical * interceptSE;
                    let interceptCI95Upper = intercept + tCritical * interceptSE;

                    coefficientStats['Intercept'] = {
                        coefficient: intercept,
                        standardError: interceptSE,
                        tStat: interceptTStat,
                        pValue: interceptPValue,
                        ci95Lower: interceptCI95Lower,
                        ci95Upper: interceptCI95Upper
                    };

                    // For slopes (indices 1 to p)
                    for (let i = 0; i < allXCols.length; i++) {
                        const colName = allXCols[i];
                        const coef = regression.slopes[i];
                        const se = Math.sqrt(mse * XtXInv[i + 1][i + 1]);
                        const tStat = se > 0 ? coef / se : 0;
                        const pValue = calculatePValue(tStat, df);
                        const ci95Lower = coef - tCritical * se;
                        const ci95Upper = coef + tCritical * se;

                        coefficientStats[colName] = {
                            coefficient: coef,
                            standardError: se,
                            tStat: tStat,
                            pValue: pValue,
                            ci95Lower: ci95Lower,
                            ci95Upper: ci95Upper
                        };
                    }

                    console.log('Coefficient stats calculated:', coefficientStats);
                } catch (e) {
                    console.warn('Error calculating coefficient statistics:', e);
                    // Still return results even if coefficient stats fail
                }

                console.log('Final result:', {
                    rSquared,
                    adjustedRSquared,
                    multipleR,
                    standardError,
                    intercept,
                    slopesCount: Object.keys(slopes).length
                });

                resolve({
                    slopes,
                    intercept,
                    rSquared,
                    adjustedRSquared,
                    multipleR,
                    standardError,
                    predictions,
                    xColumns: allXCols,
                    coefficientStats
                });
            } catch (err) {
                reject(err);
            }
        });
    });
}
