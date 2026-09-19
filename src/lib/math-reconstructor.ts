/**
 * Mathematical Formula Reconstruction & Symbol Extraction Engine
 *
 * Responsibilities:
 * 1. Reconstruct multi-line broken PDF formula extractions into clean mathematical representations.
 * 2. Parse and explain mathematical formulas term-by-term.
 * 3. Extract and explain variables, symbols, and parameters (e.g. sigma, ci, xq, wi, k).
 * 4. Format math cleanly for web typography (inline code, standard LaTeX-like math, superscripts, subscripts).
 */

export interface FormulaComponent {
  term: string;
  name: string;
  explanation: string;
}

export interface ReconstructedFormula {
  rawFormula: string;
  cleanFormula: string;
  latexFormula: string;
  components: FormulaComponent[];
}

/**
 * Clean and reconstruct multi-line PDF text fragments into clean mathematical expressions.
 */
export function reconstructPdfMath(text: string): string {
  if (!text) return "";

  let cleaned = text;

  // 1. Reconstruct broken square root symbols: v\nu\nu\tt or v u u t
  cleaned = cleaned.replace(/v\s*u\s*u\s*t\s*/gi, "sqrt(");

  // 2. Reconstruct broken summation symbols: e.g., "m\tX\ni=1" or "k\tX\ni=1" or "n\tX\nk=1"
  cleaned = cleaned.replace(/([a-z0-9]+)\s*\t?\s*X\s*\n?\s*([a-z0-9]+)\s*=\s*([0-9]+)/gi, "sum_{$2=$3}^$1 ");
  cleaned = cleaned.replace(/X\s*\n?\s*([a-z0-9]+)\s*=\s*([0-9]+)/gi, "sum_{$1=$2} ");

  // 3. Reconstruct broken fractions like "1\nk" or "1 / k"
  cleaned = cleaned.replace(/1\s*\n\s*([a-z0-9]+)/gi, "(1 / $1)");

  // 4. Reconstruct hat notation "ˆ f (xq)" -> "\hat{f}(xq)"
  cleaned = cleaned.replace(/ˆ\s*f\s*\(\s*([a-z0-9_]+)\s*\)/gi, "f_hat($1)");

  // 5. Reconstruct broken RBF exponential term:
  // wi exp\n\n−||x − ci||2\n2σ2
  cleaned = cleaned.replace(
    /wi\s+exp\s*\n*\s*[−\-]\s*\|\|\s*x\s*[−\-]\s*ci\s*\|\|\s*2\s*\n*\s*2\s*σ\s*2/gi,
    "wi * exp( - ||x - ci||^2 / (2 * sigma^2) )"
  );
  cleaned = cleaned.replace(
    /[−\-]\s*\|\|\s*x\s*[−\-]\s*ci\s*\|\|\s*2\s*\n*\s*2\s*σ\s*2/gi,
    "- ||x - ci||^2 / (2 * sigma^2)"
  );

  // 6. Reconstruct LWR distance-weighted exponential term:
  // wi = e− d(xq ,xi)2\n2σ2
  cleaned = cleaned.replace(
    /wi\s*=\s*e\s*[−\-]\s*d\s*\(\s*xq\s*,\s*xi\s*\)\s*2\s*\n*\s*2\s*σ\s*2/gi,
    "wi = exp( - d(xq, xi)^2 / (2 * sigma^2) )"
  );

  // 7. Reconstruct Euclidean distance:
  // d(xi, xj ) = sqrt( sum_{k=1}^n (xik − xjk)2 )
  cleaned = cleaned.replace(
    /d\s*\(\s*xi\s*,\s*xj\s*\)\s*=\s*sqrt\(\s*sum_\{k=1\}\^n\s*\(xik\s*[−\-]\s*xjk\)\s*2/gi,
    "d(xi, xj) = sqrt( sum_{k=1}^n (xik - xjk)^2 )"
  );

  // 8. Reconstruct Manhattan distance:
  // d(xi, xj ) = sum_{k=1}^n |xik − xjk|
  cleaned = cleaned.replace(
    /d\s*\(\s*xi\s*,\s*xj\s*\)\s*=\s*sum_\{k=1\}\^n\s*\|xik\s*[−\-]\s*xjk\|/gi,
    "d(xi, xj) = sum_{k=1}^n |xik - xjk|"
  );

  // 9. Reconstruct numeric k-NN average:
  // f (xq) = 1/k * sum_{i=1}^k f(xi)
  cleaned = cleaned.replace(
    /f\s*\(\s*xq\s*\)\s*=\s*\(?1\s*\/\s*k\)?\s*sum_\{i=1\}\^k\s*f\s*\(\s*xi\s*\)/gi,
    "f(xq) = (1/k) * sum_{i=1}^k f(xi)"
  );

  return cleaned;
}

/**
 * Specific term-by-term breakdown for Radial Basis Functions (RBF).
 */
export function getRbfFormulaBreakdown(): ReconstructedFormula {
  return {
    rawFormula: "f(x) = sum_{i=1}^m wi exp( - ||x - ci||^2 / (2 * sigma^2) )",
    cleanFormula: "f(x) = sum_{i=1}^m wi * exp( - ||x - ci||^2 / (2 * sigma^2) )",
    latexFormula: "f(x) = \\sum_{i=1}^m w_i \\exp\\left(-\\frac{\\|x - c_i\\|^2}{2\\sigma^2}\\right)",
    components: [
      {
        term: "f(x)",
        name: "Target / Approximated Function",
        explanation: "The global function being estimated for an arbitrary input instance x across the feature space.",
      },
      {
        term: "sum_{i=1}^m",
        name: "Linear Combination Sum",
        explanation: "Summation over all m radial basis kernel functions in the network, combining their local outputs into a final prediction.",
      },
      {
        term: "wi",
        name: "Kernel Weight (Linear Coefficient)",
        explanation: "The weight coefficient assigned to the i-th radial basis function, determining how strongly this basis function influences the final output.",
      },
      {
        term: "exp( ... )",
        name: "Gaussian Radial Kernel Activation",
        explanation: "A radially symmetric Gaussian bell curve function whose output is maximum (equal to 1) when x is at the center ci, and decays rapidly towards 0 as x moves away.",
      },
      {
        term: "||x - ci||^2",
        name: "Squared Euclidean Distance from Center",
        explanation: "The squared geometric distance between input instance x and the kernel center ci, measuring proximity in feature space.",
      },
      {
        term: "ci",
        name: "Basis Function Center",
        explanation: "The center location of the i-th radial basis function in feature space. Input points close to ci cause high activation for this specific kernel.",
      },
      {
        term: "sigma (σ)",
        name: "Width / Spread Parameter",
        explanation: "Controls the width or spread of the Gaussian radial basis function. A larger sigma produces broader, smoother activations, while a smaller sigma creates tight, localized peaks.",
      },
      {
        term: "2 * sigma^2",
        name: "Scaling Variance Denominator",
        explanation: "Normalizes the squared distance, defining how rapidly the Gaussian activation decays with distance from the center ci.",
      },
    ],
  };
}

/**
 * Specific term-by-term breakdown for Locally Weighted Regression (LWR).
 */
export function getLwrFormulaBreakdown(): ReconstructedFormula {
  return {
    rawFormula: "f_hat(xq) = sum_{i=1}^m wi * f(xi) where wi = exp( - d(xq, xi)^2 / (2 * sigma^2) )",
    cleanFormula: "f_hat(xq) = sum_{i=1}^m wi * f(xi),  wi = exp( - d(xq, xi)^2 / (2 * sigma^2) )",
    latexFormula: "\\hat{f}(x_q) = \\sum_{i=1}^m w_i f(x_i), \\quad w_i = \\exp\\left(-\\frac{d(x_q, x_i)^2}{2\\sigma^2}\\right)",
    components: [
      {
        term: "f_hat(xq)",
        name: "Predicted Query Target Value",
        explanation: "The estimated output value for the new query point xq, computed on-demand as a locally weighted average.",
      },
      {
        term: "sum_{i=1}^m wi * f(xi)",
        name: "Weighted Sum of Stored Instances",
        explanation: "Combines the known target values f(xi) of stored training examples, scaled by their proximity weights wi.",
      },
      {
        term: "wi",
        name: "Distance-Based Neighbor Weight",
        explanation: "Weight assigned to training instance xi. Closer training points receive higher weights, while distant points have near-zero influence.",
      },
      {
        term: "d(xq, xi)^2",
        name: "Squared Distance to Query Point",
        explanation: "The squared distance between query instance xq and stored instance xi using Euclidean or Manhattan distance.",
      },
      {
        term: "sigma (σ)",
        name: "Kernel Bandwidth / Width Parameter",
        explanation: "Controls the effective neighborhood size around xq. Smaller sigma restricts influence to immediate neighbors, while larger sigma incorporates wider surrounding points.",
      },
    ],
  };
}

/**
 * Term-by-term breakdown for Distance Metrics (Euclidean & Manhattan).
 */
export function getDistanceMetricBreakdowns(): { euclidean: ReconstructedFormula; manhattan: ReconstructedFormula } {
  return {
    euclidean: {
      rawFormula: "d(xi, xj) = sqrt( sum_{k=1}^n (xik - xjk)^2 )",
      cleanFormula: "d(xi, xj) = sqrt( sum_{k=1}^n (xik - xjk)^2 )",
      latexFormula: "d(x_i, x_j) = \\sqrt{\\sum_{k=1}^n (x_{ik} - x_{jk})^2}",
      components: [
        {
          term: "d(xi, xj)",
          name: "Euclidean Distance",
          explanation: "Straight-line geometric L2 distance between instance xi and instance xj.",
        },
        {
          term: "n",
          name: "Number of Feature Dimensions",
          explanation: "Total number of attributes or coordinate dimensions describing each instance.",
        },
        {
          term: "xik - xjk",
          name: "Coordinate Difference",
          explanation: "Difference between xi and xj along the k-th feature dimension.",
        },
        {
          term: "(xik - xjk)^2",
          name: "Squared Difference",
          explanation: "Squares each difference so negative values become positive and larger discrepancies are penalized more heavily.",
        },
        {
          term: "sqrt( ... )",
          name: "Square Root Operator",
          explanation: "Takes square root of the total sum of squared differences to return to original measurement units.",
        },
      ],
    },
    manhattan: {
      rawFormula: "d(xi, xj) = sum_{k=1}^n |xik - xjk|",
      cleanFormula: "d(xi, xj) = sum_{k=1}^n |xik - xjk|",
      latexFormula: "d(x_i, x_j) = \\sum_{k=1}^n |x_{ik} - x_{jk}|",
      components: [
        {
          term: "d(xi, xj)",
          name: "Manhattan Distance (City Block / L1)",
          explanation: "Grid-based distance measured as the sum of absolute differences along each feature axis.",
        },
        {
          term: "|xik - xjk|",
          name: "Absolute Coordinate Difference",
          explanation: "Absolute magnitude of difference along feature dimension k, treating discrepancies across all dimensions linearly.",
        },
      ],
    },
  };
}
