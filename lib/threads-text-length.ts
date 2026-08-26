export const THREADS_TEXT_LIMIT = 500;

export function countThreadsText(value: string): number {
  return Array.from(value).length;
}

export function validateThreadsTextLength(
  label: string,
  value: string | null | undefined,
  options: { required?: boolean; max?: number } = {},
): string | null {
  const text = value || '';
  const max = options.max ?? THREADS_TEXT_LIMIT;
  if (options.required && text.trim().length === 0) {
    return `${label}は必須です`;
  }
  const length = countThreadsText(text);
  if (length > max) {
    return `${label}は改行・空白込みで${length}文字です（上限${max}文字）`;
  }
  return null;
}

export function scheduledPostTextLengthErrors(input: {
  mainText: string;
  comment1?: string;
  comment2?: string;
  comment3?: string;
  comment4?: string;
  comment5?: string;
  comment6?: string;
  comment7?: string;
}): string[] {
  const fields = [
    { label: 'メイン投稿', value: input.mainText, required: true },
    { label: 'コメント1', value: input.comment1 },
    { label: 'コメント2', value: input.comment2 },
    { label: 'コメント3', value: input.comment3 },
    { label: 'コメント4', value: input.comment4 },
    { label: 'コメント5', value: input.comment5 },
    { label: 'コメント6', value: input.comment6 },
    { label: 'コメント7', value: input.comment7 },
  ];
  return fields.flatMap((field) => {
    const error = validateThreadsTextLength(field.label, field.value, { required: field.required });
    return error ? [error] : [];
  });
}
