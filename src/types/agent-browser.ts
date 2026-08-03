// Agent Browser types — autonomous browsing for AI agents with governance

export type BrowserActionType =
  | 'navigate'
  | 'click'
  | 'fill_form'
  | 'submit_form'
  | 'extract_data'
  | 'take_screenshot'
  | 'wait_for_element'
  | 'scroll'
  | 'get_page_title'
  | 'get_text_content'
  | 'evaluate_script';

export type BrowserSessionStatus =
  | 'pending'
  | 'initializing'
  | 'active'
  | 'completed'
  | 'failed'
  | 'blocked';

export type BrowserActionStatus = 'success' | 'failed' | 'blocked' | 'timeout';

export interface BrowserAction {
  type: BrowserActionType;
  target?: string;
  value?: string;
  timeout_ms?: number;
}

export interface BrowserActionResult {
  action_type: BrowserActionType;
  status: BrowserActionStatus;
  duration_ms?: number;
  screenshot_hash?: string;
  page_state?: {
    url: string;
    title: string;
    text_preview?: string;
  };
  extracted_data?: unknown;
  error_message?: string;
  error_code?: string;
}

export interface AgentBrowserRequest {
  tenant_id: string;
  agent_id: string;
  agent_run_id?: string;
  initial_url: string;
  actions: BrowserAction[];
  policy_override?: boolean;
}

export interface AgentBrowserResponse {
  session_id: string;
  status: 'success' | 'failed' | 'blocked' | 'partial';
  initial_url: string;
  final_url?: string;
  actions_completed: number;
  actions_blocked: number;
  total_duration_ms: number;
  evidence_items: number;
  results: BrowserActionResult[];
  policy_check?: {
    passed: boolean;
    reason?: string;
  };
}

export interface AgentBrowserSession {
  id: string;
  tenant_id: string;
  agent_id: string;
  agent_run_id?: string;
  session_key: string;
  status: BrowserSessionStatus;
  initial_url: string;
  current_url?: string;
  policy_check_passed?: boolean;
  policy_violation_reason?: string;
  action_count: number;
  blocked_actions: number;
  screenshot_count: number;
  duration_ms?: number;
  started_at: string;
  completed_at?: string;
  error_message?: string;
  error_code?: string;
  evidence_items: number;
  metadata?: Record<string, unknown>;
}

export interface AgentBrowserActionRow {
  id: string;
  session_id: string;
  action_type: BrowserActionType;
  action_target?: string;
  action_value?: string;
  status: BrowserActionStatus;
  executed_at: string;
  duration_ms?: number;
  screenshot_hash?: string;
  page_state?: {
    url: string;
    title: string;
    text_content_preview?: string;
  };
  extracted_data?: unknown;
  policy_check_passed?: boolean;
  policy_reason?: string;
  error_message?: string;
  error_code?: string;
}

export interface AgentBrowserPolicy {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  enabled: boolean;
  applies_to_agents: string[];
  allowed_domains: string[];
  blocked_domains: string[];
  allow_subdomains: boolean;
  allowed_actions: BrowserActionType[];
  blocked_actions: BrowserActionType[];
  require_approval: boolean;
  screenshot_every_action: boolean;
  capture_har: boolean;
  max_concurrent_sessions: number;
  max_session_duration_seconds: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface AgentBrowserSessionWithContext extends AgentBrowserSession {
  policy_name?: string;
  require_approval?: boolean;
  total_blocked_actions?: number;
}
