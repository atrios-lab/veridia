import { z } from "zod";

// What the platform types into the assessment forms, validated the same
// way in the browser and on the server.

export const questionFormSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(5, "Escreva o enunciado.")
    .max(500, "O enunciado passa de 500 caracteres."),
  options: z
    .array(
      z
        .string()
        .trim()
        .min(1, "Preencha as quatro alternativas.")
        .max(240, "Uma alternativa passa de 240 caracteres."),
    )
    .length(4, "São exatamente quatro alternativas."),
  correctIndex: z
    .number()
    .int()
    .min(0, "Marque a alternativa certa.")
    .max(3, "Marque a alternativa certa."),
});

export type QuestionFormInput = z.output<typeof questionFormSchema>;

export const assessmentSettingsSchema = z.object({
  passingScore: z
    .number()
    .int("Nota mínima inválida.")
    .min(1, "A nota mínima vai de 1 a 100.")
    .max(100, "A nota mínima vai de 1 a 100."),
  /** Null: the course gives no certificate (and has no assessment). */
  workloadHours: z
    .number()
    .int("Carga horária inválida.")
    .min(1, "A carga horária é de pelo menos 1 hora.")
    .max(200, "A carga horária passa de 200 horas.")
    .nullable(),
  retryHours: z
    .number()
    .int("Intervalo inválido.")
    .min(0, "O intervalo não pode ser negativo.")
    .max(168, "O intervalo passa de uma semana."),
});

export type AssessmentSettings = z.output<typeof assessmentSettingsSchema>;
