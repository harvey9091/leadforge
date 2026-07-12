/**
 * =============================================================================
 * Alert System — Phase 8
 * =============================================================================
 *
 * Configurable alert rules that monitor operational metrics and trigger
 * events when thresholds are exceeded. Supports webhooks for external
 * integrations.
 * =============================================================================
 */

import { db } from "@/lib/db";
import { logger } from "@/server/utils/logger";

export interface AlertRuleData {
  id: string;
  name: string;
  metric: string;
  condition: string;
  threshold: number;
  windowMinutes: number;
  isEnabled: boolean;
  webhookUrl: string | null;
  severity: string;
  lastTriggered: Date | null;
}

/**
 * Default alert rules — created on first run.
 */
const DEFAULT_RULES = [
  { name: "Discovery Worker Offline", metric: "worker.discovery.status", condition: "eq", threshold: 0, windowMinutes: 2, severity: "critical" },
  { name: "Enrichment Worker Offline", metric: "worker.enrichment.status", condition: "eq", threshold: 0, windowMinutes: 2, severity: "critical" },
  { name: "AI Worker Offline", metric: "worker.ai.status", condition: "eq", threshold: 0, windowMinutes: 2, severity: "critical" },
  { name: "Queue Backlog > 100", metric: "queue.depth", condition: "gt", threshold: 100, windowMinutes: 5, severity: "warning" },
  { name: "Crawl Failure Rate > 30%", metric: "crawl.failure_rate", condition: "gt", threshold: 30, windowMinutes: 10, severity: "warning" },
  { name: "AI Failure Rate > 20%", metric: "ai.failure_rate", condition: "gt", threshold: 20, windowMinutes: 10, severity: "warning" },
  { name: "API Latency p95 > 5s", metric: "api.latency_p95", condition: "gt", threshold: 5000, windowMinutes: 5, severity: "warning" },
  { name: "Circuit Breaker Open", metric: "ai.circuit_breaker", condition: "eq", threshold: 1, windowMinutes: 1, severity: "critical" },
];

/**
 * Initialize default alert rules (idempotent).
 */
export async function initializeDefaultAlerts(): Promise<void> {
  const count = await db.alertRule.count();
  if (count > 0) return;

  for (const rule of DEFAULT_RULES) {
    await db.alertRule.create({ data: rule });
  }
  logger.info("alerts.defaults.created", { count: DEFAULT_RULES.length });
}

/**
 * Evaluate all enabled alert rules against current metrics.
 */
export async function evaluateAlerts(currentMetrics: Record<string, number>): Promise<void> {
  const rules = await db.alertRule.findMany({ where: { isEnabled: true } });

  for (const rule of rules) {
    const value = currentMetrics[rule.metric];
    if (value === undefined) continue;

    const shouldTrigger = evaluateCondition(value, rule.condition, rule.threshold);
    if (!shouldTrigger) continue;

    // Check if this rule was triggered recently (within window)
    if (rule.lastTriggered) {
      const minutesSinceTrigger = (Date.now() - rule.lastTriggered.getTime()) / (1000 * 60);
      if (minutesSinceTrigger < rule.windowMinutes) continue; // Skip — already triggered recently
    }

    await triggerAlert(rule, value);
  }
}

function evaluateCondition(value: number, condition: string, threshold: number): boolean {
  switch (condition) {
    case "gt": return value > threshold;
    case "gte": return value >= threshold;
    case "lt": return value < threshold;
    case "lte": return value <= threshold;
    case "eq": return value === threshold;
    default: return false;
  }
}

async function triggerAlert(rule: { id: string; name: string; metric: string; threshold: number; severity: string; webhookUrl: string | null }, value: number): Promise<void> {
  const message = `${rule.name}: ${rule.metric} = ${value} (threshold: ${rule.threshold})`;

  // Create alert event
  await db.alertEvent.create({
    data: {
      ruleId: rule.id,
      ruleName: rule.name,
      metric: rule.metric,
      value,
      threshold: rule.threshold,
      severity: rule.severity,
      message,
    },
  });

  // Update last triggered
  await db.alertRule.update({
    where: { id: rule.id },
    data: { lastTriggered: new Date() },
  });

  logger.warn("alert.triggered", { rule: rule.name, metric: rule.metric, value, threshold: rule.threshold });

  // Send webhook if configured
  if (rule.webhookUrl) {
    try {
      await fetch(rule.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alert: rule.name,
          metric: rule.metric,
          value,
          threshold: rule.threshold,
          severity: rule.severity,
          message,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (err) {
      logger.error("alert.webhook.failed", { rule: rule.name, error: err instanceof Error ? err.message : String(err) });
    }
  }
}

/**
 * Get unacknowledged alerts.
 */
export async function getActiveAlerts(): Promise<Array<{
  id: string;
  ruleName: string;
  metric: string;
  value: number;
  threshold: number;
  severity: string;
  message: string;
  triggeredAt: Date;
}>> {
  return db.alertEvent.findMany({
    where: { isAcknowledged: false },
    orderBy: { triggeredAt: "desc" },
    take: 50,
  });
}

/**
 * Acknowledge an alert.
 */
export async function acknowledgeAlert(alertId: string): Promise<void> {
  await db.alertEvent.update({
    where: { id: alertId },
    data: { isAcknowledged: true, acknowledgedAt: new Date() },
  });
}

/**
 * Get alert statistics for the dashboard.
 */
export async function getAlertStats(): Promise<{
  totalRules: number;
  enabledRules: number;
  activeAlerts: number;
  criticalAlerts: number;
  todayAlerts: number;
}> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [totalRules, enabledRules, activeAlerts, criticalAlerts, todayAlerts] = await Promise.all([
    db.alertRule.count(),
    db.alertRule.count({ where: { isEnabled: true } }),
    db.alertEvent.count({ where: { isAcknowledged: false } }),
    db.alertEvent.count({ where: { isAcknowledged: false, severity: "critical" } }),
    db.alertEvent.count({ where: { triggeredAt: { gte: todayStart } } }),
  ]);

  return { totalRules, enabledRules, activeAlerts, criticalAlerts, todayAlerts };
}
