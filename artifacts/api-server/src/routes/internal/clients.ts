/**
 * Rotas internas de clientes.
 * GET   /internal/clients        — lista com contagem de projetos
 * GET   /internal/clients/:id    — cliente + projetos + usinas
 * POST  /internal/clients        — cria
 * PATCH /internal/clients/:id    — atualiza
 */
import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { clientsTable, projectsTable, plantsTable } from "@workspace/db/schema";
import { eq, asc, sql, and, ne } from "drizzle-orm";
import { z } from "zod/v4";

const router: IRouter = Router();

/** Só dígitos, sem DDI: "(85) 9 8888-7777" e "+5585988887777" viram o mesmo valor. */
export function normalizePhone(raw: string | null | undefined): string | null {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
  return d.length >= 10 ? d.slice(-11) : null;
}

const clientSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  phone: z.string().nullish(),
  email: z.string().nullish(),
  cpfCnpj: z.string().nullish(),
  address: z.string().nullish(),
  city: z.string().nullish(),
  state: z.string().nullish(),
  origem: z.string().nullish(),
  canalCaptacao: z.string().nullish(),
  observacoes: z.string().nullish(),
});

router.get("/clients", async (req, res) => {
  try {
    const rows = await db
      .select({
        id: clientsTable.id,
        name: clientsTable.name,
        phone: clientsTable.phone,
        phoneNormalized: clientsTable.phoneNormalized,
        email: clientsTable.email,
        cpfCnpj: clientsTable.cpfCnpj,
        address: clientsTable.address,
        city: clientsTable.city,
        state: clientsTable.state,
        origem: clientsTable.origem,
        canalCaptacao: clientsTable.canalCaptacao,
        observacoes: clientsTable.observacoes,
        createdAt: clientsTable.createdAt,
        // Subquery correlacionada: referencia as colunas cruas, porque interpolar
        // clientsTable.id aqui não gera a correlação e o count vira o total da tabela.
        projectCount: sql<number>`(select count(*)::int from projects where projects.client_id = clients.id)`,
      })
      .from(clientsTable)
      .orderBy(asc(clientsTable.name));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to list clients");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/clients/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, id));
    if (!client) {
      res.status(404).json({ message: "Cliente não encontrado" });
      return;
    }
    const projects = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.clientId, id))
      .orderBy(asc(projectsTable.id));
    const plants = await db
      .select()
      .from(plantsTable)
      .where(eq(plantsTable.clientId, id))
      .orderBy(asc(plantsTable.id));
    res.json({ client, projects, plants });
  } catch (err) {
    req.log.error({ err }, "Failed to get client");
    res.status(500).json({ message: "Internal server error" });
  }
});

/** 409 explícito em vez de deixar o índice único estourar erro cru. */
async function phoneTakenBy(phoneNormalized: string, exceptId?: number) {
  const cond = exceptId
    ? and(eq(clientsTable.phoneNormalized, phoneNormalized), ne(clientsTable.id, exceptId))
    : eq(clientsTable.phoneNormalized, phoneNormalized);
  const [row] = await db.select({ id: clientsTable.id, name: clientsTable.name }).from(clientsTable).where(cond).limit(1);
  return row;
}

router.post("/clients", async (req, res) => {
  try {
    const parsed = clientSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Dados inválidos", errors: parsed.error.issues });
      return;
    }
    const phoneNormalized = normalizePhone(parsed.data.phone);
    if (phoneNormalized) {
      const taken = await phoneTakenBy(phoneNormalized);
      if (taken) {
        res.status(409).json({ message: `Telefone já cadastrado para "${taken.name}"`, clientId: taken.id });
        return;
      }
    }
    const [client] = await db
      .insert(clientsTable)
      .values({ ...parsed.data, phoneNormalized, origem: parsed.data.origem ?? "manual" })
      .returning();
    res.status(201).json(client);
  } catch (err) {
    req.log.error({ err }, "Failed to create client");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.patch("/clients/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const parsed = clientSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Dados inválidos", errors: parsed.error.issues });
      return;
    }
    const patch: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };
    if (parsed.data.phone !== undefined) {
      const phoneNormalized = normalizePhone(parsed.data.phone);
      if (phoneNormalized) {
        const taken = await phoneTakenBy(phoneNormalized, id);
        if (taken) {
          res.status(409).json({ message: `Telefone já cadastrado para "${taken.name}"`, clientId: taken.id });
          return;
        }
      }
      patch.phoneNormalized = phoneNormalized;
    }
    const [client] = await db.update(clientsTable).set(patch).where(eq(clientsTable.id, id)).returning();
    if (!client) {
      res.status(404).json({ message: "Cliente não encontrado" });
      return;
    }
    res.json(client);
  } catch (err) {
    req.log.error({ err }, "Failed to update client");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
