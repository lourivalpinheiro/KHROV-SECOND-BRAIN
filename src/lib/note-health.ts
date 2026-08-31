import type { NoteListItem } from "@/types/models";

/** Estímulo com menos que isso de texto puro conta como "vazio" — criado (via [[link]] ou extração) mas nunca desenvolvido. */
export const EMPTY_STIMULUS_THRESHOLD = 20;

/** A partir de quantos Estímulos vazios acumulados, criar mais um passa a mostrar o aviso. */
export const EMPTY_STIMULUS_NUDGE_AT = 5;

export function isEmptyStimulus(note: Pick<NoteListItem, "type" | "plainText">): boolean {
  return note.type === "STIMULUS" && note.plainText.trim().length < EMPTY_STIMULUS_THRESHOLD;
}
