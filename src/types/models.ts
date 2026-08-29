export type TagDTO = {
  id: string;
  name: string;
  _count?: { notes: number };
};

export type NoteListItem = {
  id: string;
  title: string;
  plainText: string;
  type: "CORTEX" | "STIMULUS" | "POTENTIATION" | "SYNAPSE" | "ENGRAM";
  synthesisText: string | null;
  /** Preenchida só nas notas de Sessão (Córtex) — uma por dia por usuário. */
  dailyDate: string | null;
  updatedAt: string;
  createdAt: string;
  tags: { tag: TagDTO }[];
};

export type AttachmentDTO = {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: string;
};

export type NoteDetail = NoteListItem & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content: any;
  attachments: AttachmentDTO[];
};
