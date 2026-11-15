// Platform Intelligence Agent — Policies & Configuration
// Zentrale Policy-Engine für Multi-Agent-Orchestration

export interface AgentPolicy {
  schedule: SchedulePolicy;
  autonomy: AutonomyPolicy;
  restrictions: RestrictionPolicy;
  notifications: NotificationPolicy;
  scope: ScopePolicy;
  analysis: AnalysisPolicy;
  thresholds: ThresholdPolicy;
  reporting: ReportingPolicy;
}

export interface SchedulePolicy {
  // Daily at 06:00 UTC + on every push to main
  daily_utc_hour: 6;
  trigger_on_push: boolean;
  timezone: "UTC";
}

export interface AutonomyPolicy {
  // Auto-apply for text/labels/docs
  auto_fix_enabled: {
    text_and_docs: boolean;       // true
    button_labels: boolean;        // true
    accessibility_metadata: boolean; // true
  };
  // Manual review required for
  manual_review_required: {
    stripe_changes: boolean;       // true
    database_changes: boolean;     // true
    auth_changes: boolean;         // true
    policy_changes: boolean;       // true
  };
}

export interface RestrictionPolicy {
  never_auto_apply: string[]; // ["stripe/*", "supabase/*", "auth/*"]
  require_human_review: string[]; // ["src/config/*", "src/services/auth/*"]
  prohibited_actions: string[]; // ["database migration", "delete", "reset"]
}

export interface NotificationPolicy {
  slack_channel: "#platform-evolution";
  slack_mention_on_critical: ["@platform-lead"];
  github_issue_creation: boolean; // true
  github_issue_labels: string[]; // ["platform-intelligence", "auto-generated"]
  notify_on_severity: "critical" | "high" | "medium";
}

export interface ScopePolicy {
  analyze_repositories: ["realsyncdynamics-spec/RealSyncDynamics.AI"];
  analyze_directories: [
    "src/pages/",
    "src/components/",
    "src/config/",
    "src/services/",
    "supabase/functions/"
  ];
  exclude_directories: [
    ".archive/",
    "node_modules/",
    "dist/",
    ".git/"
  ];
}

export interface AnalysisPolicy {
  checks: {
    ux_optimization: AnalysisCheck;
    customer_journey: AnalysisCheck;
    dashboard_evolution: AnalysisCheck;
    routing_quality: AnalysisCheck;
    stripe_business: AnalysisCheck;
  };
}

export interface AnalysisCheck {
  enabled: boolean;
  priority: "critical" | "high" | "medium" | "low";
  auto_fix: boolean;
}

export interface ThresholdPolicy {
  critical_threshold: 90;  // 90+ severity points
  high_threshold: 70;      // 70-89 severity points
  medium_threshold: 50;    // 50-69 severity points
  low_threshold: 0;        // < 50 severity points

  wcag_aa_required: boolean; // true
  color_contrast_ratio_min: 4.5; // AA standard
}

export interface ReportingPolicy {
  findings_format: "github_issues" | "slack_messages" | "both";
  include_recommendations: boolean;
  include_auto_fixes: boolean;
  deduplication_enabled: boolean;
  sort_by_severity: boolean;
}

// Default Policy Instance
export const DEFAULT_AGENT_POLICY: AgentPolicy = {
  schedule: {
    daily_utc_hour: 6,
    trigger_on_push: true,
    timezone: "UTC"
  },
  autonomy: {
    auto_fix_enabled: {
      text_and_docs: true,
      button_labels: true,
      accessibility_metadata: true
    },
    manual_review_required: {
      stripe_changes: true,
      database_changes: true,
      auth_changes: true,
      policy_changes: true
    }
  },
  restrictions: {
    never_auto_apply: ["stripe/*", "supabase/*", "auth/*"],
    require_human_review: ["src/config/*", "src/services/auth/*"],
    prohibited_actions: ["database migration", "delete", "reset"]
  },
  notifications: {
    slack_channel: "#platform-evolution",
    slack_mention_on_critical: ["@platform-lead"],
    github_issue_creation: true,
    github_issue_labels: ["platform-intelligence", "auto-generated"],
    notify_on_severity: "critical"
  },
  scope: {
    analyze_repositories: ["realsyncdynamics-spec/RealSyncDynamics.AI"],
    analyze_directories: [
      "src/pages/",
      "src/components/",
      "src/config/",
      "src/services/",
      "supabase/functions/"
    ],
    exclude_directories: [
      ".archive/",
      "node_modules/",
      "dist/",
      ".git/"
    ]
  },
  analysis: {
    checks: {
      ux_optimization: { enabled: true, priority: "high", auto_fix: true },
      customer_journey: { enabled: true, priority: "high", auto_fix: false },
      dashboard_evolution: { enabled: true, priority: "high", auto_fix: false },
      routing_quality: { enabled: true, priority: "medium", auto_fix: true },
      stripe_business: { enabled: true, priority: "critical", auto_fix: false }
    }
  },
  thresholds: {
    critical_threshold: 90,
    high_threshold: 70,
    medium_threshold: 50,
    low_threshold: 0,
    wcag_aa_required: true,
    color_contrast_ratio_min: 4.5
  },
  reporting: {
    findings_format: "both",
    include_recommendations: true,
    include_auto_fixes: true,
    deduplication_enabled: true,
    sort_by_severity: true
  }
};
