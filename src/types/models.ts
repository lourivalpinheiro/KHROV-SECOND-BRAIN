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
  /** Preenchida quando a nota está na lixeira (soft delete) — null = ativa. */
  deletedAt: string | null;
  /** Marca a nota como um "índice de assunto" — ver BacklinksPanel. */
  isHub: boolean;
  /** Publicada como página pública sem login, em /p/[shareToken]. */
  isPublished: boolean;
  shareToken: string | null;
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

/** Uma "foto" do content da nota tirada quando ela deixou pra trás um estágio do pipeline — ver NoteStageHistory. */
export type NoteStageHistoryDTO = {
  id: string;
  stage: "STIMULUS" | "POTENTIATION" | "SYNAPSE" | "ENGRAM";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content: any;
  createdAt: string;
  /** true = reconstruída num backfill (nota já estava além de Estímulo antes da feature existir) — não é histórico real, é aproximação com o content atual. */
  isEstimate: boolean;
};

export type NoteDetail = NoteListItem & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content: any;
  attachments: AttachmentDTO[];
  stageHistory: NoteStageHistoryDTO[];
};
