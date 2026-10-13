import { Router } from "express";
import { get, save, pushEvent } from "../store.js";

const EV = (zh, en) => ({ zh, en });

export default function endpointsRouter() {
  const r = Router();
  r.get("/", (req, res) => {
    const s = get();
    res.json({
      endpoints: s.endpoints,
      totalRequests: s.endpoints.reduce((a, x) => a + x.requests, 0),
    });
  });

  // scale / playground / logs，对齐原型 runAction 中的 endpoint 分支
  r.post("/:id/action", (req, res) => {
    const s = get();
    const x = s.endpoints.find((e) => e.id === req.params.id);
    if (!x) return res.status(404).json({ error: "endpoint not found" });
    const { action, min, max, prompt, lang } = req.body || {};

    if (action === "scale") {
      const mn = Number(min), mx = Number(max);
      if (mn < 0 || mx < 1 || mn > mx) return res.status(400).json({ error: "副本配置无效 / Invalid replica config" });
      x.min = mn; x.max = mx;
      x.replicas = Math.max(mn, Math.min(mx, x.replicas));
      x.status = x.replicas === 0 ? "scaled-zero" : "healthy";
      pushEvent("info", EV(`${x.name} 扩缩容策略更新为 ${mn}–${mx} 副本`, `${x.name} scaling policy updated to ${mn}–${mx} replicas`));
      save();
      return res.json({ ok: true, endpoint: x });
    }
    if (action === "playground") {
      const text = prompt || "你好";
      x.requests += 1;
      save();
      const zh = "这是一个模拟的推理响应。你输入的问题是：" + text + "。真实 Endpoint 会调用已部署的 GPU 推理容器。";
      const en = "This is a simulated inference response. Your input was: " + text + ". A real endpoint calls the deployed GPU inference container.";
      return res.json({
        ok: true,
        response: {
          id: "chatcmpl-demo",
          object: "chat.completion",
          model: x.model,
          choices: [{ message: { role: "assistant", content: lang === "en" ? en : zh } }],
          usage: { prompt_tokens: 26, completion_tokens: 48, total_tokens: 74 },
        },
      });
    }
    if (action === "logs") {
      return res.json({
        ok: true,
        logs: [
          `[INFO] request accepted /v1/${x.name}/chat/completions`,
          `[INFO] model loaded from shared cache (region=${x.region || "-"})`,
          `[INFO] worker=replica-${Math.max(1, x.replicas)} tokens=156 latency=${x.p95 || 120}ms`,
          `[INFO] autoscaler target replicas=${x.replicas}`,
        ].join("\n"),
      });
    }
    if (action === "curl") {
      return res.json({
        ok: true,
        curl: `curl https://api.runsuncloud.example/v1/${x.name}/chat/completions -H "Authorization: Bearer DEMO_API_KEY" -H "Content-Type: application/json" -d "{\\"model\\":\\"${x.model}\\",\\"messages\\":[{\\"role\\":\\"user\\",\\"content\\":\\"Hello\\"}]}"`,
      });
    }
    return res.status(400).json({ error: "unknown action" });
  });
  return r;
}
