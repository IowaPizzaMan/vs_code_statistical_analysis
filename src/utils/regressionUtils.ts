import * as fs from 'fs';
import * as stats from 'simple-statistics';

export interface RegressionResult {
    slopes: { [key: string]: number };
    intercept: number;
    rSquared: number;
    adjustedRSquared: number;
    predictions: number[];
    xColumns: string[];
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
                const lines = data.split('\n').filter(line => line.trim());
                if (lines.length < 2) {
                    throw new Error('CSV file must have at least 2 rows (header + data)');
                }

                const headers = lines[0].split(',').map(h => h.trim());
                const yIndex = headers.indexOf(yColumn);

                if (yIndex === -1) {
                    throw new Error(`Column "${yColumn}" not found in CSV`);
                }

                // Validate all X columns exist
                const xIndices: { [key: string]: number } = {};
                for (const xCol of xColumns) {
                    const idx = headers.indexOf(xCol);
                    if (idx === -1) {
                        throw new Error(`Column "${xCol}" not found in CSV`);
                    }
                    xIndices[xCol] = idx;
                }

                // Parse data and apply dummy variables if provided
                const yValues: number[] = [];
                const xMatrix: number[][] = [];

                for (let i = 1; i < lines.length; i++) {
                    const values = lines[i].split(',').map(v => v.trim());
                    const y = parseFloat(values[yIndex]);

                    if (isNaN(y)) {
                        continue;
                    }

                    const row: number[] = [];
                    let skipRow = false;

                    // Add original X columns
                    for (const xCol of xColumns) {
                        const xIdx = xIndices[xCol];
                        const x = parseFloat(values[xIdx]);
                        if (isNaN(x)) {
                            skipRow = true;
                            break;
                        }
                        row.push(x);
                    }

                    if (skipRow) {
                        continue;
                    }

                    // Add dummy variables if provided
                    if (dummyVariables) {
                        for (const colName in dummyVariables) {
                            for (const dummyName in dummyVariables[colName]) {
                                row.push(dummyVariables[colName][dummyName][yValues.length]);
                            }
                        }
                    }

                    yValues.push(y);
                    xMatrix.push(row);
                }

                if (xMatrix.length < xColumns.length + 2) {
                    throw new Error('Not enough valid data points for regression');
                }

                // Use simple-statistics for multivariate regression
                const regressionPoints = xMatrix.map((row, i) => [...row, yValues[i]]);
                const regression = stats.linearRegression(regressionPoints as any);

                // Extract coefficients
                const slopes: { [key: string]: number } = {};
                const allXCols = [...xColumns];
                if (dummyVariables) {
                    for (const colName in dummyVariables) {
                        for (const dummyName in dummyVariables[colName]) {
                            allXCols.push(dummyName);
                        }
                    }
                }

                for (let i = 0; i < allXCols.length; i++) {
                    slopes[allXCols[i]] = (regression.m as any)[i];
                }

                const intercept = regression.b;

                // Calculate predictions
                const predictions = xMatrix.map(row => {
                    let pred = intercept;
                    row.forEach((x, i) => {
                        pred += slopes[allXCols[i]] * x;
                    });
                    return pred;
                });

                // Calculate R² and Adjusted R²
                const yMean = stats.mean(yValues);
                const ssTotal = yValues.reduce((sum, y) => sum + Math.pow(y - yMean, 2), 0);
                const ssResidual = yValues.reduce(
                    (sum, y, i) => sum + Math.pow(y - predictions[i], 2),
                    0
                );

                // Handle edge case where all y values are identical
                const rSquared = ssTotal === 0 ? 0 : 1 - ssResidual / ssTotal;
                const n = yValues.length;
                const p = allXCols.length;

                // Ensure valid adjusted R² calculation
                let adjustedRSquared = 0;
                if (n > p + 1) {
                    adjustedRSquared = 1 - (1 - rSquared) * ((n - 1) / (n - p - 1));
                } else {
                    adjustedRSquared = rSquared; // Not enough data for meaningful adjusted R²
                }

                resolve({
                    slopes,
                    intercept,
                    rSquared,
                    adjustedRSquared,
                    predictions,
                    xColumns: allXCols
                });
            } catch (err) {
                reject(err);
            }
        });
    });
}
