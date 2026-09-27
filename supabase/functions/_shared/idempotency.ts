export class RepositoryConflictError extends Error {
  constructor() {
    super("Document revision conflict.");
    this.name = "RepositoryConflictError";
  }
}

export function nextRevision(revision: number): number {
  if (!Number.isInteger(revision) || revision < 1) throw new Error("Revision must be a positive integer.");
  return revision + 1;
}

export function assertMutationResult<T>(row: T | null): T {
  if (!row) throw new RepositoryConflictError();
  return row;
}
