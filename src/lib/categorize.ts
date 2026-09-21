const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "Motor": ["motor", "cabezote", "culata", "biela", "piston", "pistón", "block", "cigüeñal", "cigueñal", "correa", "distribucion", "distribución", "bomba de agua", "bomba de aceite", "inyector", "bujia", "bujía", "carburador", "refrigerante", "termostato", "canister", "admision", "admisión", "múltiple", "multiple", "flauta", "depurador", "electro", "radiador"],
  "Eléctrico": ["arnes", "arnés", "computadora", "fusible", "sensor", "modulo", "módulo", "switch", "swicht", "bateria", "batería", "alternador", "marcha", "foco", "luz", "luces", "radio", "bocina", "cable", "uch", "encendido", "llave", "cilindro"],
  "Suspensión": ["amortiguador", "resorte", "rotula", "rótula", "terminal", "mesa", "rodamiento", "maza", "muelle"],
  "Frenos": ["freno", "disco", "pastilla", "mordaza", "bombin", "bombín"],
  "Transmisión": ["caja de cambios", "embrague", "clutch", "diferencial", "cardan", "cardán", "palanca de cambios", "sincronico"],
  "Carrocería": ["guardachoque", "capot", "puerta", "guardafango", "parabrisas", "vidrio", "compuerta", "chasis", "faro", "espejo", "retrovisor", "costado", "chapa", "cerradura", "guardapolvo", "parachoque", "techo", "aro", "llanta", "neblinero", "parante", "visagra", "bisagra"],
  "Interior": ["tapiceria", "tapicería", "asiento", "alfombra", "consola", "tablero", "guantera", "cinturon", "cinturón", "cenicero", "palanca de freno de mano", "apoyabrazos", "moldura", "elevavidrio", "manija", "jaladera", "parlante", "visera", "portagafas", "portavasos", "volante"],
  "Escape": ["silenciador", "escape", "catalizador"],
  "Chatarra": ["chatarra"],
};

export function inferCategory(description: string): string {
  const lower = description.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((k) => lower.includes(k))) return category;
  }
  return "Otro";
}
