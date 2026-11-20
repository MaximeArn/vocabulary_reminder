/**
 * UUID version 5 (RFC 9562) : toujours le même identifiant pour le même nom.
 * Sert aux fiches créées automatiquement (départements) : deux appareils du même
 * compte créent la même fiche, sans doublon à la synchronisation.
 */
export async function uuidV5(name: string, namespace: string): Promise<string> {
  const namespaceBytes = Uint8Array.from(namespace.replace(/-/g, "").match(/../g)!.map((byte) => parseInt(byte, 16)));
  const nameBytes = new TextEncoder().encode(name);
  const input = new Uint8Array(namespaceBytes.length + nameBytes.length);
  input.set(namespaceBytes);
  input.set(nameBytes, namespaceBytes.length);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-1", input)).slice(0, 16);
  hash[6] = (hash[6]! & 0x0f) | 0x50; // version 5
  hash[8] = (hash[8]! & 0x3f) | 0x80; // variante RFC
  const hex = [...hash].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
