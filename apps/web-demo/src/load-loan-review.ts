/**
 * Thin Loan Review wrapper around {@link loadWorkspaceMain}.
 * Prefer the generic loader for new call sites.
 */

import {
  LOAN_REVIEW_WORKSPACE,
  type DataAdapter,
} from "@gridyard/workspace-runtime";

import {
  loadWorkspaceMain,
  type LoadWorkspaceOptions,
  type LoadWorkspaceResult,
} from "./load-workspace.js";

export type LoadLoanReviewResult = LoadWorkspaceResult;

export type LoadLoanReviewOptions = LoadWorkspaceOptions;

/**
 * Parse the loan-review fixture and fetch/bind its main data source.
 */
export async function loadLoanReviewMain(
  options: LoadLoanReviewOptions = {},
): Promise<LoadLoanReviewResult> {
  return loadWorkspaceMain(LOAN_REVIEW_WORKSPACE, options);
}

/** Re-export for tests that inject adapters. */
export type { DataAdapter };
