"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Loader2, PackageSearch } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { partConditionLabels, partStatusBadgeVariant, partStatusLabels } from "@/lib/labels";
import type { Category } from "@/generated/prisma/client";

type PartUnit = {
  id: string;
  sku: string;
  condition: string;
  status: string;
  price: string;
  location: string | null;
  sourceVehicle: { brand: string; model: string; year: number } | null;
};

type Compatibility = {
  id: string;
  brand: string;
  model: string;
  yearFrom: number;
  yearTo: number;
};

type PartTypeResult = {
  id: string;
  name: string;
  category: { id: string; name: string };
  compatibilities: Compatibility[];
  parts: PartUnit[];
};

const STATUS_OPTIONS = [
  { value: "AVAILABLE", label: "Disponibles" },
  { value: "ALL", label: "Todos los estados" },
  { value: "RESERVED", label: "Reservadas" },
  { value: "SOLD", label: "Vendidas" },
  { value: "IN_REVIEW", label: "En revisión" },
];

export function SearchClient({ categories }: { categories: Category[] }) {
  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState<string>("ALL");
  const [status, setStatus] = useState<string>("AVAILABLE");
  const [results, setResults] = useState<PartTypeResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    if (categoryId !== "ALL") p.set("categoryId", categoryId);
    if (status) p.set("status", status);
    return p.toString();
  }, [q, categoryId, status]);

  useEffect(() => {
    const hasFilter = q.trim() || categoryId !== "ALL";
    if (!hasFilter) {
      setResults(null);
      setSearched(false);
      return;
    }

    setLoading(true);
    const timeout = setTimeout(() => {
      fetch(`/api/search?${params}`)
        .then((res) => res.json())
        .then((data) => {
          setResults(data.results ?? []);
          setSearched(true);
        })
        .finally(() => setLoading(false));
    }, 250);

    return () => clearTimeout(timeout);
  }, [params, q, categoryId]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ej: alternador corolla 2014, freno civic, MOT-000123…"
              className="pl-10 h-12 text-base"
            />
            {loading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-5 animate-spin text-muted-foreground" />
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <Select
              value={categoryId}
              onValueChange={(value) => setCategoryId(value ?? "ALL")}
              items={{ ALL: "Todas las categorías", ...Object.fromEntries(categories.map((c) => [c.id, c.name])) }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas las categorías</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={status}
              onValueChange={(value) => setStatus(value ?? "AVAILABLE")}
              items={Object.fromEntries(STATUS_OPTIONS.map((o) => [o.value, o.label]))}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {searched && results && results.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
          <PackageSearch className="size-10" />
          <p className="text-lg font-medium">No tenemos esa pieza</p>
          <p className="text-sm">Prueba con otro nombre, marca o modelo.</p>
        </div>
      )}

      {results && results.length > 0 && (
        <div className="space-y-3">
          {results.map((pt) => (
            <PartTypeCard key={pt.id} partType={pt} />
          ))}
        </div>
      )}
    </div>
  );
}

function PartTypeCard({ partType }: { partType: PartTypeResult }) {
  const availableCount = partType.parts.filter((p) => p.status === "AVAILABLE").length;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">{partType.name}</h3>
              <Badge variant="outline">{partType.category.name}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {partType.compatibilities.length > 0
                ? partType.compatibilities
                    .map((c) => `${c.brand} ${c.model} ${c.yearFrom}-${c.yearTo}`)
                    .join(" · ")
                : "Sin compatibilidad registrada"}
            </p>
          </div>
          <Badge className="text-sm" variant={availableCount > 0 ? "default" : "secondary"}>
            {availableCount > 0 ? `${availableCount} disponible${availableCount > 1 ? "s" : ""}` : "Sin stock disponible"}
          </Badge>
        </div>

        <div className="mt-4 divide-y">
          {partType.parts.map((part) => (
            <Link
              key={part.id}
              href={`/piezas/${part.id}`}
              className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm hover:bg-accent/50 -mx-2 px-2 rounded-md"
            >
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-muted-foreground">{part.sku}</span>
                <Badge variant={partStatusBadgeVariant[part.status as keyof typeof partStatusBadgeVariant]}>
                  {partStatusLabels[part.status as keyof typeof partStatusLabels]}
                </Badge>
                <span className="text-muted-foreground">
                  {partConditionLabels[part.condition as keyof typeof partConditionLabels]}
                </span>
                {part.location && <span className="text-muted-foreground">📍 {part.location}</span>}
              </div>
              <span className="font-semibold">{formatCurrency(part.price)}</span>
            </Link>
          ))}
          {partType.parts.length === 0 && (
            <p className="py-2 text-sm text-muted-foreground">No hay unidades con este filtro.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
