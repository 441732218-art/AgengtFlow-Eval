/* (c) 2026 AgentFlow-Eval — Create multi-variant experiment (Phase 2) */

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
  message,
  Divider,
} from "antd";
import {
  ArrowLeftOutlined,
  ExperimentOutlined,
  PlusOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/PageHeader";
import { experimentsApi } from "@/api/endpoints/experiments";
import { taskApi } from "@/api/endpoints/tasks";

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

type VariantForm = {
  label: string;
  runner: "openai" | "http";
  model?: string;
  endpoint_url?: string;
  temperature?: number;
};

export default function ExperimentCreatePage() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [variants, setVariants] = useState<VariantForm[]>([
    { label: "baseline", runner: "openai", model: "gpt-4o-mini", temperature: 0 },
    { label: "candidate", runner: "openai", model: "gpt-4o", temperature: 0 },
  ]);

  const tasksQ = useQuery({
    queryKey: ["tasks", "for-experiment"],
    queryFn: () => taskApi.list({ page: 1, page_size: 50 }),
  });

  const taskOptions = useMemo(
    () =>
      (tasksQ.data?.items ?? []).map((t) => ({
        value: t.id,
        label: `${t.name} (${t.id.slice(0, 8)}…)`,
      })),
    [tasksQ.data]
  );

  const createMut = useMutation({
    mutationFn: experimentsApi.create,
    onSuccess: (exp) => {
      message.success("实验已创建，变体任务已排队");
      navigate(`/experiments/${exp.id}`);
    },
    onError: (e: any) => {
      const msg =
        e?.response?.data?.error?.message || e?.message || "创建失败";
      message.error(msg);
    },
  });

  const updateVariant = (index: number, patch: Partial<VariantForm>) => {
    setVariants((prev) =>
      prev.map((v, i) => (i === index ? { ...v, ...patch } : v))
    );
  };

  const addVariant = () => {
    setVariants((prev) => [
      ...prev,
      {
        label: `variant-${prev.length + 1}`,
        runner: "openai",
        model: "gpt-4o-mini",
        temperature: 0,
      },
    ]);
  };

  const removeVariant = (index: number) => {
    setVariants((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const onFinish = (values: {
    name: string;
    description?: string;
    base_task_id?: string;
    auto_execute?: boolean;
  }) => {
    if (!values.base_task_id) {
      message.warning("请选择作为用例来源的基础任务");
      return;
    }
    const labels = variants.map((v) => v.label.trim());
    if (labels.some((l) => !l)) {
      message.warning("每个变体需要标签");
      return;
    }
    if (new Set(labels).size !== labels.length) {
      message.warning("变体标签必须唯一");
      return;
    }
    for (const v of variants) {
      if (v.runner === "http" && !(v.endpoint_url || "").trim()) {
        message.warning(`变体 ${v.label} 选择了 HTTP，请填写 endpoint_url`);
        return;
      }
    }

    const body = {
      name: values.name,
      description: values.description || "",
      base_task_id: values.base_task_id,
      auto_execute: values.auto_execute !== false,
      variants: variants.map((v) => ({
        label: v.label.trim(),
        agent_config:
          v.runner === "http"
            ? {
                runner: "http",
                endpoint_url: (v.endpoint_url || "").trim(),
                timeout_sec: 60,
                method: "POST",
                verify_ssl: true,
              }
            : {
                runner: "openai",
                model: v.model || "gpt-4o-mini",
                temperature: v.temperature ?? 0,
              },
      })),
    };
    createMut.mutate(body);
  };

  return (
    <div className="ic-page af-page">
      <PageHeader
        title="新建对比实验"
        subtitle="从已有任务复制用例，为每个变体生成独立 Task 并排队执行"
        icon={<ExperimentOutlined />}
        extra={
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/experiments")}>
            返回列表
          </Button>
        }
      />

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16, borderRadius: 10 }}
        message="工作原理"
        description="选择一个已有任务作为用例来源（suite snapshot）。每个变体会克隆相同用例、使用不同 agent_config，执行后在对比页查看分数与 Token。"
      />

      <Card className="af-glass">
        <Form
          form={form}
          layout="vertical"
          initialValues={{ auto_execute: true }}
          onFinish={onFinish}
        >
          <Form.Item
            name="name"
            label="实验名称"
            rules={[{ required: true, message: "请输入名称" }]}
          >
            <Input placeholder="例如：GPT-4o vs mini 同用例对比" size="large" maxLength={255} />
          </Form.Item>

          <Form.Item name="description" label="描述">
            <TextArea rows={2} placeholder="可选：对比目标、业务背景" />
          </Form.Item>

          <Form.Item
            name="base_task_id"
            label="基础任务（用例来源）"
            rules={[{ required: true, message: "请选择任务" }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="选择已有评测任务"
              loading={tasksQ.isLoading}
              options={taskOptions}
              size="large"
              notFoundContent={
                tasksQ.isError ? "加载任务失败" : "暂无任务，请先创建任务并添加用例"
              }
            />
          </Form.Item>

          <Form.Item
            name="auto_execute"
            label="创建后立即执行"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Divider orientation="left">变体（至少 1 个）</Divider>

          <Space direction="vertical" style={{ width: "100%" }} size={16}>
            {variants.map((v, index) => (
              <Card
                key={index}
                size="small"
                title={
                  <Space>
                    <Text strong>变体 #{index + 1}</Text>
                    <Tag color={v.runner === "http" ? "purple" : "blue"}>
                      {v.runner}
                    </Tag>
                  </Space>
                }
                extra={
                  variants.length > 1 ? (
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => removeVariant(index)}
                    />
                  ) : null
                }
              >
                <Space direction="vertical" style={{ width: "100%" }} size={12}>
                  <div>
                    <Text type="secondary">标签</Text>
                    <Input
                      value={v.label}
                      onChange={(e) => updateVariant(index, { label: e.target.value })}
                      placeholder="baseline / gpt-4o / http-v1"
                      style={{ marginTop: 4 }}
                    />
                  </div>
                  <div>
                    <Text type="secondary">Runner</Text>
                    <Select
                      style={{ width: "100%", marginTop: 4 }}
                      value={v.runner}
                      onChange={(runner) => updateVariant(index, { runner })}
                      options={[
                        { value: "openai", label: "OpenAI / ReAct" },
                        { value: "http", label: "HTTP Agent" },
                      ]}
                    />
                  </div>
                  {v.runner === "openai" ? (
                    <>
                      <div>
                        <Text type="secondary">Model</Text>
                        <Input
                          style={{ marginTop: 4 }}
                          value={v.model}
                          onChange={(e) =>
                            updateVariant(index, { model: e.target.value })
                          }
                          placeholder="gpt-4o-mini"
                        />
                      </div>
                      <div>
                        <Text type="secondary">Temperature</Text>
                        <InputNumber
                          style={{ width: "100%", marginTop: 4 }}
                          min={0}
                          max={2}
                          step={0.1}
                          value={v.temperature ?? 0}
                          onChange={(n) =>
                            updateVariant(index, { temperature: n ?? 0 })
                          }
                        />
                      </div>
                    </>
                  ) : (
                    <div>
                      <Text type="secondary">Endpoint URL</Text>
                      <Input
                        style={{ marginTop: 4 }}
                        value={v.endpoint_url}
                        onChange={(e) =>
                          updateVariant(index, { endpoint_url: e.target.value })
                        }
                        placeholder="https://agent.example.com/v1/invoke"
                      />
                      <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 4 }}>
                        需公网可达；内网地址会被 SSRF 拦截。
                      </Paragraph>
                    </div>
                  )}
                </Space>
              </Card>
            ))}
          </Space>

          <Button
            type="dashed"
            block
            icon={<PlusOutlined />}
            style={{ marginTop: 16 }}
            onClick={addVariant}
          >
            添加变体
          </Button>

          <Space style={{ marginTop: 24 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={createMut.isPending}
              size="large"
              style={{ background: "var(--af-gradient)", border: "none" }}
            >
              创建并开始对比
            </Button>
            <Button size="large" onClick={() => navigate("/experiments")}>
              取消
            </Button>
          </Space>
        </Form>
      </Card>
    </div>
  );
}
