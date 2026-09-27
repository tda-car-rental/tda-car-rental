alter table public.documents
  drop constraint if exists documents_encrypted_iv_check,
  drop constraint if exists documents_encrypted_payload_check;

alter table public.documents
  alter column encrypted_iv type text using encode(encrypted_iv, 'base64'),
  alter column encrypted_payload type text using encode(encrypted_payload, 'base64');

alter table public.documents
  add constraint documents_encrypted_iv_check
    check (encrypted_iv ~ '^[A-Za-z0-9+/]{16}$'),
  add constraint documents_encrypted_payload_check
    check (encrypted_payload ~ '^[A-Za-z0-9+/]+={0,2}$' and length(encrypted_payload) > 24);

comment on column public.documents.encrypted_iv is 'Base64 encoding of the 12-byte AES-256-GCM IV.';
comment on column public.documents.encrypted_payload is 'Base64 encoding of AES-256-GCM ciphertext with authentication tag.';
