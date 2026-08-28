export type FolderDTO = {
  id: string;
  name: string;
  parentId: string | null;
  _count?: { notes: number };
};

export type TagDTO = {
  id: string;
  name: string;
  _count?: { notes: number };
};

export type NoteListItem = {
  id: string;
  title: string;
  plainText: string;
  folderId: string | null;
  folder?: FolderDTO | null;
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
