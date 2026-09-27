create index documents_workspace_kind_updated_idx
  on public.documents (workspace_id, document_kind, updated_at desc, id desc)
  where deleted_at is null;

create index documents_workspace_updated_idx
  on public.documents (workspace_id, updated_at desc, id desc)
  where deleted_at is null;

create index documents_workspace_revision_idx
  on public.documents (workspace_id, id, revision);

create index documents_workspace_deleted_updated_idx
  on public.documents (workspace_id, deleted_at, updated_at desc, id desc);
