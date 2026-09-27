create extension if not exists pgcrypto;

create type public.app_role as enum ('owner', 'administrator', 'bookkeeper');

create type public.document_kind as enum (
  'billing',
  'quotation',
  'acknowledgement',
  'contract'
);

comment on type public.app_role is 'Fixed workspace roles enforced by RLS and Edge Functions.';
comment on type public.document_kind is 'Document kinds; business payloads are encrypted before persistence.';
