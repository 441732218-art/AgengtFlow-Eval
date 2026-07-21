/* (c) 2026 AgentFlow-Eval — Experiment comparison API client (Phase 2) */

import { apiClient } from "../client";

export interface ExperimentSuiteCase {
  user_query: string;
  expected_output?: string;
  expected_tools?: string[];
}

export interface ExperimentVariant {
  label: string;
  agent_config?: Record<string, unknown>;
}

export interface ExperimentCreate {
  name: string;
  description?: string;
  base_task_id?: string | null;
  suites?: ExperimentSuiteCase[];
  variants: ExperimentVariant[];
  auto_execute?: boolean;
}

export interface ExperimentRun {
  id: string;
  experiment_id: string;
  task_id: string;
  label: string;
  agent_config: Record<string, unknown>;
  task_status?: string | null;
  created_at?: string | null;
}

export interface Experiment {
  id: string;
  name: string;
  description: string;
  base_task_id?: string | null;
  suite_count: number;
  created_by: string;
  created_at?: string | null;
  updated_at?: string | null;
  runs: ExperimentRun[];
}

export interface ExperimentListResponse {
  items: Experiment[];
  total: number;
  page: number;
  page_size: number;
}

/** Fields returned by GET /experiments/{id}/compare */
export interface RunCompareItem {
  label: string;
  task_id: string;
  task_status: string;
  average_score: number;
  dimension_scores: Record<string, number>;
  total_tokens: number;
  total_time_ms: number;
  suite_count: number;
  scored_traces: number;
}

export interface ExperimentCompareResponse {
  experiment_id: string;
  name: string;
  suite_count: number;
  runs: RunCompareItem[];
  best_label: string | null;
  delta_vs_best: Record<string, number>;
}

export const experimentsApi = {
  list: (params?: { page?: number; page_size?: number }) =>
    apiClient
      .get<ExperimentListResponse>("/experiments", { params })
      .then((r) => r.data),

  get: (id: string) =>
    apiClient.get<Experiment>(`/experiments/${id}`).then((r) => r.data),

  create: (body: ExperimentCreate) =>
    apiClient.post<Experiment>("/experiments", body).then((r) => r.data),

  compare: (id: string) =>
    apiClient
      .get<ExperimentCompareResponse>(`/experiments/${id}/compare`)
      .then((r) => r.data),
};
