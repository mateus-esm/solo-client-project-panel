import { Router, type IRouter, type Request, type Response } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { resolveSession } from "../lib/auth";
import { db } from "@workspace/db";
import { projectsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

const STEP_NAMES: Record<number, string> = {
  1: "Onboarding",
  2: "Projeto Técnico",
  3: "Homologação",
  4: "Logística",
  5: "Execução",
  6: "Ativação",
  7: "Treinamento",
};

router.post("/chat", async (req: Request, res: Response) => {
  const sessionToken = req.cookies?.solo_session;
  if (!sessionToken) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  const session = await resolveSession(sessionToken);
  if (!session) {
    res.status(401).json({ error: "Sessão expirada" });
    return;
  }

  const { messages } = req.body as { messages?: { role: string; content: string }[] };
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "Mensagens inválidas" });
    return;
  }

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, session.projectId));

  const stepName = project ? (STEP_NAMES[project.statusStep] ?? "Desconhecida") : "Desconhecida";
  const systemPrompt = `Você é a assistente virtual da Solo Energia, uma empresa brasileira de energia solar.
Você fala exclusivamente em português do Brasil, é amigável, técnica mas acessível.

Contexto do cliente:
- Nome: ${project?.clientName ?? "Cliente"}
- Fase atual: ${stepName} (etapa ${project?.statusStep ?? 1} de 7)
- Potência do sistema: ${project?.systemPower ?? 0} kWp
- Cidade: ${project?.city ?? "não informada"}
- Previsão de ativação: ${project?.estimatedActivation ?? "em análise"}

Você pode responder perguntas sobre:
- O processo de instalação solar da Solo Energia (7 etapas)
- Energia solar fotovoltaica em geral
- Status do projeto do cliente com base no contexto acima
- Homologação, concessionária, geração de energia, compensação de créditos

Você NÃO pode:
- Alterar o status do projeto
- Acessar informações fora do contexto fornecido
- Fazer promessas de prazo que não estejam no contexto

Seja objetivo, empático e use linguagem acessível.`;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const chatMessages = [
      { role: "system" as const, content: systemPrompt },
      ...messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    ];

    const stream = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: chatMessages,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    req.log.error({ err }, "AI chat error");
    if (!res.headersSent) {
      res.status(500).json({ error: "Erro ao processar mensagem" });
    } else {
      res.write(`data: ${JSON.stringify({ error: "Erro ao processar mensagem" })}\n\n`);
      res.end();
    }
  }
});

export default router;
