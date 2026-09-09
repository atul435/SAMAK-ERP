import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";

interface Hit {
  id: string;
  label: string;
  sub: string;
  to: string;
}

export function GlobalSearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [term, setTerm] = useState("");
  const [projects, setProjects] = useState<Hit[]>([]);
  const [clients, setClients] = useState<Hit[]>([]);
  const [leads, setLeads] = useState<Hit[]>([]);
  const [documents, setDocuments] = useState<Hit[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const q = term.trim();
    const handle = setTimeout(async () => {
      const like = `%${q}%`;
      const [p, c, l, d] = await Promise.all([
        supabase
          .from("projects")
          .select("id, project_code, name, city")
          .or(q ? `name.ilike.${like},project_code.ilike.${like}` : "id.not.is.null")
          .limit(6),
        supabase
          .from("clients")
          .select("id, client_code, name, sector")
          .or(q ? `name.ilike.${like},client_code.ilike.${like}` : "id.not.is.null")
          .limit(6),
        supabase
          .from("leads")
          .select("id, lead_code, title, stage")
          .or(q ? `title.ilike.${like},lead_code.ilike.${like}` : "id.not.is.null")
          .limit(6),
        supabase
          .from("documents")
          .select("id, title, doc_type")
          .or(q ? `title.ilike.${like}` : "id.not.is.null")
          .limit(6),
      ]);
      setProjects(
        (p.data ?? []).map((r) => ({
          id: r.id,
          label: r.name,
          sub: `${r.project_code} · ${r.city ?? ""}`,
          to: `/projects/${r.id}`,
        })),
      );
      setClients(
        (c.data ?? []).map((r) => ({
          id: r.id,
          label: r.name,
          sub: `${r.client_code} · ${r.sector ?? ""}`,
          to: `/crm/clients`,
        })),
      );
      setLeads(
        (l.data ?? []).map((r) => ({
          id: r.id,
          label: r.title,
          sub: `${r.lead_code} · ${r.stage}`,
          to: `/crm/leads`,
        })),
      );
      setDocuments(
        (d.data ?? []).map((r) => ({
          id: r.id,
          label: r.title,
          sub: r.doc_type,
          to: `/documents`,
        })),
      );
    }, 200);
    return () => clearTimeout(handle);
  }, [term, open]);

  function go(to: string) {
    onOpenChange(false);
    void navigate({ to });
  }

  const groups: Array<[string, Hit[]]> = [
    ["Projects", projects],
    ["Clients", clients],
    ["Leads", leads],
    ["Documents", documents],
  ];

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search across the ERP…"
        value={term}
        onValueChange={setTerm}
      />
      <CommandList>
        <CommandEmpty>No matching records.</CommandEmpty>
        {groups.map(([name, hits]) =>
          hits.length ? (
            <CommandGroup key={name} heading={name}>
              {hits.map((h) => (
                <CommandItem key={h.id} value={`${name}-${h.label}-${h.id}`} onSelect={() => go(h.to)}>
                  <span className="truncate">{h.label}</span>
                  <span className="ml-auto truncate text-xs text-muted-foreground">{h.sub}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null,
        )}
      </CommandList>
    </CommandDialog>
  );
}
