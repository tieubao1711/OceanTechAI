type StatusTranslator = {
  has: (key: string) => boolean;
  (key: string): string;
};

export function translateStatus(t: StatusTranslator, status: string): string {
  if (t.has(status)) return t(status);
  return status;
}
