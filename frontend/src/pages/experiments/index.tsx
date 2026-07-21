/* (c) 2026 AgentFlow-Eval — Experiment list (Phase 2) */

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  Card,
  Empty,
  Pagination,
  Space,
  Table,
  Tag,
  Typography,
  Alert,
} from "antd";
import {
  PlusOutlined,
  ReloadOutlined,
  ExperimentOutlined,
  BarChartOutlined,
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { experimentsApi, type Experiment } from "@/api/endpoints/experiments";
import { formatDateTime } from "@/utils/format";
import { Can } from "@/auth";

const { Text } = Typography;
const KEY = ["experiments"] as const;

function runsSummary(exp: Experiment): string {
  const runs = exp.runs || [];
  if (!runs.length) return "—";
  const labels = runs.map((r) => r.label).join(", ");
  return labels.length > 48 ? `${labels.slice(0, 48)}…` : labels;
}

function overallStatus(exp: Experiment): string {
  const statuses = (exp.runs || []).map((r) => r.task_status || "unknown");
  if (!statuses.length) return "—";
  if (statuses.every((s) => s === "completed")) return "completed";
  if (statuses.some((s) => s === "failed")) return "failed";
  if (statuses.some((s) => ["running", "queued", "judging"].includes(s || "")))
    return "running";
  return statuses[0] || "created";
}

export default function ExperimentListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const listQ = useQuery({
    queryKey: [...KEY, page, pageSize],
    queryFn: () => experimentsApi.list({ page, page_size: pageSize }),
    refetchInterval: (q) => {
      const items = q.state.data?.items ?? [];
      const live = items.some((e) =>
        (e.runs || []).some((r) =>
          ["running", "queued", "judging"].includes(r.task_status || "")
        )
      );
      return live ? 5000 : false;
    },
  });

  const columns = useMemo(
    () => [
      {
        title: "名称",
        dataIndex: "name",
        render: (name: string, row: Experiment) => (
          <Space direction="vertical" size={0}>
            <Button
              type="link"
              style={{ padding: 0, height: "auto", fontWeight: 600 }}
              onClick={() => navigate(`/experiments/${row.id}`)}
            >
              {name}
            </Button>
            {row.description ? (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {row.description.slice(0, 80)}
                {row.description.length > 80 ? "…" : ""}
              </Text>
            ) : null}
          </Space>
        ),
      },
      {
        title: "用例数",
        dataIndex: "suite_count",
        width: 88,
        align: "center" as const,
      },
      {
        title: "变体",
        key: "variants",
        width: 200,
        render: (_: unknown, row: Experiment) => (
          <Text style={{ fontSize: 12 }}>{runsSummary(row)}</Text>
        ),
      },
      {
        title: "状态",
        key: "status",
        width: 120,
        render: (_: unknown, row: Experiment) => {
          const st = overallStatus(row);
          return st === "—" ? <Tag>—</Tag> : <StatusBadge status={st} />;
        },
      },
      {
        title: "创建者",
        dataIndex: "created_by",
        width: 100,
        render: (v: string) => <Tag>{v || "anonymous"}</Tag>,
      },
      {
        title: "创建时间",
        dataIndex: "created_at",
        width: 160,
        render: (v: string | null | undefined) =>
          v ? formatDateTime(v) : "—",
      },
      {
        title: "操作",
        key: "actions",
        width: 140,
        render: (_: unknown, row: Experiment) => (
          <Space>
            <Button
              size="small"
              type="primary"
              ghost
              icon={<BarChartOutlined />}
              onClick={() => navigate(`/experiments/${row.id}`)}
            >
              对比
            </Button>
          </Space>
        ),
      },
    ],
    [navigate]
  );

  if (listQ.isLoading) {
    return <PageSkeleton variant="cards" />;
  }

  const items = listQ.data?.items ?? [];
  const total = listQ.data?.total ?? 0;

  return (
    <div className="ic-page af-page">
      <PageHeader
        title="对比实验"
        subtitle="同一套用例、多种 Agent 配置，并排比较分数与成本"
        icon={<ExperimentOutlined />}
        extra={
          <Space wrap>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => void listQ.refetch()}
              loading={listQ.isFetching}
            >
              刷新
            </Button>
            <Can perm="task:create">
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => navigate("/experiments/create")}
                style={{ background: "var(--af-gradient)", border: "none" }}
              >
                新建实验
              </Button>
            </Can>
          </Space>
        }
      />

      {listQ.isError && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="加载实验列表失败"
          description={(listQ.error as Error)?.message || "请检查后端与权限"}
        />
      )}

      <Card className="af-glass">
        {!items.length && !listQ.isError ? (
          <Empty
            description="暂无对比实验"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Can perm="task:create">
              <Button type="primary" onClick={() => navigate("/experiments/create")}>
                创建第一个实验
              </Button>
            </Can>
          </Empty>
        ) : (
          <>
            <Table
              rowKey="id"
              size="middle"
              columns={columns}
              dataSource={items}
              pagination={false}
            />
            <div style={{ marginTop: 16, textAlign: "right" }}>
              <Pagination
                current={page}
                pageSize={pageSize}
                total={total}
                showSizeChanger
                showTotal={(t) => `共 ${t} 个实验`}
                onChange={(p, ps) => {
                  setPage(p);
                  setPageSize(ps);
                }}
              />
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
