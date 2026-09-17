import { PartCondition, PartStatus, PaymentMethod, ExpenseCategory } from "@/generated/prisma/enums";

export const partConditionLabels: Record<PartCondition, string> = {
  [PartCondition.NEW]: "Nueva",
  [PartCondition.USED_GOOD]: "Usada - Buena",
  [PartCondition.USED_FAIR]: "Usada - Regular",
  [PartCondition.FOR_PARTS]: "Para refacción",
};

export const partStatusLabels: Record<PartStatus, string> = {
  [PartStatus.AVAILABLE]: "Disponible",
  [PartStatus.RESERVED]: "Reservada",
  [PartStatus.SOLD]: "Vendida",
  [PartStatus.IN_REVIEW]: "En revisión",
};

export const partStatusBadgeVariant: Record<PartStatus, "default" | "secondary" | "destructive" | "outline"> = {
  [PartStatus.AVAILABLE]: "default",
  [PartStatus.RESERVED]: "secondary",
  [PartStatus.SOLD]: "destructive",
  [PartStatus.IN_REVIEW]: "outline",
};

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  [PaymentMethod.CASH]: "Efectivo",
  [PaymentMethod.CARD]: "Tarjeta",
  [PaymentMethod.TRANSFER]: "Transferencia",
  [PaymentMethod.OTHER]: "Otro",
};

export const expenseCategoryLabels: Record<ExpenseCategory, string> = {
  [ExpenseCategory.DISMANTLING_LABOR]: "Mano de obra / desmantelaje",
  [ExpenseCategory.TRANSPORT]: "Transporte",
  [ExpenseCategory.WAREHOUSE]: "Bodega",
  [ExpenseCategory.UTILITIES]: "Servicios",
  [ExpenseCategory.TOOLS]: "Herramientas",
  [ExpenseCategory.OTHER]: "Otro",
};

export const sourceVehicleStatusLabels: Record<string, string> = {
  IN_PROGRESS: "En proceso",
  DISMANTLED: "Desmantelado",
  ARCHIVED: "Archivado",
};
