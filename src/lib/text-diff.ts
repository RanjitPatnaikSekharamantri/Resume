/**
 * Minimal word-level diff for highlighting changes between two texts.
 * Uses a longest-common-subsequence approach on word arrays.
 */

export type DiffSpan =
  | { type: "equal"; text: string }
  | { type: "added"; text: string }
  | { type: "removed"; text: string };

export function computeWordDiff(original: string, modified: string): DiffSpan[] {
  const origWords = tokenize(original);
  const modWords = tokenize(modified);

  const lcs = longestCommonSubsequence(origWords, modWords);
  const result: DiffSpan[] = [];

  let oi = 0;
  let mi = 0;
  let li = 0;

  while (oi < origWords.length || mi < modWords.length) {
    if (li < lcs.length && oi < origWords.length && mi < modWords.length && origWords[oi] === lcs[li] && modWords[mi] === lcs[li]) {
      pushSpan(result, "equal", origWords[oi]);
      oi++;
      mi++;
      li++;
    } else if (li < lcs.length && mi < modWords.length && modWords[mi] === lcs[li]) {
      pushSpan(result, "removed", origWords[oi]);
      oi++;
    } else if (li < lcs.length && oi < origWords.length && origWords[oi] === lcs[li]) {
      pushSpan(result, "added", modWords[mi]);
      mi++;
    } else {
      if (oi < origWords.length && (li >= lcs.length || origWords[oi] !== lcs[li])) {
        pushSpan(result, "removed", origWords[oi]);
        oi++;
      }
      if (mi < modWords.length && (li >= lcs.length || modWords[mi] !== lcs[li])) {
        pushSpan(result, "added", modWords[mi]);
        mi++;
      }
    }
  }

  return mergeSpans(result);
}

function tokenize(text: string): string[] {
  return text.split(/(\s+)/).filter(Boolean);
}

function pushSpan(spans: DiffSpan[], type: DiffSpan["type"], text: string) {
  const last = spans[spans.length - 1];
  if (last && last.type === type) {
    last.text += text;
  } else {
    spans.push({ type, text });
  }
}

function mergeSpans(spans: DiffSpan[]): DiffSpan[] {
  return spans;
}

function longestCommonSubsequence(a: string[], b: string[]): string[] {
  // Optimized for typical resume sizes (< 2000 words)
  const m = a.length;
  const n = b.length;

  if (m === 0 || n === 0) return [];

  // Use two rows instead of full matrix for memory efficiency
  let prev = new Array(n + 1).fill(0);
  let curr = new Array(n + 1).fill(0);

  // Build lengths
  const dp: number[][] = [];
  for (let i = 0; i <= m; i++) {
    dp[i] = new Array(n + 1).fill(0);
  }
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack
  const result: string[] = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      result.unshift(a[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return result;
}
