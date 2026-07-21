/* (c) 2026 AgentFlow-Eval — Experiment detail + compare table (Phase 2) */

import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  Spin,
} from "antd";
import {
  ArrowLeftOutlined,
  ExperimentOutlined,
  ReloadOutlined,
  TrophyOutlined,
  LinkOutlined,
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  experimentsApi,
  type RunCompareItem,
} from "@/api/endpoints/experiments";
import { formatDateTime } from "@/utils/format";

const { Text, Title } = Typography;

function isLiveStatus(s?: string | null) {
  return ["running", "queued", "judging", "created"].includes(s || "");
}

/** Approximate “coverage / success proxy” from backend fields (no contract change). */
function scoreCoverage(row: RunCompareItem): string {
  if (!row.suite_count) return "—";
  const pct = Math.round((row.scored_traces / row.suite_count) * 100);
  return `${row.scored_traces}/${row.suite_count} (${pct}%)`;
}

function formatMs(ms: number): string {
  if (!ms) return "0";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

export default function ExperimentDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const detailQ = useQuery({
    queryKey: ["experiments", id],
    queryFn: () => experimentsApi.get(id),
    enabled: !!id,
    refetchInterval: (q) => {
      const runs = q.state.data?.runs ?? [];
      return runs.some((r) => isLiveStatus(r.task_status)) ? 4000 : false;
    },
  });

  const compareQ = useQuery({
    queryKey: ["experiments", id, "compare"],
    queryFn: () => experimentsApi.compare(id),
    enabled: !!id,
    refetchInterval: () => {
      // Also refresh compare while any run still live (from detail)
      const runs = detailQ.data?.runs ?? [];
      return runs.some((r) => isLiveStatus(r.task_status)) ? 5000 : false;
    },
  });

  const dimKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const r of compareQ.data?.runs ?? []) {
      Object.keys(r.dimension_scores || {}).forEach((k) => keys.add(k));
    }
    return Array.from(keys).sort();
  }, [compareQ.data]);

  const columns = useMemo(() => {
    const base = [
      {
        title: "变体",
        dataIndex: "label",
        fixed: "left" as const,
        width: 140,
        render: (label: string) => {
          const isBest = compareQ.data?.best_label === label;
          return (
            <Space>
              <Text strong>{label}</Text>
              {isBest ? (
                <Tag color="gold" icon={<TrophyOutlined />}>
                  Best
                </Tag>
              ) : null}
            </Space>
          );
        },
      },
      {
        title: "任务状态",
        dataIndex: "task_status",
        width: 110,
        render: (s: string) => <StatusBadge status={s || "unknown"} />,
      },
      {
        title: "平均分",
        dataIndex: "average_score",
        width: 100,
        sorter: (a: RunCompareItem, b: RunCompareItem) =>
          a.average_score - b.average_score,
        defaultSortOrder: "descend" as const,
        render: (v: number, row: RunCompareItem) => {
          const isBest = compareQ.data?.best_label === row.label;
          return (
            <Text strong style={{ color: isBest ? "var(--af-primary)" : undefined }}>
              {Number(v).toFixed(1)}
            </Text>
          );
        },
      },
      {
        title: "Δ vs Best",
        key: "delta",
        width: 100,
        render: (_: unknown, row: RunCompareItem) => {
          const d = compareQ.data?.delta_vs_best?.[row.label];
          if (d === undefined || d === null) return "—";
          const color = d === 0 ? "default" : d > 0 ? "success" : "error";
          const text = d > 0 ? `+${d.toFixed(1)}` : d.toFixed(1);
          return <Tag color={color}>{text}</Tag>;
        },
      },
      {
        title: "评分覆盖",
        key: "coverage",
        width: 120,
        render: (_: unknown, row: RunCompareItem) => scoreCoverage(row),
      },
      {
        title: "Tokens",
        dataIndex: "total_tokens",
        width: 100,
        render: (v: number) => v?.toLocaleString?.() ?? v,
      },
      {
        title: "总耗时",
        dataIndex: "total_time_ms",
        width: 100,
        render: (v: number) => formatMs(v || 0),
      },
      ...dimKeys.map((dim) => ({
        title: dim,
        key: `dim-${dim}`,
        width: 100,
        render: (_: unknown, row: RunCompareItem) => {
          const v = row.dimension_scores?.[dim];
          return v === undefined ? "—" : Number(v).toFixed(1);
        },
      })),
      {
        title: "任务",
        key: "task",
        width: 100,
        fixed: "right" as const,
        render: (_: unknown, row: RunCompareItem) => (
          <Button
            type="link"
            size="small"
            icon={<LinkOutlined />}
            onClick={() => navigate(`/tasks/${row.task_id}`)}
          >
            打开
          </Button>
        ),
      },
    ];
    return base;
  }, [compareQ.data, dimKeys, navigate]);

  if (!id) {
    return <Alert type="error" message="缺少实验 ID" />;
  }

  if (detailQ.isLoading) {
    return <PageSkeleton variant="detail" />;
  }

  if (detailQ.isError || !detailQ.data) {
    return (
      <div className="ic-page af-page">
        <Alert
          type="error"
          showIcon
          message="无法加载实验"
          description={(detailQ.error as Error)?.message || "实验不存在或无权限"}
          action={
            <Button onClick={() => navigate("/experiments")}>返回列表</Button>
          }
        />
      </div>
    );
  }

  const exp = detailQ.data;
  const compare = compareQ.data;
  const best = compare?.best_label;
  const bestRun = compare?.runs?.find((r) => r.label === best);

  return (
    <div className="ic-page af-page">
      <PageHeader
        title={exp.name}
        subtitle={
          exp.description ||
          `用例 ${exp.suite_count} · 变体 ${exp.runs?.length || 0} · ${exp.created_by}`
        }
        icon={<ExperimentOutlined />}
        extra={
          <Space wrap>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/experiments")}>
              列表
            </Button>
            <Button
              icon={<ReloadOutlined />}
              loading={detailQ.isFetching || compareQ.isFetching}
              onClick={() => {
                void detailQ.refetch();
                void compareQ.refetch();
              }}
            >
              刷新
            </Button>
          </Space>
        }
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card className="af-glass" size="small">
            <Statistic title="用例数" value={exp.suite_count} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="af-glass" size="small">
            <Statistic title="变体数" value={exp.runs?.length || 0} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="af-glass" size="small">
            <Statistic
              title="当前最佳"
              value={best || "—"}
              prefix={best ? <TrophyOutlined /> : undefined}
              suffix={
                bestRun ? (
                  <Text type="secondary" style={{ fontSize: 14 }}>
                    {" "}
                    · {bestRun.average_score.toFixed(1)} 分
                  </Text>
                ) : null
              }
            />
          </Card>
        </Col>
      </Row>

      <Card
        className="af-glass"
        style={{ marginBottom: 16 }}
        title="变体运行状态"
        extra={
          <Text type="secondary" style={{ fontSize: 12 }}>
            创建于 {exp.created_at ? formatDateTime(exp.created_at) : "—"}
          </Text>
        }
      >
        <Table
          size="small"
          rowKey="id"
          pagination={false}
          dataSource={exp.runs || []}
          columns={[
            { title: "标签", dataIndex: "label" },
            {
              title: "状态",
              dataIndex: "task_status",
              render: (s: string) => <StatusBadge status={s || "unknown"} />,
            },
            {
              title: "Runner",
              key: "runner",
              render: (_: unknown, r) => {
                const cfg = r.agent_config || {};
                const runner = String(cfg.runner || cfg.model || "openai");
                return <Tag>{runner}</Tag>;
              },
            },
            {
              title: "任务 ID",
              dataIndex: "task_id",
              render: (tid: string) => (
                <Button type="link" size="small" onClick={() => navigate(`/tasks/${tid}`)}>
                  {tid.slice(0, 8)}…
                </Button>
              ),
            },
          ]}
        />
      </Card>

      <Card
        className="af-glass"
        title={
          <Space>
            <Title level={5} style={{ margin: 0 }}>
              对比结果
            </Title>
            {compareQ.isFetching ? <Spin size="small" /> : null}
          </Space>
        }
      >
        {compareQ.isLoading ? (
          <PageSkeleton variant="cards" />
        ) : compareQ.isError ? (
          <Alert
            type="error"
            showIcon
            message="对比数据加载失败"
            description={
              (compareQ.error as any)?.response?.data?.error?.message ||
              (compareQ.error as Error)?.message ||
              "需要 evaluation:read 权限，或后端暂不可用"
            }
          />
        ) : !(compare?.runs?.length) ? (
          <Empty description="暂无对比数据，请等待变体任务完成评分" />
        ) : (
          <>
            <Alert
              type="success"
              showIcon
              style={{ marginBottom: 16, borderRadius: 10 }}
              message={
                best
                  ? `当前最高分变体：${best}（平均分 ${bestRun?.average_score.toFixed(1) ?? "—"}）`
                  : "尚无足够评分数据"
              }
              description="评分覆盖 = 已有 MetricScore 的 Trace 数 / 用例数。Δ vs Best 为相对最高平均分的差值。"
            />
            <Table
              size="middle"
              rowKey="task_id"
              scroll={{ x: 900 + dimKeys.length * 100 }}
              dataSource={compare.runs}
              columns={columns}
              pagination={false}
            />
          </>
        )}
      </Card>
    </div>
  );
}
