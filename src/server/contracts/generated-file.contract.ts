import { z } from "zod";
import { ValidationError } from "@/server/errors/validation-error";

export const GeneratedFileContract = z.object({
  path: z.string().min(1),
  content: z.string().min(1),
  mimeType: z.string().default("text/markdown"),
});

export type GeneratedFileContractType = z.infer<typeof GeneratedFileContract>;

export function parseGeneratedFile(data: unknown): GeneratedFileContractType {
  const result = GeneratedFileContract.safeParse(data);
  if (!result.success) {
    throw new ValidationError(
      "INVALID_GENERATED_FILE",
      "Generated file failed contract validation.",
      result.error.flatten()
    );
  }
  return result.data;
}

export function parseGeneratedFiles(data: unknown[]): GeneratedFileContractType[] {
  return data.map(parseGeneratedFile);
}
