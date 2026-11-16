import { describe, expect, it } from "vitest";
import {
  allNodeDefinitions,
  getNodeDefinition,
  getSpecificNodeType,
} from "@/contracts/bots";
import { BOT_TEMPLATES } from "./botTemplates";

const knownTypes = new Set(allNodeDefinitions.map((d) => d.type));

describe("BOT_TEMPLATES", () => {
  it("tem ids únicos e metadados preenchidos", () => {
    const ids = BOT_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of BOT_TEMPLATES) {
      expect(t.name.trim().length).toBeGreaterThan(0);
      expect(t.tagline.trim().length).toBeGreaterThan(0);
      expect(t.description.trim().length).toBeGreaterThan(0);
      expect(t.suggestedName.trim().length).toBeGreaterThan(0);
    }
  });

  it("gera fluxos válidos: nós conhecidos, arestas ligadas e gatilhos conectados", () => {
    expect(BOT_TEMPLATES.length).toBeGreaterThan(0);
    for (const template of BOT_TEMPLATES) {
      const flow = template.build();
      expect(flow.version).toBeGreaterThan(0);
      expect(flow.nodes.length).toBeGreaterThan(0);

      const nodeIds = new Set(flow.nodes.map((n) => n.id));
      const triggers = flow.nodes.filter(
        (n) => n.data.category === "trigger",
      );
      expect(
        triggers.length,
        `${template.id} precisa de ao menos um gatilho`,
      ).toBeGreaterThan(0);

      for (const edge of flow.edges) {
        expect(nodeIds.has(edge.source)).toBe(true);
        expect(nodeIds.has(edge.target)).toBe(true);
      }

      for (const node of flow.nodes) {
        const type = getSpecificNodeType(node.data);
        expect(
          knownTypes.has(type),
          `${template.id}: tipo desconhecido ${type}`,
        ).toBe(true);
        const def = getNodeDefinition(type);
        expect(def).toBeDefined();

        const incoming = flow.edges.filter((e) => e.target === node.id);
        const outgoing = flow.edges.filter((e) => e.source === node.id);
        if (node.data.category === "trigger" && flow.nodes.length > 1) {
          expect(
            outgoing.length,
            `${template.id}: gatilho ${node.id} sem saída`,
          ).toBeGreaterThan(0);
        }
        if (node.data.category === "action") {
          expect(
            incoming.length,
            `${template.id}: ação ${node.id} sem entrada`,
          ).toBeGreaterThan(0);
        }

        // Espelha a validação do BotFlowEditor: campos obrigatórios preenchidos.
        const config = (node.data.config ?? {}) as Record<string, unknown>;
        for (const field of def?.configSchema ?? []) {
          if (
            field.required &&
            (config[field.key] === undefined || config[field.key] === "")
          ) {
            throw new Error(
              `${template.id}: campo obrigatório "${field.key}" vazio no nó ${node.id}`,
            );
          }
        }
      }
    }
  });

  it("build() retorna objetos novos a cada chamada", () => {
    const first = BOT_TEMPLATES[0].build();
    const second = BOT_TEMPLATES[0].build();
    expect(first).not.toBe(second);
    expect(first.nodes).not.toBe(second.nodes);
    expect(first.nodes[0]).not.toBe(second.nodes[0]);
    expect(first.nodes[0].data).not.toBe(second.nodes[0].data);
  });
});
